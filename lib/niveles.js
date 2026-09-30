// Niveles de fidelizacion: salen de lo que la clienta COMPRO EN TOTAL (ventas validas + compras
// anteriores migradas), no de los puntos disponibles. Asi, si canjea puntos por un premio, no baja
// de nivel. Los montos de cada nivel son configurables por negocio (Clientes -> Niveles).
const pool = require('../config/database');

const NIVELES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Black'];
const UMBRALES_POR_DEFECTO = { Silver: 50000, Gold: 100000, Platinum: 200000, Black: 500000 };

const VENTA_VALIDA = `COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
  AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')`;

let columnaLista = false;
async function asegurarColumna(db) {
  if (columnaLista) return;
  await db.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS niveles_umbrales JSONB');
  columnaLista = true;
}

async function obtenerUmbrales(db = pool) {
  try {
    await asegurarColumna(db);
    const r = await db.query('SELECT niveles_umbrales FROM configuracion_negocio WHERE id = 1');
    const u = r.rows[0] && r.rows[0].niveles_umbrales;
    if (u && typeof u === 'object') return { ...UMBRALES_POR_DEFECTO, ...u };
  } catch (e) { /* sin tabla de configuracion: valores por defecto */ }
  return { ...UMBRALES_POR_DEFECTO };
}

function nivelPorGasto(gasto, umbrales) {
  const g = parseFloat(gasto) || 0;
  if (g >= umbrales.Black) return 'Black';
  if (g >= umbrales.Platinum) return 'Platinum';
  if (g >= umbrales.Gold) return 'Gold';
  if (g >= umbrales.Silver) return 'Silver';
  return 'Bronze';
}

// SQL con lo que gasto cada clienta (ventas validas + compras migradas)
async function sqlGasto(db) {
  const hayMig = await db.query(`SELECT to_regclass('migracion_puntos') AS t`);
  return `SELECT c.id,
      COALESCE((SELECT SUM(v.total) FROM ventas v WHERE v.cliente_id = c.id AND ${VENTA_VALIDA}), 0)
      ${hayMig.rows[0].t ? '+ COALESCE((SELECT SUM(m.monto) FROM migracion_puntos m WHERE m.cliente_id = c.id), 0)' : ''} AS gasto
    FROM clientes c`;
}

// Recalcula el nivel de una clienta (usar dentro de la misma transaccion de la venta/anulacion)
async function recalcularNivel(db, clienteId) {
  if (!clienteId) return null;
  const umbrales = await obtenerUmbrales(db);
  const r = await db.query(`SELECT gasto FROM (${await sqlGasto(db)}) g WHERE g.id = $1`, [clienteId]);
  if (!r.rows.length) return null;
  const nivel = nivelPorGasto(r.rows[0].gasto, umbrales);
  await db.query('UPDATE clientes SET nivel = $1 WHERE id = $2', [nivel, clienteId]);
  return nivel;
}

// Recalcula todas (al cambiar los montos de los niveles)
async function recalcularTodos(db = pool) {
  const u = await obtenerUmbrales(db);
  const r = await db.query(`
    UPDATE clientes c SET nivel = CASE
        WHEN g.gasto >= $4 THEN 'Black' WHEN g.gasto >= $3 THEN 'Platinum'
        WHEN g.gasto >= $2 THEN 'Gold' WHEN g.gasto >= $1 THEN 'Silver' ELSE 'Bronze' END
    FROM (${await sqlGasto(db)}) g
    WHERE g.id = c.id
    RETURNING c.id`, [u.Silver, u.Gold, u.Platinum, u.Black]);
  return r.rowCount;
}

module.exports = { NIVELES, UMBRALES_POR_DEFECTO, obtenerUmbrales, nivelPorGasto, recalcularNivel, recalcularTodos, asegurarColumna };
