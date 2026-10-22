// 🏆 Competencia del mes entre clientas: cada clienta suma "puntos del mes" con sus compras (1 punto cada $100,
// igual que los puntos de la tarjeta) y ve su puesto en su cuenta de la tienda. Arranca de cero cada mes.
// Al terminar el mes, la dueña lo cierra y cada puesto con premio se lo lleva (texto + puntos extra opcionales);
// los premios se configuran por puesto y se pueden cambiar mes a mes (el cierre guarda el premio de ese momento).
const pool = require('../config/database');
const { porNegocio } = require('./contexto');
const { VENTA_VALIDA } = require('./niveles');

const PESOS_POR_PUNTO = 100;
const n = (x) => parseFloat(x) || 0;
const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS del_mes_config (id INT PRIMARY KEY DEFAULT 1, premio_vendedora TEXT, premio_clienta TEXT, criterio_clienta TEXT DEFAULT 'monto')`);
  await pool.query(`INSERT INTO del_mes_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await pool.query(`ALTER TABLE del_mes_config ADD COLUMN IF NOT EXISTS comp_activo BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE del_mes_config ADD COLUMN IF NOT EXISTS comp_premios JSONB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS competencia_ganadoras (
    anio INT NOT NULL, mes INT NOT NULL, cliente_id INT NOT NULL, puesto INT NOT NULL, puntos_mes INT, premio TEXT, puntos_extra INT DEFAULT 0,
    entregado_en TIMESTAMP, creado_en TIMESTAMP DEFAULT NOW(), PRIMARY KEY (anio, mes, cliente_id))`);
  listo.set(true);
}
// Premios por puesto: [{ desde, hasta, premio, puntos }] (ej: 1-1 "Kit de skincare", 4-10 "200 puntos")
const premiosDe = (lista) => (Array.isArray(lista) ? lista : []).map(p => {
  const desde = Math.max(1, Math.min(100, parseInt(p && p.desde) || 1));
  return { desde, hasta: Math.max(desde, Math.min(100, parseInt(p && p.hasta) || desde)), premio: String((p && p.premio) || '').trim().slice(0, 120), puntos: Math.max(0, Math.min(100000, parseInt(p && p.puntos) || 0)) };
}).filter(p => p.premio || p.puntos).sort((a, b) => a.desde - b.desde).slice(0, 12);
const premioDePuesto = (premios, puesto) => premios.find(p => puesto >= p.desde && puesto <= p.hasta) || null;
async function config() {
  await asegurar();
  const c = (await pool.query('SELECT comp_activo, comp_premios FROM del_mes_config WHERE id = 1')).rows[0] || {};
  return { activo: !!c.comp_activo, premios: premiosDe(c.comp_premios) };
}
// Mes actual (segun la base) y limites de un mes
async function mesDe(anio, mes) {
  const hoy = (await pool.query(`SELECT EXTRACT(YEAR FROM NOW())::int AS a, EXTRACT(MONTH FROM NOW())::int AS m`)).rows[0];
  let a = parseInt(anio) || hoy.a, m = parseInt(mes) || hoy.m;
  if (m < 1 || m > 12 || a * 12 + m > hoy.a * 12 + hoy.m) { a = hoy.a; m = hoy.m; }
  const desde = `${a}-${String(m).padStart(2, '0')}-01`;
  const hasta = (await pool.query(`SELECT ($1::date + INTERVAL '1 month')::date AS h`, [desde])).rows[0].h;
  return { anio: a, mes: m, desde, hasta, actual: a === hoy.a && m === hoy.m };
}
// Ranking del mes: todas las clientas con compras (en el local o en la tienda), por puntos del mes
async function ranking(desde, hasta) {
  const r = await pool.query(`SELECT c.id, c.nombre, c.telefono, COUNT(*)::int AS compras, SUM(v.total) AS total
    FROM ventas v JOIN clientes c ON c.id = v.cliente_id WHERE ${VENTA_VALIDA} AND v.creado_en >= $1 AND v.creado_en < $2
    GROUP BY c.id, c.nombre, c.telefono HAVING SUM(v.total) > 0 ORDER BY SUM(v.total) DESC, MIN(v.creado_en) ASC`, [desde, hasta]);
  return r.rows.map((x, i) => ({ puesto: i + 1, id: x.id, nombre: x.nombre, telefono: x.telefono, compras: x.compras, total: n(x.total), puntos: Math.floor(n(x.total) / PESOS_POR_PUNTO) }));
}
// "Sofía R." (para mostrar el podio a las clientas sin datos de nadie)
const nombreCorto = (nom) => { const p = String(nom || '').trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : '') : 'Clienta'; };

// Lo que ve una clienta en su cuenta
async function deClienta(clienteId) {
  const cfg = await config();
  if (!cfg.activo) return null;
  const m = await mesDe();
  const rk = await ranking(m.desde, m.hasta);
  const yo = rk.find(x => x.id === Number(clienteId));
  const arriba = yo && yo.puesto > 1 ? rk[yo.puesto - 2] : null;
  const ganados = (await pool.query(`SELECT anio, mes, puesto, premio, puntos_extra, entregado_en FROM competencia_ganadoras WHERE cliente_id = $1 AND make_date(anio, mes, 1) >= date_trunc('month', NOW()) - INTERVAL '3 months' ORDER BY anio DESC, mes DESC`, [clienteId])).rows;
  return {
    anio: m.anio, mes: m.mes, participantes: rk.length,
    puesto: yo ? yo.puesto : null, puntos: yo ? yo.puntos : 0,
    faltan: yo && arriba ? Math.max(1, arriba.puntos - yo.puntos + 1) : !yo && rk.length ? null : 0,
    podio: rk.slice(0, 3).map(x => ({ puesto: x.puesto, nombre: nombreCorto(x.nombre), yo: x.id === Number(clienteId) })),
    premios: cfg.premios,
    ganados: ganados.map(g => ({ anio: g.anio, mes: g.mes, puesto: g.puesto, premio: g.premio, puntos: g.puntos_extra, entregado: !!g.entregado_en })),
  };
}

module.exports = { asegurar, config, premiosDe, premioDePuesto, mesDe, ranking, deClienta, PESOS_POR_PUNTO };
