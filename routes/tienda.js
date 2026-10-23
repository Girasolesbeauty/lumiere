const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const tienda = require('../lib/tienda');
const describir = require('../lib/describir');
const misiones = require('../lib/misiones');
const gocuotas = require('../lib/gocuotas');
const { ayudaMP } = require('./mercadopago');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { negocioActual } = require('../lib/contexto');
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
    res.json({ ...c, ruleta: tienda.ruletaDe(c), preventa: tienda.preventaDe(c), misiones: misiones.misionesDe(c), misiones_tipos: misiones.TIPOS, rutinas: tienda.rutinasDe(c), referidos: tienda.referidosDe(c), ofertas: tienda.ofertasDe(c), regalos: tienda.regalosDe(c), links: tienda.linksDe(c), muestras: tienda.muestrasDe(c), cumple: tienda.cumpleDe(c), express: tienda.expressDe(c), diagnostico: tienda.diagnosticoDe(c), packs: tienda.packsDe(c), regalos_hoy: tienda.temaRegaloHoy(tienda.regalosDe(c)), mp_conectado: mp, slug_sugerido: sugerido, dominio: dominio || '' });
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
    await pool.query('UPDATE tienda_config SET horas_pago_online = $1 WHERE id = 1', [tienda.horasPagoOnline(b)]);
    await pool.query('UPDATE tienda_config SET pago_gocuotas = $1, descuentos_pago = $2, descuentos_pago_kits = $3 WHERE id = 1', [!!b.pago_gocuotas, JSON.stringify(tienda.descuentosPagoDe({ descuentos_pago: b.descuentos_pago })), JSON.stringify(tienda.descuentosPagoKitsDe({ descuentos_pago_kits: b.descuentos_pago_kits }))]);
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
    // WhatsApp de cada ciudad: el boton de WhatsApp de la tienda va al del local que eligio la clienta.
    // Se guarda en los datos de cada local de la pagina de links (es el mismo numero)
    if (b.whatsapp_locales && typeof b.whatsapp_locales === 'object') {
      const actual = tienda.linksDe((await pool.query('SELECT links FROM tienda_config WHERE id = 1')).rows[0] || {});
      for (const [id, n] of Object.entries(b.whatsapp_locales)) {
        if (!/^\d+$/.test(id)) continue;
        actual.locales[id] = { ...(actual.locales[id] || { mostrar: true, horarios: '', mapa: '' }), whatsapp: String(n || '') };
      }
      await pool.query('UPDATE tienda_config SET links = $1 WHERE id = 1', [JSON.stringify(tienda.linksDe({ links: actual }))]);
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
    const combos = tienda.ofertasDe(c).combos.map(x => ({ id: x.id, nombre: x.nombre, kit_id: x.kit_id, precio: x.precio, activo: x.activo }));
    res.json({ banner, banners_img: c.banners_img || [], filas: c.filas || [], sectores: c.sectores || [], combos, reingreso: { activo: !!c.reingreso_activo, dias: c.reingreso_dias || 14, nombre: c.reingreso_nombre || '' } });
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
      // Kits y combos del sector (ids de los combos de Ofertas y combos)
      combos: [...new Set((Array.isArray(s.combos) ? s.combos : []).map(x => String(x || '')).filter(x => /^[a-z0-9]{1,20}$/i.test(x)))].slice(0, 20),
      // Sector de un evento (ej. Cyber Monday): solo se ve en la tienda entre esas fechas
      ...(/^\d{4}-\d{2}-\d{2}$/.test(s.desde || '') && /^\d{4}-\d{2}-\d{2}$/.test(s.hasta || '') ? { desde: s.desde, hasta: s.hasta } : {}),
    })).filter(s => s.nombre);
    const DESTINOS = ['producto', 'sector', 'categoria', 'marca', 'reingreso', 'ninguno'];
    const bannersImg = (Array.isArray(b.banners_img) ? b.banners_img : []).slice(0, 10).map(x => ({
      id: idSeccion(x.id), imagen: parseInt(x.imagen) || null, imagen_movil: parseInt(x.imagen_movil) || null,
      titulo: texto(x.titulo, 80), texto: texto(x.texto, 160), boton: texto(x.boton, 30),
      destino: DESTINOS.includes(x.destino) ? x.destino : 'ninguno', valor: texto(x.valor, 120),
    })).filter(x => x.imagen);
    if (filas.some(f => !f.productos.length)) return res.status(400).json({ error: 'Cada fila de la portada necesita al menos un producto' });
    if (sectores.some(s => !s.categorias.length && !s.productos.length && !s.combos.length)) return res.status(400).json({ error: 'Cada sector necesita al menos una categoría, un producto o un kit' });
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
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, p.codigo_barras, p.proveedor_id, pr.nombre AS proveedor, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush, p.creado_en,
             COALESCE(p.tiene_variantes, FALSE) AS tiene_variantes, COALESCE(p.stock_transito_rg, 0) AS transito_rg, COALESCE(p.stock_transito_ush, 0) AS transito_ush,
             COALESCE(p.reservado_rg, 0) AS reservado_rg, COALESCE(p.reservado_ush, 0) AS reservado_ush,
             COALESCE(tp.publicado, FALSE) AS publicado, tp.descripcion, COALESCE(tp.destacado, FALSE) AS destacado, COALESCE(tp.no_nuevo, FALSE) AS no_nuevo, tp.video_url, tp.etiquetas,
             EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto,
             EXISTS (SELECT 1 FROM tienda_videos v WHERE v.producto_id = p.id) AS video_subido,
             (SELECT COUNT(*)::int FROM tienda_fotos f WHERE f.producto_id = p.id) AS fotos_extra
      FROM productos p LEFT JOIN tienda_productos tp ON tp.producto_id = p.id LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      WHERE p.activo = TRUE ORDER BY COALESCE(tp.publicado, FALSE) DESC, p.nombre`);
    res.json(r.rows.map(p => ({ ...p, precio: num(p.precio) })));
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los productos' }); }
});

// Propuesta de descripcion y segmentos (con IA si esta configurada). No guarda nada: la tienda revisa y guarda.
const usosDescribir = new Map();
router.post('/productos/:id/sugerir', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const k = req.usuario ? req.usuario.id : 0, ahora = Date.now();
    const l = (usosDescribir.get(k) || []).filter(t => ahora - t < 3600e3);
    if (l.length >= 120) return res.status(429).json({ error: 'Pediste muchas propuestas seguidas. Probá de nuevo en un rato.' });
    l.push(ahora); usosDescribir.set(k, l);
    const p = (await pool.query(`SELECT p.id, p.nombre, p.marca, p.categoria, tp.descripcion FROM productos p LEFT JOIN tienda_productos tp ON tp.producto_id = p.id WHERE p.id = $1`, [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'No se encontró el producto' });
    res.json(await describir.proponer(p));
  } catch (e) {
    console.error('[tienda] sugerir descripcion:', e.status || '', e.message);
    res.status(502).json({ error: 'No se pudo armar la propuesta. Probá de nuevo en un momento.' });
  }
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
    if (b.no_nuevo !== undefined) await pool.query('UPDATE tienda_productos SET no_nuevo = $2 WHERE producto_id = $1', [req.params.id, !!b.no_nuevo]);
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
  return { ...p, subtotal: num(p.subtotal), total: num(p.total), costo_envio: num(p.costo_envio), monto_online: p.monto_online === null ? null : num(p.monto_online), items: items.map(i => ({ ...i, precio: num(i.precio) })), ruleta };
}

// Catalogo para Google e Instagram: cuantos productos entran y cuales quedan afuera (lib/catalogo.js)
router.get('/catalogo', async (req, res) => {
  try {
    const l = await require('../lib/catalogo').productos();
    res.json({ publicados: l.length, incluidos: l.filter(p => p.incluido).length, sin_stock: l.filter(p => p.incluido && p.stock <= 0).length,
      afuera: l.filter(p => !p.incluido).slice(0, 100).map(p => ({ id: p.id, nombre: p.nombre, motivo: p.motivo })) });
  } catch (e) { res.status(500).json({ error: 'No se pudo revisar el catálogo' }); }
});
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
    res.json(r.rows.map(p => ({ ...p, listo_express: tienda.listoExpress(p), subtotal: num(p.subtotal), total: num(p.total), costo_envio: num(p.costo_envio), monto_online: p.monto_online === null || p.monto_online === undefined ? null : num(p.monto_online), pendiente: pendienteDe(p), items: items.filter(i => i.pedido_id === p.id).map(i => ({ ...i, precio: num(i.precio) })) })));
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
// Notas del local en un pedido (cualquiera que maneje pedidos). Borrar: quien la escribio o la dueña
// "Ya le escribimos a la clienta" (o se deshace)
router.post('/pedidos/:id/contactado', async (req, res) => {
  try {
    const u = req.usuario || {};
    const por = u.nombre || (u.id ? ((await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre : null);
    const si = !(req.body && req.body.contactado === false);
    const r = await pool.query(`UPDATE tienda_pedidos SET contactado_en = ${si ? 'NOW()' : 'NULL'}, contactado_por = $1 WHERE id = $2 RETURNING contactado_en, contactado_por`, [si ? por || 'Local' : null, parseInt(req.params.id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el pedido' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Por que se vencio o se cancelo un pedido: motivo de la lista + lo que dijo la clienta. motivo vacio = se borra
const MOTIVOS_VENC = ['mirando', 'arrepintio', 'pago', 'otro_medio', 'local', 'caro', 'envio', 'sin_respuesta', 'otro', 'clienta', 'sin_stock', 'duplicado', 'cambio', 'prueba'];
router.post('/pedidos/:id/vencimiento', async (req, res) => {
  try {
    const b = req.body || {};
    const motivo = MOTIVOS_VENC.includes(b.motivo) ? b.motivo : null;
    const nota = String(b.nota || '').trim().slice(0, 400) || null;
    if (b.motivo && !motivo) return res.status(400).json({ error: 'Elegí un motivo de la lista' });
    if (motivo === 'otro' && !nota) return res.status(400).json({ error: 'Contá qué pasó' });
    const u = req.usuario || {};
    const por = motivo ? u.nombre || (u.id ? ((await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre : null) || 'Local' : null;
    const r = await pool.query(`UPDATE tienda_pedidos SET venc_motivo = $1, venc_nota = $2, venc_por = $3, venc_en = ${motivo ? 'NOW()' : 'NULL'} WHERE id = $4
      RETURNING venc_motivo, venc_nota, venc_por, venc_en`, [motivo, motivo ? nota : null, por, parseInt(req.params.id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el pedido' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.post('/pedidos/:id/notas', async (req, res) => {
  try {
    const texto = String((req.body && req.body.texto) || '').trim().slice(0, 300);
    if (!texto) return res.status(400).json({ error: 'Escribí la nota' });
    const u = req.usuario || {};
    const por = u.nombre || (u.id ? ((await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre : null);
    const nota = { id: crypto.randomBytes(4).toString('hex'), texto, por: por || null, usuario_id: u.id || null, en: new Date().toISOString() };
    const r = await pool.query(`UPDATE tienda_pedidos SET notas_local = COALESCE(notas_local, '[]'::jsonb) || $1::jsonb WHERE id = $2 RETURNING notas_local`, [JSON.stringify([nota]), parseInt(req.params.id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el pedido' });
    res.json({ notas_local: r.rows[0].notas_local });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar la nota' }); }
});
router.delete('/pedidos/:id/notas/:nota', async (req, res) => {
  try {
    const p = (await pool.query('SELECT notas_local FROM tienda_pedidos WHERE id = $1', [parseInt(req.params.id)])).rows[0];
    if (!p) return res.status(404).json({ error: 'No se encontró el pedido' });
    const lista = Array.isArray(p.notas_local) ? p.notas_local : [];
    const n = lista.find(x => x.id === req.params.nota);
    if (!n) return res.status(404).json({ error: 'Esa nota ya no está' });
    if (!esDuena(req) && Number(n.usuario_id) !== Number(req.usuario && req.usuario.id)) return res.status(403).json({ error: 'Solo quien la escribió (o la dueña) la puede borrar' });
    const nuevas = lista.filter(x => x.id !== n.id);
    await pool.query('UPDATE tienda_pedidos SET notas_local = $1 WHERE id = $2', [nuevas.length ? JSON.stringify(nuevas) : null, parseInt(req.params.id)]);
    res.json({ notas_local: nuevas });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});
router.put('/pedidos/:id/estado', async (req, res) => {
  try {
    const estado = String((req.body && req.body.estado) || '');
    const p = (await pool.query('SELECT * FROM tienda_pedidos WHERE id = $1', [req.params.id])).rows[0];
    if (!p) return res.status(404).json({ error: 'No se encontró el pedido' });
    if (['entregado', 'cancelado'].includes(p.estado)) return res.status(400).json({ error: 'Ese pedido ya está cerrado' });
    if (estado === 'cancelado') {
      await tienda.cancelar(p.id, String((req.body && req.body.motivo) || 'Cancelado desde Lumiere').slice(0, 200));
    } else if (estado === 'pagado') {
      // Si pago con otro medio (ej: le rechazaron la tarjeta y transfirio), queda ese medio para la caja
      const otro = ['transferencia', 'mp', 'gocuotas'].includes(req.body && req.body.pago) ? req.body.pago : null;
      await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, NOW()), estado = CASE WHEN estado = 'pendiente_pago' THEN 'confirmado' ELSE estado END, vence_en = NULL,
        pago = COALESCE($2, pago), pago_rechazo = CASE WHEN $2::text IS NULL THEN pago_rechazo ELSE NULL END, actualizado_en = NOW() WHERE id = $1`, [p.id, otro]);
    } else if (estado === 'paga_retiro') {
      // Le rechazaron el pago online y queda en pagar en el local al retirarlo (reservado el tiempo de siempre)
      if (p.pagado) return res.status(400).json({ error: 'Ese pedido ya está pagado' });
      if (p.entrega !== 'retiro') return res.status(400).json({ error: 'Es con envío: marcá el pago cuando lo cobres' });
      const horas = Math.min(168, Math.max(1, parseInt(req.tienda && req.tienda.horas_reserva) || parseInt((await pool.query('SELECT horas_reserva FROM tienda_config WHERE id = 1')).rows[0].horas_reserva) || 24));
      await pool.query(`UPDATE tienda_pedidos SET pago = 'retiro', pago_rechazo = NULL, estado = 'confirmado', vence_en = NOW() + ($2 || ' hours')::interval, actualizado_en = NOW() WHERE id = $1`, [p.id, String(horas)]);
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
    // Puede llegar de a partes: se aparta lo que ya tiene stock en el local del pedido y lo demas sigue en preventa
    const llegaron = items.filter(it => (parseInt(it.stock) || 0) >= it.cantidad);
    const faltan = items.filter(it => (parseInt(it.stock) || 0) < it.cantidad);
    if (!llegaron.length) {
      await client.query('ROLLBACK');
      const otro = u ? 'stock_rg' : 'stock_ush';
      const enOtro = (await pool.query(`SELECT COUNT(*)::int AS n FROM productos WHERE id = ANY($1::int[]) AND COALESCE(${otro}, 0) > 0`, [faltan.map(it => it.producto_id)])).rows[0].n;
      return res.status(400).json({ error: 'Todavía no hay stock en ' + (u ? 'Ushuaia' : 'Río Grande') + ' de: ' + faltan.map(it => it.nombre).join(', ') + '. Recibí la orden de ingreso primero' + (enOtro ? ' (o pasalos con un traspaso: hay stock en ' + (u ? 'Río Grande' : 'Ushuaia') + ')' : '') + '.' });
    }
    const col = u ? 'stock_ush' : 'stock_rg', colRes = u ? 'reservado_ush' : 'reservado_rg';
    await client.query(`SELECT set_config('lumiere.sin_reingreso', '1', true)`);
    for (const it of llegaron) {
      // Deja de estar reservado sobre lo que venia en camino y se aparta del stock que ya entro
      await client.query(`UPDATE productos SET ${colRes} = GREATEST(COALESCE(${colRes}, 0) - $1, 0), ${col} = COALESCE(${col}, 0) - $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1 WHERE id = $2`, [it.cantidad, it.producto_id]);
      await client.query('UPDATE tienda_pedido_items SET preventa = FALSE WHERE id = $1', [it.id]);
    }
    if (faltan.length) {
      await client.query('UPDATE tienda_pedidos SET stock_apartado = TRUE, actualizado_en = NOW() WHERE id = $1', [p.id]);
      await client.query('COMMIT');
      return res.json({ ...(await pedidoCompleto(p.id)), llegaron: llegaron.map(it => it.nombre), faltan: faltan.map(it => it.nombre) });
    }
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

// Cambiar un producto de un pedido por otro (la clienta se arrepintio o pidio otro): devuelve el stock (o la
// reserva de preventa) del que se saca, aparta el nuevo (o lo reserva en preventa si todavia no llego) y ajusta
// el total. Queda anotado en el pedido, con la diferencia a cobrar o devolver.
router.post('/pedidos/:id/items/:item/cambiar', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p || ['entregado', 'cancelado', 'en_caja'].includes(p.estado)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese pedido ya está cerrado: no se pueden cambiar sus productos' }); }
    const it = (await client.query('SELECT * FROM tienda_pedido_items WHERE id = $1 AND pedido_id = $2', [req.params.item, p.id])).rows[0];
    if (!it) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ese producto no está en el pedido' }); }
    const b = req.body || {};
    const cant = Math.min(99, Math.max(1, parseInt(b.cantidad) || 1));
    const nuevo = (await client.query('SELECT id, nombre, precio, COALESCE(tiene_variantes, FALSE) AS tiene_variantes FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE', [parseInt(b.producto_id)])).rows[0];
    if (!nuevo) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí el producto nuevo' }); }
    const vari = b.variante_id ? (await client.query('SELECT id, valor FROM producto_variantes WHERE id = $1 AND producto_id = $2 FOR UPDATE', [parseInt(b.variante_id), nuevo.id])).rows[0] : null;
    if (nuevo.tiene_variantes && !vari) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí cuál de ' + nuevo.nombre + ' (tono, tamaño...)' }); }
    const u = Number(p.local_id) === 2, col = u ? 'stock_ush' : 'stock_rg', colRes = u ? 'reservado_ush' : 'reservado_rg', colTr = u ? 'stock_transito_ush' : 'stock_transito_rg';
    await client.query(`SELECT set_config('lumiere.sin_reingreso', '1', true)`);
    const moverItem = async (productoId, varianteId, delta) => {
      if (varianteId) await client.query(`UPDATE producto_variantes SET ${col} = COALESCE(${col}, 0) + $1 WHERE id = $2`, [delta, varianteId]);
      else await client.query(`UPDATE productos SET ${col} = COALESCE(${col}, 0) + $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) + $1 WHERE id = $2`, [delta, productoId]);
    };
    // 1. Lo que sale: vuelve al local (o deja de estar reservado si era preventa)
    if (it.preventa) await client.query(`UPDATE productos SET ${colRes} = GREATEST(COALESCE(${colRes}, 0) - $1, 0) WHERE id = $2`, [it.cantidad, it.producto_id]);
    else if (p.stock_apartado) await moverItem(it.producto_id, it.variante_id, +it.cantidad);
    // 2. Lo que entra: del stock del local si hay; si no, en preventa sobre lo que viene en camino
    const pr = (await client.query(`SELECT COALESCE(${col}, 0) AS st, COALESCE(${colRes}, 0) AS res, COALESCE(${colTr}, 0) AS tr FROM productos WHERE id = $1`, [nuevo.id])).rows[0];
    const stockV = vari ? parseInt((await client.query(`SELECT COALESCE(${col}, 0) AS st FROM producto_variantes WHERE id = $1`, [vari.id])).rows[0].st) || 0 : null;
    const hayYa = vari ? stockV >= cant : (parseInt(pr.st) || 0) - (parseInt(pr.res) || 0) >= cant;
    const hayPre = !vari && Math.min(parseInt(pr.tr) || 0, (parseInt(pr.st) || 0) + (parseInt(pr.tr) || 0) - (parseInt(pr.res) || 0)) >= cant;
    if (!hayYa && !hayPre) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay ' + cant + ' de ' + nuevo.nombre + (vari ? ' (' + vari.valor + ')' : '') + ' en ' + (u ? 'Ushuaia' : 'Río Grande') + ' (ni en camino).' }); }
    const preventa = !hayYa;
    if (preventa) await client.query(`UPDATE productos SET ${colRes} = COALESCE(${colRes}, 0) + $1 WHERE id = $2`, [cant, nuevo.id]);
    else if (p.stock_apartado) await moverItem(nuevo.id, vari ? vari.id : null, -cant);
    // 3. El renglon y el total
    const precio = num(nuevo.precio);
    const diferencia = Math.round((precio * cant - num(it.precio) * it.cantidad) * 100) / 100;
    await client.query(`UPDATE tienda_pedido_items SET producto_id = $2, variante_id = $3, nombre = $4, variante_valor = $5, cantidad = $6, precio = $7, preventa = $8 WHERE id = $1`,
      [it.id, nuevo.id, vari ? vari.id : null, nuevo.nombre, vari ? vari.valor : null, cant, precio, preventa]);
    const cambio = { fecha: new Date().toISOString(), de: it.cantidad + ' × ' + it.nombre + (it.variante_valor ? ' (' + it.variante_valor + ')' : ''), a: cant + ' × ' + nuevo.nombre + (vari ? ' (' + vari.valor + ')' : ''), diferencia, usuario: (req.usuario && (req.usuario.nombre || req.usuario.email)) || null };
    // Pagado online: se guarda cuanto se pago online (el total de antes), asi la diferencia queda como algo a cobrar o devolver
    await client.query(`UPDATE tienda_pedidos SET monto_online = COALESCE(monto_online, total) WHERE id = $1 AND pagado AND COALESCE(pago, '') <> 'retiro'`, [p.id]);
    await client.query(`UPDATE tienda_pedidos SET subtotal = GREATEST(subtotal + $2, 0), total = GREATEST(total + $2, 0), cambios = COALESCE(cambios, '[]'::jsonb) || $3::jsonb, actualizado_en = NOW() WHERE id = $1`,
      [p.id, diferencia, JSON.stringify([cambio])]);
    await client.query('COMMIT');
    const pc = await pedidoCompleto(p.id);
    res.json({ ...pc, diferencia, preventa, pendiente: pendienteDe(pc) });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] cambiar item:', e.message);
    res.status(500).json({ error: 'No se pudo cambiar el producto' });
  } finally { client.release(); }
});

// Lo que falta cobrar (+) o devolver (-) de un pedido pagado online al que se le cambiaron productos
const pendienteDe = (p) => {
  if (!p || p.monto_online === null || p.monto_online === undefined) return 0;
  const extra = (Array.isArray(p.pagos_extra) ? p.pagos_extra : []).reduce((t, x) => t + (num(x.importe) || 0), 0);
  return Math.round((num(p.total) - num(p.monto_online) - extra) * 100) / 100;
};
// Arreglar esa diferencia: cobrarla (uno o varios medios de pago: entra al cierre de caja del dia), devolverla
// (con un medio de pago) o dejarle un credito a favor (una gift card con ese saldo, para usar en el local o la tienda)
router.post('/pedidos/:id/diferencia', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!p || p.estado === 'cancelado') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No se encontró el pedido' }); }
    const pend = pendienteDe(p);
    const b = req.body || {}, fecha = new Date().toISOString();
    const usuario = (req.usuario && (req.usuario.nombre || req.usuario.email)) || null;
    const medios = (await client.query('SELECT id, nombre FROM medios_pago')).rows;
    const nombreMedio = (id) => (medios.find(m => Number(m.id) === Number(id)) || {}).nombre;
    let nuevos = [], gc = null;
    if (b.accion === 'cobrar') {
      if (pend <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay nada para cobrar en este pedido' }); }
      const pagos = (Array.isArray(b.pagos) ? b.pagos : []).map(x => ({ medio_pago_id: parseInt(x.medio_pago_id), importe: Math.round((parseFloat(x.importe) || 0) * 100) / 100 })).filter(x => x.importe > 0);
      if (!pagos.length || pagos.some(x => !nombreMedio(x.medio_pago_id))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí el medio de pago de cada importe' }); }
      const suma = pagos.reduce((t, x) => t + x.importe, 0);
      if (Math.abs(suma - pend) >= 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Los importes suman ' + suma.toLocaleString('es-AR') + ' y hay que cobrar ' + pend.toLocaleString('es-AR') }); }
      nuevos = pagos.map(x => ({ fecha, tipo: 'cobro', medio_pago_id: x.medio_pago_id, nombre: nombreMedio(x.medio_pago_id), importe: x.importe, usuario }));
    } else if (b.accion === 'devolver') {
      if (pend >= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay nada para devolver en este pedido' }); }
      if (!nombreMedio(b.medio_pago_id)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí cómo se lo devolvés' }); }
      nuevos = [{ fecha, tipo: 'devolucion', medio_pago_id: parseInt(b.medio_pago_id), nombre: nombreMedio(b.medio_pago_id), importe: pend, usuario }];
    } else if (b.accion === 'credito') {
      if (pend >= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay saldo a favor de la clienta' }); }
      const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let codigo = null;
      for (let i = 0; i < 12 && !codigo; i++) {
        const c = 'GIFT-' + Array.from(require('crypto').randomBytes(6), x => letras[x % letras.length]).join('');
        if (!(await client.query('SELECT 1 FROM gift_cards WHERE codigo = $1', [c])).rows.length) codigo = c;
      }
      const monto = -pend;
      gc = (await client.query(`INSERT INTO gift_cards (codigo, monto_inicial, saldo, beneficiario_nombre, beneficiario_telefono, cliente_id, estado, local_id, mensaje)
        VALUES ($1, $2, $2, $3, $4, $5, 'activa', $6, $7) RETURNING id, codigo`, [codigo, monto, p.nombre, p.telefono || null, p.cliente_id || null, p.local_id || 1, 'Crédito a favor por cambio en el pedido web N° ' + (p.numero || p.codigo)])).rows[0];
      await client.query(`INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante) VALUES ($1, 'emision', $2, $2)`, [gc.id, monto]);
      // Como los creditos por devolucion: no es plata nueva (importe 0 en la caja)
      await client.query(`INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id) VALUES ($1, 'I', 0, $2, $3)`,
        ['Gift Card ' + codigo + ' (credito por cambio, pedido web ' + (p.numero || p.codigo) + ')', codigo, p.local_id || 1]);
      nuevos = [{ fecha, tipo: 'credito', importe: pend, gc_codigo: codigo, usuario }];
    } else { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí qué hacer con la diferencia' }); }
    await client.query(`UPDATE tienda_pedidos SET pagos_extra = COALESCE(pagos_extra, '[]'::jsonb) || $2::jsonb, actualizado_en = NOW() WHERE id = $1`, [p.id, JSON.stringify(nuevos)]);
    await client.query('COMMIT');
    const pc = await pedidoCompleto(p.id);
    res.json({ ...pc, pendiente: pendienteDe(pc), gc_codigo: gc ? gc.codigo : null });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] diferencia:', e.message);
    res.status(500).json({ error: 'No se pudo registrar' });
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

// Preventa: ordenes de ingreso que todavia tienen mercaderia en camino, para ponerles la fecha estimada de ingreso
router.get('/preventa/ordenes', async (req, res) => {
  try {
    const r = await pool.query(`SELECT o.id, o.numero_factura, o.fecha_factura, TO_CHAR(o.fecha_estimada, 'YYYY-MM-DD') AS fecha_estimada, COALESCE(p.nombre, o.proveedor_nombre) AS proveedor,
        COUNT(oi.id)::int AS productos, SUM(GREATEST(CASE WHEN NOT COALESCE(oi.revisado_rg, FALSE) THEN COALESCE(oi.cantidad_rg, 0) ELSE 0 END, 0) + GREATEST(CASE WHEN NOT COALESCE(oi.revisado_ush, FALSE) THEN COALESCE(oi.cantidad_ush, 0) ELSE 0 END, 0))::int AS unidades,
        STRING_AGG(oi.producto_nombre, ', ' ORDER BY oi.id) AS nombres
      FROM ordenes_ingreso o JOIN ordenes_ingreso_items oi ON oi.orden_id = o.id LEFT JOIN proveedores p ON p.id = o.proveedor_id
      WHERE (oi.cantidad_rg > 0 AND NOT COALESCE(oi.revisado_rg, FALSE)) OR (oi.cantidad_ush > 0 AND NOT COALESCE(oi.revisado_ush, FALSE))
      GROUP BY o.id, p.nombre ORDER BY o.creado_en DESC LIMIT 40`);
    res.json(r.rows);
  } catch (e) { console.error('[tienda] preventa ordenes:', e.message); res.status(500).json({ error: 'No se pudieron cargar las órdenes' }); }
});
router.put('/preventa/ordenes/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const f = String((req.body && req.body.fecha_estimada) || '');
    if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return res.status(400).json({ error: 'Fecha no válida' });
    await pool.query('UPDATE ordenes_ingreso SET fecha_estimada = $1 WHERE id = $2', [f || null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar la fecha' }); }
});

// Sector "¿Querés hacer un regalo?" (gift cards online y armador de regalos)
router.put('/referidos', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const b = req.body || {};
    const r = tienda.referidosDe({ referidos: { activo: !!b.activo, pct: b.pct, puntos: b.puntos } });
    await pool.query('UPDATE tienda_config SET referidos = $1 WHERE id = 1', [JSON.stringify(r)]);
    res.json({ referidos: r });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/misiones', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const m = misiones.misionesDe({ misiones: (req.body || {}).misiones });
    await pool.query('UPDATE tienda_config SET misiones = $1 WHERE id = 1', [JSON.stringify(m)]);
    res.json({ misiones: m });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/rutinas', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const r = tienda.rutinasDe({ rutinas: Array.isArray(req.body) ? req.body : (req.body || {}).rutinas });
    for (const x of r) if (x.video_url && !tienda.videoRutina(x.video_url)) return res.status(400).json({ error: 'El video de "' + x.titulo + '" no es un link que podamos mostrar (Instagram, TikTok —el link largo— o YouTube).' });
    await pool.query('UPDATE tienda_config SET rutinas = $1 WHERE id = 1', [JSON.stringify(r)]);
    res.json({ rutinas: r });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/ofertas', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const o = tienda.ofertasDe({ ofertas: req.body || {} });
    await pool.query('UPDATE tienda_config SET ofertas = $1 WHERE id = 1', [JSON.stringify(o)]);
    res.json({ ofertas: o });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Un kit de Lumiere (Productos > Kits) como combo de la tienda: si ya hay un combo de ese kit se devuelve ese;
// si no, se crea con sus productos y cantidades al precio de lista (la suma). El precio especial se pone en Ofertas y combos.
router.post('/ofertas/desde-kit', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño, el encargado o quien maneja la tienda' });
    const kitId = parseInt(req.body && req.body.kit_id) || 0;
    const kit = (await pool.query('SELECT id, nombre FROM kits WHERE id = $1 AND activo = TRUE', [kitId])).rows[0];
    if (!kit) return res.status(404).json({ error: 'No se encontró el kit' });
    const c = await tienda.leerConfig();
    const o = tienda.ofertasDe(c);
    const ya = o.combos.find(x => x.kit_id === kit.id);
    if (ya) return res.json({ combo: ya, nuevo: false });
    const items = (await pool.query(`SELECT ki.producto_id, SUM(ki.cantidad)::int AS cantidad, MAX(p.precio) AS precio FROM kit_items ki
      JOIN productos p ON p.id = ki.producto_id WHERE ki.kit_id = $1 GROUP BY ki.producto_id ORDER BY MIN(ki.id) LIMIT 6`, [kit.id])).rows;
    if (!items.length) return res.status(400).json({ error: 'Ese kit no tiene productos' });
    const cantidades = {};
    items.forEach(it => { if (it.cantidad > 1) cantidades[it.producto_id] = Math.min(it.cantidad, 10); });
    // Sin precio especial (0) = precio de lista: sigue los precios de los productos
    const nuevo = { id: 'k' + kit.id + Date.now().toString(36).slice(-5), nombre: kit.nombre, productos: items.map(it => it.producto_id), cantidades, kit_id: kit.id, precio: 0, activo: true };
    const guardado = tienda.ofertasDe({ ofertas: { dia: o.dia, combos: [...o.combos, nuevo] } });
    const combo = guardado.combos.find(x => x.id === nuevo.id);
    if (!combo) return res.status(400).json({ error: 'El kit necesita al menos 2 unidades para ser un combo' });
    await pool.query('UPDATE tienda_config SET ofertas = $1 WHERE id = 1', [JSON.stringify(guardado)]);
    res.json({ combo, nuevo: true });
  } catch (e) { console.error('[tienda] combo desde kit:', e.message); res.status(500).json({ error: 'No se pudo armar el combo del kit' }); }
});
router.put('/regalos', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const r = tienda.regalosDe({ regalos: req.body || {} });
    await pool.query('UPDATE tienda_config SET regalos = $1 WHERE id = 1', [JSON.stringify(r)]);
    res.json({ regalos: r, regalos_hoy: tienda.temaRegaloHoy(r) });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Ver la tienda como la ve una clienta (su cuenta, su rutina, sus avisos), solo para mirar: llave de 30 minutos
router.post('/ver-como/:clienteId', async (req, res) => {
  try {
    if (!esDuena(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
    const c = (await pool.query('SELECT id, nombre FROM clientes WHERE id = $1', [parseInt(req.params.clienteId)])).rows[0];
    if (!c) return res.status(404).json({ error: 'No encontramos esa clienta' });
    const cfg = (await pool.query('SELECT slug, activo FROM tienda_config WHERE id = 1')).rows[0];
    if (!cfg || !cfg.activo || !cfg.slug) return res.status(400).json({ error: 'Primero publicá la tienda online' });
    const neg = negocioActual();
    const token = jwt.sign({ id: c.id, tipo: 'cliente', neg: neg && neg.id, vista: true, por: req.usuario && req.usuario.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.json({ slug: cfg.slug, token, nombre: c.nombre });
  } catch (e) { console.error('[tienda] ver como:', e.message); res.status(500).json({ error: 'No se pudo abrir' }); }
});
router.put('/packs', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const lista = Array.isArray(req.body && req.body.packs) ? req.body.packs : [];
    const packs = tienda.packsDe({ packs: lista });
    if (packs.length < lista.filter(p => p && (String(p.nombre || '').trim() || (p.marcas || []).length || (p.productos || []).length)).length) return res.status(400).json({ error: 'Cada pack necesita un nombre y al menos una marca o un producto' });
    await pool.query('UPDATE tienda_config SET packs = $1 WHERE id = 1', [JSON.stringify(packs)]);
    res.json({ packs });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/express', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const k = tienda.expressDe({ express: req.body || {} });
    if (k.activo && !k.franjas.length) return res.status(400).json({ error: 'Cargá al menos un horario' });
    if (k.activo && k.franjas.some(f => f.desde >= f.hasta)) return res.status(400).json({ error: 'En cada horario, el "hasta" tiene que ser después del "desde"' });
    if (k.activo && k.franjas.some(f => !f.dias.length)) return res.status(400).json({ error: 'Elegí al menos un día en cada horario' });
    await pool.query('UPDATE tienda_config SET express = $1 WHERE id = 1', [JSON.stringify(k)]);
    res.json({ express: k });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Diagnostico de piel: horarios, duracion y cupo (la dueña o encargada); la agenda la ven tambien las vendedoras
router.put('/diagnostico', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const k = tienda.diagnosticoDe({ diagnostico: req.body || {} });
    if (k.activo && !k.franjas.length) return res.status(400).json({ error: 'Cargá al menos un horario' });
    if (k.activo && k.franjas.some(f => f.desde >= f.hasta)) return res.status(400).json({ error: 'En cada horario, el "hasta" tiene que ser después del "desde"' });
    if (k.activo && k.franjas.some(f => !f.dias.length)) return res.status(400).json({ error: 'Elegí al menos un día en cada horario' });
    await pool.query('UPDATE tienda_config SET diagnostico = $1 WHERE id = 1', [JSON.stringify(k)]);
    res.json({ diagnostico: k });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
const ESTADOS_TURNO = ['reservado', 'confirmado', 'atendido', 'ausente', 'cancelado'];
const PIELES_T = ['grasa', 'seca', 'mixta', 'sensible', 'normal'];
const NEC_T = ['acne', 'manchas', 'antiedad', 'rojeces', 'hidratacion', 'poros', 'ojeras'];
const SQL_TURNOS = `SELECT t.id, t.cliente_id, t.nombre, t.telefono, t.local_id, l.nombre AS local, to_char(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora, t.piel, t.nec, t.nota,
  t.estado, t.atendido_por, t.resultado, t.confirmado_en, t.creado_en, c.perfil_piel FROM tienda_turnos t LEFT JOIN locales l ON l.id = t.local_id LEFT JOIN clientes c ON c.id = t.cliente_id`;
// Agenda: desde hace una semana (para anotar lo que quedo pendiente) hasta lo que viene
router.get('/turnos', async (req, res) => {
  try {
    const r = await pool.query(`${SQL_TURNOS} WHERE t.fecha >= CURRENT_DATE - 7 ORDER BY t.fecha, t.hora, t.id`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la agenda' }); }
});
// Confirmar (ya le escribimos), vino / no vino / cancelar, y lo que le recomendaron. El tipo de piel que se anota pasa a su perfil
router.put('/turnos/:id', async (req, res) => {
  try {
    const b = req.body || {}, id = parseInt(req.params.id);
    const t = (await pool.query('SELECT * FROM tienda_turnos WHERE id = $1', [id])).rows[0];
    if (!t) return res.status(404).json({ error: 'No encontramos ese turno' });
    const estado = ESTADOS_TURNO.includes(b.estado) ? b.estado : t.estado;
    const u = req.usuario || {};
    const por = u.nombre || (u.id ? ((await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre : null) || 'Local';
    const piel = b.piel === undefined ? t.piel : (PIELES_T.includes(b.piel) ? b.piel : null);
    const nec = b.nec === undefined ? t.nec : [...new Set((Array.isArray(b.nec) ? b.nec : []).filter(n => NEC_T.includes(n)))].slice(0, 3);
    const resultado = b.resultado === undefined ? t.resultado : (String(b.resultado || '').trim().slice(0, 1000) || null);
    await pool.query(`UPDATE tienda_turnos SET estado = $1, piel = $2, nec = $3, resultado = $4, actualizado_en = NOW(),
      confirmado_en = CASE WHEN $1 = 'confirmado' AND confirmado_en IS NULL THEN NOW() ELSE confirmado_en END,
      atendido_por = CASE WHEN $1 = 'atendido' THEN COALESCE(atendido_por, $5) ELSE atendido_por END WHERE id = $6`,
      [estado, piel, nec && nec.length ? JSON.stringify(nec) : null, resultado, por, id]);
    if (estado === 'atendido' && t.cliente_id && (piel || (nec && nec.length))) {
      const antes = ((await pool.query('SELECT perfil_piel FROM clientes WHERE id = $1', [t.cliente_id])).rows[0] || {}).perfil_piel || {};
      await pool.query('UPDATE clientes SET perfil_piel = $1 WHERE id = $2', [JSON.stringify({ piel: piel || antes.piel || null, nec: nec && nec.length ? nec : (antes.nec || []) }), t.cliente_id]);
    }
    res.json((await pool.query(`${SQL_TURNOS} WHERE t.id = $1`, [id])).rows[0]);
  } catch (e) { console.error('[tienda] turno:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/cumple', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const k = tienda.cumpleDe({ cumple: req.body || {} });
    if (k.activo && !k.valor) return res.status(400).json({ error: 'Poné cuánto es el regalo' });
    await pool.query('UPDATE tienda_config SET cumple = $1 WHERE id = 1', [JSON.stringify(k)]);
    res.json({ cumple: k });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/muestras', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    // Los envases se cuentan solos con cada pedido: solo se pisan los locales que se cargaron a mano en esta vez
    const actual = tienda.muestrasDe((await pool.query('SELECT muestras FROM tienda_config WHERE id = 1')).rows[0] || {});
    const b = req.body || {};
    const m = tienda.muestrasDe({ muestras: { ...b, envases: { ...actual.envases, ...(b.envases && typeof b.envases === 'object' ? b.envases : {}) } } });
    if (m.activo && !m.opciones.length) return res.status(400).json({ error: 'Escribí al menos una muestra para elegir' });
    await pool.query('UPDATE tienda_config SET muestras = $1 WHERE id = 1', [JSON.stringify(m)]);
    res.json({ muestras: m });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.put('/links', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const l = tienda.linksDe({ links: req.body || {} });
    await pool.query('UPDATE tienda_config SET links = $1 WHERE id = 1', [JSON.stringify(l)]);
    res.json({ links: l });
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
    await tienda.premiarReferida(client, p.id).catch(e => console.error('[tienda] premiar amiga:', e.message));
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
    await tienda.premiarReferida(pool, parseInt(req.params.id)).catch(e => console.error('[tienda] premiar amiga:', e.message));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar como entregado' }); }
});

module.exports = router;
