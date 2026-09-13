const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar las variantes de un producto
router.get('/:productoId/variantes', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM producto_variantes WHERE producto_id = $1 AND activo = TRUE ORDER BY id ASC',
      [req.params.productoId]
    );
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener variantes: ' + error.message });
  }
});

// Crear una variante nueva
router.post('/:productoId/variantes', async (req, res) => {
  try {
    const { valor, codigo_barras, imagen_url, stock_rg, stock_ush } = req.body;
    if (!valor || !valor.trim()) return res.status(400).json({ error: 'Falta el valor de la variante (ej: S, Rojo)' });
    const r = await pool.query(
      `INSERT INTO producto_variantes (producto_id, valor, codigo_barras, imagen_url, stock_rg, stock_ush)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.productoId, valor.trim(), codigo_barras || null, imagen_url || null, parseInt(stock_rg) || 0, parseInt(stock_ush) || 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la variante: ' + error.message });
  }
});

// Editar una variante (datos y/o stock)
router.put('/variantes/:id', async (req, res) => {
  try {
    const { valor, codigo_barras, imagen_url, stock_rg, stock_ush } = req.body;
    const r = await pool.query(
      `UPDATE producto_variantes SET
         valor = COALESCE($1, valor), codigo_barras = $2, imagen_url = $3,
         stock_rg = COALESCE($4, stock_rg), stock_ush = COALESCE($5, stock_ush)
       WHERE id = $6 RETURNING *`,
      [valor || null, codigo_barras || null, imagen_url || null,
       stock_rg !== undefined ? parseInt(stock_rg) : null, stock_ush !== undefined ? parseInt(stock_ush) : null,
       req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Variante no encontrada' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al editar la variante: ' + error.message });
  }
});

// Desactivar (no borrar de verdad, para no romper el historial de ventas ya hechas)
router.delete('/variantes/:id', async (req, res) => {
  try {
    await pool.query('UPDATE producto_variantes SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la variante: ' + error.message });
  }
});

module.exports = router;