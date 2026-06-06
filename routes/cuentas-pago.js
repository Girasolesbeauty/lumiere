const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const { solo_pago } = req.query;
    let query = 'SELECT * FROM cuentas_pago WHERE activo = TRUE';
    if (solo_pago === 'true') query += ' AND solo_acreditacion = FALSE';
    query += ' ORDER BY tipo, nombre';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cuentas' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, tipo, titular, banco, cbu, alias, solo_acreditacion } = req.body;
    const result = await pool.query(
      `INSERT INTO cuentas_pago (nombre, tipo, titular, banco, cbu, alias, solo_acreditacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, tipo, titular, banco, cbu, alias, solo_acreditacion || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear cuenta' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, tipo, titular, banco, cbu, alias, solo_acreditacion, activo } = req.body;
    const result = await pool.query(
      `UPDATE cuentas_pago SET nombre=$1, tipo=$2, titular=$3, banco=$4, cbu=$5, alias=$6, solo_acreditacion=$7, activo=$8 WHERE id=$9 RETURNING *`,
      [nombre, tipo, titular, banco, cbu, alias, solo_acreditacion, activo !== undefined ? activo : true, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar cuenta' });
  }
});

module.exports = router;