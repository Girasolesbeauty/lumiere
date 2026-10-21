// Resumen semanal para la dueña: la semana pasada (lunes a domingo) contra la anterior.
// Ventas por local, lo mas vendido, lo que se esta por agotar, pedidos de la tienda online y clientas nuevas.
// ?atras=N mira N semanas mas para atras (0 = la ultima semana completa).
const express = require('express');
const pool = require('../config/database');
const { VENTA_VALIDA } = require('../lib/niveles');
const { muestrasDe } = require('../lib/tienda');

const router = express.Router();
const n = (x) => parseFloat(x) || 0;
const esJefe = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const q = async (sql, params) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return []; } };

router.get('/', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  try {
    const atras = Math.min(52, Math.max(0, parseInt(req.query.atras) || 0));
    const VV = VENTA_VALIDA;
    // $1 = lunes de la semana a mirar, $2 = lunes siguiente, $3 = lunes de la semana anterior
    const sem = (await pool.query(`SELECT date_trunc('week', NOW()) - ($1::int + 1) * INTERVAL '7 days' AS desde,
      date_trunc('week', NOW()) - $1::int * INTERVAL '7 days' AS hasta, date_trunc('week', NOW()) - ($1::int + 2) * INTERVAL '7 days' AS antes,
      to_char(date_trunc('week', NOW()) - ($1::int + 1) * INTERVAL '7 days', 'YYYY-MM-DD') AS desde_txt, to_char(date_trunc('week', NOW()) - $1::int * INTERVAL '7 days' - INTERVAL '1 day', 'YYYY-MM-DD') AS hasta_txt`, [atras])).rows[0];
    const P = [sem.desde, sem.hasta, sem.antes];
    const [locales, top, dias, vendedoras, web, clientas, agotan, cfgT] = await Promise.all([
      q(`SELECT l.id, l.nombre,
           COALESCE(SUM(v.total) FILTER (WHERE v.creado_en >= $1), 0) AS total, COUNT(v.id) FILTER (WHERE v.creado_en >= $1) AS cant,
           COALESCE(SUM(v.total) FILTER (WHERE v.creado_en < $1), 0) AS total_ant, COUNT(v.id) FILTER (WHERE v.creado_en < $1) AS cant_ant
         FROM locales l LEFT JOIN ventas v ON v.local_id = l.id AND ${VV} AND v.creado_en >= $3 AND v.creado_en < $2
         WHERE COALESCE(l.activo, TRUE) GROUP BY l.id, l.nombre ORDER BY l.id`, P),
      q(`SELECT p.id, p.nombre, p.marca, SUM(vi.cantidad)::int AS unidades, COALESCE(SUM(vi.subtotal), 0) AS total
         FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
         WHERE ${VV} AND v.creado_en >= $1 AND v.creado_en < $2 GROUP BY p.id ORDER BY 4 DESC, 5 DESC LIMIT 5`, P.slice(0, 2)),
      q(`SELECT EXTRACT(ISODOW FROM v.creado_en)::int AS dow, SUM(v.total) AS total FROM ventas v
         WHERE ${VV} AND v.creado_en >= $1 AND v.creado_en < $2 GROUP BY 1 ORDER BY 2 DESC`, P.slice(0, 2)),
      q(`SELECT u.nombre, COUNT(*) AS cant, SUM(v.total) AS total FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${VV} AND v.creado_en >= $1 AND v.creado_en < $2 GROUP BY 1 ORDER BY 3 DESC LIMIT 3`, P.slice(0, 2)),
      q(`SELECT COUNT(*) FILTER (WHERE creado_en >= $1) AS cant, COALESCE(SUM(total) FILTER (WHERE creado_en >= $1), 0) AS total,
           COUNT(*) FILTER (WHERE creado_en < $1) AS cant_ant, COALESCE(SUM(total) FILTER (WHERE creado_en < $1), 0) AS total_ant
         FROM tienda_pedidos WHERE estado <> 'cancelado' AND creado_en >= $3 AND creado_en < $2`, P),
      q(`SELECT COUNT(*) FILTER (WHERE creado_en >= $1) AS nuevas, COUNT(*) FILTER (WHERE creado_en < $1) AS nuevas_ant
         FROM clientes WHERE creado_en >= $3 AND creado_en < $2`, P),
      // Lo que se agota: vendido en las ultimas 4 semanas y con stock para menos de 2 semanas a ese ritmo (contando lo que viene en camino)
      q(`WITH r AS (SELECT vi.producto_id, SUM(vi.cantidad) AS vend FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
           WHERE ${VV} AND v.creado_en >= NOW() - INTERVAL '28 days' GROUP BY 1)
         SELECT p.id, p.nombre, p.marca, GREATEST(COALESCE(p.stock_rg, 0), 0) + GREATEST(COALESCE(p.stock_ush, 0), 0) AS stock,
           COALESCE(p.stock_transito_rg, 0) + COALESCE(p.stock_transito_ush, 0) AS camino, r.vend::int AS vendidos_28
         FROM r JOIN productos p ON p.id = r.producto_id WHERE p.activo = TRUE
           AND (GREATEST(COALESCE(p.stock_rg, 0), 0) + GREATEST(COALESCE(p.stock_ush, 0), 0) + COALESCE(p.stock_transito_rg, 0) + COALESCE(p.stock_transito_ush, 0)) < r.vend / 2.0
         ORDER BY (GREATEST(COALESCE(p.stock_rg, 0), 0) + GREATEST(COALESCE(p.stock_ush, 0), 0)) / r.vend, r.vend DESC LIMIT 8`, []),
      q(`SELECT muestras FROM tienda_config WHERE id = 1`, []),
    ]);
    const total = locales.reduce((t, l) => t + n(l.total), 0), totalAnt = locales.reduce((t, l) => t + n(l.total_ant), 0);
    const cant = locales.reduce((t, l) => t + n(l.cant), 0), cantAnt = locales.reduce((t, l) => t + n(l.cant_ant), 0);
    const w = web[0] || {}, c = clientas[0] || {};
    const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    res.json({
      desde: sem.desde_txt, hasta: sem.hasta_txt, atras,
      total, total_ant: totalAnt, cant, cant_ant: cantAnt,
      ticket: cant ? total / cant : 0, ticket_ant: cantAnt ? totalAnt / cantAnt : 0,
      locales: locales.map(l => ({ id: l.id, nombre: l.nombre, total: n(l.total), total_ant: n(l.total_ant), cant: n(l.cant) })),
      top: top.map(p => ({ id: p.id, nombre: p.nombre, marca: p.marca, unidades: n(p.unidades), total: n(p.total) })),
      mejor_dia: dias.length ? { dia: DIAS[dias[0].dow], total: n(dias[0].total) } : null,
      vendedoras: vendedoras.map(v => ({ nombre: v.nombre, cant: n(v.cant), total: n(v.total) })),
      web: { cant: n(w.cant), total: n(w.total), cant_ant: n(w.cant_ant), total_ant: n(w.total_ant) },
      clientas: { nuevas: n(c.nuevas), nuevas_ant: n(c.nuevas_ant) },
      // Envases de muestras gratis que se estan terminando (10 o menos en un local)
      envases_bajos: (() => { const m = muestrasDe(cfgT[0] || {}); return m.activo ? locales.filter(l => m.envases[l.id] !== undefined && m.envases[l.id] <= 10).map(l => ({ nombre: l.nombre, quedan: m.envases[l.id] })) : []; })(),
      agotan: agotan.map(p => ({ id: p.id, nombre: p.nombre, marca: p.marca, stock: n(p.stock), camino: n(p.camino), vendidos_28: n(p.vendidos_28) })),
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo armar el resumen' }); }
});

module.exports = router;
