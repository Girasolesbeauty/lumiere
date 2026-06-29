const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar insumos (con nombre de proveedor).
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, p.nombre AS proveedor_nombre
      FROM insumos i
      LEFT JOIN proveedores p ON i.proveedor_id = p.id
      WHERE i.activo = TRUE
      ORDER BY i.nombre ASC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Insumos configurados para el POS de un local (para mostrar los selectores en la venta)
router.get('/para-pos', async (req, res) => {
  try {
    const { local_id } = req.query;
    const lid = parseInt(local_id) || 1;
    // Interruptor general del local
    const locRes = await pool.query('SELECT descuenta_insumos FROM locales WHERE id = $1', [lid]);
    const activo = locRes.rows.length ? locRes.rows[0].descuenta_insumos === true : false;
    if (!activo) return res.json({ activo: false, insumos: [] });
    const result = await pool.query(`
      SELECT i.id, i.nombre, i.stock_rg, i.stock_ush
      FROM pos_insumos_config c
      JOIN insumos i ON i.id = c.insumo_id
      WHERE c.local_id = $1 AND c.activo = TRUE AND i.activo = TRUE
      ORDER BY i.nombre ASC
    `, [lid]);
    res.json({ activo: true, insumos: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leer la config del POS de un local (para la pantalla de configuracion)
router.get('/config-pos', async (req, res) => {
  try {
    const { local_id } = req.query;
    const lid = parseInt(local_id) || 1;
    const locRes = await pool.query('SELECT descuenta_insumos FROM locales WHERE id = $1', [lid]);
    const activo = locRes.rows.length ? locRes.rows[0].descuenta_insumos === true : false;
    // Todos los insumos + si estan activos en la config de este local
    const result = await pool.query(`
      SELECT i.id, i.nombre, i.categoria,
        COALESCE(c.activo, FALSE) AS en_pos
      FROM insumos i
      LEFT JOIN pos_insumos_config c ON c.insumo_id = i.id AND c.local_id = $1
      WHERE i.activo = TRUE
      ORDER BY i.nombre ASC
    `, [lid]);
    res.json({ activo, insumos: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar la config del POS de un local
router.put('/config-pos', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id, activo, insumos_ids } = req.body;
    const lid = parseInt(local_id) || 1;
    // Interruptor general
    await client.query('UPDATE locales SET descuenta_insumos = $1 WHERE id = $2', [activo === true, lid]);
    // Reemplazar la lista de insumos activos para este local
    await client.query('DELETE FROM pos_insumos_config WHERE local_id = $1', [lid]);
    const ids = Array.isArray(insumos_ids) ? insumos_ids : [];
    for (const insumoId of ids) {
      await client.query(
        'INSERT INTO pos_insumos_config (local_id, insumo_id, activo) VALUES ($1, $2, TRUE) ON CONFLICT (local_id, insumo_id) DO UPDATE SET activo = TRUE',
        [lid, parseInt(insumoId)]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
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
    const { nombre, categoria, unidad, proveedor_id, costo, stock_rg, stock_ush, stock_minimo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const result = await pool.query(
      `INSERT INTO insumos (nombre, categoria, unidad, proveedor_id, costo, stock_rg, stock_ush, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        nombre, categoria || null, unidad || 'unidad',
        proveedor_id || null, parseFloat(costo) || 0,
        parseInt(stock_rg) || 0, parseInt(stock_ush) || 0,
        parseInt(stock_minimo) || 5
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editar insumo (datos generales, no el stock)
router.put('/:id', async (req, res) => {
  try {
    const { nombre, categoria, unidad, proveedor_id, costo, stock_minimo } = req.body;
    const result = await pool.query(
      `UPDATE insumos SET
        nombre = COALESCE($1, nombre),
        categoria = $2,
        unidad = COALESCE($3, unidad),
        proveedor_id = $4,
        costo = COALESCE($5, costo),
        stock_minimo = COALESCE($6, stock_minimo)
       WHERE id = $7 RETURNING *`,
      [
        nombre || null, categoria || null, unidad || null,
        proveedor_id || null,
        costo !== undefined ? parseFloat(costo) : null,
        stock_minimo !== undefined ? parseInt(stock_minimo) : null,
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