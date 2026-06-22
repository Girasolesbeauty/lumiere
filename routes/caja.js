const express = require('express');
const router = express.Router();
const pool = require('../config/database');
// Obtener movimientos de caja por local
router.get('/', async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT m.*, cp.nombre as cuenta_destino_nombre
      FROM movimientos_caja_efectivo m
      LEFT JOIN cuentas_pago cp ON m.cuenta_destino_id = cp.id
      WHERE 1=1
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND m.local_id = $${params.length}`;
    }
    query += ' ORDER BY m.creado_en DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movimientos de caja' });
  }
});
// Obtener saldo actual de caja
router.get('/saldo', async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT 
        SUM(CASE WHEN tipo = 'ingreso' THEN importe ELSE -importe END) as saldo
      FROM movimientos_caja_efectivo
      WHERE (anulado IS NULL OR anulado = FALSE)
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND local_id = $${params.length}`;
    }
    const result = await pool.query(query, params);
    res.json({ saldo: parseFloat(result.rows[0].saldo) || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener saldo' });
  }
});
// Registrar movimiento de caja
router.post('/', async (req, res) => {
  try {
    const { tipo, importe, concepto, destino_origen, cuenta_destino_id, local_id, usuario_id } = req.body;
    const result = await pool.query(
      `INSERT INTO movimientos_caja_efectivo 
       (tipo, importe, concepto, destino_origen, cuenta_destino_id, local_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tipo, importe, concepto, destino_origen, cuenta_destino_id || null, local_id || 1, usuario_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar movimiento: ' + error.message });
  }
});
module.exports = router;