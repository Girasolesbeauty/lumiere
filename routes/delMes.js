// 🏆 Clienta del mes: la competencia entre clientas (ver lib/competencia.js). Aca la dueña ve el ranking con
// nombres y montos, configura los premios por puesto, cierra el mes (reparte premios y puntos) y marca lo entregado.
const express = require('express');
const pool = require('../config/database');
const comp = require('../lib/competencia');

const router = express.Router();
const esJefe = (req) => req.usuario && (['jefe', 'admin', 'administrativo'].includes(req.usuario.rol) || Number(req.usuario.rol_id) === 1);
router.use((req, res, next) => esJefe(req) ? next() : res.status(403).json({ error: 'Solo la dueña o encargada' }));

router.get('/', async (req, res) => {
  try {
    const cfg = await comp.config();
    const m = await comp.mesDe(req.query.anio, req.query.mes);
    const [rk, cerradas, hist] = await Promise.all([
      comp.ranking(m.desde, m.hasta),
      pool.query(`SELECT g.*, c.nombre, c.telefono FROM competencia_ganadoras g JOIN clientes c ON c.id = g.cliente_id WHERE anio = $1 AND mes = $2 ORDER BY puesto`, [m.anio, m.mes]),
      pool.query(`SELECT g.anio, g.mes, COUNT(*)::int AS ganadoras, COUNT(g.entregado_en)::int AS entregados, MIN(c.nombre) FILTER (WHERE g.puesto = 1) AS primera
        FROM competencia_ganadoras g JOIN clientes c ON c.id = g.cliente_id GROUP BY 1, 2 ORDER BY 1 DESC, 2 DESC LIMIT 12`),
    ]);
    res.json({
      ...cfg, anio: m.anio, mes: m.mes, actual: m.actual,
      ranking: rk.slice(0, 50).map(x => ({ ...x, premio: comp.premioDePuesto(cfg.premios, x.puesto) })), participantes: rk.length,
      cerrado: cerradas.rows.length > 0,
      ganadoras: cerradas.rows.map(g => ({ cliente_id: g.cliente_id, nombre: g.nombre, telefono: g.telefono, puesto: g.puesto, puntos_mes: g.puntos_mes, premio: g.premio, puntos_extra: g.puntos_extra, entregado: !!g.entregado_en })),
      historial: hist.rows,
    });
  } catch (e) { console.error('[clienta del mes]', e.message); res.status(500).json({ error: 'No se pudo armar el ranking' }); }
});

router.put('/config', async (req, res) => {
  try {
    await comp.asegurar();
    const b = req.body || {};
    await pool.query('UPDATE del_mes_config SET comp_activo = $1, comp_premios = $2 WHERE id = 1', [!!b.activo, JSON.stringify(comp.premiosDe(b.premios))]);
    res.json(await comp.config());
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Cerrar un mes terminado: cada puesto con premio queda anotado (con el premio de ese momento) y se suman los puntos extra
router.post('/cerrar', async (req, res) => {
  const client = await pool.connect();
  try {
    const cfg = await comp.config();
    const m = await comp.mesDe(req.body && req.body.anio, req.body && req.body.mes);
    if (m.actual) return res.status(400).json({ error: 'El mes todavía no terminó' });
    if (!cfg.premios.length) return res.status(400).json({ error: 'Primero cargá los premios por puesto' });
    const rk = await comp.ranking(m.desde, m.hasta);
    await client.query('BEGIN');
    if ((await client.query('SELECT 1 FROM competencia_ganadoras WHERE anio = $1 AND mes = $2 LIMIT 1 FOR UPDATE', [m.anio, m.mes])).rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese mes ya se cerró' }); }
    let n = 0;
    for (const x of rk) {
      const p = comp.premioDePuesto(cfg.premios, x.puesto);
      if (!p) continue;
      await client.query(`INSERT INTO competencia_ganadoras (anio, mes, cliente_id, puesto, puntos_mes, premio, puntos_extra, entregado_en) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [m.anio, m.mes, x.id, x.puesto, x.puntos, p.premio || null, p.puntos, !p.premio && p.puntos ? new Date() : null]);
      if (p.puntos > 0) await client.query('UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2', [p.puntos, x.id]);
      n++;
    }
    await client.query('COMMIT');
    res.json({ ok: true, ganadoras: n });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); console.error('[clienta del mes] cerrar:', e.message); res.status(500).json({ error: 'No se pudo cerrar el mes' }); }
  finally { client.release(); }
});

// Marcar (o desmarcar) que una ganadora ya recibio su premio
router.post('/entregado', async (req, res) => {
  try {
    await comp.asegurar();
    const b = req.body || {};
    await pool.query(`UPDATE competencia_ganadoras SET entregado_en = ${b.entregado === false ? 'NULL' : 'NOW()'} WHERE anio = $1 AND mes = $2 AND cliente_id = $3`, [parseInt(b.anio), parseInt(b.mes), parseInt(b.cliente_id)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

module.exports = router;
