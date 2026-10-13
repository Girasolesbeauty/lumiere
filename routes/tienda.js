const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const tienda = require('../lib/tienda');
const gocuotas = require('../lib/gocuotas');
const { ayudaMP } = require('./mercadopago');
const QRCode = require('qrcode');
const { VENTA_VALIDA } = require('../lib/niveles');

// Tienda web: lo que se maneja desde Lumiere (configuracion, productos publicados y pedidos).
// La parte publica esta en routes/tiendaPublica.js. Ver lib/tienda.js.

const { num } = tienda;
// Quien maneja la tienda: dueña, admin y administrativo, o quien tenga el permiso "Manejar toda la tienda online"
// (se lee en cada pedido, ver router.use). Las claves de GoCuotas y el dominio quedan solo para la dueña o admin.
const esDuena = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const esJefe = (req) => esDuena(req) || !!req.manejaTienda;
const SLUG_OK = /^[a-z0-9][a-z0-9-]{2,40}$/;

router.use(async (req, res, next) => {
  try {
    await tienda.asegurar(); await tienda.vencerPendientes().catch(() => {});
    if (req.usuario && !esDuena(req) && req.usuario.id) {
      req.manejaTienda = (await pool.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'tienda.admin'`, [req.usuario.id]).catch(() => ({ rows: [] }))).rows.length > 0;
    }
    next();
  } catch (e) { res.status(500).json({ error: 'No se pudo abrir la tienda' }); }
});

router.get('/config', async (req, res) => {
  try {
    const c = await tienda.leerConfig();
    let mp = false;
    try { await ayudaMP.asegurar(); mp = !!(await ayudaMP.token()); } catch (e) {}
    const neg = (await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const sugerido = String(neg.nombre_negocio || 'mi-tienda').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mi-tienda';
    const dominio = await tienda.dominioDe(req.negocio ? req.negocio.id : 1).catch(() => null);
    res.json({ ...c, ruleta: tienda.ruletaDe(c), preventa: tienda.preventaDe(c), regalos: tienda.regalosDe(c), regalos_hoy: tienda.temaRegaloHoy(tienda.regalosDe(c)), mp_conectado: mp, slug_sugerido: sugerido, dominio: dominio || '' });
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la configuración' }); }
});

router.put('/config', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado puede configurar la tienda' });
    const b = req.body || {};
    const slug = String(b.slug || '').trim().toLowerCase();
    if (b.activo && !SLUG_OK.test(slug)) return res.status(400).json({ error: 'La dirección tiene que tener entre 3 y 40 letras o números (sin espacios; podés usar guiones). Ej: girasoles' });
    const zonas = (Array.isArray(b.envio_zonas) ? b.envio_zonas : []).map(z => ({ nombre: String(z.nombre || '').trim().slice(0, 60), costo: Math.max(0, num(z.costo)), local: Number(z.local || b.envio_local) === 2 ? 2 : 1 })).filter(z => z.nombre).slice(0, 30);
    if (b.envio_activo && !zonas.length) return res.status(400).json({ error: 'Para ofrecer envío, cargá al menos una zona con su costo' });
    if (b.activo && !b.retiro_activo && !b.envio_activo) return res.status(400).json({ error: 'Elegí al menos una forma de entrega (retiro o envío)' });
    if (b.activo && !b.pago_mp && !b.pago_transferencia && !b.pago_retiro && !b.pago_gocuotas) return res.status(400).json({ error: 'Elegí al menos una forma de pago' });
    if (b.pago_gocuotas && !(await gocuotas.conectado())) return res.status(400).json({ error: 'Para cobrar con GoCuotas, primero conectá tu cuenta (mail y contraseña de GoCuotas)' });
    if (b.pago_transferencia && !String(b.transferencia_datos || '').trim()) return res.status(400).json({ error: 'Para cobrar por transferencia, escribí el alias o CBU y el titular' });
    const locales = (Array.isArray(b.retiro_locales) ? b.retiro_locales : []).map(Number).filter(x => x === 1 || x === 2);
    // La direccion se reserva recien cuando todo lo demas esta bien
    if (slug && SLUG_OK.test(slug)) {
      const ok = await tienda.guardarSlug(slug, req.negocio ? req.negocio.id : 1);
      if (!ok) return res.status(400).json({ error: 'Esa dirección ya la usa otra tienda. Probá con otra.' });
    }
    await pool.query(`UPDATE tienda_config SET activo=$1, slug=$2, titulo=$3, mensaje=$4, color=$5, whatsapp=$6, retiro_activo=$7, retiro_locales=$8,
        envio_activo=$9, envio_zonas=$10, envio_gratis_desde=$11, envio_local=$12, pago_mp=$13, pago_transferencia=$14, transferencia_datos=$15, pago_retiro=$16, horas_reserva=$17, anuncios=$18 WHERE id=1`,
      [!!b.activo, slug || null, String(b.titulo || '').trim().slice(0, 80) || null, String(b.mensaje || '').trim().slice(0, 300) || null,
       /^#[0-9a-fA-F]{6}$/.test(String(b.color || '')) ? b.color : null, String(b.whatsapp || '').trim().slice(0, 40) || null,
       !!b.retiro_activo, locales.length ? locales : null, !!b.envio_activo, JSON.stringify(zonas),
       num(b.envio_gratis_desde) > 0 ? num(b.envio_gratis_desde) : null, Number(b.envio_local) === 2 ? 2 : 1,
       !!b.pago_mp, !!b.pago_transferencia, String(b.transferencia_datos || '').trim().slice(0, 300) || null, !!b.pago_retiro,
       Math.min(168, Math.max(1, parseInt(b.horas_reserva) || 24)),
       String(b.anuncios || '').split('\n').map(x => x.trim().slice(0, 90)).filter(Boolean).slice(0, 5).join('\n') || null]);
    await pool.query('UPDATE tienda_config SET pago_gocuotas = $1, descuentos_pago = $2 WHERE id = 1', [!!b.pago_gocuotas, JSON.stringify(tienda.descuentosPagoDe({ descuentos_pago: b.descuentos_pago }))]);
    // Dominio propio (opcional): se guarda en el registro central, junto a la direccion de la tienda
    if (b.dominio !== undefined && esDuena(req)) {
      const d = String(b.dominio || '').trim() ? tienda.limpiarDominio(b.dominio) : null;
      if (String(b.dominio || '').trim() && !d) return res.status(400).json({ error: 'El dominio no es válido. Escribilo así: girasolesbeauty.com.ar' });
      if (d && /(^|\.)(sistemalumiere\.com|vercel\.app|railway\.app)$/.test(d)) return res.status(400).json({ error: 'Ese dominio no se puede usar' });
      if (!(await tienda.guardarDominio(req.negocio ? req.negocio.id : 1, d))) return res.status(400).json({ error: 'Ese dominio ya lo usa otra tienda' });
    }
    // Preventa (productos que vienen en camino)
    if (b.preventa && typeof b.preventa === 'object') await pool.query('UPDATE tienda_config SET preventa = $1 WHERE id = 1', [JSON.stringify(tienda.preventaDe({ preventa: b.preventa }))]);
    // Ruleta de premios (compras grandes)
    if (b.ruleta && typeof b.ruleta === 'object') {
      const r = tienda.limpiarRuleta(b.ruleta);
      if (r.activo && r.premios.length < 2) return res.status(400).json({ error: 'La ruleta necesita al menos 2 opciones' });
      if (r.activo && !r.premios.some(p => p.chance > 0)) return res.status(400).json({ error: 'Poné chances a las opciones de la ruleta' });
      await pool.query('UPDATE tienda_config SET ruleta = $1 WHERE id = 1', [JSON.stringify(r)]);
    }
    // Redes: se guarda el usuario o el link tal como lo escribio (la tienda arma el link)
    if (b.redes && typeof b.redes === 'object') {
      const redes = {};
      for (const k of ['instagram', 'tiktok', 'facebook']) { const v = String(b.redes[k] || '').trim().slice(0, 200); if (v) redes[k] = v; }
      await pool.query('UPDATE tienda_config SET redes = $1 WHERE id = 1', [JSON.stringify(redes)]);
    }
    // Icono para el acceso directo del celular (cuadrado, ya achicado en el navegador). Vacio = el de Lumiere
    if (Object.prototype.hasOwnProperty.call(b, 'icono')) {
      const ic = String(b.icono || '');
      if (ic && (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(ic) || ic.length > 700000)) return res.status(400).json({ error: 'El ícono tiene que ser una imagen PNG o JPG' });
      await pool.query('UPDATE tienda_config SET icono = $1 WHERE id = 1', [ic || null]);
    }
    // Logo propio de la tienda (imagen chica, ya achicada en el navegador). Vacio = usar el del negocio
    if (Object.prototype.hasOwnProperty.call(b, 'logo')) {
      const logo = String(b.logo || '');
      if (logo && (!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 600000)) return res.status(400).json({ error: 'El logo tiene que ser una imagen PNG o JPG' });
      await pool.query('UPDATE tienda_config SET logo = $1 WHERE id = 1', [logo || null]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[tienda] config:', e.message);
    res.status(500).json({ error: 'No se pudo guardar' });
  }
});

// ---- Portada y sectores ----
// banner: ids en orden (son los destacados). filas: [{id, titulo, productos}]. sectores: [{id, nombre, categorias, productos}]
const ids = (x, max) => [...new Set((Array.isArray(x) ? x : []).map(v => parseInt(v)).filter(v => v > 0))].slice(0, max);
const texto = (x, max) => String(x || '').trim().slice(0, max);
const idSeccion = (x) => /^[a-z0-9]{1,12}$/.test(String(x || '')) ? String(x) : Math.random().toString(36).slice(2, 10);

router.get('/portada', async (req, res) => {
  try {
    const c = await tienda.leerConfig();
    const dest = (await pool.query('SELECT producto_id FROM tienda_productos WHERE destacado ORDER BY producto_id')).rows.map(r => r.producto_id);
    // El banner respeta el orden guardado y suma los destacados marcados con la estrella en Productos
    const banner = [...(c.banner || []).filter(id => dest.includes(id)), ...dest.filter(id => !(c.banner || []).includes(id))];
    res.json({ banner, banners_img: c.banners_img || [], filas: c.filas || [], sectores: c.sectores || [], reingreso: { activo: !!c.reingreso_activo, dias: c.reingreso_dias || 14, nombre: c.reingreso_nombre || '' } });
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la portada' }); }
});

router.put('/portada', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!esJefe(req)) { client.release(); return res.status(403).json({ error: 'Solo el dueño o encargado' }); }
    const b = req.body || {};
    const banner = ids(b.banner, 12);
    const filas = (Array.isArray(b.filas) ? b.filas : []).slice(0, 12).map(f => ({ id: idSeccion(f.id), titulo: texto(f.titulo, 60), productos: ids(f.productos, 40) })).filter(f => f.titulo);
    const sectores = (Array.isArray(b.sectores) ? b.sectores : []).slice(0, 12).map(s => ({
      id: idSeccion(s.id), nombre: texto(s.nombre, 40),
      categorias: [...new Set((Array.isArray(s.categorias) ? s.categorias : []).map(x => texto(x, 80)).filter(Boolean))].slice(0, 40),
      productos: ids(s.productos, 300),
    })).filter(s => s.nombre);
    const DESTINOS = ['producto', 'sector', 'categoria', 'marca', 'reingreso', 'ninguno'];
    const bannersImg = (Array.isArray(b.banners_img) ? b.banners_img : []).slice(0, 10).map(x => ({
      id: idSeccion(x.id), imagen: parseInt(x.imagen) || null, imagen_movil: parseInt(x.imagen_movil) || null,
      titulo: texto(x.titulo, 80), texto: texto(x.texto, 160), boton: texto(x.boton, 30),
      destino: DESTINOS.includes(x.destino) ? x.destino : 'ninguno', valor: texto(x.valor, 120),
    })).filter(x => x.imagen);
    if (filas.some(f => !f.productos.length)) return res.status(400).json({ error: 'Cada fila de la portada necesita al menos un producto' });
    if (sectores.some(s => !s.categorias.length && !s.productos.length)) return res.status(400).json({ error: 'Cada sector necesita al menos una categoría o un producto' });
    await client.query('BEGIN');
    const re = b.reingreso || {};
    await client.query('UPDATE tienda_config SET banner = $1, filas = $2, sectores = $3, reingreso_activo = $4, reingreso_dias = $5, reingreso_nombre = $6, banners_img = $7 WHERE id = 1',
      [JSON.stringify(banner), JSON.stringify(filas), JSON.stringify(sectores), !!re.activo, Math.min(90, Math.max(1, parseInt(re.dias) || 14)), texto(re.nombre, 40) || null, JSON.stringify(bannersImg)]);
    // Las imagenes que ya no usa ningun banner se borran (las subidas en las ultimas 6 horas se dejan: pueden estar sin guardar todavia)
    const usadas = bannersImg.flatMap(x => [x.imagen, x.imagen_movil]).filter(Boolean);
    await client.query(`DELETE FROM tienda_banner_imagenes WHERE NOT (id = ANY($1::int[])) AND creado_en < NOW() - INTERVAL '6 hours'`, [usadas]);
    // Los del banner quedan destacados (la estrella en Productos) y los demas no
    await client.query('UPDATE tienda_productos SET destacado = FALSE WHERE destacado AND NOT (producto_id = ANY($1::int[]))', [banner]);
    for (const id of banner) await client.query(`INSERT INTO tienda_productos (producto_id, destacado) VALUES ($1, TRUE) ON CONFLICT (producto_id) DO UPDATE SET destacado = TRUE`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); console.error('[tienda] portada:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); } finally { client.release(); }
});

// Imagen de un banner (llega ya achicada del navegador, en buena calidad; hasta 6 MB)
router.post('/banner-imagen', express.raw({ type: () => true, limit: '6mb' }), async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return res.status(400).json({ error: 'La imagen tiene que ser JPG, PNG o WebP' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No llegó la imagen' });
    const r = await pool.query('INSERT INTO tienda_banner_imagenes (tipo, datos) VALUES ($1, $2) RETURNING id', [tipo, req.body]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[tienda] banner imagen:', e.message); res.status(500).json({ error: 'No se pudo subir la imagen' }); }
});

router.get('/banner-imagen/:id', async (req, res) => {
  try {
    const r = (await pool.query('SELECT tipo, datos FROM tienda_banner_imagenes WHERE id = $1', [req.params.id])).rows[0];
    if (!r) return res.status(404).end();
    res.set('Content-Type', r.tipo).set('Cache-Control', 'private, max-age=86400').send(r.datos);
  } catch (e) { res.status(404).end(); }
});

// ---- Sector de videos (reels de Instagram por link, YouTube o videos subidos) ----
router.get('/reels', async (req, res) => {
  try {
    const c = await tienda.leerConfig();
    const r = await pool.query('SELECT id, titulo, tipo, codigo, productos FROM tienda_reels ORDER BY orden, id');
    res.json({ titulo: c.reels_titulo || '', reels: r.rows });
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los videos' }); }
});
const sigOrden = async () => (await pool.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM tienda_reels')).rows[0].n;
router.post('/reels/link', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const url = String((req.body && req.body.url) || '').trim();
    const ig = tienda.reelDeLink(url), yt = tienda.videoDeLink(url), tt = /tiktok\.com/i.test(url) ? await tienda.tiktokDeLink(url) : null;
    if (!ig && !tt && !(yt && yt.tipo === 'youtube')) return res.status(400).json({ error: 'Pegá el link de un reel de Instagram, de un video de TikTok o de YouTube' });
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM tienda_reels')).rows[0].n;
    if (n >= 40) return res.status(400).json({ error: 'Ya hay 40 videos. Borrá alguno para sumar otro.' });
    const r = await pool.query('INSERT INTO tienda_reels (tipo, codigo, orden) VALUES ($1, $2, $3) RETURNING id', [ig ? 'instagram' : tt ? 'tiktok' : 'youtube', ig || tt || yt.id, await sigOrden()]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: 'No se pudo agregar' }); }
});
router.post('/reels/subir', express.raw({ type: () => true, limit: tienda.VIDEO_MAX_MB + 'mb' }), async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!/^video\/(mp4|webm|quicktime)$/.test(tipo)) return res.status(400).json({ error: 'El video tiene que ser .mp4, .mov o .webm' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No llegó el video' });
    const r = await pool.query('INSERT INTO tienda_reels (tipo, mime, datos, orden) VALUES ($1, $2, $3, $4) RETURNING id', ['subido', tipo, req.body, await sigOrden()]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[tienda] reel:', e.message); res.status(500).json({ error: 'No se pudo subir el video' }); }
});
router.put('/reels/orden', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const lista = ids(req.body && req.body.ids, 100);
    for (let i = 0; i < lista.length; i++) await pool.query('UPDATE tienda_reels SET orden = $1 WHERE id = $2', [i + 1, lista[i]]);
    if (req.body && req.body.titulo !== undefined) await pool.query('UPDATE tienda_config SET reels_titulo = $1 WHERE id = 1', [texto(req.body.titulo, 40) || null]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/reels/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const b = req.body || {};
    await pool.query('UPDATE tienda_reels SET titulo = $1, productos = $2 WHERE id = $3', [texto(b.titulo, 80) || null, ids(b.productos, 12), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.delete('/reels/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await pool.query('DELETE FROM tienda_reels WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

// QR de la direccion de la tienda (para el mostrador o Instagram)
router.get('/qr', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!/^https?:\/\/\S+$/.test(url) || url.length > 300) return res.status(400).json({ error: 'Dirección no válida' });
    res.json({ qr: await QRCode.toDataURL(url, { width: 360, margin: 1 }) });
  } catch (e) { res.status(500).json({ error: 'No se pudo armar el QR' }); }
});

// ---- GoCuotas: conectar la cuenta de comercio (mail y contraseña; la contraseña no vuelve al navegador) ----
router.get('/gocuotas', async (req, res) => {
  try { const c = await gocuotas.credenciales(); res.json({ conectado: !!c, email: c ? c.email : null }); }
  catch (e) { res.json({ conectado: false, email: null }); }
});
router.put('/gocuotas', async (req, res) => {
  try {
    if (!esDuena(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await gocuotas.conectar(req.body && req.body.email, req.body && req.body.password);
    res.json({ conectado: true, email: String(req.body.email || '').trim() });
  } catch (e) { res.status(400).json({ error: e.message || 'No se pudo conectar con GoCuotas' }); }
});
router.delete('/gocuotas', async (req, res) => {
  try {
    if (!esDuena(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await gocuotas.desconectar();
    await pool.query('UPDATE tienda_config SET pago_gocuotas = FALSE WHERE id = 1');
    res.json({ conectado: false });
  } catch (e) { res.status(500).json({ error: 'No se pudo desconectar' }); }
});

// QRs de varios productos de una vez (para imprimir las etiquetas de precio del local)
router.post('/qr-lote', async (req, res) => {
  try {
    const urls = (Array.isArray(req.body && req.body.urls) ? req.body.urls : []).slice(0, 150).map(String);
    if (urls.some(u => !/^https?:\/\/\S+$/.test(u) || u.length > 300)) return res.status(400).json({ error: 'Dirección no válida' });
    res.json({ qrs: await Promise.all(urls.map(u => QRCode.toDataURL(u, { width: 320, margin: 1, errorCorrectionLevel: 'M' }))) });
  } catch (e) { res.status(500).json({ error: 'No se pudieron armar los QR' }); }
});

// Productos para elegir que se publica
router.get('/productos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, p.codigo_barras, p.proveedor_id, pr.nombre AS proveedor, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
             COALESCE(tp.publicado, FALSE) AS publicado, tp.descripcion, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url, tp.etiquetas,
             EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto,
             EXISTS (SELECT 1 FROM tienda_videos v WHERE v.producto_id = p.id) AS video_subido,
             (SELECT COUNT(*)::int FROM tienda_fotos f WHERE f.producto_id = p.id) AS fotos_extra
      FROM productos p LEFT JOIN tienda_productos tp ON tp.producto_id = p.id LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      WHERE p.activo = TRUE ORDER BY COALESCE(tp.publicado, FALSE) DESC, p.nombre`);
    res.json(r.rows.map(p => ({ ...p, precio: num(p.precio) })));
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los productos' }); }
});

router.put('/productos/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const b = req.body || {};
    const link = b.video_url === undefined ? undefined : String(b.video_url || '').trim();
    if (link && !tienda.videoDeLink(link)) return res.status(400).json({ error: 'Ese link no es de un video que podamos mostrar. Usá un link de YouTube, Vimeo o de un archivo .mp4.' });
    await pool.query(`INSERT INTO tienda_productos (producto_id, publicado, descripcion, destacado, video_url) VALUES ($1, COALESCE($2, FALSE), $3, COALESCE($5, FALSE), $6)
      ON CONFLICT (producto_id) DO UPDATE SET publicado = COALESCE($2, tienda_productos.publicado),
        descripcion = CASE WHEN $4 THEN $3 ELSE tienda_productos.descripcion END,
        destacado = COALESCE($5, tienda_productos.destacado),
        video_url = CASE WHEN $7 THEN $6 ELSE tienda_productos.video_url END`,
      [req.params.id, b.publicado === undefined ? null : !!b.publicado, String(b.descripcion || '').trim().slice(0, 1500) || null, b.descripcion !== undefined,
       b.destacado === undefined ? null : !!b.destacado, link ? link.slice(0, 500) : null, link !== undefined]);
    if (b.etiquetas !== undefined) await pool.query('UPDATE tienda_productos SET etiquetas = $2 WHERE producto_id = $1', [req.params.id, tienda.limpiarEtiquetas(b.etiquetas)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// ---- Fotos de un producto: portada (producto_imagenes) + extras (tienda_fotos) ----
const IMG_OK = (x) => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x) && x.length <= 400 * 1024;

router.get('/productos/:id/fotos', async (req, res) => {
  try {
    const portada = (await pool.query('SELECT imagen FROM producto_imagenes WHERE producto_id = $1', [req.params.id]).catch(() => ({ rows: [] }))).rows[0];
    const extras = (await pool.query('SELECT id, imagen FROM tienda_fotos WHERE producto_id = $1 ORDER BY orden, id', [req.params.id])).rows;
    res.json({ portada: portada ? portada.imagen : null, extras });
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar las fotos' }); }
});

// Agrega una foto. Si el producto no tiene portada, esta pasa a ser la portada.
router.post('/productos/:id/fotos', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const imagen = String((req.body && req.body.imagen) || '');
    if (!IMG_OK(imagen)) return res.status(400).json({ error: 'La foto no es válida o es muy pesada' });
    const tiene = (await pool.query('SELECT 1 FROM producto_imagenes WHERE producto_id = $1', [req.params.id])).rows.length;
    if (!tiene) {
      await pool.query(`INSERT INTO producto_imagenes (producto_id, imagen, actualizado_en) VALUES ($1, $2, NOW())`, [req.params.id, imagen]);
      return res.json({ ok: true, portada: true });
    }
    const n = (await pool.query('SELECT COUNT(*)::int AS n, COALESCE(MAX(orden), 0) AS m FROM tienda_fotos WHERE producto_id = $1', [req.params.id])).rows[0];
    if (n.n >= tienda.FOTOS_EXTRA_MAX) return res.status(400).json({ error: 'Ya tiene ' + (tienda.FOTOS_EXTRA_MAX + 1) + ' fotos (la portada y ' + tienda.FOTOS_EXTRA_MAX + ' más). Borrá alguna para sumar otra.' });
    const r = await pool.query('INSERT INTO tienda_fotos (producto_id, imagen, orden) VALUES ($1, $2, $3) RETURNING id', [req.params.id, imagen, n.m + 1]);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) { console.error('[tienda] foto:', e.message); res.status(500).json({ error: 'No se pudo guardar la foto' }); }
});

router.delete('/fotos/:fotoId', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await pool.query('DELETE FROM tienda_fotos WHERE id = $1', [req.params.fotoId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar la foto' }); }
});

// Borra la portada: la primera foto extra (si hay) pasa a ser la portada
router.delete('/productos/:id/portada', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!esJefe(req)) { client.release(); return res.status(403).json({ error: 'Solo el dueño o encargado' }); }
    await client.query('BEGIN');
    await client.query('DELETE FROM producto_imagenes WHERE producto_id = $1', [req.params.id]);
    const sig = (await client.query('SELECT id, imagen FROM tienda_fotos WHERE producto_id = $1 ORDER BY orden, id LIMIT 1', [req.params.id])).rows[0];
    if (sig) {
      await client.query('INSERT INTO producto_imagenes (producto_id, imagen, actualizado_en) VALUES ($1, $2, NOW())', [req.params.id, sig.imagen]);
      await client.query('DELETE FROM tienda_fotos WHERE id = $1', [sig.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ error: 'No se pudo borrar la foto' }); } finally { client.release(); }
});

// Una foto extra pasa a ser la portada (y la portada anterior queda como extra, en su lugar)
router.post('/fotos/:fotoId/portada', async (req, res) => {
  const client = await pool.connect();
  try {
    if (!esJefe(req)) { client.release(); return res.status(403).json({ error: 'Solo el dueño o encargado' }); }
    await client.query('BEGIN');
    const f = (await client.query('SELECT * FROM tienda_fotos WHERE id = $1 FOR UPDATE', [req.params.fotoId])).rows[0];
    if (!f) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No encontramos esa foto' }); }
    const vieja = (await client.query('SELECT imagen FROM producto_imagenes WHERE producto_id = $1', [f.producto_id])).rows[0];
    await client.query(`INSERT INTO producto_imagenes (producto_id, imagen, actualizado_en) VALUES ($1, $2, NOW())
      ON CONFLICT (producto_id) DO UPDATE SET imagen = EXCLUDED.imagen, actualizado_en = NOW()`, [f.producto_id, f.imagen]);
    if (vieja) await client.query('UPDATE tienda_fotos SET imagen = $1 WHERE id = $2', [vieja.imagen, f.id]);
    else await client.query('DELETE FROM tienda_fotos WHERE id = $1', [f.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ error: 'No se pudo cambiar la portada' }); } finally { client.release(); }
});

// Orden de las fotos extra
router.put('/productos/:id/fotos/orden', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map(x => parseInt(x)).filter(x => x > 0);
    for (let i = 0; i < ids.length; i++) await pool.query('UPDATE tienda_fotos SET orden = $1 WHERE id = $2 AND producto_id = $3', [i + 1, ids[i], req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo ordenar' }); }
});

// Video subido desde la compu o el celular (se guarda en la base, hasta VIDEO_MAX_MB)
router.post('/productos/:id/video', express.raw({ type: () => true, limit: tienda.VIDEO_MAX_MB + 'mb' }), async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!/^video\/(mp4|webm|quicktime)$/.test(tipo)) return res.status(400).json({ error: 'El video tiene que ser .mp4, .mov o .webm' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No llegó el video' });
    await pool.query(`INSERT INTO tienda_videos (producto_id, tipo, datos) VALUES ($1, $2, $3)
      ON CONFLICT (producto_id) DO UPDATE SET tipo = $2, datos = $3, actualizado_en = NOW()`, [req.params.id, tipo, req.body]);
    await pool.query(`INSERT INTO tienda_productos (producto_id) VALUES ($1) ON CONFLICT (producto_id) DO NOTHING`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error('[tienda] video:', e.message); res.status(500).json({ error: 'No se pudo subir el video' }); }
});

router.delete('/productos/:id/video', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await pool.query('DELETE FROM tienda_videos WHERE producto_id = $1', [req.params.id]);
    await pool.query('UPDATE tienda_productos SET video_url = NULL WHERE producto_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo sacar el video' }); }
});

// Publicar o sacar varios de una vez (los que se ven en la lista, o todos)
router.post('/productos/masivo', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const b = req.body || {};
    const publicado = !!b.publicado;
    const ids = Array.isArray(b.ids) ? b.ids.map(x => parseInt(x)).filter(x => x > 0).slice(0, 20000) : null;
    const r = await pool.query(`INSERT INTO tienda_productos (producto_id, publicado)
      SELECT p.id, $1 FROM productos p WHERE p.activo = TRUE AND ($2::int[] IS NULL OR p.id = ANY($2))
      ON CONFLICT (producto_id) DO UPDATE SET publicado = $1 RETURNING producto_id`, [publicado, ids]);
    res.json({ ok: true, cambiados: r.rows.length });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});

// Segmentar muchos productos de una vez: [{ id, etiquetas }] (etiquetas null = volver a automatico)
router.post('/productos/etiquetas', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const lista = Array.isArray(req.body && req.body.cambios) ? req.body.cambios.slice(0, 20000) : [];
    const ids = [], ets = [];
    for (const c of lista) { const id = parseInt(c && c.id); if (id > 0) { ids.push(id); ets.push(JSON.stringify(tienda.limpiarEtiquetas(c.etiquetas))); } }
    if (!ids.length) return res.status(400).json({ error: 'No hay productos para cambiar' });
    const r = await pool.query(`INSERT INTO tienda_productos (producto_id, etiquetas)
      SELECT x.id, NULLIF(x.e, 'null')::jsonb FROM unnest($1::int[], $2::text[]) AS x(id, e) JOIN productos p ON p.id = x.id
      ON CONFLICT (producto_id) DO UPDATE SET etiquetas = EXCLUDED.etiquetas RETURNING producto_id`, [ids, ets]);
    res.json({ ok: true, cambiados: r.rows.length });
  } catch (e) { console.error('[tienda] etiquetas:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Guardar muchas descripciones de una vez (por ejemplo, las traidas de la tienda anterior)
router.post('/productos/descripciones', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const items = (Array.isArray(req.body && req.body.items) ? req.body.items : []).slice(0, 5000)
      .map(x => ({ id: parseInt(x.producto_id), d: String(x.descripcion || '').trim().slice(0, 1500) })).filter(x => x.id > 0 && x.d);
    const reemplazar = !!(req.body && req.body.reemplazar);
    let n = 0;
    for (const it of items) {
      const r = await pool.query(`INSERT INTO tienda_productos (producto_id, descripcion) VALUES ($1, $2)
        ON CONFLICT (producto_id) DO UPDATE SET descripcion = $2
        WHERE $3 OR tienda_productos.descripcion IS NULL OR tienda_productos.descripcion = '' RETURNING producto_id`, [it.id, it.d, reemplazar]);
      n += r.rows.length;
    }
    res.json({ ok: true, guardadas: n });
  } catch (e) { console.error('[tienda] descripciones:', e.message); res.status(500).json({ error: 'No se pudieron guardar' }); }
});

// Publicar de una vez los que tienen foto, precio y stock
router.post('/productos/publicar-con-foto', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const r = await pool.query(`INSERT INTO tienda_productos (producto_id, publicado)
      SELECT p.id, TRUE FROM productos p WHERE p.activo = TRUE AND COALESCE(p.precio, 0) > 0 AND (COALESCE(p.stock_rg, 0) + COALESCE(p.stock_ush, 0)) > 0
        AND EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id)
      ON CONFLICT (producto_id) DO UPDATE SET publicado = TRUE RETURNING producto_id`);
    res.json({ ok: true, publicados: r.rows.length });
  } catch (e) { res.status(500).json({ error: 'No se pudo publicar' }); }
});

// ---------- Pedidos ----------
async function pedidoCompleto(id) {
  const p = (await pool.query('SELECT * FROM tienda_pedidos WHERE id = $1', [id])).rows[0];
  if (!p) return null;
  const items = (await pool.query(`SELECT i.*, COALESCE(v.stock_rg, p.stock_rg, 0) AS stock_rg, COALESCE(v.stock_ush, p.stock_ush, 0) AS stock_ush
    FROM tienda_pedido_items i LEFT JOIN productos p ON p.id = i.producto_id LEFT JOIN producto_variantes v ON v.id = i.variante_id WHERE i.pedido_id = $1 ORDER BY i.id`, [id])).rows;
  const ruleta = (await pool.query('SELECT texto, tipo, valor, cupon FROM tienda_ruleta WHERE pedido_id = $1', [id]).catch(() => ({ rows: [] }))).rows[0] || null;
  return { ...p, subtotal: num(p.subtotal), total: num(p.total), costo_envio: num(p.costo_envio), items: items.map(i => ({ ...i, precio: num(i.precio) })), ruleta };
}

router.get('/pedidos', async (req, res) => {
  try {
    // Los de Mercado Pago que siguen "esperando el pago": se le pregunta a Mercado Pago (por si pagaron y cerraron la pagina)
    const esperando = (await pool.query(`SELECT * FROM tienda_pedidos WHERE pago = 'mp' AND NOT pagado AND creado_en > NOW() - INTERVAL '7 days'
      AND (estado = 'pendiente_pago' OR (estado = 'cancelado' AND motivo = 'Venció sin pagar')) ORDER BY creado_en DESC LIMIT 12`)).rows;
    await Promise.all(esperando.map(p => tienda.revisarPagoMP(p)));
    await tienda.emitirGiftCardsPendientes();
    const r = await pool.query(`SELECT p.*, CASE WHEN r.pedido_id IS NULL THEN NULL ELSE json_build_object('texto', r.texto, 'tipo', r.tipo, 'valor', r.valor, 'cupon', r.cupon) END AS ruleta
      FROM tienda_pedidos p LEFT JOIN tienda_ruleta r ON r.pedido_id = p.id
      ORDER BY CASE WHEN p.estado IN ('confirmado','pendiente_pago','preparado','en_caja') THEN 0 ELSE 1 END, p.creado_en DESC LIMIT 200`);
    const ids = r.rows.map(p => p.id);
    const items = ids.length ? (await pool.query('SELECT * FROM tienda_pedido_items WHERE pedido_id = ANY($1) ORDER BY id', [ids])).rows : [];
    res.json(r.rows.map(p => ({ ...p, subtotal: num(p.subtotal), total: num(p.total), costo_envio: num(p.costo_envio), items: items.filter(i => i.pedido_id === p.id).map(i => ({ ...i, precio: num(i.precio) })) })));
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los pedidos' }); }
});

router.get('/pedidos/:id', async (req, res) => {
  try {
    const p = await pedidoCompleto(req.params.id);
    if (!p) return res.status(404).json({ error: 'No se encontró el pedido' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar el pedido' }); }
});

// Cambiar estado: pago recibido (transferencia), preparado, o cancelar
router.put('/pedidos/:id/estado', async (req, res) => {
  try {
    const estado = String((req.body && req.body.estado) || '');
    const p = (await pool.query('SELECT * FROM tienda_pedidos WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'No se encontró el pedido' });
    if (['entregado', 'cancelado'].includes(p.estado)) return res.status(400).json({ error: 'Ese pedido ya está cerrado' });
    if (estado === 'cancelado') {
      await tienda.cancelar(p.id, String((req.body && req.body.motivo) || 'Cancelado desde Lumiere').slice(0, 200));
    } else if (estado === 'pagado') {
      await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, NOW()), estado = CASE WHEN estado = 'pendiente_pago' THEN 'confirmado' ELSE estado END, vence_en = NULL, actualizado_en = NOW() WHERE id = $1`, [p.id]);
      // Gift card: con el pago se emite en Lumiere y el pedido queda entregado
      if (p.tipo === 'giftcard') await tienda.emitirGiftCard(p.id);
    } else if (p.tipo === 'giftcard') {
      return res.status(400).json({ error: 'Las gift cards se entregan solas cuando se confirma el pago' });
    } else if (estado === 'preparado' || estado === 'confirmado') {
      if (p.estado === 'pendiente_pago' && estado === 'preparado') return res.status(400).json({ error: 'Todavía no está pagado: marcá el pago primero (o cancelalo)' });
      await pool.query(`UPDATE tienda_pedidos SET estado = $1, actualizado_en = NOW() WHERE id = $2`, [estado, p.id]);
    } else return res.status(400).json({ error: 'Estado no válido' });
    res.json(await pedidoCompleto(p.id));
  } catch (e) {
    console.error('[tienda] estado:', e.message);
    res.status(500).json({ error: 'No se pudo cambiar el estado' });
  }
});

// Pasar a caja: se devuelve el stock apartado (la venta del Punto de Venta lo descuenta) y se carga el pedido en la caja
router.post('/pedidos/:id/a-caja', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró el pedido' }); }
    if (['entregado', 'cancelado'].includes(p.estado)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese pedido ya está cerrado' }); }
    if (p.estado === 'pendiente_pago' && p.pago !== 'retiro') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Todavía no figura pagado. Si ya te pagó, marcá "Pago recibido" primero.' }); }
    if (p.tipo === 'giftcard') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Es una gift card: se emite sola cuando se confirma el pago' }); }
    if ((await client.query('SELECT 1 FROM tienda_pedido_items WHERE pedido_id = $1 AND preventa LIMIT 1', [p.id])).rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Tiene productos en preventa que todavía no llegaron. Cuando lleguen, tocá "Llegó la preventa".' }); }
    if (p.stock_apartado) await tienda.moverStock(client, p, +1);
    await client.query(`UPDATE tienda_pedidos SET estado = 'en_caja', stock_apartado = FALSE, actualizado_en = NOW() WHERE id = $1`, [p.id]);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] a caja:', e.message);
    return res.status(500).json({ error: 'No se pudo pasar a la caja' });
  } finally { client.release(); }
  // Medio de pago con el que ya pago (para dejarlo elegido en el Punto de Venta)
  let medio = null;
  try {
    const p = (await pool.query('SELECT pago, pagado FROM tienda_pedidos WHERE id = $1', [req.params.id])).rows[0];
    if (p.pagado && (p.pago === 'mp' || p.pago === 'gocuotas')) {
      const nombreMedio = p.pago === 'mp' ? 'Mercado Pago (tienda web)' : 'GoCuotas (tienda web)';
      let m = (await pool.query(`SELECT * FROM medios_pago WHERE nombre = $1 LIMIT 1`, [nombreMedio])).rows[0];
      if (!m) m = (await pool.query(`INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online) VALUES ($1, 'plataforma', 1, FALSE, 1.0, 0, TRUE, TRUE) RETURNING *`, [nombreMedio])).rows[0];
      else if (!m.activo) await pool.query('UPDATE medios_pago SET activo = TRUE WHERE id = $1', [m.id]);
      medio = m.id;
    } else if (p.pagado && p.pago === 'transferencia') {
      const m = (await pool.query(`SELECT id FROM medios_pago WHERE tipo = 'transferencia' AND activo ORDER BY id LIMIT 1`)).rows[0];
      medio = m ? m.id : null;
    }
  } catch (e) {}
  res.json({ ...(await pedidoCompleto(req.params.id)), medio_pago_id: medio });
});

// Si se paso a caja pero no se cobro, se vuelve a apartar el stock
router.post('/pedidos/:id/reapartar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p || p.estado !== 'en_caja') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese pedido no está en la caja' }); }
    await tienda.moverStock(client, p, -1);
    const horas = Math.min(168, Math.max(1, parseInt((await tienda.leerConfig(client)).horas_reserva) || 24));
    await client.query(`UPDATE tienda_pedidos SET estado = CASE WHEN pagado OR pago = 'retiro' THEN 'preparado' ELSE 'pendiente_pago' END, stock_apartado = TRUE,
      vence_en = CASE WHEN pago = 'retiro' OR NOT pagado THEN NOW() + make_interval(hours => $2) ELSE vence_en END, actualizado_en = NOW() WHERE id = $1`, [p.id, horas]);
    await client.query('COMMIT');
    res.json(await pedidoCompleto(p.id));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    res.status(500).json({ error: 'No se pudo volver a apartar' });
  } finally { client.release(); }
});

// Llego la mercaderia de la preventa: pasa de lo reservado en camino al stock del local (apartado para
// este pedido), y si es "paga al retirar" empieza a correr el plazo para retirarlo
router.post('/pedidos/:id/llego-preventa', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p || ['entregado', 'cancelado', 'en_caja'].includes(p.estado)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese pedido ya está cerrado' }); }
    const u = Number(p.local_id) === 2;
    const items = (await client.query(`SELECT i.id, i.producto_id, i.nombre, i.cantidad, COALESCE(pr.${u ? 'stock_ush' : 'stock_rg'}, 0) AS stock
      FROM tienda_pedido_items i JOIN productos pr ON pr.id = i.producto_id WHERE i.pedido_id = $1 AND i.preventa FOR UPDATE OF pr`, [p.id])).rows;
    if (!items.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Este pedido no tiene preventa pendiente' }); }
    const falta = items.find(it => (parseInt(it.stock) || 0) < it.cantidad);
    if (falta) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Todavía no hay stock de ' + falta.nombre + ' en ' + (u ? 'Ushuaia' : 'Río Grande') + '. Recibí la orden de ingreso primero.' }); }
    await tienda.reservarPreventa(client, p, -1);
    await client.query('UPDATE tienda_pedido_items SET preventa = FALSE WHERE pedido_id = $1 AND preventa', [p.id]);
    // aparta solo lo que era preventa (lo demas ya estaba apartado)
    const col = u ? 'stock_ush' : 'stock_rg';
    await client.query(`SELECT set_config('lumiere.sin_reingreso', '1', true)`);
    for (const it of items) await client.query(`UPDATE productos SET ${col} = COALESCE(${col}, 0) - $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1 WHERE id = $2`, [it.cantidad, it.producto_id]);
    const horas = Math.min(168, Math.max(1, parseInt((await tienda.leerConfig(client)).horas_reserva) || 24));
    await client.query(`UPDATE tienda_pedidos SET stock_apartado = TRUE, vence_en = CASE WHEN pago = 'retiro' AND estado IN ('confirmado', 'preparado') THEN NOW() + make_interval(hours => $2) ELSE vence_en END, actualizado_en = NOW() WHERE id = $1`, [p.id, horas]);
    await client.query('COMMIT');
    res.json(await pedidoCompleto(p.id));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] llego preventa:', e.message);
    res.status(500).json({ error: 'No se pudo' });
  } finally { client.release(); }
});

// Darle mas tiempo a un pedido (ej: "voy mañana"): suma las horas de reserva desde ahora o desde su vencimiento
router.post('/pedidos/:id/extender', async (req, res) => {
  try {
    const horas = Math.min(168, Math.max(1, parseInt((await tienda.leerConfig()).horas_reserva) || 24));
    const r = await pool.query(`UPDATE tienda_pedidos SET vence_en = GREATEST(COALESCE(vence_en, NOW()), NOW()) + make_interval(hours => $2), actualizado_en = NOW()
      WHERE id = $1 AND estado IN ('pendiente_pago', 'confirmado', 'preparado') AND vence_en IS NOT NULL RETURNING vence_en`, [req.params.id, horas]);
    if (!r.rows.length) return res.status(400).json({ error: 'Ese pedido no tiene vencimiento' });
    res.json({ ok: true, vence_en: r.rows[0].vence_en, horas });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});

// ---- Clientas de la web: quien pidio aviso de un producto, carritos sin terminar y favoritos ----
router.get('/clientas-web', async (req, res) => {
  try {
    const avisos = (await pool.query(`SELECT a.*, p.nombre AS producto, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush
      FROM tienda_avisos a JOIN productos p ON p.id = a.producto_id WHERE a.avisado_en IS NULL ORDER BY a.creado_en`)).rows;
    const carritos = (await pool.query(`SELECT k.*, c.nombre, c.telefono FROM tienda_carritos k JOIN clientes c ON c.id = k.cliente_id
      WHERE k.actualizado_en < NOW() - INTERVAL '1 hour' AND k.actualizado_en > NOW() - INTERVAL '30 days' ORDER BY k.actualizado_en DESC LIMIT 100`)).rows;
    // A cada producto del carrito: si hoy tiene stock en el local de la clienta y si tiene foto
    const idsCarr = [...new Set(carritos.flatMap(k => (k.items || []).map(i => parseInt(i.producto_id)).filter(Boolean)))];
    const infoProd = new Map((idsCarr.length ? (await pool.query(`SELECT p.id, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush, p.precio,
        EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto FROM productos p WHERE p.id = ANY($1::int[])`, [idsCarr])).rows : []).map(p => [p.id, p]));
    carritos.forEach(k => { k.items = (k.items || []).map(i => { const p = infoProd.get(parseInt(i.producto_id)); return p ? { ...i, foto: p.foto, stock: Number(k.local_id) === 2 ? p.stock_ush : p.stock_rg, precio_hoy: num(p.precio) } : { ...i, foto: false, stock: 0 }; }); });
    // Analisis de favoritos: cuantas lo guardaron (total y esta semana), cuantas de ellas lo compraron despues, stock
    const favoritos = (await pool.query(`SELECT f.producto_id, p.nombre, p.categoria, p.precio, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
        COUNT(*)::int AS n, COUNT(*) FILTER (WHERE f.creado_en > NOW() - INTERVAL '7 days')::int AS n7,
        (SELECT COUNT(DISTINCT f2.cliente_id)::int FROM tienda_favoritos f2 JOIN ventas v ON v.cliente_id = f2.cliente_id AND v.creado_en >= f2.creado_en
           JOIN venta_items vi ON vi.venta_id = v.id AND vi.producto_id = f2.producto_id WHERE f2.producto_id = f.producto_id AND ${VENTA_VALIDA}) AS compraron
      FROM tienda_favoritos f JOIN productos p ON p.id = f.producto_id
      GROUP BY f.producto_id, p.nombre, p.categoria, p.precio, p.stock_rg, p.stock_ush ORDER BY n DESC, n7 DESC LIMIT 40`).catch(e => { console.error('[tienda] favoritos:', e.message); return { rows: [] }; })).rows;
    const resumenFav = (await pool.query(`SELECT COUNT(*)::int AS guardados, COUNT(DISTINCT cliente_id)::int AS clientas,
        COUNT(*) FILTER (WHERE creado_en > NOW() - INTERVAL '7 days')::int AS semana FROM tienda_favoritos`)).rows[0];
    const c = await tienda.leerConfig();
    res.json({ avisos, carritos: carritos.map(k => ({ ...k, subtotal: num(k.subtotal) })), favoritos: favoritos.map(f => ({ ...f, precio: num(f.precio) })), resumen_fav: resumenFav, mensajes: c.mensajes || {} });
  } catch (e) { console.error('[tienda] clientas web:', e.message); res.status(500).json({ error: 'No se pudo cargar' }); }
});
// Mensajes de WhatsApp editables: { carrito, aviso } (vacio = el de siempre)
router.put('/mensajes', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const b = req.body || {};
    const m = {}; for (const k of ['carrito', 'aviso', 'resena']) { const t = String(b[k] || '').trim().slice(0, 700); if (t) m[k] = t; }
    await pool.query('UPDATE tienda_config SET mensajes = $1 WHERE id = 1', [JSON.stringify(m)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// ---- Reseñas: se aprueban antes de publicarse. Y a quien retiro su pedido se le puede pedir la reseña por WhatsApp. ----
router.get('/resenas', async (req, res) => {
  try {
    const c = await tienda.leerConfig();
    const [lista, pedir] = await Promise.all([
      pool.query(`SELECT r.id, r.producto_id, r.estrellas, r.texto, r.estado, r.creado_en, r.revisado_en, r.puntos_dados, (r.foto IS NOT NULL) AS foto, p.nombre AS producto, cl.nombre AS clienta, cl.telefono
        FROM tienda_resenas r LEFT JOIN productos p ON p.id = r.producto_id LEFT JOIN clientes cl ON cl.id = r.cliente_id
        ORDER BY (r.estado = 'pendiente') DESC, r.creado_en DESC LIMIT 400`),
      // Pedidos entregados en los ultimos 45 dias con productos sin reseñar
      pool.query(`SELECT tp.id, tp.codigo, tp.nombre, tp.telefono, tp.actualizado_en, tp.resena_pedida_en,
          ARRAY(SELECT DISTINCT i.nombre FROM tienda_pedido_items i WHERE i.pedido_id = tp.id
            AND NOT EXISTS (SELECT 1 FROM tienda_resenas r WHERE r.producto_id = i.producto_id AND r.cliente_id = tp.cliente_id)) AS sin_resena
        FROM tienda_pedidos tp WHERE tp.estado = 'entregado' AND tp.actualizado_en > NOW() - INTERVAL '45 days' AND COALESCE(tp.telefono, '') <> ''
        ORDER BY (tp.resena_pedida_en IS NULL) DESC, tp.actualizado_en DESC LIMIT 100`),
    ]);
    res.json({ lista: lista.rows, pedir: pedir.rows.filter(p => p.sin_resena.length), mensaje: (c.mensajes || {}).resena || '', puntos: tienda.puntosResenaDe(c) });
  } catch (e) { console.error('[tienda] resenas:', e.message); res.status(500).json({ error: 'No se pudieron cargar las reseñas' }); }
});
// Gift card online de cualquier gift card de Lumiere (tambien las vendidas en el local): mensaje y link para mandarla
router.get('/giftcard/:id/online', async (req, res) => {
  try {
    const g = (await pool.query('SELECT id, codigo, mensaje, beneficiario_nombre, beneficiario_telefono, comprador_nombre, monto_inicial, saldo FROM gift_cards WHERE id = $1', [req.params.id])).rows[0];
    if (!g) return res.status(404).json({ error: 'No se encontró la gift card' });
    const c = await tienda.leerConfig();
    const dominio = await tienda.dominioDe(req.negocio ? req.negocio.id : 1).catch(() => null);
    res.json({ ...g, monto_inicial: num(g.monto_inicial), saldo: num(g.saldo), firma: tienda.firmaRegalo(g.codigo), slug: c.slug || null, dominio: dominio || null, tienda_activa: !!c.activo, titulo: c.titulo || null, tema: tienda.temaRegaloHoy(tienda.regalosDe(c)).tema,
      logo_marca: Number(req.negocio ? req.negocio.id : 1) === 1 ? { blanco: '/logos/girasoles-logo-blanco.svg', color: '/logos/girasoles-logo.svg' } : null });
  } catch (e) { res.status(500).json({ error: 'No se pudo armar la gift card online' }); }
});
router.put('/giftcard/:id/mensaje', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query('UPDATE gift_cards SET mensaje = $1, comprador_nombre = COALESCE($3, comprador_nombre) WHERE id = $2 RETURNING id',
      [String(b.mensaje || '').trim().slice(0, 300) || null, req.params.id, String(b.de || '').trim().slice(0, 80) || null]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró la gift card' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Sector "¿Querés hacer un regalo?" (gift cards online y armador de regalos)
router.put('/regalos', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const r = tienda.regalosDe({ regalos: req.body || {} });
    await pool.query('UPDATE tienda_config SET regalos = $1 WHERE id = 1', [JSON.stringify(r)]);
    res.json({ regalos: r, regalos_hoy: tienda.temaRegaloHoy(r) });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/resenas/puntos', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const b = req.body || {};
    const r = tienda.puntosResenaDe({ resenas_puntos: { activo: !!b.activo, puntos: b.puntos, extra_foto: b.extra_foto } });
    await pool.query('UPDATE tienda_config SET resenas_puntos = $1 WHERE id = 1', [JSON.stringify(r)]);
    res.json(r);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Compras del local (ventas con ficha de clienta y WhatsApp) para pedirles reseña, filtradas por proveedor y periodo.
// Solo los productos que todavia no reseño. Si no tiene cuenta, la crea con su DNI desde el link (se la reconoce).
router.get('/resenas/pedir-local', async (req, res) => {
  try {
    const dias = [30, 60, 90, 180, 365].includes(parseInt(req.query.dias)) ? parseInt(req.query.dias) : 90;
    const prov = parseInt(req.query.proveedor) || null;
    const [clientas, proveedores] = await Promise.all([
      pool.query(`SELECT c.id AS cliente_id, c.nombre, c.telefono, (c.password_hash IS NOT NULL) AS con_cuenta, MAX(v.creado_en) AS ultima,
          ARRAY_AGG(DISTINCT p.nombre) AS productos, rp.pedido_en
        FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos p ON p.id = vi.producto_id JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN tienda_resenas_pedidas rp ON rp.cliente_id = c.id
        WHERE ${VENTA_VALIDA} AND v.creado_en > NOW() - make_interval(days => $1::int) AND ($2::int IS NULL OR p.proveedor_id = $2::int)
          AND LENGTH(REGEXP_REPLACE(COALESCE(c.telefono, ''), '[^0-9]', '', 'g')) >= 8
          AND NOT EXISTS (SELECT 1 FROM tienda_resenas r WHERE r.producto_id = vi.producto_id AND r.cliente_id = c.id)
        GROUP BY c.id, rp.pedido_en
        ORDER BY (rp.pedido_en IS NULL) DESC, MAX(v.creado_en) DESC LIMIT 300`, [dias, prov]),
      pool.query(`SELECT pr.id, pr.nombre, COUNT(DISTINCT v.cliente_id)::int AS clientas
        FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos p ON p.id = vi.producto_id JOIN proveedores pr ON pr.id = p.proveedor_id
        WHERE ${VENTA_VALIDA} AND v.cliente_id IS NOT NULL AND v.creado_en > NOW() - make_interval(days => $1::int)
        GROUP BY pr.id ORDER BY pr.nombre`, [dias]).catch(() => ({ rows: [] })),
    ]);
    res.json({ clientas: clientas.rows, proveedores: proveedores.rows, dias });
  } catch (e) { console.error('[tienda] pedir-local:', e.message); res.status(500).json({ error: 'No se pudieron cargar las compras' }); }
});
router.post('/resenas/pedida-clienta/:clienteId', async (req, res) => {
  try {
    await pool.query(`INSERT INTO tienda_resenas_pedidas (cliente_id) VALUES ($1) ON CONFLICT (cliente_id) DO UPDATE SET pedido_en = NOW()`, [parseInt(req.params.clienteId) || 0]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.get('/resenas/pendientes', async (req, res) => {
  try { res.json({ n: (await pool.query(`SELECT COUNT(*)::int AS n FROM tienda_resenas WHERE estado = 'pendiente'`)).rows[0].n }); } catch (e) { res.json({ n: 0 }); }
});
router.get('/resenas/:id/foto', async (req, res) => {
  try {
    const r = (await pool.query('SELECT foto, foto_tipo FROM tienda_resenas WHERE id = $1 AND foto IS NOT NULL', [parseInt(req.params.id) || 0])).rows[0];
    if (!r) return res.status(404).end();
    res.set('Content-Type', r.foto_tipo || 'image/jpeg').set('Cache-Control', 'private, max-age=3600').send(r.foto);
  } catch (e) { res.status(404).end(); }
});
router.post('/resenas/:id/estado', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const estado = ['aprobada', 'rechazada', 'pendiente'].includes(req.body && req.body.estado) ? req.body.estado : null;
    if (!estado) return res.status(400).json({ error: 'Estado inválido' });
    const id = parseInt(req.params.id) || 0;
    const pr = tienda.puntosResenaDe(await tienda.leerConfig());
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = (await client.query('SELECT * FROM tienda_resenas WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!r) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró la reseña' }); }
      await client.query('UPDATE tienda_resenas SET estado = $1, revisado_en = NOW() WHERE id = $2', [estado, id]);
      // La primera vez que se publica: se le suman los puntos (si la despublican despues, los puntos quedan)
      let puntos = 0;
      if (estado === 'aprobada' && pr.activo && !r.puntos_dados) {
        puntos = pr.puntos + (r.foto ? pr.extra_foto : 0);
        if (puntos > 0) {
          await client.query('UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2', [puntos, r.cliente_id]);
          await client.query('UPDATE tienda_resenas SET puntos_dados = $1 WHERE id = $2', [puntos, id]);
        }
      }
      await client.query('COMMIT');
      res.json({ ok: true, puntos });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  } catch (e) { console.error('[tienda] resena estado:', e.message); res.status(500).json({ error: 'No se pudo' }); }
});
router.post('/resenas/:id/sin-foto', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await pool.query('UPDATE tienda_resenas SET foto = NULL, foto_tipo = NULL WHERE id = $1', [parseInt(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.delete('/resenas/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await pool.query('DELETE FROM tienda_resenas WHERE id = $1', [parseInt(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.post('/pedidos/:id/resena-pedida', async (req, res) => {
  try { await pool.query('UPDATE tienda_pedidos SET resena_pedida_en = NOW() WHERE id = $1', [parseInt(req.params.id) || 0]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.post('/avisos/:id/avisado', async (req, res) => {
  try { await pool.query('UPDATE tienda_avisos SET avisado_en = NOW() WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.delete('/avisos/:id', async (req, res) => {
  try { await pool.query('DELETE FROM tienda_avisos WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});
router.post('/carritos/:clienteId/recordado', async (req, res) => {
  try { await pool.query('UPDATE tienda_carritos SET recordado_en = NOW() WHERE cliente_id = $1', [req.params.clienteId]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'No se pudo' }); }
});

// Lo llama el Punto de Venta al registrar la venta del pedido
// Pedido que se cobro en la caja sin cargarlo desde la tienda: queda entregado, se devuelve el stock apartado
// (la venta de la caja ya lo desconto), se activa el cupon de la ruleta y, si se indica, se vincula esa venta
// (asi el cierre no cuenta dos veces lo que ya se cobro online).
router.post('/pedidos/:id/cobrado-aparte', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró el pedido' }); }
    if (['entregado', 'cancelado'].includes(p.estado)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese pedido ya está cerrado' }); }
    if (p.tipo === 'giftcard') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Es una gift card: se entrega sola cuando se confirma el pago' }); }
    if ((await client.query('SELECT 1 FROM tienda_pedido_items WHERE pedido_id = $1 AND preventa LIMIT 1', [p.id])).rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Tiene productos en preventa que todavía no llegaron' }); }
    let ventaId = null;
    const num = String((req.body && req.body.venta) || '').trim();
    if (num) {
      const v = (await client.query(`SELECT id FROM ventas WHERE numero_factura = $1 OR ($1 ~ '^[0-9]+$' AND id = $1::int) ORDER BY creado_en DESC LIMIT 1`, [num])).rows[0];
      if (!v) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No encontré una venta con ese número' }); }
      ventaId = v.id;
    }
    if (p.stock_apartado) await tienda.moverStock(client, p, +1);
    await client.query(`UPDATE tienda_pedidos SET estado = 'entregado', stock_apartado = FALSE, pagado = TRUE, venta_id = COALESCE($2, venta_id), actualizado_en = NOW() WHERE id = $1`, [p.id, ventaId]);
    if (ventaId) await client.query(`UPDATE gift_card_movimientos SET venta_id = $1 WHERE id = $2 AND venta_id IS NULL`, [ventaId, p.gc_mov_id || 0]).catch(() => {});
    await client.query(`UPDATE cupones SET activo = TRUE, fecha_vencimiento = CURRENT_DATE + 30 WHERE codigo = (SELECT cupon FROM tienda_ruleta WHERE pedido_id = $1)`, [p.id]).catch(() => {});
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] cobrado aparte:', e.message);
    res.status(500).json({ error: 'No se pudo marcar como entregado' });
  } finally { client.release(); }
});

router.put('/pedidos/:id/vendido', async (req, res) => {
  try {
    await pool.query(`UPDATE tienda_pedidos SET estado = 'entregado', venta_id = $1, pagado = TRUE, actualizado_en = NOW() WHERE id = $2 AND estado <> 'cancelado'`,
      [parseInt(req.body && req.body.venta_id) || null, req.params.id]);
    // Lo pagado con gift card en la tienda queda atado a esa venta (el saldo ya se desconto al hacer el pedido)
    await pool.query(`UPDATE gift_card_movimientos SET venta_id = $1 WHERE id = (SELECT gc_mov_id FROM tienda_pedidos WHERE id = $2) AND venta_id IS NULL`,
      [parseInt(req.body && req.body.venta_id) || null, req.params.id]).catch(() => {});
    // Cupon ganado en la ruleta con este pedido: ya se puede usar, por 30 dias desde hoy
    await pool.query(`UPDATE cupones SET activo = TRUE, fecha_vencimiento = CURRENT_DATE + 30 WHERE codigo = (SELECT cupon FROM tienda_ruleta WHERE pedido_id = $1)
      AND EXISTS (SELECT 1 FROM tienda_pedidos WHERE id = $1 AND estado = 'entregado')`, [req.params.id]).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar como entregado' }); }
});

module.exports = router;
