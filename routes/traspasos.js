const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Stock cruzado: lo que en un local se agoto (o le alcanza para menos de 2 semanas a su ritmo de venta de los
// ultimos 30 dias) y en el otro hay de sobra. "mandar" = lo que este local le puede mandar al otro; "pedir" = al reves.
// Cantidad sugerida: lo que el otro vende en 30 dias (al menos 1), sin dejar al que manda con menos de la mitad de lo que tiene.
// No sugiere lo que ya va en camino.
const { VENTA_VALIDA } = require('../lib/niveles');
router.get('/sugeridos', async (req, res) => {
  try {
    const yo = Number(req.query.local_id) === 2 ? 2 : 1;
    const r = await pool.query(`WITH v AS (
        SELECT vi.producto_id, SUM(vi.cantidad) FILTER (WHERE v.local_id = 1) AS v1, SUM(vi.cantidad) FILTER (WHERE v.local_id = 2) AS v2
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id WHERE ${VENTA_VALIDA} AND v.creado_en >= NOW() - INTERVAL '30 days' GROUP BY 1)
      SELECT p.id, p.nombre, p.marca, GREATEST(COALESCE(p.stock_rg, 0), 0) AS s1, GREATEST(COALESCE(p.stock_ush, 0), 0) AS s2,
        COALESCE(p.stock_transito_rg, 0) AS t1, COALESCE(p.stock_transito_ush, 0) AS t2, COALESCE(v.v1, 0)::int AS v1, COALESCE(v.v2, 0)::int AS v2
      FROM productos p LEFT JOIN v ON v.producto_id = p.id
      WHERE p.activo = TRUE AND COALESCE(p.tiene_variantes, FALSE) = FALSE AND (COALESCE(p.stock_rg, 0) > 1 OR COALESCE(p.stock_ush, 0) > 1)`);
    const sugerir = (desde, hacia) => r.rows.map(p => {
      const sD = Number(p['s' + desde]), sH = Number(p['s' + hacia]), tH = Number(p['t' + hacia]), vH = Number(p['v' + hacia]), vD = Number(p['v' + desde]);
      // Le falta: agotado (y se vende o se vendio alguna vez en el otro) o no le alcanza para 2 semanas
      const falta = (sH <= 0 && (vH > 0 || vD > 0)) || (vH > 0 && sH < vH / 2);
      if (!falta || tH > 0 || sD < 2) return null;
      const cant = Math.min(Math.max(1, vH - sH), Math.floor(sD / 2));
      return cant > 0 ? { producto_id: p.id, nombre: p.nombre, marca: p.marca, stock_aca: sD, stock_alla: sH, vendidos_alla: vH, cantidad: cant } : null;
    }).filter(Boolean).sort((a, b) => (a.stock_alla - b.stock_alla) || (b.vendidos_alla - a.vendidos_alla)).slice(0, 30);
    res.json({ mandar: sugerir(yo, yo === 1 ? 2 : 1), pedir: sugerir(yo === 1 ? 2 : 1, yo) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo armar la lista' });
  }
});

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

// ---------- Eliminar UN traspaso devolviendo el stock ----------
// Deshace el traspaso como si nunca se hubiera hecho:
// - Si estaba en camino: vuelve al local de origen y se saca de "En camino" del destino.
// - Si ya se recibió: el destino devuelve lo que recibió y el origen recupera lo que había mandado.
// Deja las líneas de la vuelta en el historial de ajustes y queda registrado en Auditoría.
router.post('/:id/eliminar', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede eliminar traspasos' });
  const id = parseInt(req.params.id) || 0;
  const motivo = String((req.body && req.body.motivo) || '').trim().slice(0, 300);
  if (!motivo) return res.status(400).json({ error: 'Escribí el motivo' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRes = await client.query('SELECT * FROM traspasos_stock WHERE id = $1 FOR UPDATE', [id]);
    const t = tRes.rows[0];
    if (!t) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ese traspaso ya no existe' }); }
    const origen = Number(t.local_origen), destino = Number(t.local_destino);
    const enviada = parseInt(t.cantidad) || 0;
    const recibido = t.estado === 'recibido';
    const recibida = recibido ? (parseInt(t.cantidad_recibida) || 0) : 0;
    const colOrigen = origen === 2 ? 'stock_ush' : 'stock_rg';
    const colDestino = destino === 2 ? 'stock_ush' : 'stock_rg';
    const colTransito = destino === 2 ? 'stock_transito_ush' : 'stock_transito_rg';
    const pRes = await client.query(`SELECT nombre, COALESCE(${colOrigen}, 0) AS st_origen, COALESCE(${colDestino}, 0) AS st_destino FROM productos WHERE id = $1 FOR UPDATE`, [t.producto_id]);
    const prod = pRes.rows[0];
    if (!prod) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El producto de este traspaso ya no existe: no se puede devolver el stock' }); }
    const nombreLocal = async (n) => { try { return (await client.query('SELECT nombre FROM locales WHERE id = $1', [n])).rows[0]?.nombre || ('local ' + n); } catch (e) { return 'local ' + n; } };
    const nomOrigen = await nombreLocal(origen), nomDestino = await nombreLocal(destino);
    const stOrigen = parseInt(prod.st_origen) || 0, stDestino = parseInt(prod.st_destino) || 0;
    if (recibido && recibida > stDestino) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `En ${nomDestino} quedan ${stDestino} de "${prod.nombre}" y habría que devolver ${recibida} (seguramente se vendió una parte). Corregí el stock con un ajuste en lugar de eliminar el traspaso.` });
    }

    if (recibido) {
      await client.query(
        `UPDATE productos SET ${colOrigen} = COALESCE(${colOrigen}, 0) + $1, ${colDestino} = COALESCE(${colDestino}, 0) - $2,
           stock = COALESCE(stock, 0) + $1 - $2 WHERE id = $3`, [enviada, recibida, t.producto_id]);
    } else {
      await client.query(
        `UPDATE productos SET ${colOrigen} = COALESCE(${colOrigen}, 0) + $1, stock = COALESCE(stock, 0) + $1,
           ${colTransito} = GREATEST(COALESCE(${colTransito}, 0) - $1, 0) WHERE id = $2`, [enviada, t.producto_id]);
    }

    let quien = null;
    try { quien = (await client.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id])).rows[0]?.nombre || null; } catch (e) {}
    if ((await client.query(`SELECT to_regclass('ajustes_stock') AS x`)).rows[0].x) {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [t.producto_id, stOrigen, stOrigen + enviada, enviada, 'Traspaso eliminado: vuelve desde ' + nomDestino + ' (' + motivo + ')', req.usuario.id || null, quien, origen]);
      if (recibido && recibida > 0) {
        await client.query(
          `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [t.producto_id, stDestino, stDestino - recibida, -recibida, 'Traspaso eliminado: vuelve a ' + nomOrigen + ' (' + motivo + ')', req.usuario.id || null, quien, destino]);
      }
    }
    await client.query('DELETE FROM traspasos_stock WHERE id = $1', [id]);
    if ((await client.query(`SELECT to_regclass('anulaciones') AS x`)).rows[0].x) {
      await client.query(
        `INSERT INTO anulaciones (tipo, referencia_id, referencia_codigo, motivo, usuario_id, usuario_nombre, detalle_json)
         VALUES ('traspaso_eliminado', $1, $2, $3, $4, $5, $6)`,
        [id, prod.nombre + ' · ' + enviada + 'u ' + nomOrigen + ' → ' + nomDestino, motivo, req.usuario.id || null, quien,
         JSON.stringify({ producto_id: t.producto_id, producto: prod.nombre, cantidad: enviada, cantidad_recibida: recibido ? recibida : null, origen, destino, estado: t.estado, creado_en: t.creado_en, stock_devuelto: true })]);
    }
    await client.query('COMMIT');
    res.json({
      ok: true,
      mensaje: recibido
        ? `Traspaso eliminado: ${nomOrigen} recuperó ${enviada} y ${nomDestino} devolvió ${recibida} de "${prod.nombre}".`
        : `Traspaso eliminado: las ${enviada} unidades de "${prod.nombre}" volvieron a ${nomOrigen}.`,
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[traspasos] eliminar uno:', e.message);
    res.status(500).json({ error: 'No se pudo eliminar el traspaso. No se cambió nada.' });
  } finally {
    client.release();
  }
});

module.exports = router;
