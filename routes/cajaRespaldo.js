const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Ver el total actual guardado en la reserva + historial
router.get('/', async (req, res) => {
  try {
    const hist = await pool.query('SELECT * FROM caja_respaldo ORDER BY creado_en DESC');
    const guardado = hist.rows.filter(r => r.tipo === 'guardar').reduce((s, r) => s + parseFloat(r.importe), 0);
    const sacado = hist.rows.filter(r => r.tipo === 'sacar').reduce((s, r) => s + parseFloat(r.importe), 0);
    res.json({ total: guardado - sacado, movimientos: hist.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar plata (entra a la reserva)
router.post('/guardar', async (req, res) => {
  try {
    const { importe, concepto, cuenta_pago_id, usuario_id } = req.body;
    const imp = parseFloat(importe) || 0;
    if (imp <= 0) return res.status(400).json({ error: 'El importe debe ser mayor a cero' });
    const r = await pool.query(
      `INSERT INTO caja_respaldo (tipo, importe, concepto, cuenta_pago_id, usuario_id)
       VALUES ('guardar', $1, $2, $3, $4) RETURNING *`,
      [imp, concepto || null, cuenta_pago_id || null, usuario_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sacar plata (sale de la reserva)
router.post('/sacar', async (req, res) => {
  try {
    const { importe, concepto, cuenta_pago_id, usuario_id } = req.body;
    const imp = parseFloat(importe) || 0;
    if (imp <= 0) return res.status(400).json({ error: 'El importe debe ser mayor a cero' });
    // Verificar que haya saldo suficiente
    const hist = await pool.query('SELECT tipo, importe FROM caja_respaldo');
    const guardado = hist.rows.filter(x => x.tipo === 'guardar').reduce((s, x) => s + parseFloat(x.importe), 0);
    const sacado = hist.rows.filter(x => x.tipo === 'sacar').reduce((s, x) => s + parseFloat(x.importe), 0);
    const disponible = guardado - sacado;
    if (imp > disponible) return res.status(400).json({ error: 'No hay suficiente en la reserva. Disponible: ' + disponible });
    const r = await pool.query(
      `INSERT INTO caja_respaldo (tipo, importe, concepto, cuenta_pago_id, usuario_id)
       VALUES ('sacar', $1, $2, $3, $4) RETURNING *`,
      [imp, concepto || null, cuenta_pago_id || null, usuario_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Borrar un movimiento de la reserva
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM caja_respaldo WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;