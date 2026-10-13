// GoCuotas: cuotas sin interés con tarjeta de débito (pago con redirección, "API Redirect V1").
// 1) Con el mail y la contraseña de la cuenta de comercio se pide un token.
// 2) Se crea un "checkout" por el total del pedido y se manda a la clienta a la página de GoCuotas.
// 3) GoCuotas avisa el resultado al webhook (status = approved) y vuelve a la tienda.
// Las credenciales quedan en el servidor (nunca viajan al navegador).
const crypto = require('crypto');
const pool = require('../config/database');
const { porNegocio, schemaActual } = require('./contexto');

const API = (process.env.GOCUOTAS_API_BASE || 'https://www.gocuotas.com/api_redirect/v1').replace(/\/+$/, '');

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gocuotas_config (id INT PRIMARY KEY DEFAULT 1, email TEXT, password TEXT, actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  listo.set(true);
}

async function credenciales() {
  await asegurar();
  const r = (await pool.query('SELECT email, password FROM gocuotas_config WHERE id = 1')).rows[0];
  return r && r.email && r.password ? r : null;
}
const conectado = async () => !!(await credenciales().catch(() => null));

async function llamar(metodo, ruta, { token, body } = {}) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || d.message || ('GoCuotas respondió ' + r.status)); e.status = r.status; throw e; }
  return d;
}

async function token(cred) {
  const c = cred || await credenciales();
  if (!c) throw new Error('GoCuotas no está conectado');
  const d = await llamar('POST', '/authentication', { body: { email: c.email, password: c.password } });
  if (!d.token) throw new Error('GoCuotas no devolvió el acceso (revisá el mail y la contraseña)');
  return d.token;
}

// Prueba las credenciales y las guarda si andan
async function conectar(email, password) {
  const cred = { email: String(email || '').trim().slice(0, 120), password: String(password || '').slice(0, 200) };
  if (!cred.email || !cred.password) throw new Error('Escribí el mail y la contraseña de tu cuenta de comercio de GoCuotas');
  await token(cred);
  await asegurar();
  await pool.query(`INSERT INTO gocuotas_config (id, email, password, actualizado_en) VALUES (1, $1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, actualizado_en = NOW()`, [cred.email, cred.password]);
}
async function desconectar() { await asegurar(); await pool.query('DELETE FROM gocuotas_config WHERE id = 1'); }

// Firma del webhook de cada pedido: el aviso de GoCuotas solo se acepta con la firma correcta
const firma = (codigo) => crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'lumiere')).update('gocuotas:' + schemaActual() + ':' + codigo).digest('hex').slice(0, 32);
const firmaOk = (codigo, f) => { const a = Buffer.from(firma(codigo)), b = Buffer.from(String(f || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// Crea el cobro y devuelve la direccion de GoCuotas a la que se manda a la clienta
async function crearCheckout({ total, codigo, urlOk, urlFalla, webhook, email }) {
  const tok = await token();
  const q = new URLSearchParams({ amount_in_cents: String(Math.round(Number(total) * 100)), order_reference_id: 'tienda-' + codigo, url_success: urlOk, url_failure: urlFalla, webhook_url: webhook });
  if (email) q.set('email', email);
  const d = await llamar('POST', '/checkouts?' + q.toString(), { token: tok });
  if (!d.url_init) throw new Error('GoCuotas no devolvió el link de pago');
  return d.url_init;
}

module.exports = { asegurar, credenciales, conectado, conectar, desconectar, crearCheckout, firma, firmaOk };
