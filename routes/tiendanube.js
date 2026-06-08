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

// Sincronizar productos de Lumiere a Tiendanube
router.post('/sync/productos', async (req, res) => {
  try {
    const productos = await pool.query('SELECT * FROM productos WHERE activo = TRUE');
    const resultados = [];

    for (const p of productos.rows) {
      try {
        // Check if product exists in TN by sku
        const tnProds = await tnFetch('GET', `/products?q=${encodeURIComponent(p.nombre)}&per_page=5`);
        const existing = tnProds.find(tp => 
          tp.variants?.[0]?.sku === (p.codigo_barras || String(p.id))
        );

        const payload = {
          name: { es: p.nombre },
          description: { es: p.descripcion || '' },
          published: true,
          variants: [{
            price: String(p.precio || p.price || 0),
            stock: p.stock || 0,
            sku: p.codigo_barras || String(p.id),
            cost: String(p.costo || p.cost || 0)
          }]
        };

        if (existing) {
          await tnFetch('PUT', `/products/${existing.id}`, payload);
          resultados.push({ id: p.id, nombre: p.nombre, accion: 'actualizado', tn_id: existing.id });
        } else {
          const nuevo = await tnFetch('POST', '/products', payload);
          resultados.push({ id: p.id, nombre: p.nombre, accion: 'creado', tn_id: nuevo.id });
        }
      } catch (e) {
        resultados.push({ id: p.id, nombre: p.nombre, accion: 'error', error: e.message });
      }
    }

    res.json({ ok: true, total: productos.rows.length, resultados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar stock de un producto en Tiendanube
router.post('/sync/stock/:producto_id', async (req, res) => {
  try {
    const { producto_id } = req.params;
    const prod = await pool.query('SELECT * FROM productos WHERE id = $1', [producto_id]);
    if (!prod.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    
    const p = prod.rows[0];
    const sku = p.codigo_barras || String(p.id);
    
    // Find product in TN
    const tnProds = await tnFetch('GET', `/products?q=${encodeURIComponent(p.nombre)}&per_page=5`);
    const existing = tnProds.find(tp => tp.variants?.[0]?.sku === sku);
    
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado en Tiendanube' });
    
    const variantId = existing.variants[0].id;
    await tnFetch('PUT', `/products/${existing.id}/variants/${variantId}`, {
      stock: p.stock || 0,
      price: String(p.precio || p.price || 0)
    });
    
    res.json({ ok: true, producto: p.nombre, stock: p.stock });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

module.exports = router;