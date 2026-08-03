const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Historial de canjes (pago en especie a empleadas), opcional por local y/o empleada
router.get('/', async (req, res) => {
  try {
    const { local_id, empleado_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM canjes_empleados WHERE 1=1';
    if (local_id) { params.push(local_id); q += ` AND local_id = $${params.length}`; }
    if (empleado_id) { params.push(empleado_id); q += ` AND empleado_id = $${params.length}`; }
    q += ' ORDER BY creado_en DESC LIMIT 200';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener canjes: ' + error.message });
  }
});

// Registrar un canje: se le entrega mercaderia a una empleada (pago en especie, total
// o parcial). Descuenta el stock real del local, sin generar venta ni factura.
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { empleado_id, empleado_nombre, producto_id, cantidad, valor_unitario, local_id, usuario_id, usuario_nombre, notas } = req.body;

    const cant = parseInt(cantidad);
    const localNum = (local_id === 2 || local_id === '2') ? 2 : 1;

    if (!producto_id || !cant || cant <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta el producto o la cantidad' });
    }

    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
    const prodRes = await client.query(
      `SELECT nombre, precio, ${colStock} AS stock_local FROM productos WHERE id = $1`,
      [producto_id]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const prod = prodRes.rows[0];
    const stockAnterior = prod.stock_local || 0;
    if (cant > stockAnterior) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay stock suficiente en este local (hay ' + stockAnterior + ')' });
    }

    const valorUnit = (valor_unitario !== undefined && valor_unitario !== null && valor_unitario !== '')
      ? parseFloat(valor_unitario)
      : parseFloat(prod.precio || 0);
    const valorTotal = valorUnit * cant;

    let empleadoNombreFinal = empleado_nombre || null;
    if (empleado_id && !empleadoNombreFinal) {
      const empRes = await client.query('SELECT nombre FROM empleados WHERE id = $1', [empleado_id]);
      if (empRes.rows.length > 0) empleadoNombreFinal = empRes.rows[0].nombre;
    }

    // Descuenta stock del local y del total combinado (el producto sale de verdad de la tienda)
    await client.query(
      `UPDATE productos SET ${colStock} = ${colStock} - $1, stock = stock - $1 WHERE id = $2`,
      [cant, producto_id]
    );

    const result = await client.query(
      `INSERT INTO canjes_empleados (empleado_id, empleado_nombre, producto_id, producto_nombre, cantidad, valor_unitario, valor_total, local_id, usuario_id, usuario_nombre, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [empleado_id || null, empleadoNombreFinal, producto_id, prod.nombre, cant, valorUnit, valorTotal, localNum, usuario_id || null, usuario_nombre || null, notas || null]
    );

    try {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [producto_id, stockAnterior, stockAnterior - cant, -cant,
         'Canje con empleada' + (empleadoNombreFinal ? ' ' + empleadoNombreFinal : ''), usuario_id || null, usuario_nombre || null, localNum]
      );
    } catch (e2) { /* si no existe ajustes_stock en este entorno, no frena el canje */ }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el canje: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
