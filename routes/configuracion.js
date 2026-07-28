const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Leer la configuracion general (nombre del negocio, logo)
router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM configuracion_negocio WHERE id = 1');
    if (!r.rows.length) return res.json({ nombre_negocio: 'Mi Negocio', logo_url: null });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar la configuracion general
router.put('/', async (req, res) => {
  try {
    const { nombre_negocio, logo_url } = req.body;
    const r = await pool.query(
      `UPDATE configuracion_negocio SET nombre_negocio = COALESCE($1, nombre_negocio), logo_url = $2 WHERE id = 1 RETURNING *`,
      [nombre_negocio, logo_url || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;