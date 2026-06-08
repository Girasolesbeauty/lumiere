const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Listar kits
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT k.*, 
        json_agg(json_build_object('id', ki.id, 'producto_id', ki.producto_id, 'cantidad', ki.cantidad, 'producto_nombre', p.nombre, 'producto_precio', p.price, 'producto_stock', p.stock)) as items
      FROM kits k
      LEFT JOIN kit_items ki ON ki.kit_id = k.id
      LEFT JOIN productos p ON p.id = ki.producto_id
      WHERE k.activo = true
      GROUP BY k.id
      ORDER BY k.nombre
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear kit
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, descripcion, precio, items } = req.body;
    const kit = await client.query(
      'INSERT INTO kits (nombre, descripcion, precio) VALUES ($1, $2, $3) RETURNING *',
      [nombre, descripcion, precio]
    );
    const kitId = kit.rows[0].id;
    for (const item of items) {
      await client.query(
        'INSERT INTO kit_items (kit_id, producto_id, cantidad) VALUES ($1, $2, $3)',
        [kitId, item.producto_id, item.cantidad]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(kit.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Actualizar kit
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, descripcion, precio, items } = req.body;
    await client.query(
      'UPDATE kits SET nombre=$1, descripcion=$2, precio=$3 WHERE id=$4',
      [nombre, descripcion, precio, req.params.id]
    );
    await client.query('DELETE FROM kit_items WHERE kit_id=$1', [req.params.id]);
    for (const item of items) {
      await client.query(
        'INSERT INTO kit_items (kit_id, producto_id, cantidad) VALUES ($1, $2, $3)',
        [req.params.id, item.producto_id, item.cantidad]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// Desactivar kit
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE kits SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vender kit - descuenta stock de cada producto
router.post('/:id/vender', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { cantidad = 1 } = req.body;
    const items = await client.query(
      'SELECT ki.*, p.stock, p.nombre FROM kit_items ki JOIN productos p ON p.id = ki.producto_id WHERE ki.kit_id=$1',
      [req.params.id]
    );
    for (const item of items.rows) {
      const needed = item.cantidad * cantidad;
      if (item.stock < needed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Stock insuficiente de ' + item.nombre + ' (necesitas ' + needed + ', hay ' + item.stock + ')' });
      }
      await client.query('UPDATE productos SET stock = stock - $1 WHERE id=$2', [needed, item.producto_id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Stock actualizado correctamente' });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

module.exports = router;