const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Historial de traspasos entre locales (opcional: local_id trae los que salieron
// o entraron a ese local)
router.get('/', async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM traspasos_stock';
    if (local_id) {
      params.push(local_id);
      q += ` WHERE local_origen = $${params.length} OR local_destino = $${params.length}`;
    }
    q += ' ORDER BY creado_en DESC LIMIT 200';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener traspasos: ' + error.message });
  }
});

// Registrar un traspaso: igual que una orden de ingreso, se hace en dos pasos.
// Al crearlo, el local de origen pierde el stock al instante (ya no lo tiene en el estante),
// pero el destino NO lo suma como stock vendible todavia: queda "en transito" hasta que
// alguien en el destino confirme que lo recibio (puede ser al otro dia).
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { producto_id, cantidad, local_origen, local_destino, usuario_id, usuario_nombre, notas } = req.body;

    const cant = parseInt(cantidad);
    const origen = parseInt(local_origen);
    const destino = parseInt(local_destino);

    if (!producto_id || !cant || cant <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta el producto o la cantidad' });
    }
    if (![1, 2].includes(origen) || ![1, 2].includes(destino) || origen === destino) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Los locales de origen y destino tienen que ser distintos' });
    }

    const colOrigen = origen === 2 ? 'stock_ush' : 'stock_rg';
    const colDestinoTransito = destino === 2 ? 'stock_transito_ush' : 'stock_transito_rg';

    const prodRes = await client.query(
      `SELECT nombre, ${colOrigen} AS stock_origen FROM productos WHERE id = $1`,
      [producto_id]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const stockOrigenActual = prodRes.rows[0].stock_origen || 0;
    if (cant > stockOrigenActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay stock suficiente en el local de origen (hay ' + stockOrigenActual + ')' });
    }
    const nombre = prodRes.rows[0].nombre;

    // El origen lo pierde ya (baja el stock del local y el total combinado, porque mientras
    // esta en camino no es vendible en ningun lado). El destino lo suma como "en transito".
    await client.query(
      `UPDATE productos SET ${colOrigen} = ${colOrigen} - $1, stock = stock - $1,
         ${colDestinoTransito} = COALESCE(${colDestinoTransito}, 0) + $1
       WHERE id = $2`,
      [cant, producto_id]
    );

    const traspasoRes = await client.query(
      `INSERT INTO traspasos_stock (producto_id, producto_nombre, cantidad, local_origen, local_destino, usuario_id, usuario_nombre, notas, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'en_transito') RETURNING *`,
      [producto_id, nombre, cant, origen, destino, usuario_id || null, usuario_nombre || null, notas || null]
    );

    // Queda tambien en el historial general de ajustes de stock (solo el lado del origen,
    // que es el unico stock vendible que cambio de verdad hasta ahora).
    try {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [producto_id, stockOrigenActual, stockOrigenActual - cant, -cant,
         'Traspaso a ' + (destino === 2 ? 'Ushuaia' : 'Rio Grande') + ' (en transito)', usuario_id || null, usuario_nombre || null, origen]
      );
    } catch (e2) { /* si no existe ajustes_stock en este entorno, no frena el traspaso */ }

    await client.query('COMMIT');
    res.status(201).json(traspasoRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar el traspaso: ' + error.message });
  } finally {
    client.release();
  }
});

// Confirmar recepcion en destino (como el "recibir" de las ordenes de ingreso). Se puede
// cargar una cantidad recibida distinta a la enviada, por si se rompio o perdio algo en el camino.
router.put('/:id/recibir', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { cantidad_recibida, usuario_nombre, nota } = req.body;

    const tRes = await client.query('SELECT * FROM traspasos_stock WHERE id = $1', [id]);
    if (tRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Traspaso no encontrado' });
    }
    const traspaso = tRes.rows[0];
    if (traspaso.estado === 'recibido') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este traspaso ya fue recibido' });
    }

    const cantRecibida = (cantidad_recibida !== undefined && cantidad_recibida !== null && cantidad_recibida !== '')
      ? parseInt(cantidad_recibida)
      : traspaso.cantidad;
    if (isNaN(cantRecibida) || cantRecibida < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cantidad recibida invalida' });
    }

    const destino = traspaso.local_destino;
    const colDestino = destino === 2 ? 'stock_ush' : 'stock_rg';
    const colDestinoTransito = destino === 2 ? 'stock_transito_ush' : 'stock_transito_rg';

    const prevRes = await client.query(`SELECT ${colDestino} AS stock_destino FROM productos WHERE id = $1`, [traspaso.producto_id]);
    const stockDestinoAnterior = prevRes.rows[0]?.stock_destino || 0;

    // Suma a stock vendible solo lo que realmente llego. Saca del transito lo que se habia
    // mandado (la diferencia, si la cantidad enviada no llego completa, no queda flotando).
    await client.query(
      `UPDATE productos SET ${colDestino} = COALESCE(${colDestino},0) + $1, stock = stock + $1,
         ${colDestinoTransito} = GREATEST(COALESCE(${colDestinoTransito},0) - $2, 0)
       WHERE id = $3`,
      [cantRecibida, traspaso.cantidad, traspaso.producto_id]
    );

    const upd = await client.query(
      `UPDATE traspasos_stock SET estado = 'recibido', cantidad_recibida = $1, nota_inconsistencia = $2,
         recibido_por = $3, recibido_en = NOW()
       WHERE id = $4 RETURNING *`,
      [cantRecibida, nota || null, usuario_nombre || null, id]
    );

    try {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [traspaso.producto_id, stockDestinoAnterior, stockDestinoAnterior + cantRecibida, cantRecibida,
         'Recepcion de traspaso desde ' + (traspaso.local_origen === 2 ? 'Ushuaia' : 'Rio Grande'), null, usuario_nombre || null, destino]
      );
    } catch (e2) { /* no frena la recepcion si no existe ajustes_stock */ }

    await client.query('COMMIT');
    res.json(upd.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar la recepcion: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
