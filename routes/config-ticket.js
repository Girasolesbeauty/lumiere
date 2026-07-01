const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Leer la config del ticket (siempre la fila id=1)
router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM config_ticket WHERE id = 1');
    if (!r.rows.length) {
      return res.json({ mostrar_cliente: true, mostrar_numero: true, mostrar_fecha: true, mensaje_pie: 'Gracias por tu compra!', texto_extra: '' });
    }
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar la config del ticket
router.put('/', async (req, res) => {
  try {
    const { mostrar_cliente, mostrar_numero, mostrar_fecha, mensaje_pie, texto_extra } = req.body;
    const r = await pool.query(
      `UPDATE config_ticket SET
        mostrar_cliente = $1, mostrar_numero = $2, mostrar_fecha = $3,
        mensaje_pie = $4, texto_extra = $5
       WHERE id = 1 RETURNING *`,
      [mostrar_cliente === true, mostrar_numero === true, mostrar_fecha === true, mensaje_pie || '', texto_extra || '']
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;