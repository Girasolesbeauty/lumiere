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

// Crear categoria de costo nueva (nombre libre, tipo elegido por el jefe)
router.post('/', async (req, res) => {
  try {
    const { nombre, tipo, subtipo } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    const tiposValidos = ['variable', 'fijo', 'administrativo', 'sueldo'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo invalido. Debe ser: variable, fijo, administrativo o sueldo' });
    }
    const result = await pool.query(
      `INSERT INTO categorias_costo (nombre, tipo, subtipo) VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), tipo, subtipo || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear categoria' });
  }
});

// Editar categoria existente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, subtipo } = req.body;
    if (tipo) {
      const tiposValidos = ['variable', 'fijo', 'administrativo', 'sueldo'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo invalido. Debe ser: variable, fijo, administrativo o sueldo' });
      }
    }
    const result = await pool.query(
      `UPDATE categorias_costo SET
        nombre = COALESCE($1, nombre),
        tipo = COALESCE($2, tipo),
        subtipo = $3
       WHERE id=$4 RETURNING *`,
      [nombre ? nombre.trim() : null, tipo, subtipo || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Categoria no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar categoria' });
  }
});

// Borrar categoria (solo si nunca se uso en un movimiento, para no romper el historial)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const enUso = await pool.query('SELECT COUNT(*) FROM movimientos_caja WHERE categoria_id = $1', [id]);
    if (parseInt(enUso.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Esta categoria ya tiene movimientos cargados, no se puede borrar.' });
    }
    await pool.query('DELETE FROM categorias_costo WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al borrar categoria' });
  }
});

module.exports = router;