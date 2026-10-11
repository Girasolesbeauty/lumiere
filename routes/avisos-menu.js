const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Numeros para los globitos del menu: lo que hay que atender hoy, en una sola consulta liviana.
// Cada conteo va por separado: si una tabla no existe en esta base, ese globito queda en 0.
router.get('/', async (req, res) => {
  const localNum = String(req.query.local_id) === '2' ? 2 : 1;
  const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
  const usuarioId = parseInt(req.query.usuario_id) || null;
  const contar = async (sql, params = []) => {
    try { const r = await pool.query(sql, params); return parseInt(r.rows[0].n) || 0; } catch (e) { return 0; }
  };
  const [portal, pedidos, compras, tareas, control, ajustes, traspasos, tienda] = await Promise.all([
    // Premios canjeados en el portal que falta entregar
    contar(`SELECT COUNT(*) AS n FROM canjes_premios WHERE estado = 'pendiente'`),
    // Pedidos de clientes cuya mercaderia ya llego a este local y todavia no se avisaron
    contar(`SELECT COUNT(*) AS n FROM pedidos_clientas p JOIN productos pr ON pr.id = p.producto_id
            WHERE p.estado = 'esperando' AND p.avisado = FALSE AND COALESCE(p.local_id, 1) = $1
              AND COALESCE(pr.${colStock}, 0) > 0`, [localNum]),
    // Productos que se venden y estan en o por debajo del stock minimo en este local
    contar(`SELECT COUNT(*) AS n FROM productos
            WHERE activo = TRUE AND COALESCE(stock_minimo, 0) > 0 AND COALESCE(${colStock}, 0) <= stock_minimo`),
    // Tareas sin terminar asignadas a quien esta usando el sistema
    usuarioId ? contar(`SELECT COUNT(*) AS n FROM tareas WHERE asignado_a = $1 AND estado NOT IN ('finalizada')`, [usuarioId]) : 0,
    // Si ya paso el tiempo elegido sin hacer un control de inventario (1 = toca controlar)
    contar(`SELECT CASE WHEN COALESCE(avisos_activos, TRUE) AND (ultimo_control IS NULL OR ultimo_control < NOW() - (COALESCE(dias_aviso, 30) || ' days')::interval)
                   THEN 1 ELSE 0 END AS n
            FROM (SELECT $1::int AS local_id) l LEFT JOIN config_control_inventario c ON c.local_id = l.local_id`, [localNum]),
    // Pedidos de ajuste de stock esperando aprobacion en este local
    contar(`SELECT COUNT(*) AS n FROM ajustes_pendientes WHERE estado = 'pendiente' AND local_id = $1`, [localNum]),
    // Traspasos que le mandaron a este local y nadie confirmo que llegaron
    contar(`SELECT COUNT(*) AS n FROM traspasos_stock WHERE estado = 'en_transito' AND local_destino = $1`, [localNum]),
    // Pedidos de la tienda web para atender (pagados o para pagar al retirar, todavia sin preparar)
    contar(`SELECT COUNT(*) AS n FROM tienda_pedidos WHERE estado IN ('confirmado', 'pendiente_pago')`),
  ]);
  res.json({ portal, pedidos, compras, tareas, 'control-inv': control, ajustes_pendientes: ajustes, traspasos_por_recibir: traspasos, 'tienda-online': tienda });
});

// Ventas nuevas de la tienda web (para la ventana con sonido de Lumiere). ?desde=ultimo id visto.
// Sin desde (o -1) solo devuelve el ultimo id, para arrancar sin avisar lo viejo. Si la tienda nunca
// se uso (no existe la tabla), no hay nada que avisar.
router.get('/tienda-nuevos', async (req, res) => {
  try {
    const existe = (await pool.query(`SELECT to_regclass('tienda_pedidos') IS NOT NULL AS ok`)).rows[0].ok;
    if (!existe) return res.json({ ultimo: 0, pedidos: [] });
    const ultimo = parseInt((await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM tienda_pedidos')).rows[0].m) || 0;
    const desde = parseInt(req.query.desde);
    if (!(desde >= 0)) return res.json({ ultimo, pedidos: [] });
    const r = await pool.query(`SELECT id, codigo, nombre, telefono, entrega, local_id, zona, pago, pagado, estado, total, creado_en
      FROM tienda_pedidos WHERE id > $1 AND estado <> 'cancelado' ORDER BY id LIMIT 20`, [desde]);
    const ids = r.rows.map(p => p.id);
    const items = ids.length ? (await pool.query('SELECT * FROM tienda_pedido_items WHERE pedido_id = ANY($1) ORDER BY id', [ids])).rows : [];
    res.json({ ultimo, pedidos: r.rows.map(p => ({ ...p, total: Number(p.total) || 0, items: items.filter(i => i.pedido_id === p.id).map(i => ({ nombre: i.nombre, variante_valor: i.variante_valor, cantidad: i.cantidad, preventa: !!i.preventa })) })) });
  } catch (e) { res.json({ ultimo: null, pedidos: [] }); }
});

module.exports = router;
