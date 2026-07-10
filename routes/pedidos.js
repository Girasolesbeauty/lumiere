const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Crear un pedido (clienta espera un producto)
router.post('/', async (req, res) => {
  try {
    const { cliente_id, producto_id, producto_texto } = req.body;
    if (!cliente_id) return res.status(400).json({ error: 'Falta la clienta' });
    if (!producto_id && !(producto_texto && producto_texto.trim())) {
      return res.status(400).json({ error: 'Elegi un producto o escribi una sugerencia' });
    }
    const r = await pool.query(
      `INSERT INTO pedidos_clientas (cliente_id, producto_id, producto_texto) VALUES ($1, $2, $3) RETURNING *`,
      [cliente_id, producto_id || null, producto_texto ? producto_texto.trim() : null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar pedidos (por defecto los que estan esperando), con datos de clienta y producto + stock actual
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    let q = `
      SELECT p.*, c.nombre AS cliente_nombre, c.telefono, c.cuit_dni,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre,
             (p.producto_id IS NULL) AS es_sugerencia,
             (COALESCE(pr.stock_rg, 0) + COALESCE(pr.stock_ush, 0)) AS stock_total
      FROM pedidos_clientas p
      JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN productos pr ON pr.id = p.producto_id`;
    const params = [];
    if (estado) { params.push(estado); q += ` WHERE p.estado = $1`; }
    q += ' ORDER BY p.creado_en DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pedidos con stock disponible (producto paso de 0 a tener stock) y todavia no avisados
router.get('/con-stock', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, c.nombre AS cliente_nombre, c.telefono, c.cuit_dni,
             pr.nombre AS producto_nombre,
             (COALESCE(pr.stock_rg, 0) + COALESCE(pr.stock_ush, 0)) AS stock_total
      FROM pedidos_clientas p
      JOIN clientes c ON c.id = p.cliente_id
      JOIN productos pr ON pr.id = p.producto_id
      WHERE p.estado = 'esperando'
        AND p.avisado = FALSE
        AND p.producto_id IS NOT NULL
        AND (COALESCE(pr.stock_rg, 0) + COALESCE(pr.stock_ush, 0)) > 0
      ORDER BY p.creado_en DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar como avisado (cuando se le manda el WhatsApp)
router.post('/:id/avisar', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE pedidos_clientas SET avisado = TRUE, avisado_en = NOW(), estado = 'avisado' WHERE id = $1`,
      [id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Borrar / cancelar un pedido
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pedidos_clientas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;