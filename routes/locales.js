const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Obtener todos los locales
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locales WHERE activo = TRUE ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener locales' });
  }
});

// Crear local
router.post('/', async (req, res) => {
  try {
    const { nombre, direccion } = req.body;
    const result = await pool.query(
      'INSERT INTO locales (nombre, direccion) VALUES ($1, $2) RETURNING *',
      [nombre, direccion]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear local' });
  }
});

// Actualizar local
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion } = req.body;
    const result = await pool.query(
      'UPDATE locales SET nombre=$1, direccion=$2 WHERE id=$3 RETURNING *',
      [nombre, direccion, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar local' });
  }
});

module.exports = router;