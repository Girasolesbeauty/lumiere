const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Cobro con QR de Mercado Pago desde el Punto de Venta.
// Cada negocio pega su Access Token (credenciales de produccion de su cuenta de Mercado Pago).
// Al cobrar se crea un link de pago por el importe exacto y se muestra como QR en pantalla:
// el cliente lo escanea con el celular y paga. El Punto de Venta pregunta cada pocos segundos
// si ya se pago (busca el pago por la referencia) y recien ahi registra la venta.
// El token nunca se manda al navegador.

const API_MP = process.env.MP_API_BASE || 'https://api.mercadopago.com';

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS mp_config (
    id INT PRIMARY KEY DEFAULT 1,
    access_token TEXT,
    cuenta_id TEXT,
    cuenta_nombre TEXT,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS mp_cobros (
    id SERIAL PRIMARY KEY,
    referencia TEXT NOT NULL UNIQUE,
    monto NUMERIC(14,2) NOT NULL,
    descripcion TEXT,
    preference_id TEXT,
    link TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    payment_id TEXT,
    medio TEXT,
    local_id INT,
    usuario_id INT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    pagado_en TIMESTAMP)`);
  await pool.query('ALTER TABLE medios_pago ADD COLUMN IF NOT EXISTS mp_qr BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query('ALTER TABLE mp_cobros ADD COLUMN IF NOT EXISTS ultimo_intento TEXT');
  listo.set(true);
}

const esJefe = (req) => req.usuario && ['jefe', 'admin'].includes(req.usuario.rol);

async function token() {
  const r = await pool.query('SELECT access_token FROM mp_config WHERE id = 1');
  return r.rows[0] && r.rows[0].access_token ? r.rows[0].access_token : null;
}

// Llamada a la API de Mercado Pago
async function mp(tok, metodo, ruta, body) {
  const r = await fetch(API_MP + ruta, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const err = new Error((data && (data.message || data.error)) || ('HTTP ' + r.status));
    err.status = r.status;
    throw err;
  }
  return data;
}

async function medioMP() {
  const r = await pool.query('SELECT * FROM medios_pago WHERE mp_qr ORDER BY activo DESC, id LIMIT 1');
  return r.rows[0] || null;
}

// Si esta conectado y con que cuenta
router.get('/estado', async (req, res) => {
  try {
    await asegurar();
    const c = (await pool.query('SELECT cuenta_id, cuenta_nombre, access_token IS NOT NULL AS conectado, actualizado_en FROM mp_config WHERE id = 1')).rows[0];
    const m = await medioMP();
    res.json({
      conectado: !!(c && c.conectado), cuenta: c ? c.cuenta_nombre : null, cuenta_id: c ? c.cuenta_id : null,
      medio_pago_id: m && m.activo ? m.id : null, comision: m ? parseFloat(m.comision) || 0 : null,
    });
  } catch (e) {
    console.error('[mercadopago] estado:', e.message);
    res.status(500).json({ error: 'No se pudo leer la conexión con Mercado Pago' });
  }
});

// Conectar: valida el token con Mercado Pago, lo guarda y crea el medio de pago "Mercado Pago (QR)"
router.post('/conectar', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede conectar Mercado Pago' });
    await asegurar();
    const tok = String((req.body && req.body.access_token) || '').trim();
    if (!/^(APP_USR|TEST)-[\w-]{20,}$/.test(tok)) return res.status(400).json({ error: 'Ese no parece un Access Token de Mercado Pago (empieza con APP_USR-…)' });
    let yo;
    try { yo = await mp(tok, 'GET', '/users/me'); }
    catch (e) { return res.status(400).json({ error: e.status === 401 || e.status === 403 ? 'Mercado Pago no aceptó ese Access Token. Revisá que sea el de producción y esté completo.' : 'No se pudo conectar con Mercado Pago: ' + e.message }); }
    const nombre = yo.nickname || yo.email || ('Cuenta ' + yo.id);
    await pool.query(`INSERT INTO mp_config (id, access_token, cuenta_id, cuenta_nombre, actualizado_en) VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET access_token = EXCLUDED.access_token, cuenta_id = EXCLUDED.cuenta_id, cuenta_nombre = EXCLUDED.cuenta_nombre, actualizado_en = NOW()`,
      [tok, String(yo.id || ''), nombre]);
    const m = await medioMP();
    if (m) await pool.query('UPDATE medios_pago SET activo = TRUE WHERE id = $1', [m.id]);
    else await pool.query(`INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online, mp_qr)
                           VALUES ('Mercado Pago (QR)', 'plataforma', 1, FALSE, 1.0, 0, TRUE, FALSE, TRUE)`);
    res.json({ ok: true, cuenta: nombre });
  } catch (e) {
    console.error('[mercadopago] conectar:', e.message);
    res.status(500).json({ error: 'No se pudo guardar la conexión' });
  }
});

router.post('/desconectar', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede desconectar Mercado Pago' });
    await asegurar();
    await pool.query('UPDATE mp_config SET access_token = NULL, actualizado_en = NOW() WHERE id = 1');
    await pool.query('UPDATE medios_pago SET activo = FALSE WHERE mp_qr');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo desconectar' }); }
});

// Nuevo cobro: crea el link de pago por el importe y devuelve el QR para mostrar
router.post('/cobros', async (req, res) => {
  try {
    await asegurar();
    const tok = await token();
    if (!tok) return res.status(400).json({ error: 'Mercado Pago no está conectado. Conectalo en Configuración → Medios de pago.' });
    const monto = Math.round((parseFloat(req.body && req.body.monto) || 0) * 100) / 100;
    if (!(monto > 0)) return res.status(400).json({ error: 'El importe tiene que ser mayor a cero' });
    const cfg = (await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const descripcion = String((req.body && req.body.descripcion) || ('Compra en ' + (cfg.nombre_negocio || 'el local'))).slice(0, 200);
    const referencia = 'lumiere-' + crypto.randomUUID();
    const vence = new Date(Date.now() + 60 * 60 * 1000);
    const pref = await mp(tok, 'POST', '/checkout/preferences', {
      // Datos que Mercado Pago recomienda mandar: sin ellos su control antifraude rechaza mas pagos
      items: [{ id: 'venta-local', title: descripcion, description: descripcion, category_id: 'others', quantity: 1, unit_price: monto, currency_id: 'ARS' }],
      statement_descriptor: String(cfg.nombre_negocio || 'LUMIERE').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 13) || 'LUMIERE',
      external_reference: referencia,
      expires: true,
      expiration_date_to: vence.toISOString().replace('Z', '-00:00'),
    });
    const link = pref.init_point;
    const r = await pool.query(
      `INSERT INTO mp_cobros (referencia, monto, descripcion, preference_id, link, local_id, usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [referencia, monto, descripcion, pref.id, link, parseInt(req.body.local_id) || 1, (req.usuario && req.usuario.id) || null]);
    const qr = await QRCode.toDataURL(link, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
    res.status(201).json({ id: r.rows[0].id, monto, link, qr });
  } catch (e) {
    console.error('[mercadopago] cobro:', e.message);
    res.status(502).json({ error: e.status === 401 ? 'Mercado Pago rechazó el Access Token: volvé a conectarlo en Configuración.' : 'No se pudo crear el cobro en Mercado Pago: ' + e.message });
  }
});

// Estado del cobro: pregunta a Mercado Pago si ya hay un pago aprobado con esa referencia
router.get('/cobros/:id', async (req, res) => {
  try {
    await asegurar();
    const c = (await pool.query('SELECT * FROM mp_cobros WHERE id = $1', [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No se encontró el cobro' });
    if (c.estado !== 'pendiente') return res.json({ estado: c.estado, payment_id: c.payment_id, medio: c.medio });
    const tok = await token();
    if (!tok) return res.json({ estado: 'pendiente' });
    const busq = await mp(tok, 'GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + encodeURIComponent(c.referencia));
    const pagos = (busq && busq.results) || [];
    const aprobado = pagos.find(p => p.status === 'approved' && Math.abs((parseFloat(p.transaction_amount) || 0) - parseFloat(c.monto)) < 0.01);
    if (aprobado) {
      const medio = [aprobado.payment_type_id, aprobado.payment_method_id].filter(Boolean).join(' / ');
      await pool.query(`UPDATE mp_cobros SET estado='aprobado', payment_id=$1, medio=$2, pagado_en=NOW() WHERE id=$3 AND estado='pendiente'`, [String(aprobado.id), medio, c.id]);
      return res.json({ estado: 'aprobado', payment_id: String(aprobado.id), medio });
    }
    const ultimo = pagos[0];
    if (ultimo) {
      const txt = [ultimo.status, ultimo.status_detail, ultimo.payment_method_id].filter(Boolean).join(' / ');
      await pool.query('UPDATE mp_cobros SET ultimo_intento = $1 WHERE id = $2', [txt, c.id]).catch(() => {});
    }
    res.json({ estado: 'pendiente', intento: ultimo ? { status: ultimo.status, detalle: ultimo.status_detail, medio: ultimo.payment_method_id, id: ultimo.id } : null });
  } catch (e) {
    // Si Mercado Pago no responde, se sigue esperando (el POS vuelve a preguntar)
    console.error('[mercadopago] estado cobro:', e.message);
    res.json({ estado: 'pendiente', error: 'Sin respuesta de Mercado Pago, reintentando…' });
  }
});

// Ultimos cobros (para ver que paso con cada uno)
router.get('/cobros', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query('SELECT id, monto, estado, payment_id, medio, ultimo_intento, creado_en, pagado_en FROM mp_cobros ORDER BY id DESC LIMIT 30');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los cobros' }); }
});

router.post('/cobros/:id/cancelar', async (req, res) => {
  try {
    await asegurar();
    await pool.query(`UPDATE mp_cobros SET estado='cancelado' WHERE id=$1 AND estado='pendiente'`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo cancelar' }); }
});

module.exports = router;
// Para la tienda web: crear links de pago y consultar pagos con la cuenta del negocio
module.exports.ayudaMP = { mp, token, asegurar, medioMP };
