const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper: ajusta el transito de un producto en un local por una diferencia (puede ser negativa)
async function ajustarTransito(client, producto_id, local, diff) {
  if (!producto_id || !diff) return;
  const col = (local === 'ush' || local === 2 || local === '2') ? 'stock_transito_ush' : 'stock_transito_rg';
  await client.query(
    `UPDATE productos SET ${col} = GREATEST(COALESCE(${col},0) + $1, 0) WHERE id = $2`,
    [diff, producto_id]
  );
}

// EDITAR un item de una orden (cantidad, costo, y distribucion por local)
// Solo permite editar la parte que AUN NO se recibio.
router.put('/:ordenId/items/:itemId/editar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { itemId } = req.params;
    const { cantidad_total, cantidad_rg, cantidad_ush, costo_unitario, producto_id, producto_nombre } = req.body;

    const itRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE id = $1', [itemId]);
    if (itRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    const item = itRes.rows[0];

    // No permitir editar si ya se recibio algo (para no descuadrar stock real)
    if ((item.recibido_rg || 0) > 0 || (item.recibido_ush || 0) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede editar un item que ya fue recibido (parcial o total). Solo se pueden editar items pendientes.' });
    }

    // Valores nuevos (si no vienen, se mantienen)
    const nuevoProd = (producto_id !== undefined && producto_id !== null) ? producto_id : item.producto_id;
    const nuevoNombre = (producto_nombre !== undefined) ? producto_nombre : item.producto_nombre;
    const nuevaRg = (cantidad_rg !== undefined && cantidad_rg !== null) ? parseInt(cantidad_rg) : (item.cantidad_rg || 0);
    const nuevaUsh = (cantidad_ush !== undefined && cantidad_ush !== null) ? parseInt(cantidad_ush) : (item.cantidad_ush || 0);
    const nuevaTotal = (cantidad_total !== undefined && cantidad_total !== null) ? parseInt(cantidad_total) : (nuevaRg + nuevaUsh);
    const nuevoCosto = (costo_unitario !== undefined && costo_unitario !== null) ? parseFloat(costo_unitario) : item.costo_unitario;

    // Validar que no se reduzca el transito por debajo de lo ya reservado (preventas).
    // Solo aplica si NO se cambia de producto (si cambia, el producto viejo pierde todo su transito
    // y hay que chequear que no tenga reservas de esta orden).
    const prodActual = await client.query('SELECT COALESCE(stock_transito_rg, 0) AS transito_rg, COALESCE(stock_transito_ush, 0) AS transito_ush, COALESCE(reservado_rg, 0) AS reservado_rg, COALESCE(reservado_ush, 0) AS reservado_ush FROM productos WHERE id = $1', [item.producto_id]);
    if (prodActual.rows.length > 0) {
      const p = prodActual.rows[0];
      // transito que quedaria en el producto viejo tras revertir este item
      const transitoRgSinEste = (p.transito_rg || 0) - (item.cantidad_rg || 0);
      const transitoUshSinEste = (p.transito_ush || 0) - (item.cantidad_ush || 0);
      // si es el mismo producto, se vuelve a sumar la cantidad nueva
      const transitoRgFinal = (String(nuevoProd) === String(item.producto_id)) ? transitoRgSinEste + nuevaRg : transitoRgSinEste;
      const transitoUshFinal = (String(nuevoProd) === String(item.producto_id)) ? transitoUshSinEste + nuevaUsh : transitoUshSinEste;
      if (transitoRgFinal < (p.reservado_rg || 0) || transitoUshFinal < (p.reservado_ush || 0)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No se puede reducir la cantidad: hay preventas/reservas de clientas sobre este producto. Cancela esas preventas primero.' });
      }
    }

    // Revertir transito del item viejo (sobre el producto viejo)
    await ajustarTransito(client, item.producto_id, 'rg', -(item.cantidad_rg || 0));
    await ajustarTransito(client, item.producto_id, 'ush', -(item.cantidad_ush || 0));

    // Aplicar transito del item nuevo (sobre el producto nuevo)
    await ajustarTransito(client, nuevoProd, 'rg', nuevaRg);
    await ajustarTransito(client, nuevoProd, 'ush', nuevaUsh);

    // Actualizar el item
    await client.query(
      `UPDATE ordenes_ingreso_items
         SET producto_id = $1, producto_nombre = $2, cantidad_total = $3,
             cantidad_rg = $4, cantidad_ush = $5, costo_unitario = $6
       WHERE id = $7`,
      [nuevoProd, nuevoNombre, nuevaTotal, nuevaRg, nuevaUsh, nuevoCosto, itemId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Item actualizado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al editar item: ' + error.message });
  } finally {
    client.release();
  }
});

// ELIMINAR un item de una orden (revierte el transito de la parte no recibida)
router.delete('/:ordenId/items/:itemId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { itemId } = req.params;

    const itRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE id = $1', [itemId]);
    if (itRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    const item = itRes.rows[0];

    if ((item.recibido_rg || 0) > 0 || (item.recibido_ush || 0) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede eliminar un item que ya fue recibido (parcial o total).' });
    }

    // No permitir eliminar si al revertir el transito quedaria por debajo de lo reservado (preventas)
    const prodActual = await client.query('SELECT COALESCE(stock_transito_rg, 0) AS transito_rg, COALESCE(stock_transito_ush, 0) AS transito_ush, COALESCE(reservado_rg, 0) AS reservado_rg, COALESCE(reservado_ush, 0) AS reservado_ush FROM productos WHERE id = $1', [item.producto_id]);
    if (prodActual.rows.length > 0) {
      const p = prodActual.rows[0];
      const transitoRgFinal = (p.transito_rg || 0) - (item.cantidad_rg || 0);
      const transitoUshFinal = (p.transito_ush || 0) - (item.cantidad_ush || 0);
      if (transitoRgFinal < (p.reservado_rg || 0) || transitoUshFinal < (p.reservado_ush || 0)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No se puede eliminar: hay preventas/reservas de clientas sobre este producto. Cancela esas preventas primero.' });
      }
    }

    // Revertir transito
    await ajustarTransito(client, item.producto_id, 'rg', -(item.cantidad_rg || 0));
    await ajustarTransito(client, item.producto_id, 'ush', -(item.cantidad_ush || 0));

    await client.query('DELETE FROM ordenes_ingreso_items WHERE id = $1', [itemId]);

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Item eliminado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar item: ' + error.message });
  } finally {
    client.release();
  }
});

// CAMBIAR el producto de un item (se eligio uno equivocado al armar la orden).
// Lo que falta llegar pasa como "en camino" al producto nuevo, y lo que ya se recibio
// pasa del stock del producto viejo al del nuevo, en cada local.
router.put('/:ordenId/items/:itemId/cambiar-producto', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const nuevoId = parseInt(req.body.producto_id);
    const itRes = await client.query('SELECT * FROM ordenes_ingreso_items WHERE id = $1 AND orden_id = $2 FOR UPDATE', [req.params.itemId, req.params.ordenId]);
    const item = itRes.rows[0];
    if (!item) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item no encontrado' }); }
    if (!nuevoId) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegí el producto correcto' }); }
    if (String(nuevoId) === String(item.producto_id)) { await client.query('ROLLBACK'); return res.json({ ok: true, sin_cambios: true }); }
    const np = (await client.query('SELECT id, nombre FROM productos WHERE id = $1', [nuevoId])).rows[0];
    if (!np) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró ese producto' }); }

    const recRg = item.recibido_rg || 0, recUsh = item.recibido_ush || 0;
    const camRg = Math.max(0, (item.cantidad_rg || 0) - recRg), camUsh = Math.max(0, (item.cantidad_ush || 0) - recUsh);
    if (item.producto_id) {
      const viejo = (await client.query('SELECT COALESCE(stock_transito_rg, 0) AS transito_rg, COALESCE(stock_transito_ush, 0) AS transito_ush, COALESCE(reservado_rg, 0) AS reservado_rg, COALESCE(reservado_ush, 0) AS reservado_ush FROM productos WHERE id = $1 FOR UPDATE', [item.producto_id])).rows[0];
      if (viejo && ((viejo.transito_rg - camRg) < viejo.reservado_rg || (viejo.transito_ush - camUsh) < viejo.reservado_ush)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No se puede cambiar: hay preventas de clientas sobre lo que falta llegar de este producto. Cancelá esas preventas primero.' });
      }
      await ajustarTransito(client, item.producto_id, 'rg', -camRg);
      await ajustarTransito(client, item.producto_id, 'ush', -camUsh);
      if (recRg || recUsh) {
        await client.query(`UPDATE productos SET stock_rg = GREATEST(COALESCE(stock_rg,0) - $1, 0), stock_ush = GREATEST(COALESCE(stock_ush,0) - $2, 0),
          stock = GREATEST(COALESCE(stock_rg,0) - $1, 0) + GREATEST(COALESCE(stock_ush,0) - $2, 0) WHERE id = $3`, [recRg, recUsh, item.producto_id]);
      }
    }
    await ajustarTransito(client, nuevoId, 'rg', camRg);
    await ajustarTransito(client, nuevoId, 'ush', camUsh);
    if (recRg || recUsh) {
      await client.query(`UPDATE productos SET stock_rg = COALESCE(stock_rg,0) + $1, stock_ush = COALESCE(stock_ush,0) + $2,
        stock = COALESCE(stock_rg,0) + $1 + COALESCE(stock_ush,0) + $2 WHERE id = $3`, [recRg, recUsh, nuevoId]);
    }
    await client.query('UPDATE ordenes_ingreso_items SET producto_id = $1, producto_nombre = $2 WHERE id = $3', [nuevoId, np.nombre, item.id]);
    await client.query('COMMIT');
    res.json({ ok: true, producto: np, movido: { en_camino_rg: camRg, en_camino_ush: camUsh, recibido_rg: recRg, recibido_ush: recUsh } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar el producto: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;