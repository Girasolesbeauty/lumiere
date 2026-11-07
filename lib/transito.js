// "En camino" de cada producto: lo que falta recibir en las ordenes de ingreso (renglones de cada local que todavia no
// se revisaron, de ordenes no anuladas) mas los traspasos entre locales que todavia no se recibieron. Se recalcula desde las ordenes para que nunca quede "en camino" algo que ya
// no esta en ninguna orden (antes, si se recibia menos de lo esperado, la diferencia quedaba en camino para siempre).
const pool = require('../config/database');
const { porNegocio } = require('./contexto');

const SQL_PENDIENTE = `SELECT i.producto_id,
    SUM(CASE WHEN NOT COALESCE(i.revisado_rg, FALSE) THEN GREATEST(COALESCE(i.cantidad_rg, 0), 0) ELSE 0 END) AS rg,
    SUM(CASE WHEN NOT COALESCE(i.revisado_ush, FALSE) THEN GREATEST(COALESCE(i.cantidad_ush, 0), 0) ELSE 0 END) AS ush
  FROM ordenes_ingreso_items i JOIN ordenes_ingreso o ON o.id = i.orden_id
  WHERE i.producto_id IS NOT NULL AND COALESCE(o.estado, 'pendiente') <> 'anulada'`;

// ids: solo esos productos; sin ids, todos. Devuelve los productos que se corrigieron.
async function recalcularTransito(db = pool, ids = null) {
  const lista = Array.isArray(ids) ? [...new Set(ids.map(Number).filter(n => n > 0))] : null;
  if (lista && !lista.length) return [];
  // Traspasos entre locales que todavía no se recibieron: también están "en camino" al local de destino
  const hayTraspasos = !!(await db.query(`SELECT to_regclass('traspasos_stock') AS t`)).rows[0].t;
  const SQL_TRASPASOS = hayTraspasos ? `UNION ALL SELECT producto_id, SUM(CASE WHEN local_destino = 1 THEN cantidad ELSE 0 END), SUM(CASE WHEN local_destino = 2 THEN cantidad ELSE 0 END)
    FROM traspasos_stock WHERE COALESCE(estado, '') <> 'recibido' AND cantidad > 0 ${lista ? 'AND producto_id = ANY($1)' : ''} GROUP BY producto_id` : '';
  const r = await db.query(`WITH t0 AS (${SQL_PENDIENTE} ${lista ? 'AND i.producto_id = ANY($1)' : ''} GROUP BY i.producto_id ${SQL_TRASPASOS}),
    t AS (SELECT producto_id, SUM(rg) AS rg, SUM(ush) AS ush FROM t0 GROUP BY producto_id)
    UPDATE productos p SET stock_transito_rg = COALESCE(t.rg, 0), stock_transito_ush = COALESCE(t.ush, 0)
    FROM productos p0 LEFT JOIN t ON t.producto_id = p0.id
    WHERE p.id = p0.id ${lista ? 'AND p0.id = ANY($1)' : ''}
      AND (COALESCE(p.stock_transito_rg, 0) <> COALESCE(t.rg, 0) OR COALESCE(p.stock_transito_ush, 0) <> COALESCE(t.ush, 0))
    RETURNING p.id, p.nombre, p.stock_transito_rg, p.stock_transito_ush`, lista ? [lista] : []);
  return r.rows;
}

// Una vez por negocio (al arrancar el servidor): corrige lo que haya quedado mal de antes
const revisado = porNegocio(false); // (v2: ahora con traspasos)
async function revisarTransitoUnaVez() {
  if (revisado.get()) return;
  revisado.set(true);
  try {
    const c = await recalcularTransito();
    if (c.length) console.log('[transito] corregidos', c.length, 'productos:', c.slice(0, 10).map(x => x.nombre).join(', '));
  } catch (e) { revisado.set(false); console.error('[transito]', e.message); }
}

module.exports = { recalcularTransito, revisarTransitoUnaVez };
