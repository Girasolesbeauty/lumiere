const express = require('express');
const router = express.Router({ mergeParams: true });
const crypto = require('crypto');
const pool = require('../config/database');
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');
const tienda = require('../lib/tienda');
const { ayudaMP } = require('./mercadopago');

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
        req.tienda = cfg;
        await tienda.vencerPendientes().catch(() => {});
        next();
      } catch (e) { console.error('[tienda publica]', e.message); res.status(500).json({ error: 'La tienda no está disponible en este momento' }); }
    });
  } catch (e) { res.status(500).json({ error: 'La tienda no está disponible en este momento' }); }
});

async function mpDisponible() {
  try { await ayudaMP.asegurar(); return !!(await ayudaMP.token()); } catch (e) { return false; }
}

// Datos de la tienda: nombre, logo, formas de entrega y de pago
router.get('/:slug', async (req, res) => {
  try {
    const c = req.tienda;
    const neg = (await pool.query('SELECT nombre_negocio, logo_url FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const locales = (await pool.query('SELECT id, nombre, direccion FROM locales WHERE COALESCE(activo, TRUE) ORDER BY id').catch(() => ({ rows: [] }))).rows
      .filter(l => !c.retiro_locales || !c.retiro_locales.length || c.retiro_locales.includes(l.id));
    const mp = c.pago_mp && await mpDisponible();
    res.json({
      titulo: c.titulo || neg.nombre_negocio || 'Tienda', mensaje: c.mensaje || '', logo: c.logo || neg.logo_url || null, color: c.color || '#c9a84c', whatsapp: c.whatsapp || null,
      retiro: c.retiro_activo ? locales : [],
      envio: c.envio_activo ? { zonas: c.envio_zonas, gratis_desde: c.envio_gratis_desde } : null,
      pagos: { mp, transferencia: !!c.pago_transferencia, retiro: !!c.pago_retiro }, horas_reserva: c.horas_reserva,
      anuncios: String(c.anuncios || '').split('\n').filter(Boolean),
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la tienda' }); }
});

// Productos publicados con precio y lo disponible en cada local (y sus variantes)
router.get('/:slug/productos', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
             COALESCE(p.tiene_variantes, FALSE) AS tiene_variantes, tp.descripcion, tp.orden, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url, (p.creado_en > NOW() - INTERVAL '30 days') AS nuevo,
             EXISTS (SELECT 1 FROM tienda_videos tv WHERE tv.producto_id = p.id) AS video_subido,
             ARRAY(SELECT f.id FROM tienda_fotos f WHERE f.producto_id = p.id ORDER BY f.orden, f.id) AS fotos_extra,
             (SELECT EXTRACT(EPOCH FROM i.actualizado_en)::bigint FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto_v,
             EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto
      FROM tienda_productos tp JOIN productos p ON p.id = tp.producto_id
      WHERE tp.publicado AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0
      ORDER BY tp.orden, p.nombre`).catch(async () => (await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, COALESCE(p.stock_rg, 0) AS stock_rg, COALESCE(p.stock_ush, 0) AS stock_ush,
             COALESCE(p.tiene_variantes, FALSE) AS tiene_variantes, tp.descripcion, tp.orden, COALESCE(tp.destacado, FALSE) AS destacado, tp.video_url, (p.creado_en > NOW() - INTERVAL '30 days') AS nuevo, EXISTS (SELECT 1 FROM tienda_videos tv WHERE tv.producto_id = p.id) AS video_subido, ARRAY[]::int[] AS fotos_extra, NULL::bigint AS foto_v, FALSE AS foto
      FROM tienda_productos tp JOIN productos p ON p.id = tp.producto_id
      WHERE tp.publicado AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0 ORDER BY tp.orden, p.nombre`)));
    const conVar = r.rows.filter(p => p.tiene_variantes).map(p => p.id);
    const vars = conVar.length ? (await pool.query(`SELECT id, producto_id, valor, COALESCE(stock_rg, 0) AS stock_rg, COALESCE(stock_ush, 0) AS stock_ush FROM producto_variantes WHERE activo AND producto_id = ANY($1) ORDER BY id`, [conVar]).catch(() => ({ rows: [] }))).rows : [];
    res.json(r.rows.map(p => {
      const v = vars.filter(x => x.producto_id === p.id).map(x => ({ id: x.id, valor: x.valor, stock: { 1: Math.max(0, x.stock_rg), 2: Math.max(0, x.stock_ush) } }));
      return {
        id: p.id, nombre: p.nombre, marca: p.marca, categoria: p.categoria, precio: num(p.precio), descripcion: p.descripcion || '', foto: !!p.foto,
        destacado: !!p.destacado, nuevo: !!p.nuevo, fotos: p.fotos_extra || [], foto_v: p.foto_v ? Number(p.foto_v) : null,
        video: p.video_subido ? { tipo: 'subido' } : tienda.videoDeLink(p.video_url),
        variantes: p.tiene_variantes && v.length ? v : null,
        stock: { 1: Math.max(0, parseInt(p.stock_rg) || 0), 2: Math.max(0, parseInt(p.stock_ush) || 0) },
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
    const r = (await pool.query(`SELECT i.imagen FROM producto_imagenes i JOIN tienda_productos tp ON tp.producto_id = i.producto_id AND tp.publicado WHERE i.producto_id = $1`, [req.params.id])).rows[0];
    if (!r) return res.status(404).end();
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(r.imagen || '');
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'public, max-age=600').send(Buffer.from(m[2], 'base64'));
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
    const r = (await pool.query(`SELECT v.tipo, octet_length(v.datos) AS largo, v.actualizado_en FROM tienda_videos v
      JOIN tienda_productos tp ON tp.producto_id = v.producto_id AND tp.publicado WHERE v.producto_id = $1`, [id])).rows[0];
    if (!r) return res.status(404).end();
    const largo = parseInt(r.largo);
    let desde = 0, hasta = largo - 1, parcial = false;
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
    if (m && (m[1] || m[2])) {
      if (m[1]) { desde = parseInt(m[1]); if (m[2]) hasta = Math.min(parseInt(m[2]), largo - 1); }
      else { desde = Math.max(0, largo - parseInt(m[2])); }
      hasta = Math.min(hasta, desde + 2 * 1024 * 1024 - 1); // de a 2 MB
      if (desde >= largo || desde > hasta) return res.status(416).set('Content-Range', 'bytes */' + largo).end();
      parcial = true;
    }
    const d = (await pool.query('SELECT substring(datos FROM $2 FOR $3) AS trozo FROM tienda_videos WHERE producto_id = $1', [id, desde + 1, hasta - desde + 1])).rows[0];
    res.status(parcial ? 206 : 200).set({
      'Content-Type': r.tipo, 'Accept-Ranges': 'bytes', 'Content-Length': String(d.trozo.length), 'Cache-Control': 'public, max-age=600',
      ...(parcial ? { 'Content-Range': 'bytes ' + desde + '-' + (desde + d.trozo.length - 1) + '/' + largo } : {}),
    }).send(d.trozo);
  } catch (e) { res.status(404).end(); }
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
    const z = (c.envio_zonas || []).find(x => x.nombre === b.zona);
    if (!z) return res.status(400).json({ error: 'Elegí la zona de envío' });
    direccion = String(b.direccion || '').trim().slice(0, 300);
    if (direccion.length < 5) return res.status(400).json({ error: 'Escribí la dirección de entrega' });
    localId = Number(c.envio_local) === 2 ? 2 : 1; zona = z.nombre; costoEnvio = Math.max(0, num(z.costo));
  }
  const pago = ['mp', 'transferencia', 'retiro'].includes(b.pago) ? b.pago : null;
  if (!pago || (pago === 'mp' && !(c.pago_mp && await mpDisponible())) || (pago === 'transferencia' && !c.pago_transferencia) || (pago === 'retiro' && !c.pago_retiro)) return res.status(400).json({ error: 'Elegí cómo vas a pagar' });
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(it => ({ producto_id: parseInt(it.producto_id), variante_id: parseInt(it.variante_id) || null, cantidad: Math.min(99, Math.max(1, parseInt(it.cantidad) || 1)) })).filter(it => it.producto_id);
  if (!items.length) return res.status(400).json({ error: 'El carrito está vacío' });

  const col = colLocal(localId);
  const client = await pool.connect();
  let pedido;
  try {
    await client.query('BEGIN');
    const lineas = [];
    for (const it of items) {
      const p = (await client.query(`SELECT p.id, p.nombre, p.precio, COALESCE(p.${col}, 0) AS stock FROM productos p JOIN tienda_productos tp ON tp.producto_id = p.id AND tp.publicado
        WHERE p.id = $1 AND p.activo = TRUE FOR UPDATE OF p`, [it.producto_id])).rows[0];
      if (!p) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Un producto del carrito ya no está disponible. Actualizá la página.' }); }
      let stock = parseInt(p.stock) || 0, valor = null;
      if (it.variante_id) {
        const v = (await client.query(`SELECT valor, COALESCE(${col}, 0) AS stock FROM producto_variantes WHERE id = $1 AND producto_id = $2 AND activo FOR UPDATE`, [it.variante_id, p.id])).rows[0];
        if (!v) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Una opción de ' + p.nombre + ' ya no está disponible' }); }
        stock = parseInt(v.stock) || 0; valor = v.valor;
      }
      const ya = lineas.filter(l => l.producto_id === p.id && l.variante_id === it.variante_id).reduce((t, l) => t + l.cantidad, 0);
      if (stock - ya < it.cantidad) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay stock suficiente de ' + p.nombre + (valor ? ' (' + valor + ')' : '') + (stock - ya > 0 ? ': quedan ' + (stock - ya) : '') + ' en ' + (entrega === 'retiro' ? 'ese local' : 'este momento') }); }
      lineas.push({ producto_id: p.id, variante_id: it.variante_id, nombre: p.nombre, variante_valor: valor, cantidad: it.cantidad, precio: num(p.precio) });
    }
    const subtotal = Math.round(lineas.reduce((t, l) => t + l.precio * l.cantidad, 0) * 100) / 100;
    if (entrega === 'envio' && c.envio_gratis_desde && subtotal >= c.envio_gratis_desde) costoEnvio = 0;
    const total = Math.round((subtotal + costoEnvio) * 100) / 100;
    const clienteId = await clienteDe(client, nombre, telefono, email);
    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const estado = pago === 'retiro' ? 'confirmado' : 'pendiente_pago';
    const horas = pago === 'mp' ? 2 : Math.min(168, Math.max(1, parseInt(c.horas_reserva) || 24));
    pedido = (await client.query(`INSERT INTO tienda_pedidos (codigo, cliente_id, nombre, telefono, email, entrega, local_id, direccion, zona, costo_envio, pago, subtotal, total, nota, estado, vence_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, CASE WHEN $15 = 'pendiente_pago' THEN NOW() + ($16 || ' hours')::interval ELSE NULL END) RETURNING *`,
      [codigo, clienteId, nombre, telefono, email, entrega, localId, direccion, zona, costoEnvio, pago, subtotal, total, String(b.nota || '').trim().slice(0, 500) || null, estado, String(horas)])).rows[0];
    for (const l of lineas) {
      await client.query('INSERT INTO tienda_pedido_items (pedido_id, producto_id, variante_id, nombre, variante_valor, cantidad, precio) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [pedido.id, l.producto_id, l.variante_id, l.nombre, l.variante_valor, l.cantidad, l.precio]);
    }
    await tienda.moverStock(client, pedido, -1);
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
    if (p.pago === 'mp' && !p.pagado && p.estado === 'pendiente_pago') {
      try {
        const tok = await ayudaMP.token();
        const r = await ayudaMP.mp(tok, 'GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + encodeURIComponent('tienda-' + p.codigo));
        const ok = ((r && r.results) || []).find(x => x.status === 'approved' && Math.abs(num(x.transaction_amount) - num(p.total)) < 0.01);
        if (ok) p = (await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pago_ref = $1, estado = 'confirmado', vence_en = NULL, actualizado_en = NOW() WHERE id = $2 RETURNING *`, [String(ok.id), p.id])).rows[0];
      } catch (e) { /* sin respuesta de Mercado Pago: se vuelve a preguntar despues */ }
    }
    const items = (await pool.query('SELECT nombre, variante_valor, cantidad, precio FROM tienda_pedido_items WHERE pedido_id = $1 ORDER BY id', [p.id])).rows.map(i => ({ ...i, precio: num(i.precio) }));
    const loc = p.entrega === 'retiro' ? (await pool.query('SELECT nombre, direccion FROM locales WHERE id = $1', [p.local_id]).catch(() => ({ rows: [] }))).rows[0] : null;
    res.json({
      codigo: p.codigo, estado: p.estado, pagado: p.pagado, pago: p.pago, entrega: p.entrega, local: loc || null, direccion: p.direccion, zona: p.zona,
      subtotal: num(p.subtotal), costo_envio: num(p.costo_envio), total: num(p.total), items, link_pago: p.estado === 'pendiente_pago' ? p.mp_link : null,
      vence_en: p.vence_en, transferencia: p.pago === 'transferencia' && !p.pagado ? (req.tienda.transferencia_datos || '') : null, creado_en: p.creado_en,
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar el pedido' }); }
});

module.exports = router;
