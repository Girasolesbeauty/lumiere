const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar promociones. ?activas=true&vigentes=true para el POS
router.get('/', async (req, res) => {
  try {
    const { activas, vigentes } = req.query;
    let q = 'SELECT * FROM promociones WHERE 1=1';
    if (activas === 'true') q += ' AND activo = TRUE';
    if (vigentes === 'true') q += " AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE) AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)";
    q += ' ORDER BY creado_en DESC';
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.nombre || !b.tipo) return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    const r = await pool.query(
      `INSERT INTO promociones
        (nombre, tipo, valor, aplica_a, productos_ids, categorias, nx, ny, mismo_producto,
         producto_descuento_id, cross_producto_id, cross_producto_regalo_id, monto_minimo,
         medio_pago_tipo, combinable, fecha_inicio, fecha_fin, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        b.nombre, b.tipo, parseFloat(b.valor) || 0, b.aplica_a || 'todo',
        b.productos_ids || [], b.categorias || [],
        b.nx || null, b.ny || null, b.mismo_producto !== false,
        b.producto_descuento_id || null, b.cross_producto_id || null, b.cross_producto_regalo_id || null,
        b.monto_minimo || null, b.medio_pago_tipo || null,
        b.combinable === true, b.fecha_inicio || null, b.fecha_fin || null,
        b.activo !== false
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editar
router.put('/:id', async (req, res) => {
  try {
    const b = req.body;
    const r = await pool.query(
      `UPDATE promociones SET
        nombre=$1, tipo=$2, valor=$3, aplica_a=$4, productos_ids=$5, categorias=$6,
        nx=$7, ny=$8, mismo_producto=$9, producto_descuento_id=$10, cross_producto_id=$11,
        cross_producto_regalo_id=$12, monto_minimo=$13, medio_pago_tipo=$14, combinable=$15,
        fecha_inicio=$16, fecha_fin=$17, activo=$18
       WHERE id=$19 RETURNING *`,
      [
        b.nombre, b.tipo, parseFloat(b.valor) || 0, b.aplica_a || 'todo',
        b.productos_ids || [], b.categorias || [],
        b.nx || null, b.ny || null, b.mismo_producto !== false,
        b.producto_descuento_id || null, b.cross_producto_id || null, b.cross_producto_regalo_id || null,
        b.monto_minimo || null, b.medio_pago_tipo || null,
        b.combinable === true, b.fecha_inicio || null, b.fecha_fin || null,
        b.activo !== false, req.params.id
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Promocion no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Activar/desactivar rapido
router.put('/:id/toggle', async (req, res) => {
  try {
    const r = await pool.query('UPDATE promociones SET activo = NOT activo WHERE id = $1 RETURNING *', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM promociones WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;