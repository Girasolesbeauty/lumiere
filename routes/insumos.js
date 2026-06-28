const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar insumos (con nombre de proveedor). ?solo_bolsas=true para el selector del POS
router.get('/', async (req, res) => {
  try {
    const { solo_bolsas } = req.query;
    let query = `
      SELECT i.*, p.nombre AS proveedor_nombre
      FROM insumos i
      LEFT JOIN proveedores p ON i.proveedor_id = p.id
      WHERE i.activo = TRUE
    `;
    if (solo_bolsas === 'true') query += ' AND i.es_bolsa = TRUE';
    query += ' ORDER BY i.nombre ASC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Alertas: insumos cuyo stock del local (o total) esta en o por debajo del minimo
router.get('/alertas', async (req, res) => {
  try {
    const { local_id } = req.query;
    let col = 'stock_rg + stock_ush';
    if (local_id === '1') col = 'stock_rg';
    else if (local_id === '2') col = 'stock_ush';
    const result = await pool.query(
      `SELECT i.*, p.nombre AS proveedor_nombre
       FROM insumos i
       LEFT JOIN proveedores p ON i.proveedor_id = p.id
       WHERE i.activo = TRUE AND (${col}) <= i.stock_minimo
       ORDER BY (${col}) ASC`
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear insumo
router.post('/', async (req, res) => {
  try {
    const { nombre, categoria, unidad, proveedor_id, costo, stock_rg, stock_ush, stock_minimo, es_bolsa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await pool.query(
      `INSERT INTO insumos (nombre, categoria, unidad, proveedor_id, costo, stock_rg, stock_ush, stock_minimo, es_bolsa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        nombre, categoria || null, unidad || 'unidad',
        proveedor_id || null, parseFloat(costo) || 0,
        parseInt(stock_rg) || 0, parseInt(stock_ush) || 0,
        parseInt(stock_minimo) || 5, es_bolsa === true
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editar insumo (datos generales, no el stock)
router.put('/:id', async (req, res) => {
  try {
    const { nombre, categoria, unidad, proveedor_id, costo, stock_minimo, es_bolsa } = req.body;
    const result = await pool.query(
      `UPDATE insumos SET
        nombre = COALESCE($1, nombre),
        categoria = $2,
        unidad = COALESCE($3, unidad),
        proveedor_id = $4,
        costo = COALESCE($5, costo),
        stock_minimo = COALESCE($6, stock_minimo),
        es_bolsa = COALESCE($7, es_bolsa)
       WHERE id = $8 RETURNING *`,
      [
        nombre || null, categoria || null, unidad || null,
        proveedor_id || null,
        costo !== undefined ? parseFloat(costo) : null,
        stock_minimo !== undefined ? parseInt(stock_minimo) : null,
        es_bolsa !== undefined ? es_bolsa : null,
        req.params.id
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Insumo no encontrado' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ajustar stock de un local (modo: 'exacto' pone el valor, 'diferencia' suma/resta)
router.put('/:id/ajustar-stock', async (req, res) => {
  try {
    const { local_id, modo, valor } = req.body;
    const col = local_id == 2 ? 'stock_ush' : 'stock_rg';
    const prod = await pool.query('SELECT * FROM insumos WHERE id = $1', [req.params.id]);
    if (!prod.rows.length) return res.status(404).json({ error: 'Insumo no encontrado' });
    const actual = prod.rows[0][col] || 0;
    let nuevo;
    if (modo === 'diferencia') nuevo = actual + parseInt(valor);
    else nuevo = parseInt(valor);
    if (isNaN(nuevo)) return res.status(400).json({ error: 'Valor invalido' });
    if (nuevo < 0) nuevo = 0;
    const result = await pool.query(
      `UPDATE insumos SET ${col} = $1 WHERE id = $2 RETURNING *`,
      [nuevo, req.params.id]
    );
    res.json({ ok: true, stock_anterior: actual, stock_nuevo: nuevo, insumo: result.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Desactivar insumo (no borra, lo oculta)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE insumos SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;