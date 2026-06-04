const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias_costo ORDER BY tipo, nombre');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorias' });
  }
});

module.exports = router;