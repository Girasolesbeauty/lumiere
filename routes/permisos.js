const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Obtener permisos de un usuario
router.get('/:usuario_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT permiso FROM permisos_usuario WHERE usuario_id = $1',
      [req.params.usuario_id]
    );
    res.json(result.rows.map(r => r.permiso));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar permisos de un usuario (reemplaza todos)
router.put('/:usuario_id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { permisos } = req.body;
    await client.query('DELETE FROM permisos_usuario WHERE usuario_id = $1', [req.params.usuario_id]);
    for (const permiso of permisos) {
      await client.query(
        'INSERT INTO permisos_usuario (usuario_id, permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.usuario_id, permiso]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, total: permisos.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Verificar si un usuario tiene un permiso especifico
router.get('/:usuario_id/check/:permiso', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = $2',
      [req.params.usuario_id, req.params.permiso]
    );
    res.json({ tiene: result.rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;