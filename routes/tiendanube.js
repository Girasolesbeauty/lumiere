const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');

const TN_APP_ID = process.env.TIENDANUBE_APP_ID || '32840';
const TN_CLIENT_SECRET = process.env.TIENDANUBE_CLIENT_SECRET;

// Cargar token y user_id desde la base (se guardan al autorizar)
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

// OAuth callback - Tiendanube redirige aca despues de autorizar
router.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Falta el codigo de autorizacion');

    const tokenRes = await axios.post('https://www.tiendanube.com/apps/authorize/token', {
      client_id: TN_APP_ID,
      client_secret: TN_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code
    });

    const { access_token, user_id } = tokenRes.data;
    TN_TOKEN = access_token;
    TN_USER = String(user_id);

    // Guardar en base para persistir
    await pool.query(`
      INSERT INTO configuracion (clave, valor) VALUES ('tn_token', $1)
      ON CONFLICT (clave) DO UPDATE SET valor = $1
    `, [access_token]);
    await pool.query(`
      INSERT INTO configuracion (clave, valor) VALUES ('tn_user_id', $1)
      ON CONFLICT (clave) DO UPDATE SET valor = $1
    `, [String(user_id)]);

    // Tambien guardar en env para esta sesion
    process.env.TIENDANUBE_TOKEN = access_token;
    process.env.TIENDANUBE_USER_ID = String(user_id);

    res.send('<h2>Tiendanube conectada correctamente con Lumiere!</h2><p>Ya podes cerrar esta ventana.</p>');
  } catch (e) {
    console.error('Error OAuth TN:', e.response?.data || e.message);
    res.status(500).send('Error al autorizar: ' + (e.response?.data?.description || e.message));
  }
});

// Webhooks de privacidad (requeridos por Tiendanube)
router.post('/webhooks/store-redact', (req, res) => res.json({ ok: true }));
router.post('/webhooks/customers-redact', (req, res) => res.json({ ok: true }));
router.post('/webhooks/customers-data', (req, res) => res.json({ ok: true }));

// Verificar conexion
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

// Buscar productos en Tiendanube para vincular
router.get('/buscar-producto', async (req, res) => {
  try {
    const { q } = req.query;
    const productos = await tnFetch('GET', `/products?q=${encodeURIComponent(q)}&per_page=10`);
    const result = productos.map(p => ({
      id: p.id,
      nombre: p.name?.es || p.name,
      variantes: (p.variants || []).map(v => ({
        id: v.id,
        nombre: (v.values || []).map(val => val.es || val).join(' / ') || 'Default',
        stock: v.stock,
        precio: v.price,
        sku: v.sku
      }))
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.description || e.message });
  }
});

// Obtener vinculos de un producto
router.get('/vinculos/:producto_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tiendanube_vinculos WHERE producto_id = $1 AND activo = true',
      [req.params.producto_id]
    );
    res.json(result.rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar vinculo
router.post('/vinculos', async (req, res) => {
  try {
    const { producto_id, tn_product_id, tn_variant_id_rg, tn_variant_id_ush } = req.body;
    await pool.query('UPDATE tiendanube_vinculos SET activo = false WHERE producto_id = $1', [producto_id]);
    const result = await pool.query(
      `INSERT INTO tiendanube_vinculos (producto_id, tn_product_id, tn_variant_id_rg, tn_variant_id_ush)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [producto_id, tn_product_id, tn_variant_id_rg || null, tn_variant_id_ush || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar vinculo
router.delete('/vinculos/:producto_id', async (req, res) => {
  try {
    await pool.query('UPDATE tiendanube_vinculos SET activo = false WHERE producto_id = $1', [req.params.producto_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar stock en Tiendanube
router.post('/sync/stock/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    const { local_id } = req.body;
    const vinculo = await pool.query(
      'SELECT * FROM tiendanube_vinculos WHERE producto_id = $1 AND activo = true',
      [producto_id]
    );
    if (!vinculo.rows.length) return res.json({ ok: false, mensaje: 'Sin vinculo TN' });
    const v = vinculo.rows[0];
    const variant_id = local_id == 2 ? v.tn_variant_id_ush : v.tn_variant_id_rg;
    if (!variant_id) return res.json({ ok: false, mensaje: 'Sin variante TN para este local' });
    const prod = await pool.query('SELECT * FROM productos WHERE id = $1', [producto_id]);
    const nuevoStock = prod.rows[0]?.stock || 0;
    await tnFetch('PUT', `/products/${v.tn_product_id}/variants/${variant_id}`, { stock: nuevoStock });
    res.json({ ok: true, stock: nuevoStock });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.description || e.message });
  }
});

// Webhook de Tiendanube - nuevo pedido
router.post('/webhook', async (req, res) => {
  res.json({ ok: true });
  try {
    const { event } = req.body;
    if (event !== 'store/order/paid' && event !== 'store/order/created') return;
    const pedido = req.body.payload;
    if (!pedido) return;
    for (const item of (pedido.products || [])) {
      const vinculo = await pool.query(
        `SELECT tv.*, p.id as prod_id FROM tiendanube_vinculos tv 
         JOIN productos p ON p.id = tv.producto_id
         WHERE (tv.tn_variant_id_rg = $1 OR tv.tn_variant_id_ush = $1) AND tv.activo = true`,
        [String(item.variant_id)]
      );
      if (vinculo.rows.length) {
        await pool.query(
          'UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2',
          [item.quantity, vinculo.rows[0].prod_id]
        );
        await pool.query(
          `INSERT INTO ventas (total, medio_pago, canal, estado, cliente_nombre, creado_en)
           VALUES ($1, 'Tiendanube', 'tiendanube', 'completada', $2, NOW())
           ON CONFLICT DO NOTHING`,
          [pedido.total || 0, pedido.contact_name || 'Cliente TN']
        );
      }
    }
  } catch (e) {
    console.error('Webhook TN error:', e.message);
  }
});

// Obtener pedidos de Tiendanube
router.get('/pedidos', async (req, res) => {
  try {
    const pedidos = await tnFetch('GET', '/orders?per_page=20&status=open');
    res.json(pedidos);
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.description || e.message });
  }
});

// Registrar webhook en Tiendanube
router.post('/registrar-webhook', async (req, res) => {
  try {
    const { backend_url } = req.body;
    const webhook = await tnFetch('POST', '/webhooks', {
      event: 'store/order/paid',
      url: `${backend_url}/api/tiendanube/webhook`
    });
    res.json({ ok: true, webhook });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.description || e.message });
  }
});

module.exports = router;