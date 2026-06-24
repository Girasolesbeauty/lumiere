const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');

const TN_APP_ID = process.env.TIENDANUBE_APP_ID || '32840';
const TN_CLIENT_SECRET = process.env.TIENDANUBE_CLIENT_SECRET;

let TN_TOKEN = process.env.TIENDANUBE_TOKEN;
let TN_USER = process.env.TIENDANUBE_USER_ID;

const cargarCredenciales = async () => {
  try {
    const res = await pool.query("SELECT valor FROM configuracion WHERE clave = 'tn_token'");
    const res2 = await pool.query("SELECT valor FROM configuracion WHERE clave = 'tn_user_id'");
    if (res.rows.length) TN_TOKEN = res.rows[0].valor;
    if (res2.rows.length) TN_USER = res2.rows[0].valor;
  } catch (e) {}
};
cargarCredenciales();

const tnBase = () => `https://api.tiendanube.com/v1/${TN_USER}`;
const tnHeaders = () => ({
  'Authentication': `bearer ${TN_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'Lumiere/1.0 (girasolesbeauty@gmail.com)'
});

const tnFetch = async (method, path, body) => {
  const res = await axios({ method, url: `${tnBase()}${path}`, headers: tnHeaders(), data: body || undefined });
  return res.data;
};

// OAuth callback
router.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Falta el codigo de autorizacion');
    const tokenRes = await axios.post('https://www.tiendanube.com/apps/authorize/token', {
      client_id: TN_APP_ID, client_secret: TN_CLIENT_SECRET, grant_type: 'authorization_code', code
    });
    const { access_token, user_id } = tokenRes.data;
    TN_TOKEN = access_token;
    TN_USER = String(user_id);
    await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ('tn_token', $1) ON CONFLICT (clave) DO UPDATE SET valor = $1`, [access_token]);
    await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ('tn_user_id', $1) ON CONFLICT (clave) DO UPDATE SET valor = $1`, [String(user_id)]);
    process.env.TIENDANUBE_TOKEN = access_token;
    process.env.TIENDANUBE_USER_ID = String(user_id);
    res.send('<h2>Tiendanube conectada correctamente con Lumiere!</h2><p>Ya podes cerrar esta ventana.</p>');
  } catch (e) {
    console.error('Error OAuth TN:', e.response?.data || e.message);
    res.status(500).send('Error al autorizar: ' + (e.response?.data?.description || e.message));
  }
});

// Webhooks de privacidad
router.post('/webhooks/store-redact', (req, res) => res.json({ ok: true }));
router.post('/webhooks/customers-redact', (req, res) => res.json({ ok: true }));
router.post('/webhooks/customers-data', (req, res) => res.json({ ok: true }));

// Status
router.get('/status', async (req, res) => {
  try {
    await cargarCredenciales();
    if (!TN_TOKEN || !TN_USER) return res.json({ ok: false, error: 'No autorizada todavia' });
    const store = await tnFetch('GET', '/store');
    res.json({ ok: true, tienda: store.name?.es || store.name, plan: store.plan_name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.response?.data?.description || e.message });
  }
});

// Webhook de pedido - guarda como pendiente, NO descuenta stock automaticamente
router.post('/webhook', async (req, res) => {
  res.json({ ok: true });
  try {
    const { event } = req.body;
    if (event !== 'store/order/paid' && event !== 'store/order/created') return;
    const pedido = req.body.payload;
    if (!pedido || !pedido.id) return;

    const existe = await pool.query('SELECT id FROM tiendanube_pedidos WHERE tn_order_id = $1', [pedido.id]);
    if (existe.rows.length) return;

    const items = (pedido.products || []).map(p => ({
      nombre: p.name, cantidad: p.quantity, precio: p.price, variant_id: p.variant_id, product_id: p.product_id, sku: p.sku
    }));

    await pool.query(
      `INSERT INTO tiendanube_pedidos (tn_order_id, numero, cliente_nombre, cliente_email, total, productos)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [pedido.id, pedido.number || String(pedido.id), pedido.contact_name || 'Cliente TN', pedido.contact_email || null, pedido.total || 0, JSON.stringify(items)]
    );
  } catch (e) {
    console.error('Webhook TN error:', e.message);
  }
});

// Listar pedidos de TN guardados localmente
router.get('/pedidos-locales', async (req, res) => {
  try {
    const { estado } = req.query;
    let query = 'SELECT * FROM tiendanube_pedidos WHERE 1=1';
    const params = [];
    if (estado) { params.push(estado); query += ` AND estado = $${params.length}`; }
    query += ' ORDER BY creado_en DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Contar pedidos pendientes (para notificacion)
router.get('/pedidos-pendientes/count', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) as total FROM tiendanube_pedidos WHERE estado = 'pendiente'");
    res.json({ total: parseInt(result.rows[0].total) });
  } catch (e) { res.json({ total: 0 }); }
});

// Autorizar descuento de stock de un pedido
router.post('/pedidos-locales/:id/autorizar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { usuario_nombre } = req.body;
    const pedidoRes = await client.query('SELECT * FROM tiendanube_pedidos WHERE id = $1', [req.params.id]);
    if (!pedidoRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado' }); }
    const pedido = pedidoRes.rows[0];
    if (pedido.stock_descontado) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El stock ya fue descontado' }); }

    const items = pedido.productos || [];
    for (const item of items) {
      // Buscar vinculo por variant_id o product_id
      let vinculo = null;
      if (item.variant_id) {
        const vRes = await client.query(
          `SELECT producto_id FROM tiendanube_vinculos WHERE (tn_variant_id_rg = $1 OR tn_variant_id_ush = $1) AND activo = true`,
          [String(item.variant_id)]
        );
        if (vRes.rows.length) vinculo = vRes.rows[0];
      }
      if (!vinculo && item.product_id) {
        const vRes = await client.query(
          `SELECT producto_id FROM tiendanube_vinculos WHERE tn_product_id = $1 AND activo = true`,
          [item.product_id]
        );
        if (vRes.rows.length) vinculo = vRes.rows[0];
      }
      if (vinculo) {
        await client.query(
          'UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2',
          [item.cantidad || 1, vinculo.producto_id]
        );
      }
    }

    await client.query(
      `UPDATE tiendanube_pedidos SET estado = 'procesado', stock_descontado = TRUE, autorizado_por = $1, autorizado_en = NOW() WHERE id = $2`,
      [usuario_nombre || null, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Rechazar/ignorar pedido
router.post('/pedidos-locales/:id/rechazar', async (req, res) => {
  try {
    await pool.query(`UPDATE tiendanube_pedidos SET estado = 'rechazado' WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Buscar productos en Tiendanube
router.get('/buscar-producto', async (req, res) => {
  try {
    const { q } = req.query;
    const productos = await tnFetch('GET', `/products?q=${encodeURIComponent(q)}&per_page=10`);
    const result = productos.map(p => ({
      id: p.id, nombre: p.name?.es || p.name,
      variantes: (p.variants || []).map(v => ({
        id: v.id, nombre: (v.values || []).map(val => val.es || val).join(' / ') || 'Default',
        stock: v.stock, precio: v.price, sku: v.sku
      }))
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.response?.data?.description || e.message }); }
});

// Vinculos
router.get('/vinculos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tv.*, p.nombre AS producto_nombre, p.marca AS producto_marca
       FROM tiendanube_vinculos tv JOIN productos p ON tv.producto_id = p.id
       WHERE tv.activo = true ORDER BY p.nombre ASC`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/vinculos/:producto_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tiendanube_vinculos WHERE producto_id = $1 AND activo = true', [req.params.producto_id]);
    res.json(result.rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/vinculos', async (req, res) => {
  try {
    const { producto_id, tn_product_id, tn_variant_id_rg, tn_variant_id_ush } = req.body;
    await pool.query('UPDATE tiendanube_vinculos SET activo = false WHERE producto_id = $1', [producto_id]);
    const result = await pool.query(
      `INSERT INTO tiendanube_vinculos (producto_id, tn_product_id, tn_variant_id_rg, tn_variant_id_ush) VALUES ($1, $2, $3, $4) RETURNING *`,
      [producto_id, tn_product_id, tn_variant_id_rg || null, tn_variant_id_ush || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/vinculos/:producto_id', async (req, res) => {
  try {
    await pool.query('UPDATE tiendanube_vinculos SET activo = false WHERE producto_id = $1', [req.params.producto_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sync stock manual
router.post('/sync/stock/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    const { local_id } = req.body;
    const vinculo = await pool.query('SELECT * FROM tiendanube_vinculos WHERE producto_id = $1 AND activo = true', [producto_id]);
    if (!vinculo.rows.length) return res.json({ ok: false, mensaje: 'Sin vinculo TN' });
    const v = vinculo.rows[0];
    const variant_id = local_id == 2 ? v.tn_variant_id_ush : v.tn_variant_id_rg;
    if (!variant_id) return res.json({ ok: false, mensaje: 'Sin variante TN para este local' });
    const prod = await pool.query('SELECT * FROM productos WHERE id = $1', [producto_id]);
    const nuevoStock = prod.rows[0]?.stock || 0;
    await tnFetch('PUT', `/products/${v.tn_product_id}/variants/${variant_id}`, { stock: nuevoStock });
    res.json({ ok: true, stock: nuevoStock });
  } catch (e) { res.status(500).json({ error: e.response?.data?.description || e.message }); }
});

// Registrar webhook
router.post('/registrar-webhook', async (req, res) => {
  try {
    const { backend_url } = req.body;
    const webhook = await tnFetch('POST', '/webhooks', { event: 'store/order/paid', url: `${backend_url}/api/tiendanube/webhook` });
    res.json({ ok: true, webhook });
  } catch (e) { res.status(500).json({ error: e.response?.data?.description || e.message }); }
});

// Obtener pedidos directo de TN API
router.get('/pedidos', async (req, res) => {
  try {
    const pedidos = await tnFetch('GET', '/orders?per_page=20&status=open');
    res.json(pedidos);
  } catch (e) { res.status(500).json({ error: e.response?.data?.description || e.message }); }
});

module.exports = router;