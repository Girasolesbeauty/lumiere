const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Vencimientos por lote: cuando entra mercaderia con fecha de vencimiento se carga el lote
// (producto, local, cantidad, fecha). No se toca la venta ni el stock: cuantas unidades de cada
// lote quedan se estima con el stock actual del local, suponiendo que se vende primero lo que
// vence antes (lo que hay en stock son los lotes que vencen mas tarde).
// Lo vencido se da de baja con el ajuste de stock normal (desde la pantalla) y el lote queda
// marcado como "baja".

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS lotes_vencimiento (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL,
    local_id INT NOT NULL DEFAULT 1,
    cantidad INT NOT NULL,
    vence DATE NOT NULL,
    orden_id INT,
    nota TEXT,
    estado TEXT NOT NULL DEFAULT 'activo',
    baja_cantidad INT,
    usuario_nombre TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query('CREATE INDEX IF NOT EXISTS lotes_venc_prod_idx ON lotes_vencimiento (producto_id, local_id) WHERE estado = \'activo\'');
  listo.set(true);
}

const HOY_AR = `(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
const colStock = (local) => (String(local) === '2' ? 'stock_ush' : 'stock_rg');

async function nombreUsuario(req) {
  try { const r = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
}

// Lotes activos de un local con lo que se estima que queda de cada uno
async function lotesConStock(localId) {
  const col = colStock(localId);
  const r = await pool.query(`
    SELECT l.*, to_char(l.vence, 'YYYY-MM-DD') AS vence_txt, (l.vence - ${HOY_AR}) AS dias,
           p.nombre, p.marca, p.codigo_barras, COALESCE(p.costo, 0) AS costo, COALESCE(p.precio, 0) AS precio,
           GREATEST(COALESCE(p.${col}, 0), 0) AS stock_local
    FROM lotes_vencimiento l JOIN productos p ON p.id = l.producto_id
    WHERE l.estado = 'activo' AND l.local_id = $1
    ORDER BY l.producto_id, l.vence DESC, l.id DESC`, [localId]);
  // Reparto del stock: primero a los lotes que vencen mas tarde
  const quedan = {};
  const out = r.rows.map(l => {
    if (quedan[l.producto_id] === undefined) quedan[l.producto_id] = parseInt(l.stock_local) || 0;
    const en_stock = Math.min(l.cantidad, quedan[l.producto_id]);
    quedan[l.producto_id] -= en_stock;
    return {
      id: l.id, producto_id: l.producto_id, nombre: l.nombre, marca: l.marca, codigo_barras: l.codigo_barras,
      cantidad: l.cantidad, en_stock, vence: l.vence_txt, dias: parseInt(l.dias), orden_id: l.orden_id, nota: l.nota,
      costo: parseFloat(l.costo), precio: parseFloat(l.precio), stock_local: parseInt(l.stock_local) || 0,
      usuario_nombre: l.usuario_nombre, creado_en: l.creado_en,
    };
  });
  return out.sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre));
}

router.get('/', async (req, res) => {
  try {
    await asegurar();
    const localId = parseInt(req.query.local_id) || 1;
    res.json(await lotesConStock(localId));
  } catch (e) {
    console.error('[vencimientos] lista:', e.message);
    res.status(500).json({ error: 'No se pudieron cargar los vencimientos' });
  }
});

// Resumen corto (para Salud del stock y avisos)
router.get('/resumen', async (req, res) => {
  try {
    await asegurar();
    const todos = await lotesConStock(parseInt(req.query.local_id) || 1);
    const lotes = todos.filter(l => l.en_stock > 0);
    const suma = (arr) => ({ lotes: arr.length, unidades: arr.reduce((t, l) => t + l.en_stock, 0), valor_costo: Math.round(arr.reduce((t, l) => t + l.en_stock * l.costo, 0)) });
    res.json({
      hay_lotes: todos.length > 0,
      vencidos: suma(lotes.filter(l => l.dias < 0)),
      semana: suma(lotes.filter(l => l.dias >= 0 && l.dias <= 7)),
      mes: suma(lotes.filter(l => l.dias > 7 && l.dias <= 30)),
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo calcular' }); }
});

// Cargar uno o varios lotes: { local_id, orden_id?, items: [{ producto_id, cantidad, vence, nota? }] }
router.post('/', async (req, res) => {
  const b = req.body || {};
  const items = (Array.isArray(b.items) ? b.items : [b]).map(it => ({
    producto_id: parseInt(it.producto_id) || null,
    cantidad: parseInt(it.cantidad) || 0,
    vence: /^\d{4}-\d{2}-\d{2}$/.test(String(it.vence || '')) ? it.vence : null,
    nota: String(it.nota || '').trim().slice(0, 200) || null,
  }));
  if (!items.length) return res.status(400).json({ error: 'No hay nada para cargar' });
  if (items.some(it => !it.producto_id)) return res.status(400).json({ error: 'Elegí el producto' });
  if (items.some(it => it.cantidad <= 0)) return res.status(400).json({ error: 'Poné cuántas unidades vencen en esa fecha' });
  if (items.some(it => !it.vence)) return res.status(400).json({ error: 'Poné la fecha de vencimiento' });
  let client;
  try {
    await asegurar();
    const quien = await nombreUsuario(req);
    client = await pool.connect();
    await client.query('BEGIN');
    for (const it of items) {
      await client.query(
        `INSERT INTO lotes_vencimiento (producto_id, local_id, cantidad, vence, orden_id, nota, usuario_nombre) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [it.producto_id, String(b.local_id) === '2' ? 2 : 1, it.cantidad, it.vence, parseInt(b.orden_id) || null, it.nota, quien]);
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true, cargados: items.length });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    console.error('[vencimientos] cargar:', e.message);
    res.status(500).json({ error: 'No se pudieron guardar los lotes' });
  } finally { if (client) client.release(); }
});

// Corregir cantidad o fecha de un lote
router.put('/:id', async (req, res) => {
  try {
    await asegurar();
    const cantidad = parseInt(req.body && req.body.cantidad);
    const vence = req.body && req.body.vence;
    if (!(cantidad > 0)) return res.status(400).json({ error: 'La cantidad tiene que ser mayor a cero' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vence || ''))) return res.status(400).json({ error: 'Fecha no válida' });
    const r = await pool.query(`UPDATE lotes_vencimiento SET cantidad=$1, vence=$2 WHERE id=$3 AND estado='activo' RETURNING id`, [cantidad, vence, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el lote' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Marcar el lote como dado de baja (el ajuste de stock se hace aparte, con el ajuste normal)
router.put('/:id/baja', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query(`UPDATE lotes_vencimiento SET estado='baja', baja_cantidad=$1 WHERE id=$2 AND estado='activo' RETURNING id`,
      [parseInt(req.body && req.body.cantidad) || 0, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el lote' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo dar de baja' }); }
});

// Sacar el lote de la lista (ya no hay, se cargo mal, etc.) sin tocar el stock
router.delete('/:id', async (req, res) => {
  try {
    await asegurar();
    await pool.query(`UPDATE lotes_vencimiento SET estado='borrado' WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

module.exports = router;
