// "En camino" de cada producto: lo que falta recibir en las ordenes de ingreso (renglones de cada local que todavia no
// se revisaron, de ordenes no anuladas). Se recalcula desde las ordenes para que nunca quede "en camino" algo que ya
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
  const r = await db.query(`WITH t AS (${SQL_PENDIENTE} ${lista ? 'AND i.producto_id = ANY($1)' : ''} GROUP BY i.producto_id)
    UPDATE productos p SET stock_transito_rg = COALESCE(t.rg, 0), stock_transito_ush = COALESCE(t.ush, 0)
    FROM productos p0 LEFT JOIN t ON t.producto_id = p0.id
    WHERE p.id = p0.id ${lista ? 'AND p0.id = ANY($1)' : ''}
      AND (COALESCE(p.stock_transito_rg, 0) <> COALESCE(t.rg, 0) OR COALESCE(p.stock_transito_ush, 0) <> COALESCE(t.ush, 0))
    RETURNING p.id, p.nombre, p.stock_transito_rg, p.stock_transito_ush`, lista ? [lista] : []);
  return r.rows;
}

// Una vez por negocio (al arrancar el servidor): corrige lo que haya quedado mal de antes
const revisado = porNegocio(false);
async function revisarTransitoUnaVez() {
  if (revisado.get()) return;
  revisado.set(true);
  try {
    const c = await recalcularTransito();
    if (c.length) console.log('[transito] corregidos', c.length, 'productos:', c.slice(0, 10).map(x => x.nombre).join(', '));
  } catch (e) { revisado.set(false); console.error('[transito]', e.message); }
}

module.exports = { recalcularTransito, revisarTransitoUnaVez };
