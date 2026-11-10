// Cliente mínimo de Mercado Pago (Suscripciones: "preapproval"). Cobra con tarjeta de crédito o débito, solo y en cada
// período, hasta que el cliente cancele.
//   MP_ACCESS_TOKEN    clave secreta de la aplicación de Mercado Pago (se carga en las variables de Railway, nunca en el código)
//   MP_WEBHOOK_SECRET  "clave secreta" de las notificaciones (Webhooks › Configurar notificaciones) para verificar la firma
//   MP_API_URL         solo para pruebas: dirección del Mercado Pago simulado (por defecto, el real)
const crypto = require('crypto');

const base = () => process.env.MP_API_URL || 'https://api.mercadopago.com';
const configurado = () => !!process.env.MP_ACCESS_TOKEN;

async function api(metodo, ruta, cuerpo) {
  const r = await fetch(base() + ruta, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let datos = null; try { datos = texto ? JSON.parse(texto) : null; } catch (e) { datos = { raw: texto }; }
  if (!r.ok) { const err = new Error('Mercado Pago respondió ' + r.status + ': ' + (datos && (datos.message || datos.error) || texto).toString().slice(0, 200)); err.status = r.status; err.datos = datos; throw err; }
  return datos;
}

// Crea la suscripción y devuelve { id, init_point }: la dirección de Mercado Pago a la que se manda al cliente a pagar
async function crearSuscripcion({ email, razon, monto, meses, referencia, volver }) {
  const d = await api('POST', '/preapproval', {
    reason: razon, external_reference: referencia, payer_email: email || undefined, back_url: volver, status: 'pending',
    auto_recurring: { frequency: meses, frequency_type: 'months', transaction_amount: monto, currency_id: 'ARS' },
  });
  return { id: d.id, init_point: d.init_point };
}
const obtenerSuscripcion = (id) => api('GET', '/preapproval/' + encodeURIComponent(id));
const obtenerCobro = (id) => api('GET', '/authorized_payments/' + encodeURIComponent(id));
const cancelarSuscripcion = (id) => api('PUT', '/preapproval/' + encodeURIComponent(id), { status: 'cancelled' });

// Verifica que el aviso (webhook) lo mandó Mercado Pago: firma HMAC-SHA256 de "id:<id>;request-id:<x-request-id>;ts:<ts>;"
function firmaValida(req, dataId) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return true; // sin clave configurada no se puede verificar (igual se vuelve a consultar el dato a Mercado Pago)
  const cab = String(req.headers['x-signature'] || '');
  const ts = (cab.match(/(?:^|,)\s*ts=([^,]+)/) || [])[1], v1 = (cab.match(/(?:^|,)\s*v1=([^,]+)/) || [])[1];
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifiesto = 'id:' + id + ';request-id:' + (req.headers['x-request-id'] || '') + ';ts:' + ts + ';';
  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1)); } catch (e) { return false; }
}

module.exports = { configurado, crearSuscripcion, obtenerSuscripcion, obtenerCobro, cancelarSuscripcion, firmaValida };
