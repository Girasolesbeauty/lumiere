// Ventas de liquidación (Cyber Monday, Black Friday, liquidaciones...): se hicieron con mucho descuento para sacar
// mercadería lenta o parada. Esas ventas NO muestran cuánto se vende normalmente un producto, así que no tienen que
// contar para la rotación, para "Qué pedir" ni para el stock mínimo (si no, un producto que estaba parado y se
// liquidó parece "de alta rotación" y el sistema lo pide de nuevo).
//
// Un evento se reconoce igual que en Promociones › Resultado de la liquidación: promos cuyo nombre es
// "<evento> · <oferta>" o dice Cyber / liquidación, con fechas. Para no confundir una promo común de varios meses con un
// evento, solo cuentan las que duran 31 días o menos y tienen fecha de fin; las que valen para todo el negocio
// ("todo") solo si en el nombre dice Cyber, Black Friday o liquidación.
const pool = require('../config/database');

const FILTRO_EVENTO = `(pm.nombre LIKE '% · %' OR pm.nombre ILIKE '%cyber%' OR pm.nombre ILIKE '%liquidac%' OR pm.nombre ILIKE '%black%')
  AND pm.fecha_inicio IS NOT NULL AND pm.fecha_fin IS NOT NULL AND pm.fecha_fin - pm.fecha_inicio <= 31
  AND (COALESCE(pm.aplica_a, 'todo') <> 'todo' OR pm.nombre ILIKE '%cyber%' OR pm.nombre ILIKE '%liquidac%' OR pm.nombre ILIKE '%black%')`;

// Fecha de la venta en Argentina (mismo criterio que el resultado de la liquidación)
const FECHA_AR = (col) => `((((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)`;

// Condición SQL: la línea de venta (vi) es de un producto que estaba en una oferta de liquidación y se vendió
// dentro de las fechas de esa oferta. Se usa como "AND NOT (...)" para quedarse con las ventas normales,
// o sola para ver solo las de liquidación.
function sqlEsLiquidacion(vi = 'vi', v = 'v') {
  return `EXISTS (SELECT 1 FROM promociones pm WHERE ${FILTRO_EVENTO}
    AND ${FECHA_AR(v + '.creado_en')} BETWEEN pm.fecha_inicio AND pm.fecha_fin
    AND (COALESCE(pm.aplica_a, 'todo') = 'todo' OR ${vi}.producto_id = ANY(COALESCE(pm.productos_ids, '{}'::int[]))
      OR (SELECT pp.categoria FROM productos pp WHERE pp.id = ${vi}.producto_id) = ANY(COALESCE(pm.categorias, '{}'::text[]))))`;
}

// Eventos de liquidación (para calcular cuántos días del período fueron de liquidación y ponerle nombre)
async function eventos() {
  try {
    const r = await pool.query(`SELECT CASE WHEN pm.nombre LIKE '% · %' THEN split_part(pm.nombre, ' · ', 1) ELSE pm.nombre END AS evento,
        pm.fecha_inicio::text AS desde, pm.fecha_fin::text AS hasta, COALESCE(pm.aplica_a, 'todo') AS aplica_a,
        COALESCE(pm.productos_ids, '{}'::int[]) AS productos_ids, COALESCE(pm.categorias, '{}'::text[]) AS categorias
      FROM promociones pm WHERE ${FILTRO_EVENTO}`);
    return r.rows.map(x => ({
      evento: x.evento, aplica_a: x.aplica_a, ids: (x.productos_ids || []).map(Number), cats: x.categorias || [],
      desdeMs: new Date(x.desde + 'T00:00:00-03:00').getTime(), hastaMs: new Date(x.hasta + 'T00:00:00-03:00').getTime() + 864e5,
    }));
  } catch (e) { console.error('[liquidacion] eventos:', e.message); return []; }
}

const aplica = (ev, prod) => ev.aplica_a === 'todo' || ev.ids.includes(Number(prod.id)) || (prod.categoria && ev.cats.includes(prod.categoria));

// Cuántos días de [desdeMs, hastaMs] estuvo el producto en liquidación (sin contar dos veces los eventos que se pisan)
function diasEnLiquidacion(evs, prod, desdeMs, hastaMs) {
  const tramos = evs.filter(e => aplica(e, prod)).map(e => [Math.max(e.desdeMs, desdeMs), Math.min(e.hastaMs, hastaMs)]).filter(t => t[1] > t[0]).sort((a, b) => a[0] - b[0]);
  let total = 0, fin = -Infinity;
  tramos.forEach(([a, b]) => { const ini = Math.max(a, fin); if (b > ini) total += b - ini; fin = Math.max(fin, b); });
  return Math.ceil(total / 864e5);
}

// Nombre del último evento de liquidación en que estuvo el producto (para la etiqueta)
function eventoDe(evs, prod) {
  const l = evs.filter(e => aplica(e, prod)).sort((a, b) => b.hastaMs - a.hastaMs);
  return l.length ? l[0].evento : 'liquidación';
}

module.exports = { sqlEsLiquidacion, eventos, diasEnLiquidacion, eventoDe, FECHA_AR };
