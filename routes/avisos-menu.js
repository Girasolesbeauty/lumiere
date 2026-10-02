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
  const [portal, pedidos, compras, tareas, control, ajustes] = await Promise.all([
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
  ]);
  res.json({ portal, pedidos, compras, tareas, 'control-inv': control, ajustes_pendientes: ajustes });
});

module.exports = router;
