// 🧪 Testers: cada vez que se abre un producto para tester queda registrado (producto, local, fecha, costo) y,
// si quien lo abre puede ajustar stock, se descuenta 1 del local (queda en el historial de ajustes como "Tester").
// Al terminarse se marca y queda cuanto duro. Con eso: gasto en testers por marca y por mes.
// Si el producto es una de las muestras gratis de la tienda, el tilde "Tester en <local>" se prende y apaga solo.
const express = require('express');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

const router = express.Router();
const n = (x) => parseFloat(x) || 0;
const colLocal = (l) => (Number(l) === 2 ? 'stock_ush' : 'stock_rg');

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS testers (
    id SERIAL PRIMARY KEY, producto_id INT NOT NULL, local_id INT NOT NULL DEFAULT 1, abierto_en TIMESTAMP NOT NULL DEFAULT NOW(),
    terminado_en TIMESTAMP, costo NUMERIC(12,2), descontado BOOLEAN NOT NULL DEFAULT FALSE, usuario_id INT, usuario_nombre TEXT, nota TEXT)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS testers_en_uso ON testers (local_id) WHERE terminado_en IS NULL`);
  listo.set(true);
}
async function puedeAjustar(db, u) {
  if (!u || !u.id) return false;
  if (u.rol === 'jefe' || Number(u.rol_id) === 1) return true;
  return (await db.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'inventario.ajustar'`, [u.id])).rows.length > 0;
}
// Una unidad menos de stock en el local, anotada como ajuste
async function descontar(db, t, u) {
  const col = colLocal(t.local_id);
  const p = (await db.query(`SELECT ${col} AS s FROM productos WHERE id = $1 FOR UPDATE`, [t.producto_id])).rows[0];
  if (!p || (parseInt(p.s) || 0) < 1) return false;
  const ant = parseInt(p.s) || 0;
  await db.query(`UPDATE productos SET ${col} = $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - COALESCE(${col}, 0) + $1 WHERE id = $2`, [ant - 1, t.producto_id]);
  await db.query(`INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id) VALUES ($1, $2, $3, -1, 'Tester abierto', $4, $5, $6)`,
    [t.producto_id, ant, ant - 1, u.id || null, u.nombre || null, t.local_id]);
  await db.query('UPDATE testers SET descontado = TRUE WHERE id = $1', [t.id]);
  return true;
}
// Muestras gratis de la tienda: el tester de ese producto en ese local prende (o apaga) su tilde
async function sincronizarMuestra(db, productoId, localId) {
  try {
    const c = (await db.query('SELECT muestras FROM tienda_config WHERE id = 1')).rows[0];
    const m = c && c.muestras;
    if (!m || !Array.isArray(m.opciones)) return;
    const hay = (await db.query('SELECT 1 FROM testers WHERE producto_id = $1 AND local_id = $2 AND terminado_en IS NULL LIMIT 1', [productoId, localId])).rows.length > 0;
    let cambio = false;
    m.opciones = m.opciones.map(o => {
      if (!o || typeof o !== 'object' || Number(o.producto_id) !== Number(productoId)) return o;
      const locs = new Set((o.locales || []).map(Number));
      if (hay && !locs.has(Number(localId))) { locs.add(Number(localId)); cambio = true; }
      if (!hay && locs.has(Number(localId))) { locs.delete(Number(localId)); cambio = true; }
      return { ...o, locales: [...locs] };
    });
    if (cambio) await db.query('UPDATE tienda_config SET muestras = $1 WHERE id = 1', [JSON.stringify(m)]);
  } catch (e) { /* sin tienda online: nada que sincronizar */ }
}

router.get('/', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query(`SELECT t.*, p.nombre, p.marca, EXTRACT(DAY FROM COALESCE(t.terminado_en, NOW()) - t.abierto_en)::int AS dias
      FROM testers t JOIN productos p ON p.id = t.producto_id
      WHERE t.terminado_en IS NULL OR t.terminado_en >= NOW() - INTERVAL '120 days' ORDER BY t.terminado_en IS NOT NULL, t.abierto_en DESC LIMIT 400`);
    // Gasto por marca: este mes y los 2 anteriores; y cuanto suele durar cada producto
    const marcas = (await pool.query(`SELECT COALESCE(NULLIF(TRIM(p.marca), ''), 'Sin marca') AS marca,
        COUNT(*) FILTER (WHERE t.abierto_en >= date_trunc('month', NOW()))::int AS cant_mes, COALESCE(SUM(t.costo) FILTER (WHERE t.abierto_en >= date_trunc('month', NOW())), 0) AS gasto_mes,
        COUNT(*)::int AS cant_3m, COALESCE(SUM(t.costo), 0) AS gasto_3m
      FROM testers t JOIN productos p ON p.id = t.producto_id WHERE t.abierto_en >= date_trunc('month', NOW()) - INTERVAL '2 months'
      GROUP BY 1 ORDER BY gasto_3m DESC`)).rows;
    const duran = (await pool.query(`SELECT t.producto_id, ROUND(AVG(EXTRACT(EPOCH FROM t.terminado_en - t.abierto_en) / 86400))::int AS dias, COUNT(*)::int AS veces
      FROM testers t WHERE t.terminado_en IS NOT NULL GROUP BY 1`)).rows;
    res.json({
      testers: r.rows.map(t => ({ id: t.id, producto_id: t.producto_id, nombre: t.nombre, marca: t.marca, local_id: t.local_id, abierto_en: t.abierto_en, terminado_en: t.terminado_en,
        dias: t.dias, costo: n(t.costo), descontado: t.descontado, usuario_nombre: t.usuario_nombre, nota: t.nota, dura_prom: (duran.find(d => d.producto_id === t.producto_id) || {}).dias || null })),
      marcas: marcas.map(m => ({ marca: m.marca, cant_mes: m.cant_mes, gasto_mes: n(m.gasto_mes), cant_3m: m.cant_3m, gasto_3m: n(m.gasto_3m) })),
      puede_descontar: await puedeAjustar(pool, req.usuario),
    });
  } catch (e) { console.error('[testers]', e.message); res.status(500).json({ error: 'No se pudieron cargar los testers' }); }
});

// Abrir un tester
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await asegurar();
    const b = req.body || {}, u = req.usuario || {};
    const productoId = parseInt(b.producto_id), localId = Number(b.local_id) === 2 ? 2 : 1;
    const p = (await client.query('SELECT id, costo FROM productos WHERE id = $1', [productoId])).rows[0];
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    await client.query('BEGIN');
    const t = (await client.query(`INSERT INTO testers (producto_id, local_id, costo, usuario_id, usuario_nombre, nota) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [productoId, localId, p.costo || null, u.id || null, u.nombre || null, String(b.nota || '').trim().slice(0, 200) || null])).rows[0];
    let descontado = false;
    if (b.descontar !== false && await puedeAjustar(client, u)) descontado = await descontar(client, t, u);
    await sincronizarMuestra(client, productoId, localId);
    await client.query('COMMIT');
    res.json({ ok: true, descontado });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); console.error('[testers]', e.message); res.status(500).json({ error: 'No se pudo registrar' }); }
  finally { client.release(); }
});

// Descontar del stock un tester que se registro sin descontar (lo hace alguien con permiso)
router.post('/:id/descontar', async (req, res) => {
  const client = await pool.connect();
  try {
    await asegurar();
    if (!(await puedeAjustar(client, req.usuario))) return res.status(403).json({ error: 'No tenés permiso para ajustar stock' });
    await client.query('BEGIN');
    const t = (await client.query('SELECT * FROM testers WHERE id = $1 FOR UPDATE', [parseInt(req.params.id)])).rows[0];
    if (!t || t.descontado) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ya estaba descontado' }); }
    if (!(await descontar(client, t, req.usuario))) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay stock para descontar en ese local' }); }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); res.status(500).json({ error: 'No se pudo descontar' }); }
  finally { client.release(); }
});

// Se termino (o se deshace)
router.post('/:id/terminado', async (req, res) => {
  try {
    await asegurar();
    const t = (await pool.query(`UPDATE testers SET terminado_en = ${req.body && req.body.terminado === false ? 'NULL' : 'NOW()'} WHERE id = $1 RETURNING *`, [parseInt(req.params.id)])).rows[0];
    if (!t) return res.status(404).json({ error: 'No encontrado' });
    await sincronizarMuestra(pool, t.producto_id, t.local_id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

module.exports = router;
