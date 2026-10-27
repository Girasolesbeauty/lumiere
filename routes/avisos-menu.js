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
  const [portal, pedidos, compras, tareas, control, ajustes, traspasos, tienda, resenas, revisar] = await Promise.all([
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
    // Pedidos de la tienda web para atender (pagados o para pagar al retirar, todavia sin preparar). Los que estan pagando
    // con Mercado Pago o GoCuotas no cuentan, salvo que lleven mas de 2 horas sin pagar y nadie le haya escrito
    contar(`SELECT COUNT(*) AS n FROM tienda_pedidos t WHERE estado = 'confirmado' OR (estado = 'pendiente_pago' AND (pago NOT IN ('mp', 'gocuotas')
      OR (to_jsonb(t.*) ->> 'pago_rechazo') IS NOT NULL OR (creado_en < NOW() - INTERVAL '2 hours' AND (to_jsonb(t.*) ->> 'contactado_en') IS NULL)))`),
    // Reseñas de la tienda esperando que se revisen (tambien van en el globito de Tienda online)
    contar(`SELECT COUNT(*) AS n FROM tienda_resenas WHERE estado = 'pendiente'`),
    // Pedidos de la tienda que se cayeron (cancelados, vencidos, pago rechazado) y nadie del local miro todavia
    contar(`SELECT COUNT(*) AS n FROM tienda_pedidos t WHERE estado = 'cancelado' AND (to_jsonb(t.*) ->> 'revisado_en') IS NULL
      AND (pagado OR ((to_jsonb(t.*) ->> 'venc_motivo') IS NULL AND COALESCE(actualizado_en, creado_en) > NOW() - INTERVAL '7 days'))`),
  ]);
  res.json({ portal, pedidos, compras, tareas, 'control-inv': control, ajustes_pendientes: ajustes, traspasos_por_recibir: traspasos, 'tienda-online': tienda + resenas + revisar, resenas_pendientes: resenas });
});

// Ventas nuevas de la tienda web (para la ventana con sonido de Lumiere). ?desde=ultimo id visto.
// Sin desde (o -1) solo devuelve el ultimo id, para arrancar sin avisar lo viejo. Si la tienda nunca
// se uso (no existe la tabla), no hay nada que avisar.
router.get('/tienda-nuevos', async (req, res) => {
  try {
    const existe = (await pool.query(`SELECT to_regclass('tienda_pedidos') IS NOT NULL AS ok`)).rows[0].ok;
    if (!existe) return res.json({ ultimo: 0, pedidos: [] });
    const u = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m, to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.US') AS ahora FROM tienda_pedidos`)).rows[0];
    const ultimo = parseInt(u.m) || 0;
    const desde = parseInt(req.query.desde);
    // Los que todavia estan pagando con Mercado Pago o GoCuotas no avisan; avisan cuando el pago entra
    // (desde_t = hora de la revision anterior: los que se pagaron despues de eso, aunque ya se hayan visto "en proceso")
    const desdeT = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(String(req.query.desde_t || '')) ? req.query.desde_t : null;
    const r = desde >= 0 ? await pool.query(`SELECT id, codigo, (to_jsonb(tienda_pedidos.*) ->> 'numero') AS numero, nombre, telefono, entrega, local_id, zona, pago, pagado, estado, total, creado_en
      FROM tienda_pedidos WHERE estado <> 'cancelado' AND (
        (id > $1 AND NOT (estado = 'pendiente_pago' AND pago IN ('mp', 'gocuotas')))
        OR ($2::timestamp IS NOT NULL AND id <= $1 AND pago IN ('mp', 'gocuotas') AND pagado AND pagado_en > $2::timestamp))
      ORDER BY id LIMIT 20`, [desde, desdeT]) : { rows: [] };
    const ids = r.rows.map(p => p.id);
    const items = ids.length ? (await pool.query('SELECT * FROM tienda_pedido_items WHERE pedido_id = ANY($1) ORDER BY id', [ids])).rows : [];
    // Reseñas nuevas para revisar (?desde_res=ultimo id visto; sin el, solo el ultimo id)
    let ultimoRes = 0, resenas = [];
    if ((await pool.query(`SELECT to_regclass('tienda_resenas') IS NOT NULL AS ok`)).rows[0].ok) {
      ultimoRes = parseInt((await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM tienda_resenas')).rows[0].m) || 0;
      const desdeRes = parseInt(req.query.desde_res);
      if (desdeRes >= 0) resenas = (await pool.query(`SELECT r.id, r.estrellas, r.texto, (r.foto IS NOT NULL) AS foto, p.nombre AS producto, c.nombre AS clienta
        FROM tienda_resenas r LEFT JOIN productos p ON p.id = r.producto_id LEFT JOIN clientes c ON c.id = r.cliente_id
        WHERE r.id > $1 AND r.estado = 'pendiente' ORDER BY r.id LIMIT 10`, [desdeRes])).rows;
    }
    res.json({ ultimo, ahora: u.ahora, ultimo_res: ultimoRes, resenas, pedidos: r.rows.map(p => ({ ...p, total: Number(p.total) || 0, items: items.filter(i => i.pedido_id === p.id).map(i => ({ nombre: i.nombre, variante_valor: i.variante_valor, cantidad: i.cantidad, preventa: !!i.preventa })) })) });
  } catch (e) { res.json({ ultimo: null, pedidos: [] }); }
});

module.exports = router;
