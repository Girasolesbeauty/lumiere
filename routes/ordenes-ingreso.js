const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar ordenes
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    let query = `SELECT o.*, p.nombre as proveedor_nombre, p.dias_pago
                 FROM ordenes_ingreso o
                 LEFT JOIN proveedores p ON o.proveedor_id = p.id`;
    if (estado) query += ` WHERE o.estado = '${estado}'`;
    query += ' ORDER BY o.creado_en DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ordenes' });
  }
});

// Obtener orden con items
router.get('/:id', async (req, res) => {
  try {
    const orden = await pool.query(
      `SELECT o.*, p.nombre as proveedor_nombre, cp.nombre as cuenta_nombre
       FROM ordenes_ingreso o
       LEFT JOIN proveedores p ON o.proveedor_id = p.id
       LEFT JOIN cuentas_pago cp ON o.cuenta_pago_id = cp.id
       WHERE o.id = $1`, [req.params.id]
    );
    const items = await pool.query(
      'SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1', [req.params.id]
    );
    res.json({ ...orden.rows[0], items: items.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden' });
  }
});

// Crear orden
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { proveedor_id, fecha_factura, numero_factura, total, forma_pago, cuenta_pago_id, notas, items } = req.body;

    // Calcular fecha vencimiento segun dias del proveedor
    const provRes = await client.query('SELECT dias_pago FROM proveedores WHERE id = $1', [proveedor_id]);
    const dias = provRes.rows[0]?.dias_pago || 30;
    const fechaVenc = new Date(fecha_factura);
    fechaVenc.setDate(fechaVenc.getDate() + dias);

    const orden = await client.query(
      `INSERT INTO ordenes_ingreso (proveedor_id, fecha_factura, fecha_vencimiento, numero_factura, total, forma_pago, cuenta_pago_id, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [proveedor_id, fecha_factura, fechaVenc.toISOString().split('T')[0], numero_factura, total, forma_pago, cuenta_pago_id, notas]
    );

    const ordenId = orden.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO ordenes_ingreso_items (orden_id, producto_id, producto_nombre, cantidad_total, cantidad_rg, cantidad_ush, costo_unitario)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ordenId, item.producto_id, item.producto_nombre, item.cantidad_total, item.cantidad_rg || 0, item.cantidad_ush || 0, item.costo_unitario]
      );
    }

    await client.query('COMMIT');
    res.json(orden.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al crear orden: ' + error.message });
  } finally {
    client.release();
  }
});

// Confirmar recepcion de item
router.put('/:ordenId/items/:itemId/recibir', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local, cantidad } = req.body;
    const itemRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE id = $1', [req.params.itemId]);
    const item = itemRes.rows[0];

    if (local === 'rg') {
      await client.query(
        'UPDATE ordenes_ingreso_items SET recibido_rg = recibido_rg + $1 WHERE id = $2',
        [cantidad, req.params.itemId]
      );
      await client.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [cantidad, item.producto_id]);
    } else {
      await client.query(
        'UPDATE ordenes_ingreso_items SET recibido_ush = recibido_ush + $1, en_transito_ush = GREATEST(en_transito_ush - $1, 0) WHERE id = $2',
        [cantidad, req.params.itemId]
      );
      await client.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [cantidad, item.producto_id]);
    }

    // Verificar si la orden esta completa
    const itemsRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1', [req.params.ordenId]);
    const completa = itemsRes.rows.every(i => (i.recibido_rg + i.recibido_ush) >= i.cantidad_total);
    if (completa) {
      await client.query("UPDATE ordenes_ingreso SET estado = 'recibida' WHERE id = $1", [req.params.ordenId]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al confirmar recepcion' });
  } finally {
    client.release();
  }
});

// Marcar orden como pagada
router.put('/:id/pagar', async (req, res) => {
  try {
    const { cuenta_pago_id, fecha_pago, forma_pago } = req.body;
    const result = await pool.query(
      `UPDATE ordenes_ingreso SET estado='pagada', cuenta_pago_id=$1, fecha_pago=$2, forma_pago=$3 WHERE id=$4 RETURNING *`,
      [cuenta_pago_id, fecha_pago || new Date().toISOString().split('T')[0], forma_pago, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar como pagada' });
  }
});

// Cuentas a pagar proximas a vencer
router.get('/alertas/vencimientos', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, p.nombre as proveedor_nombre
       FROM ordenes_ingreso o
       LEFT JOIN proveedores p ON o.proveedor_id = p.id
       WHERE o.estado IN ('pendiente','recibida')
       AND o.fecha_vencimiento <= NOW() + INTERVAL '7 days'
       ORDER BY o.fecha_vencimiento`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vencimientos' });
  }
});

module.exports = router;