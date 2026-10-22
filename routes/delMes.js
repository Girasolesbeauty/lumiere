// 🏆 Del mes: la vendedora que mas vendio en el mes (premio que pone la dueña) y la clienta del mes (un regalo).
// Arranca de cero cada mes (se calcula con las ventas del mes). Las vendedoras ven el ranking sin montos;
// la clienta del mes y los montos los ve solo la dueña (o admin / administrativa).
const express = require('express');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
const { VENTA_VALIDA } = require('../lib/niveles');

const router = express.Router();
const n = (x) => parseFloat(x) || 0;
const esJefe = (req) => req.usuario && (['jefe', 'admin', 'administrativo'].includes(req.usuario.rol) || Number(req.usuario.rol_id) === 1);

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS del_mes_config (id INT PRIMARY KEY DEFAULT 1, premio_vendedora TEXT, premio_clienta TEXT, criterio_clienta TEXT DEFAULT 'monto')`);
  await pool.query(`INSERT INTO del_mes_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await pool.query(`CREATE TABLE IF NOT EXISTS del_mes_entregas (
    anio INT NOT NULL, mes INT NOT NULL, tipo TEXT NOT NULL, ganador_id INT, nombre TEXT, entregado_en TIMESTAMP DEFAULT NOW(), PRIMARY KEY (anio, mes, tipo))`);
  listo.set(true);
}
const config = async () => (await pool.query('SELECT premio_vendedora, premio_clienta, criterio_clienta FROM del_mes_config WHERE id = 1')).rows[0] || {};

// Ganadores de un mes (o el ranking entero): vendedoras por lo vendido; clientas por monto o por cantidad de compras
const VEND = (lim) => `SELECT u.id, u.nombre, COUNT(*)::int AS cant, SUM(v.total) AS total FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
  WHERE ${VENTA_VALIDA} AND v.creado_en >= $1 AND v.creado_en < $2 GROUP BY u.id, u.nombre ORDER BY total DESC LIMIT ${lim}`;
const CLI = (criterio, lim) => `SELECT c.id, c.nombre, c.telefono, COUNT(*)::int AS cant, SUM(v.total) AS total FROM ventas v JOIN clientes c ON c.id = v.cliente_id
  WHERE ${VENTA_VALIDA} AND v.creado_en >= $1 AND v.creado_en < $2 GROUP BY c.id, c.nombre, c.telefono ORDER BY ${criterio === 'compras' ? 'cant DESC, total DESC' : 'total DESC'} LIMIT ${lim}`;

router.get('/', async (req, res) => {
  try {
    await asegurar();
    const jefe = esJefe(req);
    const hoy = (await pool.query(`SELECT EXTRACT(YEAR FROM NOW())::int AS a, EXTRACT(MONTH FROM NOW())::int AS m`)).rows[0];
    let anio = parseInt(req.query.anio) || hoy.a, mes = parseInt(req.query.mes) || hoy.m;
    if (mes < 1 || mes > 12 || anio * 12 + mes > hoy.a * 12 + hoy.m) { anio = hoy.a; mes = hoy.m; }
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const P = [desde, (await pool.query(`SELECT ($1::date + INTERVAL '1 month')::date AS h`, [desde])).rows[0].h];
    const cfg = await config();
    const [vend, cli, ent] = await Promise.all([
      pool.query(VEND(20), P), jefe ? pool.query(CLI(cfg.criterio_clienta, 5), P) : { rows: [] },
      pool.query('SELECT tipo, ganador_id, nombre, entregado_en FROM del_mes_entregas WHERE anio = $1 AND mes = $2', [anio, mes]),
    ]);
    const lider = vend.rows.length ? n(vend.rows[0].total) : 0;
    // Historial: el primer puesto de los ultimos 6 meses cerrados
    const hist = async (sql) => (await pool.query(`WITH m AS (SELECT generate_series(date_trunc('month', NOW()) - INTERVAL '6 months', date_trunc('month', NOW()) - INTERVAL '1 month', INTERVAL '1 month') AS d)
      SELECT EXTRACT(YEAR FROM m.d)::int AS anio, EXTRACT(MONTH FROM m.d)::int AS mes, g.* FROM m LEFT JOIN LATERAL (${sql.replace(/\$1/g, 'm.d').replace(/\$2/g, "(m.d + INTERVAL '1 month')")}) g ON TRUE ORDER BY m.d DESC`)).rows;
    const [hv, hc, he] = await Promise.all([hist(VEND(1)), jefe ? hist(CLI(cfg.criterio_clienta, 1)) : [],
      pool.query(`SELECT anio, mes, tipo, entregado_en FROM del_mes_entregas WHERE make_date(anio, mes, 1) >= date_trunc('month', NOW()) - INTERVAL '6 months'`)]);
    const entregado = (a, m, t) => !!he.rows.find(x => x.anio === a && x.mes === m && x.tipo === t);
    res.json({
      anio, mes, actual: anio === hoy.a && mes === hoy.m, jefe,
      premio_vendedora: cfg.premio_vendedora || '', premio_clienta: jefe ? cfg.premio_clienta || '' : undefined, criterio_clienta: jefe ? cfg.criterio_clienta || 'monto' : undefined,
      vendedoras: vend.rows.map((v, i) => ({ puesto: i + 1, id: v.id, nombre: v.nombre, pct: lider ? Math.round(n(v.total) / lider * 100) : 0, ...(jefe ? { total: n(v.total), cant: v.cant } : {}) })),
      clientas: cli.rows.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono, cant: c.cant, total: n(c.total) })),
      entregas: ent.rows,
      historial: hv.map((v, i) => ({ anio: v.anio, mes: v.mes, vendedora: v.id ? { id: v.id, nombre: v.nombre } : null, vendedora_entregado: entregado(v.anio, v.mes, 'vendedora'),
        ...(jefe ? { clienta: hc[i] && hc[i].id ? { id: hc[i].id, nombre: hc[i].nombre, telefono: hc[i].telefono } : null, clienta_entregado: entregado(v.anio, v.mes, 'clienta') } : {}) })),
    });
  } catch (e) { console.error('[del mes]', e.message); res.status(500).json({ error: 'No se pudo armar el ranking' }); }
});

router.put('/config', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  try {
    await asegurar();
    const b = req.body || {};
    await pool.query('UPDATE del_mes_config SET premio_vendedora = $1, premio_clienta = $2, criterio_clienta = $3 WHERE id = 1',
      [String(b.premio_vendedora || '').trim().slice(0, 200) || null, String(b.premio_clienta || '').trim().slice(0, 200) || null, b.criterio_clienta === 'compras' ? 'compras' : 'monto']);
    res.json(await config());
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Marcar (o desmarcar) que ya se entrego el premio de un mes
router.post('/entregado', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  try {
    await asegurar();
    const b = req.body || {}, anio = parseInt(b.anio), mes = parseInt(b.mes), tipo = b.tipo === 'clienta' ? 'clienta' : 'vendedora';
    if (!anio || !(mes >= 1 && mes <= 12)) return res.status(400).json({ error: 'Mes inválido' });
    if (b.entregado === false) await pool.query('DELETE FROM del_mes_entregas WHERE anio = $1 AND mes = $2 AND tipo = $3', [anio, mes, tipo]);
    else await pool.query(`INSERT INTO del_mes_entregas (anio, mes, tipo, ganador_id, nombre) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (anio, mes, tipo) DO UPDATE SET ganador_id = EXCLUDED.ganador_id, nombre = EXCLUDED.nombre, entregado_en = NOW()`,
      [anio, mes, tipo, parseInt(b.ganador_id) || null, String(b.nombre || '').slice(0, 120) || null]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

module.exports = router;
