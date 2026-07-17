const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar ordenes (incluye si cada local ya termino de recibir su parte, para no mostrar "Recibir" cuando ya esta hecho)
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    let query = `SELECT o.*, p.nombre as proveedor_nombre, p.dias_pago,
                   COALESCE(bool_and(CASE WHEN oi.cantidad_rg > 0 THEN oi.revisado_rg ELSE true END), true) AS rg_completo,
                   COALESCE(bool_and(CASE WHEN oi.cantidad_ush > 0 THEN oi.revisado_ush ELSE true END), true) AS ush_completo
                 FROM ordenes_ingreso o
                 LEFT JOIN proveedores p ON o.proveedor_id = p.id
                 LEFT JOIN ordenes_ingreso_items oi ON oi.orden_id = o.id`;
    const params = [];
    if (estado) { params.push(estado); query += ` WHERE o.estado = $${params.length}`; }
    query += ' GROUP BY o.id, p.nombre, p.dias_pago ORDER BY o.creado_en DESC';
    const result = await pool.query(query, params);
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
      'SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1 ORDER BY es_extra, id', [req.params.id]
    );
    res.json({ ...orden.rows[0], items: items.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden' });
  }
});

// Items de una orden (compatibilidad con frontend existente)
router.get('/:id/items', async (req, res) => {
  try {
    const items = await pool.query(
      'SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1 ORDER BY es_extra, id', [req.params.id]
    );
    res.json(items.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener items' });
  }
});

// Crear orden (carga de stock en transito, ya dividido RG/USH)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { proveedor_id, fecha_factura, numero_factura, total, forma_pago, cuenta_pago_id, notas, items } = req.body;

    const provRes = await client.query('SELECT dias_pago FROM proveedores WHERE id = $1', [proveedor_id]);
    const dias = provRes.rows[0]?.dias_pago || 30;
    const fechaVenc = new Date(fecha_factura || new Date());
    fechaVenc.setDate(fechaVenc.getDate() + dias);

    const orden = await client.query(
      `INSERT INTO ordenes_ingreso (proveedor_id, fecha_factura, fecha_vencimiento, numero_factura, total, forma_pago, cuenta_pago_id, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [proveedor_id, fecha_factura || new Date().toISOString().split('T')[0], fechaVenc.toISOString().split('T')[0], numero_factura, total || 0, forma_pago, cuenta_pago_id, notas]
    );

    const ordenId = orden.rows[0].id;

    for (const item of items) {
      const cantRg = parseInt(item.cantidad_rg) || 0;
      const cantUsh = parseInt(item.cantidad_ush) || 0;
      const cantTotal = parseInt(item.cantidad_total) || (cantRg + cantUsh);
      await client.query(
        `INSERT INTO ordenes_ingreso_items
          (orden_id, producto_id, producto_nombre, cantidad_total, cantidad_rg, cantidad_ush, costo_unitario, en_transito_ush)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ordenId, item.producto_id, item.producto_nombre, cantTotal, cantRg, cantUsh, item.costo_unitario || 0, cantUsh]
      );
      // Sumar al stock en transito del producto (por local)
      if (item.producto_id) {
        await client.query(
          `UPDATE productos SET
             stock_transito_rg = COALESCE(stock_transito_rg,0) + $1,
             stock_transito_ush = COALESCE(stock_transito_ush,0) + $2
           WHERE id = $3`,
          [cantRg, cantUsh, item.producto_id]
        );
      }
      // Si el item vino de una factura cargada (tiene el nombre tal cual aparecia ahi),
      // guardamos la vinculacion para que la proxima factura de este proveedor la reconozca sola.
      if (item.nombre_factura && item.producto_id) {
        await client.query(
          `INSERT INTO proveedor_producto_alias (proveedor_id, nombre_factura, producto_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (proveedor_id, nombre_factura) DO UPDATE SET producto_id = EXCLUDED.producto_id`,
          [proveedor_id, item.nombre_factura, item.producto_id]
        );
      }
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

// Agregar item EXTRA (regalo del proveedor, no estaba en el pedido) - ya llego fisico
router.post('/:ordenId/item-extra', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { producto_id, producto_nombre, cantidad, local, costo_unitario } = req.body;
    const cant = parseInt(cantidad) || 0;
    if (cant <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cantidad invalida' });
    }
    const esRg = local === 'rg';
    await client.query(
      `INSERT INTO ordenes_ingreso_items
        (orden_id, producto_id, producto_nombre, cantidad_total, cantidad_rg, cantidad_ush,
         costo_unitario, recibido_rg, recibido_ush, es_extra, revisado_rg, revisado_ush)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10,$11)`,
      [
        req.params.ordenId, producto_id || null, producto_nombre, cant,
        esRg ? cant : 0, esRg ? 0 : cant, costo_unitario || 0,
        esRg ? cant : 0, esRg ? 0 : cant,
        esRg, !esRg
      ]
    );
    if (producto_id) {
      if (esRg) {
        await client.query(
          `UPDATE productos SET stock_rg = COALESCE(stock_rg,0) + $1,
             stock = COALESCE(stock_rg,0) + $1 + COALESCE(stock_ush,0)
           WHERE id = $2`,
          [cant, producto_id]
        );
      } else {
        await client.query(
          `UPDATE productos SET stock_ush = COALESCE(stock_ush,0) + $1,
             stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1
           WHERE id = $2`,
          [cant, producto_id]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al agregar item extra: ' + error.message });
  } finally {
    client.release();
  }
});

// Confirmar recepcion de item por local, con cantidad real contada y nota de inconsistencia
router.put('/:ordenId/items/:itemId/recibir', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local, cantidad, nota, usuario_nombre } = req.body;
    const cant = parseInt(cantidad) || 0;
    const itemRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE id = $1', [req.params.itemId]);
    const item = itemRes.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    if (local === 'rg') {
      await client.query(
        'UPDATE ordenes_ingreso_items SET recibido_rg = $1, revisado_rg = TRUE, nota_inconsistencia = COALESCE($2, nota_inconsistencia), recibido_por_rg = $3, fecha_recepcion_rg = NOW() WHERE id = $4',
        [cant, nota || null, usuario_nombre || null, req.params.itemId]
      );
      if (item.producto_id) {
        await client.query(
          `UPDATE productos SET stock_rg = COALESCE(stock_rg,0) + $1,
             stock = COALESCE(stock_rg,0) + $1 + COALESCE(stock_ush,0)
           WHERE id = $2`,
          [cant, item.producto_id]
        );
        await client.query(
          'UPDATE productos SET stock_transito_rg = GREATEST(COALESCE(stock_transito_rg,0) - $1, 0) WHERE id = $2',
          [item.cantidad_rg || 0, item.producto_id]
        );
      }
    } else {
      await client.query(
        'UPDATE ordenes_ingreso_items SET recibido_ush = $1, revisado_ush = TRUE, nota_inconsistencia = COALESCE($2, nota_inconsistencia), recibido_por_ush = $3, fecha_recepcion_ush = NOW() WHERE id = $4',
        [cant, nota || null, usuario_nombre || null, req.params.itemId]
      );
      if (item.producto_id) {
        await client.query(
          `UPDATE productos SET stock_ush = COALESCE(stock_ush,0) + $1,
             stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1
           WHERE id = $2`,
          [cant, item.producto_id]
        );
        await client.query(
          'UPDATE productos SET stock_transito_ush = GREATEST(COALESCE(stock_transito_ush,0) - $1, 0) WHERE id = $2',
          [item.cantidad_ush || 0, item.producto_id]
        );
      }
    }

    const itemsRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1', [req.params.ordenId]);
    const completa = itemsRes.rows.every(i =>
      (i.cantidad_rg > 0 ? i.revisado_rg : true) && (i.cantidad_ush > 0 ? i.revisado_ush : true)
    );
    if (completa) {
      await client.query("UPDATE ordenes_ingreso SET estado = 'recibida' WHERE id = $1", [req.params.ordenId]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al confirmar recepcion: ' + error.message });
  } finally {
    client.release();
  }
});

// Historial de stock recibido (items ya revisados, con fecha y quien)
router.get('/reporte/recibido', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT oi.*, o.numero_factura, p.nombre AS proveedor_nombre
       FROM ordenes_ingreso_items oi
       JOIN ordenes_ingreso o ON oi.orden_id = o.id
       LEFT JOIN proveedores p ON o.proveedor_id = p.id
       WHERE oi.revisado_rg = TRUE OR oi.revisado_ush = TRUE
       ORDER BY GREATEST(COALESCE(oi.fecha_recepcion_rg, '1970-01-01'), COALESCE(oi.fecha_recepcion_ush, '1970-01-01')) DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener stock recibido: ' + error.message });
  }
});

// Reporte de inconsistencias (para el jefe)
router.get('/reporte/inconsistencias', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT oi.*, o.numero_factura, o.fecha_factura, p.nombre AS proveedor_nombre
       FROM ordenes_ingreso_items oi
       JOIN ordenes_ingreso o ON oi.orden_id = o.id
       LEFT JOIN proveedores p ON o.proveedor_id = p.id
       WHERE (oi.revisado_rg = TRUE AND oi.recibido_rg <> oi.cantidad_rg)
          OR (oi.revisado_ush = TRUE AND oi.recibido_ush <> oi.cantidad_ush)
          OR oi.es_extra = TRUE
          OR (oi.nota_inconsistencia IS NOT NULL AND oi.nota_inconsistencia <> '')
       ORDER BY o.creado_en DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener inconsistencias: ' + error.message });
  }
});

// Ventas donde se vendio sin stock suficiente (quedaria en negativo) y la vendedora justifico
router.get('/reporte/inconsistencias-stock', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM inconsistencias_stock ORDER BY creado_en DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener inconsistencias de stock: ' + error.message });
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