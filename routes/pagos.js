const express = require('express');
const router = express.Router();
const negocios = require('../lib/negocios');
const planes = require('../lib/planes');
const mp = require('../lib/mercadopago');

// Cobro de la suscripción con Mercado Pago (tarjeta de crédito o débito, cobro automático en cada período).
// Cómo funciona:
//   1. La ventana de pago llama a POST /iniciar con el plan y el período. Se crea la suscripción en Mercado Pago y se le
//      devuelve al cliente la dirección donde carga su tarjeta.
//   2. Cuando Mercado Pago cobra, avisa a POST /webhook. El servidor NO confía en el aviso: le vuelve a preguntar a Mercado
//      Pago (con la clave secreta) qué pasó, controla el monto y recién ahí activa la cuenta por un período más.
//   3. En cada renovación llega otro aviso y se suma otro período. Si un cobro falla, quedan unos días de gracia y después
//      la cuenta pasa a solo lectura hasta que se pague.
const esDueno = (req) => !!req.usuario && (req.usuario.rol === 'jefe' || Number(req.usuario.rol_id) === 1);
const APP = process.env.APP_URL || 'https://app.sistemalumiere.com';

// "lum:<negocio>:<plan>:<periodo>": lo que viaja en la suscripción para saber de quién es
const armarReferencia = (negocioId, plan, periodo) => ['lum', negocioId, plan, periodo].join(':');
function leerReferencia(ref) {
  const m = String(ref || '').match(/^lum:(\d+):([a-z]+):([a-z]+)$/);
  return m ? { negocioId: Number(m[1]), plan: m[2], periodo: m[3] } : null;
}

// Qué planes y precios hay, y cómo está la cuenta (para la ventana de pago)
router.get('/planes', async (req, res) => {
  try {
    const n = req.negocio;
    res.json({
      configurado: mp.configurado(), planes: planes.catalogo(), gracia_dias: negocios.GRACIA_DIAS,
      cuenta: negocios.resumen(n), puede_pagar: esDueno(req), pagos: await negocios.pagosDe(n.id),
    });
  } catch (e) { console.error('[pagos] planes:', e.message); res.status(500).json({ error: 'No se pudieron cargar los planes' }); }
});

// El cliente eligió plan y período: se abre la suscripción en Mercado Pago y se le da la dirección para pagar
router.post('/iniciar', async (req, res) => {
  try {
    if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño puede activar o cambiar el plan' });
    if (!mp.configurado()) return res.status(503).json({ error: 'El pago online todavía no está habilitado. Escribinos a hola@sistemalumiere.com y lo activamos en el momento.', sin_configurar: true });
    const { plan, periodo } = req.body || {};
    const pr = planes.precio(plan, periodo);
    if (!pr) return res.status(400).json({ error: 'Elegí un plan y cómo querés pagar' });
    const n = req.negocio;
    const s = await mp.crearSuscripcion({
      email: req.usuario.email || n.email_contacto, razon: 'Lumiere ' + planes.PLANES[plan].nombre + ' (' + planes.PERIODOS[periodo].etiqueta + ')',
      monto: pr.total, meses: pr.meses, referencia: armarReferencia(n.id, plan, periodo), volver: APP + '/?pago=volvio',
    });
    await negocios.guardarSuscripcion(n.id, { id: s.id, estado: 'pending' });
    res.json({ ok: true, url: s.init_point, monto: pr.total });
  } catch (e) {
    console.error('[pagos] iniciar:', e.message);
    res.status(502).json({ error: 'No pudimos abrir el pago con Mercado Pago. Probá de nuevo en un momento.' });
  }
});

// Cancelar la renovación automática (sigue activa hasta el día que ya pagó)
router.post('/cancelar', async (req, res) => {
  try {
    if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño puede cancelar la renovación' });
    const n = req.negocio;
    if (!n.mp_suscripcion_id) return res.status(400).json({ error: 'No hay una renovación automática para cancelar' });
    if (mp.configurado()) await mp.cancelarSuscripcion(n.mp_suscripcion_id);
    await negocios.guardarSuscripcion(n.id, { estado: 'cancelled' });
    res.json({ ok: true, cuenta: negocios.resumen(await negocios.negocioPorId(n.id)) });
  } catch (e) { console.error('[pagos] cancelar:', e.message); res.status(502).json({ error: 'No se pudo cancelar. Probá de nuevo o escribinos a hola@sistemalumiere.com' }); }
});

// Aviso de Mercado Pago (público, sin sesión)
router.post('/webhook', async (req, res) => {
  const tipo = String((req.body && (req.body.type || req.body.topic)) || req.query.type || req.query.topic || '');
  const id = (req.body && req.body.data && req.body.data.id) || req.query['data.id'] || req.query.id || (req.body && req.body.id);
  if (!id) return res.status(200).json({ ok: true, ignorado: true });
  if (!mp.firmaValida(req, id)) { console.warn('[pagos] aviso con firma inválida'); return res.status(401).json({ error: 'firma' }); }
  if (!mp.configurado()) return res.status(200).json({ ok: true, ignorado: true });
  try {
    if (/authorized_payment/.test(tipo)) {
      // Un cobro de la suscripción
      const c = await mp.obtenerCobro(id);
      const aprobado = c && (c.status === 'processed' || (c.payment && c.payment.status === 'approved')) && !(c.payment && c.payment.status && c.payment.status !== 'approved');
      if (!aprobado) return res.status(200).json({ ok: true, pendiente: true });
      const s = await mp.obtenerSuscripcion(c.preapproval_id);
      const ref = leerReferencia(s.external_reference);
      if (!ref) { console.warn('[pagos] cobro sin referencia conocida'); return res.status(200).json({ ok: true, ignorado: true }); }
      const esperado = planes.precio(ref.plan, ref.periodo);
      const monto = Number(c.transaction_amount || (c.payment && c.payment.transaction_amount) || s.auto_recurring && s.auto_recurring.transaction_amount);
      if (!esperado || Math.abs(monto - esperado.total) > 0.5) { console.error('[pagos] monto inesperado', monto, 'esperado', esperado && esperado.total, 'negocio', ref.negocioId); return res.status(200).json({ ok: true, monto_inesperado: true }); }
      const r = await negocios.aplicarCobro({ negocioId: ref.negocioId, cobroId: c.id || id, suscripcionId: s.id, monto, plan: ref.plan, periodo: ref.periodo, meses: esperado.meses });
      await negocios.guardarSuscripcion(ref.negocioId, { id: s.id, estado: s.status });
      console.log('[pagos] cobro aplicado negocio', ref.negocioId, ref.plan, ref.periodo, r.repetido ? '(repetido)' : '');
    } else if (/preapproval|subscription/.test(tipo)) {
      // Cambió el estado de la suscripción (autorizada, pausada, cancelada)
      const s = await mp.obtenerSuscripcion(id);
      const ref = leerReferencia(s.external_reference);
      if (ref) await negocios.guardarSuscripcion(ref.negocioId, { id: s.id, estado: s.status });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    // Con error 500 Mercado Pago vuelve a mandar el aviso más tarde
    console.error('[pagos] webhook:', e.message);
    res.status(500).json({ error: 'reintentar' });
  }
});

module.exports = router;
