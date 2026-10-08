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
         VALUES ($1, $2, $3, $4, 'Traspaso a ' || COALESCE((SELECT nombre FROM locales WHERE id = $8::int), 'local ' || $8::text) || ' (en transito)', $5, $6, $7)`,
        [producto_id, stockOrigenActual, stockOrigenActual - cant, -cant,
         usuario_id || null, usuario_nombre || null, origen, destino]
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
         VALUES ($1, $2, $3, $4, 'Recepcion de traspaso desde ' || COALESCE((SELECT nombre FROM locales WHERE id = $8::int), 'local ' || $8::text), $5, $6, $7)`,
        [traspaso.producto_id, stockDestinoAnterior, stockDestinoAnterior + cantRecibida, cantRecibida,
         null, usuario_nombre || null, destino, traspaso.local_origen]
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

// ---------- Eliminar traspasos SIN tocar el stock ----------
// Para cuando se cargaron traspasos y el stock ya se corrigió por otro lado (ej: con ajustes de
// inventario): borra los traspasos de un rango de días y sus líneas en el historial de ajustes,
// y saca de "En camino" lo que nunca se recibió. El stock vendible de cada local NO cambia.
// Solo el jefe. Queda registrado en Auditoría.
const DIA_AR = (col) => `((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
const esJefe = (req) => req.usuario && (req.usuario.rol === 'jefe' || req.usuario.rol === 'admin');

async function traspasosDelRango(db, desde, hasta) {
  const r = await db.query(
    `SELECT t.*, to_char(${DIA_AR('t.creado_en')}, 'DD/MM/YYYY') AS dia
     FROM traspasos_stock t WHERE ${DIA_AR('t.creado_en')} BETWEEN $1::date AND $2::date ORDER BY t.creado_en`, [desde, hasta]);
  return r.rows;
}

router.post('/eliminar/vista', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede eliminar traspasos' });
    const { desde, hasta } = req.body || {};
    if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) return res.status(400).json({ error: 'Elegí bien las fechas (desde ≤ hasta)' });
    const lista = await traspasosDelRango(pool, desde, hasta);
    res.json({
      traspasos: lista,
      en_camino: lista.filter(t => t.estado !== 'recibido').reduce((a, t) => a + (parseInt(t.cantidad) || 0), 0),
    });
  } catch (e) {
    console.error('[traspasos] vista eliminar:', e.message);
    res.status(500).json({ error: 'No se pudo armar la lista' });
  }
});

router.post('/eliminar', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede eliminar traspasos' });
  const { desde, hasta, motivo } = req.body || {};
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) return res.status(400).json({ error: 'Elegí bien las fechas (desde ≤ hasta)' });
  if (!String(motivo || '').trim()) return res.status(400).json({ error: 'Escribí el motivo' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lista = await traspasosDelRango(client, desde, hasta);
    // Solo se borra lo que la pantalla mostró (si entretanto se cargó otro traspaso en esas fechas, se frena)
    const esperados = Array.isArray(req.body.ids) ? req.body.ids.map(Number).sort((a, b) => a - b).join(',') : null;
    if (esperados !== null && esperados !== lista.map(t => t.id).sort((a, b) => a - b).join(',')) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La lista cambió desde que la viste. Volvé a ver la vista previa.' });
    }
    if (!lista.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay traspasos en esas fechas' }); }
    const hayAjustes = (await client.query(`SELECT to_regclass('ajustes_stock') AS t`)).rows[0].t;
    let enCamino = 0, lineasHistorial = 0;
    for (const t of lista) {
      // Lo que nunca se recibió sigue sumado en "En camino" del destino: se saca (no es stock vendible)
      if (t.estado !== 'recibido') {
        const col = Number(t.local_destino) === 2 ? 'stock_transito_ush' : 'stock_transito_rg';
        await client.query(`UPDATE productos SET ${col} = GREATEST(COALESCE(${col}, 0) - $1, 0) WHERE id = $2`, [t.cantidad, t.producto_id]);
        enCamino += parseInt(t.cantidad) || 0;
      }
      // Sus líneas en el historial de ajustes (se guardaron en la misma operación, con la misma hora)
      if (hayAjustes) {
        const a = await client.query(
          `DELETE FROM ajustes_stock WHERE producto_id = $1 AND local_id = $2 AND motivo LIKE 'Traspaso a %' AND creado_en = $3`,
          [t.producto_id, t.local_origen, t.creado_en]);
        lineasHistorial += a.rowCount;
        if (t.recibido_en) {
          const b = await client.query(
            `DELETE FROM ajustes_stock WHERE producto_id = $1 AND local_id = $2 AND motivo LIKE 'Recepcion de traspaso desde %' AND creado_en = $3`,
            [t.producto_id, t.local_destino, t.recibido_en]);
          lineasHistorial += b.rowCount;
        }
      }
    }
    await client.query('DELETE FROM traspasos_stock WHERE id = ANY($1)', [lista.map(t => t.id)]);
    let quien = null;
    try { quien = (await client.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id])).rows[0]?.nombre || null; } catch (e) {}
    if ((await client.query(`SELECT to_regclass('anulaciones') AS t`)).rows[0].t) {
      await client.query(
        `INSERT INTO anulaciones (tipo, referencia_id, referencia_codigo, motivo, usuario_id, usuario_nombre, detalle_json)
         VALUES ('traspasos_eliminados', $6, $1, $2, $3, $4, $5)`,
        [desde + ' a ' + hasta, String(motivo).trim(), req.usuario.id || null, quien,
         JSON.stringify({ desde, hasta, cantidad: lista.length, en_camino_quitado: enCamino, lineas_historial: lineasHistorial,
           traspasos: lista.map(t => ({ id: t.id, dia: t.dia, producto: t.producto_nombre, cantidad: t.cantidad, origen: t.local_origen, destino: t.local_destino, estado: t.estado })) }),
         lista[0].id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, eliminados: lista.length, en_camino_quitado: enCamino, lineas_historial: lineasHistorial });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[traspasos] eliminar:', e.message);
    res.status(500).json({ error: 'No se pudieron eliminar. No se borró nada.' });
  } finally {
    client.release();
  }
});

module.exports = router;
