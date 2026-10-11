const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const net = require('net');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Buscar fotos de productos en internet (buscador de imagenes de Brave) y traer la elegida.
// La clave de Brave la carga cada negocio en Lumiere (o la pone Lumiere para todos con
// BRAVE_API_KEY). La clave nunca vuelve al navegador.
// Las fotos se traen desde el servidor porque el navegador no puede leer imagenes de otros
// sitios para achicarlas; se revisa que la direccion no apunte a la red interna.

const API_BRAVE = (process.env.BRAVE_API_BASE || 'https://api.search.brave.com') + '/res/v1/images/search';
const MAX_BYTES = 8 * 1024 * 1024;
const puede = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);

const listo = porNegocio(null);
function asegurar() {
  if (!listo.get()) {
    const p = pool.query(`CREATE TABLE IF NOT EXISTS fotos_web_config (id INT PRIMARY KEY DEFAULT 1, brave_key TEXT, actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`)
      .catch((e) => { listo.set(null); throw e; });
    listo.set(p);
  }
  return listo.get();
}
async function clave() {
  await asegurar();
  const r = await pool.query('SELECT brave_key FROM fotos_web_config WHERE id = 1');
  return (r.rows[0] && r.rows[0].brave_key) || process.env.BRAVE_API_KEY || null;
}

async function buscarBrave(key, q) {
  const r = await fetch(API_BRAVE + '?' + new URLSearchParams({ q, count: '24', safesearch: 'strict', search_lang: 'es' }), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(12000),
  });
  if (r.status === 401 || r.status === 403) { const e = new Error('La clave de Brave no es válida. Revisala en Configuración.'); e.codigo = 400; throw e; }
  if (r.status === 429) { const e = new Error('Se usaron muchas búsquedas seguidas o se terminó el crédito del mes en Brave. Probá en un rato.'); e.codigo = 429; throw e; }
  if (!r.ok) { const e = new Error('El buscador de fotos no respondió. Probá de nuevo.'); e.codigo = 502; throw e; }
  const d = await r.json();
  return (d.results || []).map(x => ({
    miniatura: x.thumbnail && x.thumbnail.src,
    url: (x.properties && x.properties.url) || (x.thumbnail && x.thumbnail.src),
    titulo: x.title || '',
    sitio: (x.meta_url && x.meta_url.hostname) || x.source || '',
    ancho: x.properties && x.properties.width, alto: x.properties && x.properties.height,
  })).filter(x => x.miniatura && x.url);
}

router.use(async (req, res, next) => {
  if (!puede(req)) return res.status(403).json({ error: 'Solo el dueño o encargado puede buscar fotos' });
  try { await asegurar(); next(); } catch (e) { res.status(500).json({ error: 'No se pudo abrir el buscador de fotos' }); }
});

router.get('/config', async (req, res) => {
  try {
    const r = await pool.query('SELECT brave_key FROM fotos_web_config WHERE id = 1');
    const propia = !!(r.rows[0] && r.rows[0].brave_key);
    res.json({ configurado: propia || !!process.env.BRAVE_API_KEY, propia });
  } catch (e) { res.status(500).json({ error: 'No se pudo leer la configuración' }); }
});

// Guarda la clave (se prueba con una busqueda antes de guardarla). Vacia = borrarla.
router.put('/config', async (req, res) => {
  try {
    const k = String((req.body && req.body.clave) || '').trim();
    if (k) {
      if (k.length < 10 || k.length > 200 || /\s/.test(k)) return res.status(400).json({ error: 'Esa clave no parece válida. Copiala de nuevo desde Brave.' });
      await buscarBrave(k, 'crema hidratante');
    }
    await pool.query(`INSERT INTO fotos_web_config (id, brave_key, actualizado_en) VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET brave_key = $1, actualizado_en = NOW()`, [k || null]);
    res.json({ ok: true });
  } catch (e) { res.status(e.codigo || 500).json({ error: e.codigo ? e.message : 'No se pudo guardar la clave' }); }
});

router.get('/buscar', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 150);
    if (q.length < 2) return res.status(400).json({ error: 'Escribí qué buscar' });
    const key = await clave();
    if (!key) return res.status(409).json({ error: 'Falta cargar la clave de Brave', sin_clave: true });
    res.json(await buscarBrave(key, q));
  } catch (e) {
    if (!e.codigo) console.error('[fotos web] buscar:', e.message);
    res.status(e.codigo || 500).json({ error: e.codigo ? e.message : 'No se pudo buscar' });
  }
});

// ---- Traer la foto elegida ----
function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const s = ip.toLowerCase();
  if (s.startsWith('::ffff:')) return ipPrivada(s.slice(7));
  return s === '::' || s === '::1' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80') || s.startsWith('ff');
}
async function direccionSegura(texto) {
  let u;
  try { u = new URL(texto); } catch (e) { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return null;
  if (process.env.FOTOS_WEB_PERMITIR_LOCAL === '1') return u; // solo para pruebas locales
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!ips.length || ips.some(x => ipPrivada(x.address))) return null;
  return u;
}

router.get('/traer', async (req, res) => {
  try {
    let u = await direccionSegura(String(req.query.url || ''));
    let r = null;
    for (let saltos = 0; u && saltos < 4; saltos++) {
      r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (Lumiere; fotos de productos)', Accept: 'image/*' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = await direccionSegura(new URL(r.headers.get('location'), u).href); r = null; continue; }
      break;
    }
    if (!u || !r) return res.status(400).json({ error: 'No se pudo traer esa foto. Probá con otra.' });
    const tipo = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!r.ok || !/^image\/(jpeg|jpg|png|webp|gif|avif)$/.test(tipo)) return res.status(400).json({ error: 'No se pudo traer esa foto. Probá con otra.' });
    if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) return res.status(400).json({ error: 'Esa foto es muy pesada. Probá con otra.' });
    const partes = []; let total = 0;
    for await (const trozo of r.body) {
      total += trozo.length;
      if (total > MAX_BYTES) return res.status(400).json({ error: 'Esa foto es muy pesada. Probá con otra.' });
      partes.push(trozo);
    }
    res.set('Content-Type', tipo === 'image/jpg' ? 'image/jpeg' : tipo).set('Cache-Control', 'no-store').send(Buffer.concat(partes));
  } catch (e) { res.status(400).json({ error: 'No se pudo traer esa foto. Probá con otra.' }); }
});

module.exports = router;
