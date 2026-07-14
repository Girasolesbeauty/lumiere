const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar calculadoras
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calculadoras_precio WHERE activo = TRUE ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener calculadoras' });
  }
});

// Crear calculadora nueva
router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, tipo, margen, iva, extras } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    const result = await pool.query(
      `INSERT INTO calculadoras_precio (nombre, descripcion, tipo, margen, iva, extras, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [nombre, descripcion || null, tipo, parseFloat(margen) || 2, parseFloat(iva) || 0, JSON.stringify(extras || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear calculadora: ' + error.message });
  }
});

// Editar calculadora
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, tipo, margen, iva, extras } = req.body;
    const result = await pool.query(
      `UPDATE calculadoras_precio SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        tipo = COALESCE($3, tipo),
        margen = COALESCE($4, margen),
        iva = COALESCE($5, iva),
        extras = COALESCE($6, extras)
       WHERE id = $7 RETURNING *`,
      [nombre, descripcion, tipo, margen ? parseFloat(margen) : null, iva !== undefined ? parseFloat(iva) : null, extras ? JSON.stringify(extras) : null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Calculadora no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al editar calculadora' });
  }
});

// Desactivar calculadora
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE calculadoras_precio SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar calculadora' });
  }
});

module.exports = router;