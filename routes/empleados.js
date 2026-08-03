const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar empleadas (opcional: filtrar por local_id). Activas primero.
router.get('/', async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM empleados';
    if (local_id) {
      params.push(local_id);
      q += ' WHERE local_id = $1';
    }
    q += ' ORDER BY activo DESC, nombre ASC';
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener empleadas: ' + error.message });
  }
});

// Crear empleada nueva (ej: Mara), asociada a un local, con su % de comision.
router.post('/', async (req, res) => {
  try {
    const { nombre, local_id, comision_pct } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!local_id) {
      return res.status(400).json({ error: 'Falta el local' });
    }
    const pct = parseFloat(comision_pct) || 0;
    const result = await pool.query(
      `INSERT INTO empleados (nombre, local_id, comision_pct, activo)
       VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [nombre.trim(), local_id, pct]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear empleada: ' + error.message });
  }
});

// Editar empleada: nombre, comision y/o activo (ej: desactivar a Cintia cuando deja de trabajar).
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, comision_pct, activo } = req.body;

    const actual = await pool.query('SELECT * FROM empleados WHERE id = $1', [id]);
    if (actual.rows.length === 0) return res.status(404).json({ error: 'Empleada no encontrada' });
    const a = actual.rows[0];

    const result = await pool.query(
      `UPDATE empleados SET nombre = $1, comision_pct = $2, activo = $3 WHERE id = $4 RETURNING *`,
      [
        nombre !== undefined ? nombre.trim() : a.nombre,
        (comision_pct !== undefined && comision_pct !== null && comision_pct !== '') ? parseFloat(comision_pct) : a.comision_pct,
        activo !== undefined ? activo : a.activo,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar empleada: ' + error.message });
  }
});

module.exports = router;
