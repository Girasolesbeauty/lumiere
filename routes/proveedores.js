const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE activo = TRUE ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// Reporte de compras por proveedor en un rango de fechas (usa fecha_factura de cada
// orden de ingreso). Va ANTES de /:id para que Express no confunda "reporte-compras"
// con un id de proveedor.
// Reporte de VENTAS por proveedor: cuanto se vendio de los productos de cada proveedor
// en un rango de fechas (distinto del reporte de compras -- ese mira lo que le compraste
// vos al proveedor, este mira lo que le vendiste a tus clientas de su mercaderia).
router.get('/reporte-ventas', async (req, res) => {
  try {
    const { desde, hasta, local_id } = req.query;
    let q = `
      SELECT p.id AS proveedor_id, p.nombre AS proveedor_nombre,
             COUNT(DISTINCT vi.venta_id) AS cantidad_ventas,
             COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas,
             COALESCE(SUM(vi.cantidad * vi.precio_unitario), 0) AS total_vendido
      FROM proveedores p
      JOIN productos pr ON pr.proveedor_id = p.id
      JOIN venta_items vi ON vi.producto_id = pr.id
      JOIN ventas v ON v.id = vi.venta_id
      WHERE COALESCE(v.es_preventa, FALSE) = FALSE
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND v.creado_en >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND v.creado_en <= ($${params.length + 1}::date + interval '1 day')`; params.push(hasta); }
    if (local_id) { params.push(local_id); q += ` AND v.local_id = $${params.length}`; }
    q += ' GROUP BY p.id, p.nombre ORDER BY total_vendido DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el reporte de ventas: ' + error.message });
  }
});

// Detalle: que productos puntuales de ese proveedor se vendieron en el periodo.
router.get('/:id/productos-vendidos', async (req, res) => {
  try {
    const { desde, hasta, local_id } = req.query;
    let q = `
      SELECT pr.id AS producto_id, pr.nombre AS producto_nombre,
             SUM(vi.cantidad) AS unidades_vendidas,
             SUM(vi.cantidad * vi.precio_unitario) AS total_vendido
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos pr ON pr.id = vi.producto_id
      WHERE pr.proveedor_id = $1 AND COALESCE(v.es_preventa, FALSE) = FALSE
    `;
    const params = [req.params.id];
    if (desde) { params.push(desde); q += ` AND v.creado_en >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND v.creado_en <= ($${params.length + 1}::date + interval '1 day')`; params.push(hasta); }
    if (local_id) { params.push(local_id); q += ` AND v.local_id = $${params.length}`; }
    q += ' GROUP BY pr.id, pr.nombre ORDER BY total_vendido DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el detalle: ' + error.message });
  }
});

router.get('/reporte-compras', async (req, res) => {
  try {
    const { desde, hasta, proveedor_id } = req.query;
    let q = `
      SELECT p.id AS proveedor_id, p.nombre AS proveedor_nombre,
             COUNT(o.id) AS cantidad_ordenes, COALESCE(SUM(o.total), 0) AS total_comprado
      FROM proveedores p
      JOIN ordenes_ingreso o ON o.proveedor_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND o.fecha_factura >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND o.fecha_factura <= $${params.length}`; }
    if (proveedor_id) { params.push(proveedor_id); q += ` AND p.id = $${params.length}`; }
    q += ' GROUP BY p.id, p.nombre ORDER BY total_comprado DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el reporte: ' + error.message });
  }
});

// Detalle de las ordenes individuales de un proveedor en el mismo rango (para desplegar
// y ver factura por factura, no solo el total).
router.get('/:id/ordenes', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let q = `SELECT id, numero_factura, fecha_factura, total, estado FROM ordenes_ingreso WHERE proveedor_id = $1`;
    const params = [req.params.id];
    if (desde) { params.push(desde); q += ` AND fecha_factura >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND fecha_factura <= $${params.length}`; }
    q += ' ORDER BY fecha_factura DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las ordenes: ' + error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas } = req.body;
    const result = await pool.query(
      `INSERT INTO proveedores (nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago || 30, forma_pago || 'transferencia', banco, cbu, alias, titular_cuenta, cuit_banco, categoria || 'mercaderia', notas]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo } = req.body;
    const result = await pool.query(
      `UPDATE proveedores SET nombre=$1, cuit=$2, email=$3, telefono=$4, whatsapp=$5, dias_pago=$6, forma_pago=$7, banco=$8, cbu=$9, alias=$10, titular_cuenta=$11, cuit_banco=$12, categoria=$13, notas=$14, activo=$15 WHERE id=$16 RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo !== undefined ? activo : true, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

module.exports = router;