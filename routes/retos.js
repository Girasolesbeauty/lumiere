const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Desafios de venta: en el POS la vendedora acepta el reto de superar el ticket promedio
// de la clienta. Cada reto (logrado o no) queda registrado aca. Si en el mes junta la
// cantidad de retos superados que se configuro, gana un canje de producto de hasta $X.
// La cantidad y el monto se configuran en Configuracion del Negocio.

const leerConfig = async (db) => {
  const r = await db.query(
    `SELECT COALESCE(retos_activo, true) AS activo,
            COALESCE(retos_meta_mensual, 10) AS meta_mensual,
            COALESCE(retos_premio_monto, 50000) AS premio_monto
       FROM configuracion_negocio WHERE id = 1`
  );
  const c = r.rows[0] || { activo: true, meta_mensual: 10, premio_monto: 50000 };
  return { activo: c.activo, meta_mensual: parseInt(c.meta_mensual), premio_monto: parseFloat(c.premio_monto) };
};

const periodo = (anio, mes) => {
  const hoy = new Date();
  const a = parseInt(anio) || hoy.getFullYear();
  const m = parseInt(mes) || (hoy.getMonth() + 1);
  return { anio: a, mes: m };
};

// Cuantos retos logro una vendedora en un mes
const logradosDelMes = async (db, usuarioId, anio, mes) => {
  const r = await db.query(
    `SELECT COUNT(*) FILTER (WHERE logrado)::int AS logrados, COUNT(*)::int AS intentados
       FROM retos_vendedoras
      WHERE usuario_id = $1
        AND EXTRACT(YEAR FROM creado_en) = $2 AND EXTRACT(MONTH FROM creado_en) = $3`,
    [usuarioId, anio, mes]
  );
  return r.rows[0];
};

// Registrar el resultado de un reto al terminar la venta
router.post('/', async (req, res) => {
  try {
    const { usuario_id, usuario_nombre, cliente_id, cliente_nombre, venta_id, meta, vendido, local_id } = req.body;
    const metaNum = parseFloat(meta);
    const vendidoNum = parseFloat(vendido);
    if (!usuario_id) return res.status(400).json({ error: 'Falta la vendedora' });
    if (!(metaNum > 0) || isNaN(vendidoNum)) return res.status(400).json({ error: 'Datos del reto invalidos' });

    const config = await leerConfig(pool);
    const logrado = vendidoNum > metaNum;
    await pool.query(
      `INSERT INTO retos_vendedoras (usuario_id, usuario_nombre, cliente_id, cliente_nombre, venta_id, meta, vendido, logrado, local_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [usuario_id, usuario_nombre || null, cliente_id || null, cliente_nombre || null, venta_id || null, metaNum, vendidoNum, logrado, local_id || null]
    );

    const { anio, mes } = periodo();
    const { logrados, intentados } = await logradosDelMes(pool, usuario_id, anio, mes);

    // Al llegar a la meta del mes se genera el premio (uno por vendedora por mes)
    let premioNuevo = null;
    if (config.activo && logrado && config.meta_mensual > 0 && logrados >= config.meta_mensual) {
      const ins = await pool.query(
        `INSERT INTO retos_premios (usuario_id, usuario_nombre, anio, mes, retos_logrados, monto_premio, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (usuario_id, anio, mes) DO NOTHING
         RETURNING *`,
        [usuario_id, usuario_nombre || null, anio, mes, logrados, config.premio_monto, local_id || null]
      );
      premioNuevo = ins.rows[0] || null;
    }

    res.status(201).json({ logrado, logrados, intentados, meta_mensual: config.meta_mensual, premio_monto: config.premio_monto, premio_nuevo: premioNuevo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Progreso de una vendedora en el mes actual (para mostrarlo en el POS)
router.get('/mio', async (req, res) => {
  try {
    const usuarioId = parseInt(req.query.usuario_id);
    const config = await leerConfig(pool);
    if (!usuarioId) return res.json({ ...config, logrados: 0, intentados: 0 });
    const { anio, mes } = periodo();
    const { logrados, intentados } = await logradosDelMes(pool, usuarioId, anio, mes);
    const premio = await pool.query('SELECT * FROM retos_premios WHERE usuario_id = $1 AND anio = $2 AND mes = $3', [usuarioId, anio, mes]);
    res.json({ ...config, logrados, intentados, premio: premio.rows[0] || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Resumen del mes por vendedora (seccion Comisiones)
router.get('/resumen', async (req, res) => {
  try {
    const { anio, mes } = periodo(req.query.anio, req.query.mes);
    const localId = parseInt(req.query.local_id) || null;
    const config = await leerConfig(pool);
    const r = await pool.query(
      `SELECT rv.usuario_id,
              MAX(rv.usuario_nombre) AS usuario_nombre,
              COUNT(*) FILTER (WHERE rv.logrado)::int AS logrados,
              COUNT(*)::int AS intentados,
              COALESCE(SUM(rv.vendido - rv.meta) FILTER (WHERE rv.logrado), 0) AS extra_vendido
         FROM retos_vendedoras rv
        WHERE EXTRACT(YEAR FROM rv.creado_en) = $1 AND EXTRACT(MONTH FROM rv.creado_en) = $2
          AND ($3::int IS NULL OR rv.local_id = $3)
        GROUP BY rv.usuario_id
        ORDER BY logrados DESC, intentados DESC`,
      [anio, mes, localId]
    );
    const premios = await pool.query('SELECT * FROM retos_premios WHERE anio = $1 AND mes = $2', [anio, mes]);
    const premioPor = {};
    premios.rows.forEach(pr => { premioPor[pr.usuario_id] = pr; });
    res.json({
      ...config, anio, mes,
      vendedoras: r.rows.map(v => ({ ...v, extra_vendido: parseFloat(v.extra_vendido), premio: premioPor[v.usuario_id] || null })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Entregar el premio: se elige el producto (hasta el monto del premio), se descuenta del
// stock del local y queda registrado como canje de mercaderia.
router.post('/premios/:id/entregar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { producto_id, local_id, usuario_id, usuario_nombre } = req.body;
    await client.query('BEGIN');
    const pr = await client.query('SELECT * FROM retos_premios WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!pr.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Premio no encontrado' }); }
    const premio = pr.rows[0];
    if (premio.estado === 'entregado') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Este premio ya fue entregado' }); }
    if (!producto_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegi el producto del premio' }); }

    const localNum = (local_id === 2 || local_id === '2') ? 2 : 1;
    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
    const prodRes = await client.query(`SELECT nombre, precio, ${colStock} AS stock_local FROM productos WHERE id = $1`, [producto_id]);
    if (!prodRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Producto no encontrado' }); }
    const prod = prodRes.rows[0];
    const precio = parseFloat(prod.precio || 0);
    if (precio > parseFloat(premio.monto_premio)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El producto (' + precio + ') supera el valor del premio (' + premio.monto_premio + ')' });
    }
    const stockAnterior = prod.stock_local || 0;
    if (stockAnterior < 1) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay stock de ese producto en este local' }); }

    await client.query(`UPDATE productos SET ${colStock} = ${colStock} - 1, stock = stock - 1 WHERE id = $1`, [producto_id]);
    const notas = 'Premio desafios de venta ' + String(premio.mes).padStart(2, '0') + '/' + premio.anio + ' (' + premio.retos_logrados + ' retos superados)';
    const canje = await client.query(
      `INSERT INTO canjes_empleados (empleado_id, empleado_nombre, producto_id, producto_nombre, cantidad, valor_unitario, valor_total, local_id, usuario_id, usuario_nombre, notas)
       VALUES (NULL, $1, $2, $3, 1, $4, $4, $5, $6, $7, $8) RETURNING id`,
      [premio.usuario_nombre, producto_id, prod.nombre, precio, localNum, usuario_id || null, usuario_nombre || null, notas]
    );
    // El registro en ajustes_stock es opcional (no todas las copias tienen la tabla): se hace
    // dentro de un savepoint para que, si falla, no se caiga toda la entrega.
    await client.query('SAVEPOINT ajuste');
    try {
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
         VALUES ($1, $2, $3, -1, $4, $5, $6, $7)`,
        [producto_id, stockAnterior, stockAnterior - 1, 'Premio desafios: ' + (premio.usuario_nombre || ''), usuario_id || null, usuario_nombre || null, localNum]
      );
    } catch (e2) { await client.query('ROLLBACK TO SAVEPOINT ajuste'); }

    const upd = await client.query(
      `UPDATE retos_premios SET estado = 'entregado', producto_id = $1, producto_nombre = $2, valor_producto = $3,
         canje_id = $4, entregado_en = NOW(), entregado_por = $5 WHERE id = $6 RETURNING *`,
      [producto_id, prod.nombre, precio, canje.rows[0].id, usuario_nombre || null, premio.id]
    );
    await client.query('COMMIT');
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
