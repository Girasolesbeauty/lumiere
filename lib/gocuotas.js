// GoCuotas: cuotas sin interés con tarjeta de débito (pago con redirección, "API Redirect V1").
// 1) Con el mail y la contraseña de la cuenta de comercio se pide un token.
// 2) Se crea un "checkout" por el total del pedido y se manda a la clienta a la página de GoCuotas.
// 3) GoCuotas avisa el resultado al webhook (status = approved) y vuelve a la tienda.
// Las credenciales quedan en el servidor (nunca viajan al navegador).
const crypto = require('crypto');
const pool = require('../config/database');
const { porNegocio, schemaActual } = require('./contexto');

// Direcciones conocidas de la API (la de la documentacion y la que usan las integraciones de Magento).
// Al conectar se prueban en orden y se guarda la que anduvo.
const BASES = (process.env.GOCUOTAS_API_BASE ? [process.env.GOCUOTAS_API_BASE] : ['https://www.gocuotas.com/api_redirect/v1', 'https://api-magento.gocuotas.com/api_redirect/v1'])
  .map(x => x.replace(/\/+$/, ''));

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gocuotas_config (id INT PRIMARY KEY DEFAULT 1, email TEXT, password TEXT, actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`ALTER TABLE gocuotas_config ADD COLUMN IF NOT EXISTS base TEXT`);
  await pool.query(`ALTER TABLE gocuotas_config ADD COLUMN IF NOT EXISTS campo TEXT`); // 'email' o 'dni': con que se identifica
  listo.set(true);
}

async function credenciales() {
  await asegurar();
  const r = (await pool.query('SELECT email, password, base, campo FROM gocuotas_config WHERE id = 1')).rows[0];
  return r && r.email && r.password ? r : null;
}
const conectado = async () => !!(await credenciales().catch(() => null));

// Error con un motivo claro (para mostrarle a la dueña que paso)
const errorGC = (motivo, status) => { const e = new Error(motivo); e.status = status; return e; };
async function llamar(base, metodo, ruta, { token, body, form } = {}) {
  let r;
  try {
    r = await fetch(base + ruta, {
      method: metodo,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
    });
  } catch (e) { throw errorGC('no se pudo llegar a GoCuotas (' + (e.name === 'TimeoutError' ? 'no respondió a tiempo' : 'sin conexión') + ')', 0); }
  const texto = await r.text();
  let d = null; try { d = JSON.parse(texto); } catch (e) {}
  if (!r.ok) {
    const msj = d && (d.error || d.message || (Array.isArray(d.errors) ? d.errors.join(', ') : d.errors));
    if (r.status === 401 || r.status === 403 || r.status === 422) throw errorGC('no aceptó el mail y la contraseña' + (msj ? ' (' + String(msj).slice(0, 120) + ')' : ''), r.status);
    if (r.status === 404) throw errorGC('esa dirección no existe para tu cuenta (404)', 404);
    throw errorGC('respondió con un error ' + r.status + (msj ? ' (' + String(msj).slice(0, 120) + ')' : ''), r.status);
  }
  if (!d) throw errorGC('respondió algo que no es la API (puede que la integración no esté habilitada)', r.status);
  return d;
}

async function tokenEn(base, c) {
  const body = { [c.campo === 'dni' ? 'dni' : 'email']: c.email, password: c.password };
  // El modulo oficial manda el usuario como formulario; si en JSON no lo acepta, se prueba asi
  let d;
  try { d = await llamar(base, 'POST', '/authentication', { body }); }
  catch (e) { if (![400, 401, 403, 422].includes(e.status)) throw e; d = await llamar(base, 'POST', '/authentication', { body, form: true }); }
  const t = d.token || d.access_token || d.jwt || (d.data && d.data.token);
  if (!t) throw errorGC('no devolvió el acceso', 200);
  return t;
}
async function token(cred) {
  const c = cred || await credenciales();
  if (!c) throw new Error('GoCuotas no está conectado');
  return { base: c.base || BASES[0], tok: await tokenEn(c.base || BASES[0], c) };
}

// Prueba las credenciales en cada direccion conocida y guarda la que anduvo. El usuario puede ser un mail
// o un DNI/CUIT (GoCuotas acepta "email, DNI o contraseña"); tambien se prueba la contraseña sin espacios de mas.
async function conectar(email, password) {
  const usuario = String(email || '').trim().slice(0, 120), pass = String(password || '').slice(0, 200);
  if (!usuario || !pass) throw new Error('Escribí el usuario (mail o DNI) y la contraseña de GoCuotas');
  const esNumero = /^[\d.\-\s]+$/.test(usuario);
  const usuarios = esNumero ? [{ campo: 'dni', email: usuario.replace(/\D/g, '') }, { campo: 'email', email: usuario.replace(/\D/g, '') }] : [{ campo: 'email', email: usuario }, { campo: 'email', email: usuario.toLowerCase() }];
  const claves = pass.trim() !== pass ? [pass, pass.trim()] : [pass];
  const variantes = [];
  usuarios.forEach(u => claves.forEach(k => { if (!variantes.some(v => v.campo === u.campo && v.email === u.email && v.password === k)) variantes.push({ ...u, password: k }); }));
  const fallas = [];
  let base = null, cred = null;
  for (const b of BASES) {
    for (const v of variantes) {
      try { await tokenEn(b, v); base = b; cred = v; break; }
      catch (e) {
        console.error('[gocuotas] conectar', b, v.campo, e.status, e.message);
        if (![401, 403, 422].includes(e.status) || v === variantes[variantes.length - 1]) { fallas.push({ host: b.replace(/^https?:\/\//, '').split('/')[0], motivo: e.message, status: e.status }); if (![401, 403, 422].includes(e.status)) break; }
      }
    }
    if (base) break;
  }
  if (!base) {
    const credMal = fallas.some(f => [401, 403, 422].includes(f.status));
    const e = new Error((credMal ? 'GoCuotas no aceptó ese usuario y contraseña para la integración. ' : 'No se pudo conectar con GoCuotas. ') + 'Detalle: ' + fallas.map(f => f.host + ': ' + f.motivo).join(' · ')
      + (credMal ? '. Para la tienda online hay que usar un usuario sucursal: en el panel de GoCuotas andá a Otros → Sucursales → Nueva, creá uno con un mail y una contraseña, y poné esos datos acá (no los del panel).' : '. Puede que tengas que pedirle a GoCuotas que te habiliten la integración por API (API Redirect V1).'));
    e.status = 400; throw e;
  }
  await asegurar();
  await pool.query(`INSERT INTO gocuotas_config (id, email, password, base, campo, actualizado_en) VALUES (1, $1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password, base = EXCLUDED.base, campo = EXCLUDED.campo, actualizado_en = NOW()`, [cred.email, cred.password, base, cred.campo]);
}
async function desconectar() { await asegurar(); await pool.query('DELETE FROM gocuotas_config WHERE id = 1'); }

// Firma del webhook de cada pedido: el aviso de GoCuotas solo se acepta con la firma correcta
const firma = (codigo) => crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'lumiere')).update('gocuotas:' + schemaActual() + ':' + codigo).digest('hex').slice(0, 32);
const firmaOk = (codigo, f) => { const a = Buffer.from(firma(codigo)), b = Buffer.from(String(f || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// Crea el cobro y devuelve la direccion de GoCuotas a la que se manda a la clienta
// (como el modulo oficial de GoCuotas: los datos van en el cuerpo, con el celular para la verificacion por SMS)
async function crearCheckout({ total, codigo, urlOk, urlFalla, webhook, email, telefono }) {
  const { base, tok } = await token();
  const datos = { order_reference_id: 'tienda-' + codigo, email: email || '', phone_number: String(telefono || '').replace(/\D/g, ''), amount_in_cents: Math.round(Number(total) * 100),
    url_success: urlOk, url_failure: urlFalla, webhook_url: webhook };
  const q = new URLSearchParams(Object.entries(datos).map(([k, v]) => [k, String(v)]));
  const d = await llamar(base, 'POST', '/checkouts?' + q.toString(), { token: tok, body: datos });
  if (!d.url_init) throw new Error('GoCuotas no devolvió el link de pago');
  return d.url_init;
}

// Estado de una orden en GoCuotas (para confirmar el aviso del webhook). null si no se pudo consultar.
async function orden(id) {
  try { const { base, tok } = await token(); return await llamar(base, 'GET', '/orders/' + encodeURIComponent(id), { token: tok }); }
  catch (e) { console.error('[gocuotas] orden', id, e.status, e.message); return null; }
}

module.exports = { orden, asegurar, credenciales, conectado, conectar, desconectar, crearCheckout, firma, firmaOk };
