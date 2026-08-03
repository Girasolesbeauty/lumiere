const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Historial de traspasos entre locales (opcional: local_id trae los que salieron
// o entraron a ese local)
router.get('/', async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM traspasos_stock';
    if (local_id) {
      params.push(local_id);
      q += ` WHERE local_origen = $${params.length} OR local_destino = $${params.length}`;
    }
    q += ' ORDER BY creado_en DESC LIMIT 200';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener traspasos: ' + error.message });
  }
});

// Registrar un traspaso: mueve stock de un local a otro. El stock total combinado
// del producto no cambia, solo se redistribuye entre stock_rg y stock_ush.
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { producto_id, cantidad, local_origen, local_destino, usuario_id, usuario_nombre, notas } = req.body;

    const cant = parseInt(cantidad);
    const origen = parseInt(local_origen);
    const destino = parseInt(local_destino);

    if (!producto_id || !cant || cant <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta el producto o la cantidad' });
    }
    if (![1, 2].includes(origen) || ![1, 2].includes(destino) || origen === destino) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Los locales de origen y destino tienen que ser distintos' });
    }

    const colOrigen = origen === 2 ? 'stock_ush' : 'stock_rg';
    const colDestino = destino === 2 ? 'stock_ush' : 'stock_rg';

    const prodRes = await client.query(
      `SELECT nombre, ${colOrigen} AS stock_origen FROM productos WHERE id = $1`,
      [producto_id]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const stockOrigenActual = prodRes.rows[0].stock_origen || 0;
    if (cant > stockOrigenActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay stock suficiente en el local de origen (hay ' + stockOrigenActual + ')' });
    }
    const nombre = prodRes.rows[0].nombre;

    await client.query(
      `UPDATE productos SET ${colOrigen} = ${colOrigen} - $1, ${colDestino} = ${colDestino} + $1 WHERE id = $2`,
      [cant, producto_id]
    );

    await client.query(
      `INSERT INTO traspasos_stock (producto_id, producto_nombre, cantidad, local_origen, local_destino, usuario_id, usuario_nombre, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [producto_id, nombre, cant, origen, destino, usuario_id || null, usuario_nombre || null, notas || null]
    );

    // Tambien queda en el historial general de ajustes de stock (mismo lugar donde
    // se ven los ajustes manuales), para tener todo unificado.
    try {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [producto_id, stockOrigenActual, stockOrigenActual - cant, -cant,
         'Traspaso a ' + (destino === 2 ? 'Ushuaia' : 'Rio Grande'), usuario_id || null, usuario_nombre || null, origen]
      );
      const destRes = await client.query(`SELECT ${colDestino} AS stock_destino FROM productos WHERE id = $1`, [producto_id]);
      const stockDestinoNuevo = destRes.rows[0].stock_destino || 0;
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [producto_id, stockDestinoNuevo - cant, stockDestinoNuevo, cant,
         'Traspaso desde ' + (origen === 2 ? 'Ushuaia' : 'Rio Grande'), usuario_id || null, usuario_nombre || null, destino]
      );
    } catch (e2) { /* si no existe ajustes_stock en este entorno, no frena el traspaso */ }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, producto_nombre: nombre, cantidad: cant });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el traspaso: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
