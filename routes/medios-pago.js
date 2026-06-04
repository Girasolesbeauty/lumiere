const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medios_pago WHERE activo = TRUE ORDER BY tipo, cuotas, con_interes');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener medios de pago' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { coeficiente, activo } = req.body;
    const result = await pool.query(
      'UPDATE medios_pago SET coeficiente=$1, activo=$2 WHERE id=$3 RETURNING *',
      [coeficiente, activo, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar medio de pago' });
  }
});

module.exports = router;