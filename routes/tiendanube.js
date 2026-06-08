const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const TN_TOKEN = process.env.TIENDANUBE_TOKEN;
const TN_USER = process.env.TIENDANUBE_USER_ID;
const TN_BASE = `https://api.tiendanube.com/v1/${TN_USER}`;
const TN_HEADERS = {
  'Authentication': `bearer ${TN_TOKEN}`,
  'Content-Type': 'application/json',
  'User-Agent': 'Lumiere/1.0 (girasolesbeauty@gmail.com)'
};

const tnFetch = async (method, path, body) => {
  const res = await fetch(`${TN_BASE}${path}`, {
    method,
    headers: TN_HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TN ${method} ${path}: ${res.status} - ${err}`);
  }
  return res.json();
};

// Verificar conexion
router.get('/status', async (req, res) => {
  try {
    const store = await tnFetch('GET', '/store');
    res.json({ ok: true, tienda: store.name, plan: store.plan_name });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
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
      variantes: p.variants.map(v => ({
        id: v.id,
        nombre: v.values?.map(val => val.es || val).join(' / ') || 'Default',
        stock: v.stock,
        precio: v.price,
        sku: v.sku
      }))
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
      [producto_id, tn_product_id, tn_variant_id_rg, tn_variant_id_ush]
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

// Actualizar stock en Tiendanube para un producto vinculado
router.post('/sync/stock/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    const { local_id, cantidad } = req.body;

    const vinculo = await pool.query(
      'SELECT * FROM tiendanube_vinculos WHERE producto_id = $1 AND activo = true',
      [producto_id]
    );
    if (!vinculo.rows.length) return res.json({ ok: false, mensaje: 'Sin vinculo TN' });

    const v = vinculo.rows[0];
    const variant_id = local_id == 2 ? v.tn_variant_id_ush : v.tn_variant_id_rg;
    if (!variant_id) return res.json({ ok: false, mensaje: 'Sin variante TN para este local' });

    // Get current stock
    const prod = await pool.query('SELECT * FROM productos WHERE id = $1', [producto_id]);
    const nuevoStock = prod.rows[0]?.stock || 0;

    await tnFetch('PUT', `/products/${v.tn_product_id}/variants/${variant_id}`, {
      stock: nuevoStock
    });

    res.json({ ok: true, stock: nuevoStock });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhook de Tiendanube - nuevo pedido
router.post('/webhook', async (req, res) => {
  try {
    const { event, store_id } = req.body;
    res.json({ ok: true }); // Responder rapido a TN

    if (event !== 'store/order/paid' && event !== 'store/order/created') return;

    const pedido = req.body.payload;
    if (!pedido) return;

    // Descontar stock en Lumiere por cada item del pedido
    for (const item of (pedido.products || [])) {
      const sku = item.sku || item.variant_id;

      // Buscar vinculo por tn_variant_id
      const vinculo = await pool.query(
        `SELECT tv.*, p.id as prod_id, p.nombre 
         FROM tiendanube_vinculos tv 
         JOIN productos p ON p.id = tv.producto_id
         WHERE (tv.tn_variant_id_rg = $1 OR tv.tn_variant_id_ush = $1) AND tv.activo = true`,
        [String(item.variant_id)]
      );

      if (vinculo.rows.length) {
        const prod_id = vinculo.rows[0].prod_id;
        await pool.query(
          'UPDATE productos SET stock = GREATEST(0, stock - $1) WHERE id = $2',
          [item.quantity, prod_id]
        );

        // Registrar como venta en Lumiere
        await pool.query(
          `INSERT INTO ventas (total, medio_pago, canal, estado, cliente_nombre, creado_en)
           VALUES ($1, 'Tiendanube', 'tiendanube', 'completada', $2, NOW())`,
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
    res.status(500).json({ error: e.message });
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
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;