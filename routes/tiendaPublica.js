const express = require('express');
const router = express.Router({ mergeParams: true });
const crypto = require('crypto');
const pool = require('../config/database');
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');
const tienda = require('../lib/tienda');
const cuponesLib = require('../lib/cupones');
const { ayudaMP } = require('./mercadopago');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { cuentas } = require('./portal');
const { VENTA_VALIDA } = require('../lib/niveles');

// Tienda web publica (sin iniciar sesion): /api/tienda-publica/:slug/...
// El slug dice de que negocio es; todo lo que sigue corre dentro del cajon de ese negocio.
// Precios y stock se toman siempre de Lumiere en el servidor (nunca del navegador).

const { num, colLocal } = tienda;

// Limite simple de pedidos por IP (evita que alguien llene la tienda de pedidos falsos)
const intentos = new Map();
const demasiados = (ip) => {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter(t => ahora - t < 10 * 60 * 1000);
  lista.push(ahora); intentos.set(ip, lista);
  return lista.length > 10;
};

router.use('/:slug', async (req, res, next) => {
  try {
    const neg = await tienda.negocioDeSlug(req.params.slug);
    if (!neg || negocios.resumen(neg).estado === 'suspendido') return res.status(404).json({ error: 'No encontramos esta tienda' });
    enNegocio({ id: neg.id, schema: neg.schema }, async () => {
      try {
        const cfg = await tienda.leerConfig();
        if (!cfg.activo) return res.status(404).json({ error: 'Esta tienda no está disponible por ahora' });
        req.tienda = cfg; req.negTienda = neg;
        await tienda.vencerPendientes().catch(() => {});
        next();
      } catch (e) { console.error('[tienda publica]', e.message); res.status(500).json({ error: 'La tienda no está disponible en este momento' }); }
    });
  } catch (e) { res.status(500).json({ error: 'La tienda no está disponible en este momento' }); }
});

// "@girasoles", "girasoles" o el link completo -> link a la red (solo https a esa red)
const BASE_RED = { instagram: ['instagram.com', 'https://www.instagram.com/'], tiktok: ['tiktok.com', 'https://www.tiktok.com/@'], facebook: ['facebook.com', 'https://www.facebook.com/'] };
function linksRedes(redes) {
  const r = {};
  for (const [k, [dominio, base]] of Object.entries(BASE_RED)) {
    const v = String((redes || {})[k] || '').trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) { try { const u = new URL(v); if (u.hostname === dominio || u.hostname.endsWith('.' + dominio) || (k === 'facebook' && u.hostname.endsWith('fb.com'))) r[k] = 'https://' + u.hostname + u.pathname + u.search; } catch (e) {} }
    else { const usuario = v.replace(/^@/, '').replace(/[^A-Za-z0-9._-]/g, ''); if (usuario) r[k] = base + usuario; }
  }
  return r;
}

async function mpDisponible() {
  try { await ayudaMP.asegurar(); return !!(await ayudaMP.token()); } catch (e) { return false; }
}

// Icono de la tienda (acceso directo del celular): se sirve como imagen, con version para el cache
const versionIcono = (ic) => crypto.createHash('md5').update(String(ic)).digest('hex').slice(0, 10);
router.get('/:slug/icono', async (req, res) => {
  const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(req.tienda.icono || '');
  if (!m) return res.status(404).end();
  res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=86400').send(Buffer.from(m[2], 'base64'));
});

// Datos de la tienda: nombre, logo, formas de entrega y de pago
router.get('/:slug', async (req, res) => {
  try {
    const c = req.tienda;
    const neg = (await pool.query('SELECT nombre_negocio, logo_url FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const todos = (await pool.query('SELECT id, nombre, direccion FROM locales WHERE COALESCE(activo, TRUE) ORDER BY id').catch(() => ({ rows: [] }))).rows;
    const locales = todos.filter(l => !c.retiro_locales || !c.retiro_locales.length || c.retiro_locales.includes(l.id));
    // Ciudades donde se puede comprar: con retiro o con zonas de envio. El cliente elige la suya
    // y compra solo con el stock de ese local.
    const zonas = c.envio_activo ? c.envio_zonas : [];
    const ciudades = todos.filter(l => (c.retiro_activo && locales.some(x => x.id === l.id)) || zonas.some(z => z.local === l.id))
      .map(l => ({ id: l.id, nombre: l.nombre, direccion: l.direccion, retiro: !!c.retiro_activo && locales.some(x => x.id === l.id), envio: zonas.some(z => z.local === l.id) }));
    const mp = c.pago_mp && await mpDisponible();
    res.json({
      titulo: c.titulo || neg.nombre_negocio || 'Tienda', mensaje: c.mensaje || '', logo: c.logo || neg.logo_url || null, color: c.color || '#c9a84c', whatsapp: c.whatsapp || null,
      retiro: c.retiro_activo ? locales : [], ciudades,
      envio: c.envio_activo ? { zonas: c.envio_zonas, gratis_desde: c.envio_gratis_desde } : null,
      pagos: { mp, transferencia: !!c.pago_transferencia, retiro: !!c.pago_retiro }, horas_reserva: c.horas_reserva,
      anuncios: String(c.anuncios || '').split('\n').filter(Boolean),
      redes: linksRedes(c.redes),
      reels_titulo: c.reels_titulo || 'Videos',
      reels: (await pool.query('SELECT id, titulo, tipo, codigo, productos FROM tienda_reels ORDER BY orden, id').catch(() => ({ rows: [] }))).rows,
      banner: c.banner || [], banners_img: c.banners_img || [], filas: c.filas || [], sectores: c.sectores || [],
      reingreso: c.reingreso_activo ? { nombre: c.reingreso_nombre || 'Nuevamente en stock', dias: c.reingreso_dias || 14 } : null,
      dominio: await tienda.dominioDe(req.negTienda.id).catch(() => null),
      ruleta: (() => { const r = tienda.ruletaDe(c); return r.activo ? { minimo: r.minimo, aviso: r.aviso_carrito } : null; })(),
      preventa: (() => { const pv = tienda.preventaDe(c); return pv.activo ? { titulo: pv.titulo } : null; })(),
      icono_v: c.icono ? versionIcono(c.icono) : null,
      resenas_puntos: (() => { const r = tienda.puntosResenaDe(c); return r.activo && (r.puntos || r.extra_foto) ? { puntos: r.puntos, extra_foto: r.extra_foto } : null; })(),
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la tienda' }); }
});

// Datos para la vista previa al compartir un link (WhatsApp, Instagram, Facebook): titulo, texto e imagen.
// ?p=slug-del-producto. Si no hay producto (o no se encuentra), los de la tienda.
router.get('/:slug/vista-previa', async (req, res) => {
  try {
    const c = req.tienda;
    const neg = (await pool.query('SELECT nombre_negocio, logo_url FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const titulo = c.titulo || neg.nombre_negocio || 'Tienda';
    const base = '/tienda-publica/' + encodeURIComponent(req.params.slug);
    const logo = [c.logo, neg.logo_url].find(x => /^https:\/\//.test(x || ''));
    const banner = (c.banners_img || []).find(b => b.imagen);
    const deTienda = { titulo, descripcion: c.mensaje || ('Comprá online en ' + titulo), imagen: logo || (banner ? base + '/banner/' + banner.imagen : null),
      icono: c.icono ? base + '/icono?v=' + versionIcono(c.icono) : null, nombre: titulo, color: c.color || '#111111' };
    const pedido = String(req.query.p || '').toLowerCase().slice(0, 120);
    if (!pedido) return res.set('Cache-Control', 'public, max-age=300').json(deTienda);
    const lista = (await pool.query(`SELECT p.id, p.nombre, p.marca, p.precio, tp.descripcion, EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto
      FROM tienda_productos tp JOIN productos p ON p.id = tp.producto_id WHERE tp.publicado AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0`)).rows;
    const slugs = tienda.slugsProductos(lista);
    const porId = /-(\d+)$/.exec(pedido);
    const p = lista.find(x => slugs.get(x.id) === pedido) || (porId && lista.find(x => x.id === Number(porId[1])));
    if (!p) return res.set('Cache-Control', 'public, max-age=60').json(deTienda);
    const precio = '$' + Math.round(num(p.precio)).toLocaleString('es-AR');
    const desc = String(p.descripcion || '').replace(/\s+/g, ' ').trim();
    res.set('Cache-Control', 'public, max-age=300').json({
      titulo: p.nombre + ' | ' + titulo,
      descripcion: (precio + (p.marca ? ' · ' + p.marca : '') + (desc ? ' · ' + desc : '')).slice(0, 200),
      imagen: p.foto ? base + '/foto/' + p.id : deTienda.imagen,
      producto: slugs.get(p.id), icono: deTienda.icono, nombre: titulo, color: deTienda.color,
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});

// Productos publicados con precio y lo disponible en cada local (y sus variantes)
router.get('/:slug/productos', async (req, res) => {
  try {
    const pv = tienda.preventaDe(req.tienda);
    const r = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
             COALESCE(p.stock_transito_rg, 0) AS transito_rg, COALESCE(p.stock_transito_ush, 0) AS transito_ush, COALESCE(p.reservado_rg, 0) AS reservado_rg, COALESCE(p.reservado_ush, 0) AS reservado_ush,
             COALESCE(tp.publicado, FALSE) AS publicado,
             COALESCE(p.tiene_variantes, FALSE) AS tiene_variantes, tp.descripcion, tp.orden, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url, (p.creado_en > NOW() - INTERVAL '30 days') AS nuevo, tp.etiquetas,
             EXISTS (SELECT 1 FROM tienda_videos tv WHERE tv.producto_id = p.id) AS video_subido,
             ARRAY(SELECT f.id FROM tienda_fotos f WHERE f.producto_id = p.id ORDER BY f.orden, f.id) AS fotos_extra,
             (SELECT json_object_agg(r.local_id, EXTRACT(EPOCH FROM r.f)::bigint) FROM (SELECT local_id, MAX(fecha) AS f FROM tienda_reingresos
                WHERE producto_id = p.id AND fecha > NOW() - make_interval(days => $1::int) GROUP BY local_id) r) AS reingreso,
             (SELECT EXTRACT(EPOCH FROM i.actualizado_en)::bigint FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto_v,
             EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto
      FROM productos p LEFT JOIN tienda_productos tp ON tp.producto_id = p.id
      WHERE p.activo = TRUE AND COALESCE(p.precio, 0) > 0
        AND (COALESCE(tp.publicado, FALSE) OR ($2::boolean AND NOT COALESCE(p.tiene_variantes, FALSE) AND COALESCE(p.stock_transito_rg, 0) + COALESCE(p.stock_transito_ush, 0) > 0))
      ORDER BY COALESCE(tp.orden, 999999), p.nombre`, [req.tienda.reingreso_activo ? (req.tienda.reingreso_dias || 14) : 0, pv.activo && pv.incluir_no_publicados]).catch(async () => (await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush, TRUE AS publicado,
             COALESCE(p.tiene_variantes, FALSE) AS tiene_variantes, tp.descripcion, tp.orden, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url, (p.creado_en > NOW() - INTERVAL '30 days') AS nuevo, EXISTS (SELECT 1 FROM tienda_videos tv WHERE tv.producto_id = p.id) AS video_subido, ARRAY[]::int[] AS fotos_extra, NULL::bigint AS foto_v, FALSE AS foto
      FROM tienda_productos tp JOIN productos p ON p.id = tp.producto_id
      WHERE tp.publicado AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0 ORDER BY tp.orden, p.nombre`)));
    const conVar = r.rows.filter(p => p.tiene_variantes).map(p => p.id);
    const vars = conVar.length ? (await pool.query(`SELECT id, producto_id, valor, COALESCE(stock_rg, 0) AS stock_rg, COALESCE(stock_ush, 0) AS stock_ush FROM producto_variantes WHERE activo AND producto_id = ANY($1) ORDER BY id`, [conVar]).catch(() => ({ rows: [] }))).rows : [];
    // Mas vendidos: unidades vendidas en los ultimos 30 dias (local y web). Los 10 primeros llevan su puesto.
    const ventas30 = (await pool.query(`SELECT vi.producto_id, SUM(vi.cantidad)::int AS n FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
      WHERE vi.producto_id = ANY($1::int[]) AND v.creado_en > NOW() - INTERVAL '30 days' AND ${VENTA_VALIDA} GROUP BY vi.producto_id HAVING SUM(vi.cantidad) >= 2 ORDER BY n DESC LIMIT 10`,
      [r.rows.filter(p => p.publicado).map(p => p.id)]).catch(() => ({ rows: [] }))).rows;
    const puesto = new Map(ventas30.map((x, i) => [x.producto_id, i + 1]));
    // Estrellas de cada producto (solo reseñas aprobadas)
    const notas = new Map((await pool.query(`SELECT producto_id, ROUND(AVG(estrellas)::numeric, 1)::float AS prom, COUNT(*)::int AS n FROM tienda_resenas WHERE estado = 'aprobada' GROUP BY producto_id`)
      .catch(() => ({ rows: [] }))).rows.map(x => [x.producto_id, [x.prom, x.n]]));
    res.json(r.rows.map(p => {
      const v = vars.filter(x => x.producto_id === p.id).map(x => ({ id: x.id, valor: x.valor, stock: { 1: Math.max(0, x.stock_rg), 2: Math.max(0, x.stock_ush) } }));
      return {
        id: p.id, nombre: p.nombre, marca: p.marca, categoria: p.categoria, precio: num(p.precio), descripcion: p.descripcion || '', foto: !!p.foto,
        destacado: !!p.destacado, nuevo: !!p.nuevo, etiquetas: p.etiquetas || null, top: puesto.get(p.id) || null, resenas: notas.get(p.id) || null, fotos: p.fotos_extra || [], reingreso: p.reingreso || null, foto_v: p.foto_v ? Number(p.foto_v) : null,
        video: p.video_subido ? { tipo: 'subido' } : tienda.videoDeLink(p.video_url),
        variantes: p.tiene_variantes && v.length ? v : null,
        // Para vender ya: stock menos lo reservado por preventas (solo si esta publicado)
        stock: p.publicado ? { 1: tienda.disponibles(p, 1).ya, 2: tienda.disponibles(p, 2).ya } : { 1: 0, 2: 0 },
        // En preventa: lo que viene en camino sin reservar (sin variantes)
        preventa: pv.activo && !p.tiene_variantes ? { 1: tienda.disponibles(p, 1).preventa, 2: tienda.disponibles(p, 2).preventa } : null,
      };
    }));
  } catch (e) {
    console.error('[tienda publica] productos:', e.message);
    res.status(500).json({ error: 'No se pudieron cargar los productos' });
  }
});

// Foto del producto (solo de productos publicados)
router.get('/:slug/foto/:id', async (req, res) => {
  try {
    const r = (await pool.query(`SELECT i.imagen FROM producto_imagenes i JOIN productos p ON p.id = i.producto_id AND p.activo WHERE i.producto_id = $1`, [req.params.id])).rows[0];
    if (!r) return res.status(404).end();
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(r.imagen || '');
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=600').send(Buffer.from(m[2], 'base64'));
  } catch (e) { res.status(404).end(); }
});

// Imagen de un banner (solo las que usa algun banner guardado). Nunca cambia: se guarda en el navegador
router.get('/:slug/banner/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const usadas = (req.tienda.banners_img || []).flatMap(x => [x.imagen, x.imagen_movil]);
    if (!usadas.includes(id)) return res.status(404).end();
    const r = (await pool.query('SELECT tipo, datos FROM tienda_banner_imagenes WHERE id = $1', [id])).rows[0];
    if (!r) return res.status(404).end();
    res.set('Content-Type', r.tipo).set('Cache-Control', 'public, max-age=31536000, immutable').send(r.datos);
  } catch (e) { res.status(404).end(); }
});

// Foto extra de un producto publicado
router.get('/:slug/foto-extra/:id', async (req, res) => {
  try {
    const r = (await pool.query(`SELECT f.imagen FROM tienda_fotos f JOIN tienda_productos tp ON tp.producto_id = f.producto_id AND tp.publicado WHERE f.id = $1`, [req.params.id])).rows[0];
    const m = r && /^data:(image\/[a-z]+);base64,(.+)$/.exec(r.imagen || '');
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=600').send(Buffer.from(m[2], 'base64'));
  } catch (e) { res.status(404).end(); }
});

// Video subido de un producto publicado. Responde por partes (Range) para que el navegador
// pueda empezar a reproducirlo sin bajarlo entero y adelantarlo.
router.get('/:slug/video/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pub = (await pool.query('SELECT 1 FROM tienda_productos WHERE producto_id = $1 AND publicado', [id])).rows.length;
    if (!pub) return res.status(404).end();
    await tienda.servirVideo(req, res, 'tienda_videos', 'producto_id', id);
  } catch (e) { res.status(404).end(); }
});

// Probar un codigo de descuento antes de comprar
router.get('/:slug/cupon/:codigo', async (req, res) => {
  try {
    const k = 'cupon:' + (req.ip || '');
    if (cuentas.bloqueado(k)) return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos.' });
    await cuponesLib.asegurar();
    const r = await tienda.revisarCupon(pool, req.params.codigo, Math.max(0, parseFloat(req.query.monto) || 0), false, { cliente_id: clienteDeToken(req), telefono: req.query.tel });
    if (!r || r.error) { cuentas.sumarIntento(k); return res.status(400).json({ error: (r && r.error) || 'Código inválido' }); }
    const { _cupon, ...publico } = r; // los datos de la duena del cupon no salen del servidor
    res.json(publico);
  } catch (e) { res.status(500).json({ error: 'No se pudo revisar el código' }); }
});

// Video subido del sector de videos
router.get('/:slug/reel/:id', async (req, res) => {
  try { await tienda.servirVideo(req, res, 'tienda_reels', 'id', parseInt(req.params.id)); } catch (e) { res.status(404).end(); }
});

// Busca el cliente por telefono o mail; si no existe, lo crea (asi suma puntos y queda en Clientes)
async function clienteDe(db, nombre, telefono, email) {
  const dig = String(telefono || '').replace(/[^0-9]/g, '').slice(-8);
  if (dig.length >= 6) {
    const r = await db.query(`SELECT id FROM clientes WHERE RIGHT(REGEXP_REPLACE(COALESCE(telefono, ''), '[^0-9]', '', 'g'), 8) = $1 LIMIT 1`, [dig]);
    if (r.rows.length) return r.rows[0].id;
  }
  if (email) {
    const r = await db.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (r.rows.length) return r.rows[0].id;
  }
  const r = await db.query('INSERT INTO clientes (nombre, telefono, email, local_id) VALUES ($1, $2, $3, 1) RETURNING id', [nombre, telefono || null, email || null]);
  return r.rows[0].id;
}

// Nuevo pedido: valida stock y precios, aparta el stock y (si paga con Mercado Pago) arma el link de pago
router.post('/:slug/pedidos', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.ip;
  if (demasiados(ip)) return res.status(429).json({ error: 'Hiciste muchos pedidos seguidos. Esperá unos minutos o escribinos por WhatsApp.' });
  const c = req.tienda;
  const b = req.body || {};
  const nombre = String(b.nombre || '').trim().slice(0, 120);
  const telefono = String(b.telefono || '').trim().slice(0, 40);
  const email = String(b.email || '').trim().slice(0, 120) || null;
  if (nombre.length < 2) return res.status(400).json({ error: 'Escribí tu nombre' });
  if (String(telefono).replace(/[^0-9]/g, '').length < 8) return res.status(400).json({ error: 'Escribí tu WhatsApp (con código de área) para avisarte' });
  const entrega = b.entrega === 'envio' ? 'envio' : 'retiro';
  let localId = 1, zona = null, costoEnvio = 0, direccion = null;
  if (entrega === 'retiro') {
    if (!c.retiro_activo) return res.status(400).json({ error: 'El retiro en el local no está disponible' });
    localId = Number(b.local_id) === 2 ? 2 : 1;
    if (c.retiro_locales && c.retiro_locales.length && !c.retiro_locales.includes(localId)) return res.status(400).json({ error: 'Elegí dónde retirar' });
  } else {
    if (!c.envio_activo) return res.status(400).json({ error: 'El envío no está disponible' });
    const ciudad = Number(b.local_id) || null;
    const z = (c.envio_zonas || []).find(x => x.nombre === b.zona && (!ciudad || x.local === ciudad));
    if (!z) return res.status(400).json({ error: 'Elegí la zona de envío de tu ciudad' });
    direccion = String(b.direccion || '').trim().slice(0, 300);
    if (direccion.length < 5) return res.status(400).json({ error: 'Escribí la dirección de entrega' });
    localId = z.local; zona = z.nombre; costoEnvio = Math.max(0, num(z.costo));
  }
  const pago = ['mp', 'transferencia', 'retiro'].includes(b.pago) ? b.pago : null;
  if (!pago || (pago === 'mp' && !(c.pago_mp && await mpDisponible())) || (pago === 'transferencia' && !c.pago_transferencia) || (pago === 'retiro' && !c.pago_retiro)) return res.status(400).json({ error: 'Elegí cómo vas a pagar' });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(it => ({ producto_id: parseInt(it.producto_id), variante_id: parseInt(it.variante_id) || null, cantidad: Math.min(99, Math.max(1, parseInt(it.cantidad) || 1)), preventa: !!it.preventa && !parseInt(it.variante_id) })).filter(it => it.producto_id);
  if (!items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const col = colLocal(localId);
  if (b.cupon) await cuponesLib.asegurar();
  const client = await pool.connect();
  let pedido;
  try {
    await client.query('BEGIN');
    const lineas = [];
    for (const it of items) {
      const p = (await client.query(`SELECT p.id, p.nombre, p.precio, COALESCE(tp.publicado, FALSE) AS publicado,
          COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush, COALESCE(p.stock_transito_rg, 0) AS transito_rg, COALESCE(p.stock_transito_ush, 0) AS transito_ush,
          COALESCE(p.reservado_rg, 0) AS reservado_rg, COALESCE(p.reservado_ush, 0) AS reservado_ush
        FROM productos p LEFT JOIN tienda_productos tp ON tp.producto_id = p.id WHERE p.id = $1 AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0 FOR UPDATE OF p`, [it.producto_id])).rows[0];
      const pvCfg = tienda.preventaDe(c);
      if (!p || (!p.publicado && !(it.preventa && pvCfg.activo && pvCfg.incluir_no_publicados))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Un producto del carrito ya no está disponible. Actualizá la página.' }); }
      if (it.preventa && !pvCfg.activo) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'La preventa ya no está disponible. Actualizá la página.' }); }
      const disp = tienda.disponibles(p, localId);
      let stock = it.preventa ? disp.preventa : disp.ya, valor = null;
      if (it.variante_id) {
        const v = (await client.query(`SELECT valor, COALESCE(${col}, 0) AS stock FROM producto_variantes WHERE id = $1 AND producto_id = $2 AND activo FOR UPDATE`, [it.variante_id, p.id])).rows[0];
        if (!v) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Una opción de ' + p.nombre + ' ya no está disponible' }); }
        stock = parseInt(v.stock) || 0; valor = v.valor;
      }
      const ya = lineas.filter(l => l.producto_id === p.id && l.variante_id === it.variante_id && l.preventa === it.preventa).reduce((t, l) => t + l.cantidad, 0);
      if (it.preventa && stock - ya < it.cantidad) { await client.query('ROLLBACK'); return res.status(409).json({ error: (stock - ya > 0 ? 'Solo quedan ' + (stock - ya) + ' de ' + p.nombre + ' para reservar en preventa' : 'Ya se reservó todo lo que viene de ' + p.nombre) + '. Actualizá la página.' }); }
      if (stock - ya < it.cantidad) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay stock suficiente de ' + p.nombre + (valor ? ' (' + valor + ')' : '') + (stock - ya > 0 ? ': quedan ' + (stock - ya) : '') + ' en ' + (entrega === 'retiro' ? 'ese local' : 'este momento') }); }
      lineas.push({ producto_id: p.id, variante_id: it.variante_id, nombre: p.nombre, variante_valor: valor, cantidad: it.cantidad, precio: num(p.precio), preventa: it.preventa });
    }
    const subtotal = Math.round(lineas.reduce((t, l) => t + l.precio * l.cantidad, 0) * 100) / 100;
    if (entrega === 'envio' && c.envio_gratis_desde && subtotal >= c.envio_gratis_desde) costoEnvio = 0;
    let cupon = null;
    const clienteId = clienteDeToken(req) || await clienteDe(client, nombre, telefono, email);
    if (b.cupon) {
      cupon = await tienda.revisarCupon(client, b.cupon, subtotal, true, { cliente_id: clienteId, telefono });
      if (cupon && cupon.error) { await client.query('ROLLBACK'); return res.status(400).json({ error: cupon.error }); }
      if (cupon) await client.query('UPDATE cupones SET usos = COALESCE(usos, 0) + 1 WHERE codigo = $1', [cupon.codigo]);
    }
    const descuento = cupon ? cupon.descuento : 0;
    const total = Math.round((subtotal - descuento + costoEnvio) * 100) / 100;
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const estado = pago === 'retiro' ? 'confirmado' : 'pendiente_pago';
    const horas = pago === 'mp' ? 2 : Math.min(168, Math.max(1, parseInt(c.horas_reserva) || 24));
    // Con preventa, "paga al retirar" no vence hasta que llega (se renueva al marcar "Llegó la preventa")
    const conPreventa = lineas.some(l => l.preventa);
    pedido = (await client.query(`INSERT INTO tienda_pedidos (codigo, cliente_id, nombre, telefono, email, entrega, local_id, direccion, zona, costo_envio, pago, subtotal, total, nota, estado, vence_en, cupon, cupon_tipo, cupon_valor, descuento)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CASE WHEN $15 = 'pendiente_pago' OR ($11 = 'retiro' AND NOT $21::boolean) THEN NOW() + ($16 || ' hours')::interval ELSE NULL END, $17, $18, $19, $20) RETURNING *`,
      [codigo, clienteId, nombre, telefono, email, entrega, localId, direccion, zona, costoEnvio, pago, subtotal, total, String(b.nota || '').trim().slice(0, 500) || null, estado, String(horas),
       cupon ? cupon.codigo : null, cupon ? cupon.tipo : null, cupon ? cupon.valor : null, descuento, conPreventa])).rows[0];
    for (const l of lineas) {
      await client.query('INSERT INTO tienda_pedido_items (pedido_id, producto_id, variante_id, nombre, variante_valor, cantidad, precio, preventa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [pedido.id, l.producto_id, l.variante_id, l.nombre, l.variante_valor, l.cantidad, l.precio, !!l.preventa]);
    }
    if (cupon) await cuponesLib.registrarUso(client, cupon._cupon, { cliente_id: clienteId, telefono }, { pedido_id: pedido.id });
    await tienda.moverStock(client, pedido, -1);
    await tienda.reservarPreventa(client, pedido, +1);
    if (clienteId) await client.query('DELETE FROM tienda_carritos WHERE cliente_id = $1', [clienteId]);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda publica] pedido:', e.message);
    return res.status(500).json({ error: 'No se pudo hacer el pedido. Probá de nuevo.' });
  } finally { client.release(); }

  // Mercado Pago: link de pago por el total (vuelve a la tienda al terminar)
  let link = null;
  if (pago === 'mp') {
    try {
      const tok = await ayudaMP.token();
      const origen = String(b.volver_a || '').startsWith('http') ? String(b.volver_a).split('?')[0].split('#')[0] : null;
      const volver = origen ? origen + '?tienda=' + encodeURIComponent(req.params.slug) + '&pedido=' + pedido.codigo : null;
      const pref = await ayudaMP.mp(tok, 'POST', '/checkout/preferences', {
        items: [{ id: 'pedido-' + pedido.codigo, title: 'Pedido ' + pedido.codigo + ' · ' + (c.titulo || 'Tienda'), description: 'Compra en la tienda web', category_id: 'others', quantity: 1, unit_price: num(pedido.total), currency_id: 'ARS' }],
        external_reference: 'tienda-' + pedido.codigo,
        payer: { name: nombre, ...(email ? { email } : {}) },
        ...(volver ? { back_urls: { success: volver, pending: volver, failure: volver }, auto_return: 'approved' } : {}),
        expires: true, expiration_date_to: new Date(Date.now() + 2 * 3600 * 1000).toISOString().replace('Z', '-00:00'),
      });
      link = pref.init_point;
      await pool.query('UPDATE tienda_pedidos SET mp_link = $1 WHERE id = $2', [link, pedido.id]);
    } catch (e) {
      console.error('[tienda publica] mp:', e.message);
      await tienda.cancelar(pedido.id, 'No se pudo crear el pago en Mercado Pago').catch(() => {});
      return res.status(502).json({ error: 'No se pudo abrir el pago con Mercado Pago. Probá con otra forma de pago.' });
    }
  }
  res.status(201).json({ codigo: pedido.codigo, total: num(pedido.total), estado: pedido.estado, link_pago: link });
});

// Estado del pedido (si pago con Mercado Pago y todavia no se confirmo, se pregunta)
router.get('/:slug/pedidos/:codigo', async (req, res) => {
  try {
    let p = (await pool.query('SELECT * FROM tienda_pedidos WHERE codigo = $1', [String(req.params.codigo || '').toUpperCase()])).rows[0];
    if (!p) return res.status(404).json({ error: 'No encontramos ese pedido' });
    if (p.pago === 'mp' && !p.pagado && p.estado === 'pendiente_pago') p = await tienda.revisarPagoMP(p, true);
    const items = (await pool.query('SELECT nombre, variante_valor, cantidad, precio, preventa FROM tienda_pedido_items WHERE pedido_id = $1 ORDER BY id', [p.id])).rows.map(i => ({ ...i, precio: num(i.precio) }));
    const loc = p.entrega === 'retiro' ? (await pool.query('SELECT nombre, direccion FROM locales WHERE id = $1', [p.local_id]).catch(() => ({ rows: [] }))).rows[0] : null;
    res.json({
      ruleta: await estadoRuleta(req.tienda, p),
      codigo: p.codigo, estado: p.estado, pagado: p.pagado, pago: p.pago, entrega: p.entrega, local: loc || null, direccion: p.direccion, zona: p.zona,
      subtotal: num(p.subtotal), costo_envio: num(p.costo_envio), descuento: num(p.descuento), cupon: p.cupon || null, total: num(p.total), items, link_pago: p.estado === 'pendiente_pago' ? p.mp_link : null,
      vence_en: p.vence_en, transferencia: p.pago === 'transferencia' && !p.pagado ? (req.tienda.transferencia_datos || '') : null, creado_en: p.creado_en,
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar el pedido' }); }
});

// ===================== Ruleta de premios =====================
// Se gira una vez por pedido, si la compra (productos menos descuento) llega al minimo y el pedido
// sigue en pie. Con Mercado Pago, recien cuando se acredita el pago.
const premioPublico = (x) => ({ id: x.id, texto: x.texto, tipo: x.tipo });
async function estadoRuleta(cfg, p) {
  const hecho = (await pool.query('SELECT premio_id, texto, tipo, valor, cupon FROM tienda_ruleta WHERE pedido_id = $1', [p.id]).catch(() => ({ rows: [] }))).rows[0];
  const r = tienda.ruletaDe(cfg);
  if (hecho) return { premios: r.premios.map(premioPublico), resultado: { id: hecho.premio_id, texto: hecho.texto, tipo: hecho.tipo, valor: num(hecho.valor), cupon: hecho.cupon } };
  if (!r.activo || p.estado === 'cancelado' || num(p.subtotal) - num(p.descuento) < r.minimo) return null;
  if (p.pago === 'mp' && !p.pagado) return { premios: r.premios.map(premioPublico), espera: true, minimo: r.minimo };
  return { premios: r.premios.map(premioPublico), disponible: true, minimo: r.minimo };
}
router.post('/:slug/pedidos/:codigo/ruleta', async (req, res) => {
  const tablasCupon = await cuponesLib.asegurar();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // De a un giro por vez en todo el negocio, asi los topes ("1 cada 100") se respetan aunque giren dos a la vez
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('tienda_ruleta'))`);
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE codigo = $1 FOR UPDATE', [String(req.params.codigo || '').toUpperCase()])).rows[0];
    if (!p) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontramos ese pedido' }); }
    const ya = (await client.query('SELECT premio_id, texto, tipo, valor, cupon FROM tienda_ruleta WHERE pedido_id = $1', [p.id])).rows[0];
    const r = tienda.ruletaDe(req.tienda);
    if (ya) { await client.query('ROLLBACK'); return res.json({ id: ya.premio_id, texto: ya.texto, tipo: ya.tipo, valor: num(ya.valor), cupon: ya.cupon }); }
    const est = await estadoRuleta(req.tienda, p);
    if (!est || !est.disponible) { await client.query('ROLLBACK'); return res.status(400).json({ error: est && est.espera ? 'Vas a poder girar la ruleta cuando se acredite el pago' : 'Esta compra no tiene ruleta' }); }
    // Topes ("como maximo 1 cada N giros"): cuantos giros hubo desde la ultima vez que salio cada uno
    const bloqueados = [];
    for (const x of r.premios.filter(x => x.cada > 1 && x.chance > 0)) {
      const desde = (await client.query(`SELECT COUNT(*)::int AS n FROM tienda_ruleta WHERE creado_en > COALESCE((SELECT MAX(creado_en) FROM tienda_ruleta WHERE premio_id = $1), '-infinity')`, [x.id])).rows[0].n;
      const salio = (await client.query('SELECT 1 FROM tienda_ruleta WHERE premio_id = $1 LIMIT 1', [x.id])).rows.length;
      if (salio && desde < x.cada - 1) bloqueados.push(x.id);
    }
    const premio = tienda.elegirPremio(r.premios, bloqueados);
    let cupon = null;
    if (premio.tipo === 'cupon') {
      for (let i = 0; i < 5 && !cupon; i++) {
        const cod = 'RULETA-' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
        const ok = await client.query(`INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, activo)
          SELECT $1::text, $2::text, '%', $3, 'Ruleta tienda', 1, CURRENT_DATE + 30, FALSE WHERE NOT EXISTS (SELECT 1 FROM cupones WHERE codigo = $1::text) RETURNING codigo`,
          [cod, 'Ruleta de la tienda (pedido ' + p.codigo + '): ' + premio.texto, premio.valor]);
        if (ok.rows.length) cupon = cod;
      }
      if (!cupon) throw new Error('no se pudo crear el cupon');
      // El cupon es solo de quien hizo la compra (su ficha y, por si acaso, su WhatsApp)
      if (tablasCupon) {
        const d = await cuponesLib.duenoPara(client, { cliente_id: p.cliente_id, telefono: p.telefono });
        await client.query('UPDATE cupones SET cliente_id = $1, dueno_dni = $2, dueno_tel = $3 WHERE codigo = $4', [d.cliente_id, d.dueno_dni, d.dueno_tel, cupon]);
      }
    }
    await client.query('INSERT INTO tienda_ruleta (pedido_id, premio_id, texto, tipo, valor, cupon) VALUES ($1, $2, $3, $4, $5, $6)', [p.id, premio.id, premio.texto, premio.tipo, premio.valor, cupon]);
    await client.query('COMMIT');
    res.json({ id: premio.id, texto: premio.texto, tipo: premio.tipo, valor: premio.valor, cupon });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda publica] ruleta:', e.message);
    res.status(500).json({ error: 'No se pudo girar la ruleta. Probá de nuevo.' });
  } finally { client.release(); }
});

// ===================== Mi cuenta (clientas) =====================
// Misma cuenta que el portal de clientas: DNI + contraseña sobre la ficha de Lumiere, asi ven
// sus puntos y premios. La llave (token) dice de que negocio es.
// La cuenta de la tienda queda abierta un año y se renueva sola cada vez que la clienta entra (ver GET /cuenta)
const firmar = (req, id) => jwt.sign({ id, tipo: 'cliente', neg: req.negTienda.id }, process.env.JWT_SECRET, { expiresIn: '365d' });
function clienteDeToken(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!t) return null;
  try { const d = jwt.verify(t, process.env.JWT_SECRET); return d.tipo === 'cliente' && d.neg === req.negTienda.id ? d.id : null; } catch (e) { return null; }
}
const conCuenta = (req, res, next) => { const id = clienteDeToken(req); if (!id) return res.status(401).json({ error: 'Volvé a ingresar a tu cuenta', sesion: true }); req.clienteId = id; next(); };
const digitos = (x) => cuentas.soloNumeros(x).slice(-8);
// Mismo telefono aunque se escriba con 0, 15 o sin codigo de area: se comparan los ultimos 6 numeros
const mismoTelefono = (a, b) => cuentas.soloNumeros(a).length >= 8 && cuentas.soloNumeros(b).length >= 8 && cuentas.soloNumeros(a).slice(-6) === cuentas.soloNumeros(b).slice(-6);

router.post('/:slug/cuenta/ingresar', async (req, res) => {
  try {
    const { dni, password } = req.body || {};
    const k = 'tienda:' + req.negTienda.id + ':' + (cuentas.soloNumeros(dni) || 'vacio');
    if (cuentas.bloqueado(k)) return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' });
    const c = (await cuentas.buscarPorDni(dni)).rows[0];
    if (!c || !c.password_hash) { cuentas.sumarIntento(k); return res.status(401).json({ error: c ? 'Todavía no creaste tu cuenta con ese DNI. Tocá "Crear mi cuenta".' : 'El DNI o la contraseña no son correctos' }); }
    if (!(await bcrypt.compare(String(password || ''), c.password_hash))) { cuentas.sumarIntento(k); return res.status(401).json({ error: 'El DNI o la contraseña no son correctos' }); }
    cuentas.intentos.delete(k);
    res.json({ token: firmar(req, c.id), cliente: { nombre: c.nombre, telefono: c.telefono, email: c.email || c.portal_email } });
  } catch (e) { console.error('[tienda] ingresar:', e.message); res.status(500).json({ error: 'No pudimos ingresar. Probá de nuevo.' }); }
});

// Crear la cuenta. Si el DNI ya esta en Lumiere (compro en el local), para proteger sus puntos
// tiene que coincidir el WhatsApp o el mail que figuran en su ficha. Si es nueva, se crea la ficha.
// Mientras escribe el DNI para crear la cuenta: si ya es clienta de Lumiere, si ya tiene cuenta, o si es nueva.
// Se muestra solo el primer nombre y el final del WhatsApp (para que sepa cual usar). Con limite por IP.
const consultasDni = new Map();
router.post('/:slug/cuenta/dni', async (req, res) => {
  try {
    const ip = req.ip || 'x', ahora = Date.now();
    const l = (consultasDni.get(ip) || []).filter(t => ahora - t < 10 * 60 * 1000); l.push(ahora); consultasDni.set(ip, l);
    if (l.length > 30) return res.status(429).json({ error: 'Demasiadas consultas. Esperá unos minutos.' });
    const dni = cuentas.soloNumeros((req.body || {}).dni);
    if (dni.length < 7 || dni.length > 11) return res.json({ estado: 'incompleto' });
    const c = (await cuentas.buscarPorDni(dni)).rows[0];
    if (!c) return res.json({ estado: 'nueva' });
    if (c.password_hash) return res.json({ estado: 'con_cuenta', nombre: String(c.nombre || '').trim().split(/\s+/)[0] || null });
    const tel = digitos(c.telefono);
    res.json({ estado: 'clienta', nombre: String(c.nombre || '').trim().split(/\s+/)[0] || null, tel_final: tel.length >= 8 ? tel.slice(-2) : null,
      falta: { email: !(c.email || c.portal_email), cumple: !c.fecha_nacimiento, telefono: tel.length < 8 } });
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar' }); }
});

// Fecha de nacimiento valida (AAAA-MM-DD, entre 10 y 110 años)
function fechaNacimiento(x) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(x || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1) return null;
  const edad = (Date.now() - d.getTime()) / (365.25 * 864e5);
  return edad >= 10 && edad <= 110 ? m[0] : null;
}

router.post('/:slug/cuenta/crear', async (req, res) => {
  let candado = null;
  try {
    const b = req.body || {};
    const dni = cuentas.soloNumeros(b.dni), password = String(b.password || ''), nombre = String(b.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const telefono = String(b.telefono || '').trim().slice(0, 40), email = String(b.email || '').trim().toLowerCase().slice(0, 120) || null;
    const nacimiento = fechaNacimiento(b.fecha_nacimiento);
    const localCliente = Number(b.local_id) === 2 ? 2 : 1;
    if (dni.length < 7 || dni.length > 11) return res.status(400).json({ error: 'Escribí tu DNI (solo números)' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres' });
    if (digitos(telefono).length < 8) return res.status(400).json({ error: 'Escribí tu WhatsApp con código de área' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ error: 'Escribí tu email' });
    if (!nacimiento) return res.status(400).json({ error: 'Elegí tu fecha de nacimiento (así te saludamos en tu cumple 🎂)' });
    const k = 'tienda-crear:' + req.negTienda.id + ':' + dni;
    if (cuentas.bloqueado(k)) return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' });
    // Un DNI = una sola cuenta: de a una alta por DNI a la vez (si dos se crean en el mismo momento,
    // la segunda espera y ve que ya existe)
    candado = await pool.connect();
    await candado.query('BEGIN');
    await candado.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cuenta-dni:' + dni]);
    let c = (await cuentas.buscarPorDni(dni)).rows[0];
    if (c) {
      if (c.password_hash) return res.status(400).json({ error: 'Ese DNI ya tiene una cuenta (puede ser del portal de clientas). Ingresá con tu contraseña.' });
      const telOk = mismoTelefono(c.telefono, telefono);
      const mailOk = !!email && [c.email, c.portal_email].some(m => m && String(m).trim().toLowerCase() === email);
      if (!telOk && !mailOk) {
        cuentas.sumarIntento(k);
        return res.status(400).json({ error: (c.telefono || c.email) ? 'Ese DNI ya está en nuestra base con otro WhatsApp o mail. Escribí el que nos diste en el local (o pedí que lo actualicen).' : 'Ese DNI ya está en nuestra base pero sin WhatsApp ni mail. Para proteger tus puntos, pedí en el local que los carguen en tu ficha y volvé a intentar.', verificar: true });
      }
      // Ya era clienta: se completan los datos que le falten (no se pisa lo que cargaron en el local)
      await pool.query(`UPDATE clientes SET password_hash = $1, portal_registrado_en = NOW(), portal_email = COALESCE(portal_email, $2::text),
        email = COALESCE(NULLIF(email, ''), $2::text), telefono = COALESCE(NULLIF(telefono, ''), $3::text), fecha_nacimiento = COALESCE(fecha_nacimiento, $5::date) WHERE id = $4`,
        [await bcrypt.hash(password, 10), email, telefono, c.id, nacimiento]);
    } else {
      if (nombre.length < 3 || !/\S+\s+\S+/.test(nombre)) return res.status(400).json({ error: 'Escribí tu nombre y apellido' });
      // Puede que ya este en Lumiere sin DNI (por ejemplo, por un pedido web): se completa esa ficha
      const porTel = (await pool.query(`SELECT * FROM clientes WHERE RIGHT(REGEXP_REPLACE(COALESCE(telefono, ''), '[^0-9]', '', 'g'), 6) = $1
        AND LENGTH(REGEXP_REPLACE(COALESCE(telefono, ''), '[^0-9]', '', 'g')) >= 8 AND COALESCE(cuit_dni, '') = '' AND password_hash IS NULL ORDER BY id LIMIT 1`, [cuentas.soloNumeros(telefono).slice(-6)])).rows[0];
      const hash = await bcrypt.hash(password, 10);
      if (porTel) {
        await pool.query(`UPDATE clientes SET cuit_dni = $1, password_hash = $2, portal_registrado_en = NOW(), portal_email = $3::text, email = COALESCE(NULLIF(email, ''), $3::text),
          fecha_nacimiento = COALESCE(fecha_nacimiento, $5::date), nombre = CASE WHEN LENGTH(COALESCE(nombre, '')) < 3 THEN $6 ELSE nombre END WHERE id = $4`, [dni, hash, email, porTel.id, nacimiento, nombre]);
        c = porTel;
      } else {
        c = (await pool.query(`INSERT INTO clientes (nombre, telefono, email, cuit_dni, password_hash, portal_email, portal_registrado_en, local_id, fecha_nacimiento) VALUES ($1, $2, $3::text, $4, $5, $3::text, NOW(), $6, $7::date) RETURNING *`,
          [nombre, telefono, email, dni, hash, localCliente, nacimiento])).rows[0];
      }
    }
    cuentas.intentos.delete(k);
    const f = (await pool.query('SELECT nombre, telefono, email FROM clientes WHERE id = $1', [c.id])).rows[0];
    res.status(201).json({ token: firmar(req, c.id), cliente: f });
  } catch (e) { console.error('[tienda] crear cuenta:', e.message); if (!res.headersSent) res.status(500).json({ error: 'No pudimos crear la cuenta. Probá de nuevo.' }); }
  finally { if (candado) { try { await candado.query('COMMIT'); } catch (x) {} candado.release(); } }
});

// ===================== Favoritos, "avisame cuando llegue" y carrito guardado =====================
router.get('/:slug/cuenta/favoritos', conCuenta, async (req, res) => {
  try { res.json((await pool.query('SELECT producto_id FROM tienda_favoritos WHERE cliente_id = $1 ORDER BY creado_en DESC', [req.clienteId])).rows.map(r => r.producto_id)); }
  catch (e) { res.status(500).json({ error: 'No se pudieron cargar tus favoritos' }); }
});
// Reemplaza la lista de favoritos (la tienda manda la lista completa)
router.put('/:slug/cuenta/favoritos', conCuenta, async (req, res) => {
  const client = await pool.connect();
  try {
    const ids = [...new Set((Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map(x => parseInt(x)).filter(x => x > 0))].slice(0, 300);
    await client.query('BEGIN');
    await client.query('DELETE FROM tienda_favoritos WHERE cliente_id = $1 AND NOT (producto_id = ANY($2::int[]))', [req.clienteId, ids]);
    if (ids.length) await client.query(`INSERT INTO tienda_favoritos (cliente_id, producto_id) SELECT $1, x FROM unnest($2::int[]) x JOIN productos p ON p.id = x ON CONFLICT DO NOTHING`, [req.clienteId, ids]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} res.status(500).json({ error: 'No se pudo guardar' }); }
  finally { client.release(); }
});
// "Avisame cuando llegue": deja el WhatsApp para que la tienda le avise cuando vuelve el stock
const pedidosAviso = new Map();
router.post('/:slug/avisame', async (req, res) => {
  try {
    const ip = req.ip || 'x', ahora = Date.now();
    const l = (pedidosAviso.get(ip) || []).filter(t => ahora - t < 10 * 60 * 1000); l.push(ahora); pedidosAviso.set(ip, l);
    if (l.length > 15) return res.status(429).json({ error: 'Demasiados pedidos. Probá en un rato.' });
    const b = req.body || {};
    const productoId = parseInt(b.producto_id);
    const clienteId = clienteDeToken(req);
    const nombre = String(b.nombre || '').trim().slice(0, 80), telefono = String(b.telefono || '').trim().slice(0, 40);
    if (nombre.length < 2) return res.status(400).json({ error: 'Escribí tu nombre' });
    if (cuentas.soloNumeros(telefono).length < 8) return res.status(400).json({ error: 'Escribí tu WhatsApp con código de área' });
    const p = (await pool.query('SELECT id, nombre FROM productos WHERE id = $1 AND activo = TRUE', [productoId])).rows[0];
    if (!p) return res.status(400).json({ error: 'No encontramos ese producto' });
    const ya = (await pool.query(`SELECT 1 FROM tienda_avisos WHERE producto_id = $1 AND avisado_en IS NULL AND RIGHT(REGEXP_REPLACE(telefono, '[^0-9]', '', 'g'), 8) = $2`, [p.id, cuentas.soloNumeros(telefono).slice(-8)])).rows.length;
    if (!ya) await pool.query('INSERT INTO tienda_avisos (producto_id, cliente_id, nombre, telefono, local_id) VALUES ($1, $2, $3, $4, $5)', [p.id, clienteId, nombre, telefono, Number(b.local_id) === 2 ? 2 : 1]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar. Probá de nuevo.' }); }
});
// Carrito de la clienta con cuenta (para que la tienda le pueda recordar si lo deja sin terminar)
router.put('/:slug/cuenta/carrito', conCuenta, async (req, res) => {
  try {
    const items = (Array.isArray(req.body && req.body.items) ? req.body.items : []).slice(0, 50).map(i => ({
      producto_id: parseInt(i.producto_id), variante_id: parseInt(i.variante_id) || null, nombre: String(i.nombre || '').slice(0, 120), variante: i.variante ? String(i.variante).slice(0, 60) : null,
      cantidad: Math.min(99, Math.max(1, parseInt(i.cantidad) || 1)), precio: Math.max(0, num(i.precio)), preventa: !!i.preventa,
    })).filter(i => i.producto_id > 0);
    if (!items.length) { await pool.query('DELETE FROM tienda_carritos WHERE cliente_id = $1', [req.clienteId]); return res.json({ ok: true }); }
    const subtotal = items.reduce((t, i) => t + i.precio * i.cantidad, 0);
    await pool.query(`INSERT INTO tienda_carritos (cliente_id, items, subtotal, local_id, actualizado_en) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (cliente_id) DO UPDATE SET items = EXCLUDED.items, subtotal = EXCLUDED.subtotal, local_id = EXCLUDED.local_id, actualizado_en = NOW(),
        recordado_en = CASE WHEN tienda_carritos.items::text = EXCLUDED.items::text THEN tienda_carritos.recordado_en ELSE NULL END`,
      [req.clienteId, JSON.stringify(items), subtotal, Number(req.body.local_id) === 2 ? 2 : 1]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar el carrito' }); }
});

router.get('/:slug/cuenta', conCuenta, async (req, res) => {
  try {
    const d = await cuentas.datosDeCliente(req.clienteId);
    if (!d) return res.status(401).json({ error: 'Volvé a ingresar a tu cuenta', sesion: true });
    const [premios, canjes, pedidos] = await Promise.all([
      cuentas.premiosDeCliente(req.clienteId).catch(() => []),
      cuentas.canjesDeCliente(req.clienteId).catch(() => []),
      pool.query(`SELECT codigo, estado, total, creado_en, entrega FROM tienda_pedidos WHERE cliente_id = $1 ORDER BY creado_en DESC LIMIT 20`, [req.clienteId]).then(r => r.rows).catch(() => []),
    ]);
    // Los canjes que son codigos de descuento: si todavia se pueden usar
    const cods = canjes.map(c => c.codigo).filter(Boolean);
    const cups = cods.length ? (await pool.query('SELECT codigo, tipo, valor, fecha_vencimiento, usos, max_usos, activo FROM cupones WHERE codigo = ANY($1)', [cods]).catch(() => ({ rows: [] }))).rows : [];
    const canjesInfo = canjes.slice(0, 20).map(c => {
      const cu = cups.find(x => x.codigo === c.codigo);
      if (!cu) return c;
      const usable = cu.activo && !(cu.max_usos && (cu.usos || 0) >= cu.max_usos) && !(cu.fecha_vencimiento && new Date(cu.fecha_vencimiento) < new Date(new Date().toDateString()));
      return { ...c, cupon: { tipo: cu.tipo === '%' ? '%' : '$', valor: parseFloat(cu.valor) || 0, vence: cu.fecha_vencimiento, usable } };
    });
    // Cada vez que entra se renueva la llave (si ya tiene mas de un dia): mientras use la tienda, no se sale
    let tokenNuevo = null;
    try { const t = jwt.decode(String(req.headers.authorization || '').replace(/^Bearer /, '')); if (t && t.iat && Date.now() / 1000 - t.iat > 86400) tokenNuevo = firmar(req, req.clienteId); } catch (e) {}
    res.json({ ...d, compras: (d.compras || []).slice(0, 15), premios: premios.map(p => ({ ...p, descuento_pct: cuentas.descuentoDePremio(p) })), canjes: canjesInfo, pedidos, token_nuevo: tokenNuevo });
  } catch (e) { console.error('[tienda] cuenta:', e.message); res.status(500).json({ error: 'No pudimos cargar tu cuenta' }); }
});

router.post('/:slug/cuenta/canjear', conCuenta, async (req, res) => {
  try { res.json(await cuentas.canjearPremio(req.clienteId, parseInt(req.body && req.body.premio_id))); }
  catch (e) {
    if (e instanceof cuentas.ErrorCanje) return res.status(e.codigo).json({ error: e.message });
    console.error('[tienda] canjear:', e.message); res.status(500).json({ error: 'No se pudo canjear' });
  }
});

// ===================== Reseñas =====================
// Solo opina quien compro el producto (en el local o en la web, con su ficha de clienta).
// Quedan pendientes hasta que la tienda las aprueba en Lumiere.
const nombreCorto = (n) => { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return p.length ? p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : '') : 'Clienta'; };
async function compradosPor(clienteId) {
  return (await pool.query(`SELECT producto_id, MAX(f) AS fecha FROM (
      SELECT vi.producto_id, v.creado_en AS f FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id WHERE v.cliente_id = $1 AND ${VENTA_VALIDA}
      UNION ALL
      SELECT i.producto_id, p.creado_en FROM tienda_pedidos p JOIN tienda_pedido_items i ON i.pedido_id = p.id WHERE p.cliente_id = $1 AND p.estado = 'entregado'
    ) x WHERE producto_id IS NOT NULL AND f > NOW() - INTERVAL '18 months' GROUP BY producto_id ORDER BY MAX(f) DESC LIMIT 60`, [clienteId])).rows;
}
router.get('/:slug/resenas/:productoId', async (req, res) => {
  try {
    const r = await pool.query(`SELECT r.id, r.estrellas, r.texto, r.creado_en, (r.foto IS NOT NULL) AS foto, c.nombre FROM tienda_resenas r LEFT JOIN clientes c ON c.id = r.cliente_id
      WHERE r.producto_id = $1 AND r.estado = 'aprobada' ORDER BY (r.foto IS NOT NULL) DESC, r.creado_en DESC LIMIT 60`, [parseInt(req.params.productoId) || 0]);
    const n = r.rows.length, prom = n ? Math.round(r.rows.reduce((t, x) => t + x.estrellas, 0) / n * 10) / 10 : 0;
    const dist = [5, 4, 3, 2, 1].map(e => r.rows.filter(x => x.estrellas === e).length);
    res.json({ prom, n, dist, lista: r.rows.map(x => ({ id: x.id, estrellas: x.estrellas, texto: x.texto, fecha: x.creado_en, foto: x.foto, nombre: nombreCorto(x.nombre) })) });
  } catch (e) { res.json({ prom: 0, n: 0, dist: [0, 0, 0, 0, 0], lista: [] }); }
});
router.get('/:slug/resena-foto/:id', async (req, res) => {
  try {
    const r = (await pool.query(`SELECT foto, foto_tipo FROM tienda_resenas WHERE id = $1 AND estado = 'aprobada' AND foto IS NOT NULL`, [parseInt(req.params.id) || 0])).rows[0];
    if (!r) return res.status(404).end();
    res.set('Content-Type', r.foto_tipo || 'image/jpeg').set('Cache-Control', 'public, max-age=86400').send(r.foto);
  } catch (e) { res.status(404).end(); }
});
// Lo que compro y todavia no reseño, y sus reseñas (con el estado)
router.get('/:slug/cuenta/resenas', conCuenta, async (req, res) => {
  try {
    const [compras, mias] = await Promise.all([compradosPor(req.clienteId),
      pool.query(`SELECT r.id, r.producto_id, r.estrellas, r.texto, r.estado, r.puntos_dados, (r.foto IS NOT NULL) AS foto, p.nombre FROM tienda_resenas r JOIN productos p ON p.id = r.producto_id
        WHERE r.cliente_id = $1 ORDER BY r.creado_en DESC`, [req.clienteId]).then(r => r.rows)]);
    const hechas = new Set(mias.map(x => x.producto_id));
    const ids = compras.map(x => x.producto_id).filter(id => !hechas.has(id));
    // Solo lo que esta publicado en la tienda (ahi es donde se ve la reseña)
    const prods = ids.length ? (await pool.query(`SELECT p.id, p.nombre, EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto FROM productos p
      JOIN tienda_productos tp ON tp.producto_id = p.id AND tp.publicado WHERE p.id = ANY($1::int[]) AND p.activo = TRUE`, [ids])).rows : [];
    res.json({ para_resenar: ids.map(id => prods.find(p => p.id === id)).filter(Boolean), mias });
  } catch (e) { console.error('[tienda] resenas cuenta:', e.message); res.status(500).json({ error: 'No se pudieron cargar tus reseñas' }); }
});
const envioResenas = new Map();
router.post('/:slug/cuenta/resenas', conCuenta, async (req, res) => {
  try {
    const ahora = Date.now(), l = (envioResenas.get(req.clienteId) || []).filter(t => ahora - t < 3600 * 1000); l.push(ahora); envioResenas.set(req.clienteId, l);
    if (l.length > 20) return res.status(429).json({ error: 'Demasiadas reseñas seguidas. Probá en un rato.' });
    const b = req.body || {};
    const productoId = parseInt(b.producto_id), estrellas = parseInt(b.estrellas), texto = String(b.texto || '').trim().replace(/\s+\n/g, '\n').slice(0, 1000);
    if (!(estrellas >= 1 && estrellas <= 5)) return res.status(400).json({ error: 'Elegí de 1 a 5 estrellas' });
    if (texto.length < 10) return res.status(400).json({ error: 'Contanos un poquito más (al menos 10 letras)' });
    if (!(await compradosPor(req.clienteId)).some(x => x.producto_id === productoId)) return res.status(403).json({ error: 'Solo podés opinar de productos que compraste' });
    let foto = null, tipo = null;
    if (b.foto) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.foto));
      if (!m) return res.status(400).json({ error: 'La foto tiene que ser JPG, PNG o WebP' });
      foto = Buffer.from(m[2], 'base64'); tipo = m[1];
      if (foto.length > 700 * 1024) return res.status(400).json({ error: 'La foto es muy pesada' });
    }
    // Si la edita, vuelve a quedar pendiente de aprobación. La foto se mantiene si no manda otra (salvo que la saque).
    await pool.query(`INSERT INTO tienda_resenas (producto_id, cliente_id, estrellas, texto, foto, foto_tipo) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (producto_id, cliente_id) DO UPDATE SET estrellas = EXCLUDED.estrellas, texto = EXCLUDED.texto, estado = 'pendiente', creado_en = NOW(), revisado_en = NULL,
        foto = CASE WHEN EXCLUDED.foto IS NOT NULL THEN EXCLUDED.foto WHEN $7 THEN NULL ELSE tienda_resenas.foto END,
        foto_tipo = CASE WHEN EXCLUDED.foto IS NOT NULL THEN EXCLUDED.foto_tipo WHEN $7 THEN NULL ELSE tienda_resenas.foto_tipo END`,
      [productoId, req.clienteId, estrellas, texto, foto, tipo, !!b.quitar_foto]);
    res.json({ ok: true });
  } catch (e) { console.error('[tienda] resena:', e.message); res.status(500).json({ error: 'No se pudo guardar tu reseña. Probá de nuevo.' }); }
});

// ===================== Recomendaciones (lo que compran juntas) =====================
// Para uno o varios productos: lo que las clientas llevaron en la misma compra, o la misma
// clienta en los 3 meses siguientes. Se cuenta cada clienta una vez. Queda en memoria 6 horas.
const cacheRec = new Map();
router.get('/:slug/recomendados', async (req, res) => {
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').map(x => parseInt(x)).filter(x => x > 0))].slice(0, 20);
    if (!ids.length) return res.json([]);
    const clave = req.negTienda.id + ':' + ids.slice().sort((a, b) => a - b).join(',');
    const c = cacheRec.get(clave);
    if (c && Date.now() - c.t < 6 * 3600 * 1000) return res.json(c.d);
    const r = await pool.query(`
      WITH base AS (
        SELECT DISTINCT v.id, v.cliente_id, v.creado_en FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
        WHERE vi.producto_id = ANY($1::int[]) AND v.creado_en > NOW() - INTERVAL '18 months' AND ${VENTA_VALIDA})
      SELECT vi.producto_id AS id, COUNT(DISTINCT COALESCE('c' || v.cliente_id::text, 'v' || v.id::text))::int AS n
      FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
      JOIN base b ON v.id = b.id OR (b.cliente_id IS NOT NULL AND v.cliente_id = b.cliente_id AND v.creado_en BETWEEN b.creado_en AND b.creado_en + INTERVAL '90 days')
      JOIN tienda_productos tp ON tp.producto_id = vi.producto_id AND tp.publicado
      WHERE NOT (vi.producto_id = ANY($1::int[])) AND ${VENTA_VALIDA}
      GROUP BY vi.producto_id HAVING COUNT(DISTINCT COALESCE('c' || v.cliente_id::text, 'v' || v.id::text)) >= 2
      ORDER BY n DESC LIMIT 24`, [ids]);
    if (cacheRec.size > 2000) cacheRec.clear();
    cacheRec.set(clave, { t: Date.now(), d: r.rows });
    res.json(r.rows);
  } catch (e) { console.error('[tienda] recomendados:', e.message); res.json([]); }
});

module.exports = router;
