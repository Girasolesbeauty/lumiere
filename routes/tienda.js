const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const tienda = require('../lib/tienda');
const { ayudaMP } = require('./mercadopago');
const QRCode = require('qrcode');

// Tienda web: lo que se maneja desde Lumiere (configuracion, productos publicados y pedidos).
// La parte publica esta en routes/tiendaPublica.js. Ver lib/tienda.js.

const { num } = tienda;
const esJefe = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const SLUG_OK = /^[a-z0-9][a-z0-9-]{2,40}$/;

router.use(async (req, res, next) => { try { await tienda.asegurar(); await tienda.vencerPendientes().catch(() => {}); next(); } catch (e) { res.status(500).json({ error: 'No se pudo abrir la tienda' }); } });

router.get('/config', async (req, res) => {
  try {
    const c = await tienda.leerConfig();
    let mp = false;
    try { await ayudaMP.asegurar(); mp = !!(await ayudaMP.token()); } catch (e) {}
    const neg = (await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const sugerido = String(neg.nombre_negocio || 'mi-tienda').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mi-tienda';
    res.json({ ...c, mp_conectado: mp, slug_sugerido: sugerido });
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
    if (b.activo && !b.pago_mp && !b.pago_transferencia && !b.pago_retiro) return res.status(400).json({ error: 'Elegí al menos una forma de pago' });
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

// QR de la direccion de la tienda (para el mostrador o Instagram)
router.get('/qr', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!/^https?:\/\/\S+$/.test(url) || url.length > 300) return res.status(400).json({ error: 'Dirección no válida' });
    res.json({ qr: await QRCode.toDataURL(url, { width: 360, margin: 1 }) });
  } catch (e) { res.status(500).json({ error: 'No se pudo armar el QR' }); }
});

// Productos para elegir que se publica
router.get('/productos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, p.codigo_barras, p.proveedor_id, pr.nombre AS proveedor, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
             COALESCE(tp.publicado, FALSE) AS publicado, tp.descripcion, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url,
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
  return { ...p, subtotal: num(p.subtotal), total: num(p.total), costo_envio: num(p.costo_envio), items: items.map(i => ({ ...i, precio: num(i.precio) })) };
}

router.get('/pedidos', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM tienda_pedidos ORDER BY CASE WHEN estado IN ('confirmado','pendiente_pago','preparado','en_caja') THEN 0 ELSE 1 END, creado_en DESC LIMIT 200`);
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
      await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, estado = CASE WHEN estado = 'pendiente_pago' THEN 'confirmado' ELSE estado END, vence_en = NULL, actualizado_en = NOW() WHERE id = $1`, [p.id]);
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
    if (p.pagado && p.pago === 'mp') {
      let m = (await pool.query(`SELECT * FROM medios_pago WHERE nombre = 'Mercado Pago (tienda web)' LIMIT 1`)).rows[0];
      if (!m) m = (await pool.query(`INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online) VALUES ('Mercado Pago (tienda web)', 'plataforma', 1, FALSE, 1.0, 0, TRUE, TRUE) RETURNING *`)).rows[0];
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
    await client.query(`UPDATE tienda_pedidos SET estado = CASE WHEN pagado OR pago = 'retiro' THEN 'preparado' ELSE 'pendiente_pago' END, stock_apartado = TRUE, actualizado_en = NOW() WHERE id = $1`, [p.id]);
    await client.query('COMMIT');
    res.json(await pedidoCompleto(p.id));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    res.status(500).json({ error: 'No se pudo volver a apartar' });
  } finally { client.release(); }
});

// Lo llama el Punto de Venta al registrar la venta del pedido
router.put('/pedidos/:id/vendido', async (req, res) => {
  try {
    await pool.query(`UPDATE tienda_pedidos SET estado = 'entregado', venta_id = $1, pagado = TRUE, actualizado_en = NOW() WHERE id = $2 AND estado <> 'cancelado'`,
      [parseInt(req.body && req.body.venta_id) || null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar como entregado' }); }
});

module.exports = router;
