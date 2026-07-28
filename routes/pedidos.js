const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Crear un pedido (clienta espera un producto). Puede ser de una clienta ya registrada
// (cliente_id) o de alguien sin registrar en el sistema -- en ese caso, nombre y celular
// son obligatorios (no se puede anotar un pedido sin poder contactar a la clienta despues).
router.post('/', async (req, res) => {
  try {
    const { cliente_id, producto_id, producto_texto, nombre_manual, telefono_manual, local_id } = req.body;

    if (!cliente_id && !(nombre_manual && nombre_manual.trim() && telefono_manual && telefono_manual.trim())) {
      return res.status(400).json({ error: 'Elegi una clienta registrada, o cargá su nombre y celular' });
    }
    if (!producto_id && !(producto_texto && producto_texto.trim())) {
      return res.status(400).json({ error: 'Elegi un producto o escribi una sugerencia' });
    }
    const r = await pool.query(
      `INSERT INTO pedidos_clientas (cliente_id, producto_id, producto_texto, nombre_manual, telefono_manual, local_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [cliente_id || null, producto_id || null, producto_texto ? producto_texto.trim() : null,
       cliente_id ? null : nombre_manual.trim(), cliente_id ? null : telefono_manual.trim(), local_id || 1]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar pedidos (por defecto los que estan esperando), con datos de clienta y producto + stock actual
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    let q = `
      SELECT p.*, COALESCE(c.nombre, p.nombre_manual) AS cliente_nombre,
             COALESCE(c.telefono, p.telefono_manual) AS telefono,
             c.cuit_dni, (p.cliente_id IS NULL) AS clienta_sin_registrar,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre,
             (p.producto_id IS NULL) AS es_sugerencia,
             CASE WHEN p.local_id = 2 THEN 'Ushuaia' ELSE 'Rio Grande' END AS local_nombre,
             CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END AS stock_total
      FROM pedidos_clientas p
      LEFT JOIN clientes c ON c.id = p.cliente_id
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
      SELECT p.*, COALESCE(c.nombre, p.nombre_manual) AS cliente_nombre,
             COALESCE(c.telefono, p.telefono_manual) AS telefono,
             c.cuit_dni,
             pr.nombre AS producto_nombre,
             CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END AS stock_total
      FROM pedidos_clientas p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      JOIN productos pr ON pr.id = p.producto_id
      WHERE p.estado = 'esperando'
        AND p.avisado = FALSE
        AND p.producto_id IS NOT NULL
        AND (CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END) > 0
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

module.exports = router;s