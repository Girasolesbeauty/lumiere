const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Presupuestos: lo que se le cotiza a un cliente antes de que compre. Se manda por WhatsApp
// (o como PDF) y, si lo acepta, se pasa al Punto de Venta con los mismos productos y precios.
// No mueve stock ni plata: eso pasa recien cuando se hace la venta.
// Estados: pendiente, aceptado, rechazado, vendido. "Vencido" se calcula por la fecha.

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS presupuestos (
    id SERIAL PRIMARY KEY,
    numero INT NOT NULL,
    cliente_id INT,
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    descuento_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    validez_dias INT NOT NULL DEFAULT 7,
    nota TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    venta_id INT,
    local_id INT NOT NULL DEFAULT 1,
    usuario_id INT,
    usuario_nombre TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  listo.set(true);
}

const ESTADOS = ['pendiente', 'aceptado', 'rechazado', 'vendido'];
const r2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

// Valida y arma los datos que vienen del formulario
function leer(b) {
  const items = (Array.isArray(b.items) ? b.items : []).map(it => ({
    producto_id: parseInt(it.producto_id) || null,
    variante_id: parseInt(it.variante_id) || null,
    nombre: String(it.nombre || '').trim().slice(0, 200),
    cantidad: Math.max(0, parseFloat(it.cantidad) || 0),
    precio: Math.max(0, r2(it.precio)),
  })).filter(it => it.nombre && it.cantidad > 0);
  if (!items.length) return { error: 'Agregá al menos un producto' };
  const cliente = String(b.cliente_nombre || '').trim().slice(0, 120);
  if (!cliente && !b.cliente_id) return { error: 'Poné a quién va el presupuesto' };
  const descuento = Math.min(100, Math.max(0, parseFloat(b.descuento_pct) || 0));
  const subtotal = r2(items.reduce((t, it) => t + it.cantidad * it.precio, 0));
  const total = r2(subtotal * (1 - descuento / 100));
  const validez = Math.min(365, Math.max(1, parseInt(b.validez_dias) || 7));
  return {
    cliente_id: parseInt(b.cliente_id) || null,
    cliente_nombre: cliente || null,
    cliente_telefono: String(b.cliente_telefono || '').trim().slice(0, 40) || null,
    items, descuento_pct: descuento, subtotal, total, validez_dias: validez,
    nota: String(b.nota || '').trim().slice(0, 1000) || null,
  };
}

const conVencimiento = (p) => {
  const vence = new Date(new Date(p.creado_en).getTime() + p.validez_dias * 86400000);
  return {
    ...p,
    subtotal: parseFloat(p.subtotal), total: parseFloat(p.total), descuento_pct: parseFloat(p.descuento_pct),
    vence_en: vence,
    vencido: ['pendiente', 'aceptado'].includes(p.estado) && vence < new Date(),
  };
};

async function nombreUsuario(req) {
  try { const r = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
}

router.get('/', async (req, res) => {
  try {
    await asegurar();
    const params = [];
    let where = '';
    if (req.query.local_id) { params.push(parseInt(req.query.local_id) || 1); where = 'WHERE local_id = $1'; }
    const r = await pool.query(`SELECT * FROM presupuestos ${where} ORDER BY id DESC LIMIT 500`, params);
    res.json(r.rows.map(conVencimiento));
  } catch (e) {
    console.error('[presupuestos] lista:', e.message);
    res.status(500).json({ error: 'No se pudieron cargar los presupuestos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query('SELECT * FROM presupuestos WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el presupuesto' });
    res.json(conVencimiento(r.rows[0]));
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar el presupuesto' }); }
});

router.post('/', async (req, res) => {
  try {
    await asegurar();
    const d = leer(req.body || {});
    if (d.error) return res.status(400).json({ error: d.error });
    const num = await pool.query('SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM presupuestos');
    const r = await pool.query(
      `INSERT INTO presupuestos (numero, cliente_id, cliente_nombre, cliente_telefono, items, descuento_pct, subtotal, total, validez_dias, nota, local_id, usuario_id, usuario_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [num.rows[0].n, d.cliente_id, d.cliente_nombre, d.cliente_telefono, JSON.stringify(d.items), d.descuento_pct, d.subtotal, d.total,
       d.validez_dias, d.nota, parseInt(req.body.local_id) || 1, req.usuario.id || null, await nombreUsuario(req)]);
    res.status(201).json(conVencimiento(r.rows[0]));
  } catch (e) {
    console.error('[presupuestos] crear:', e.message);
    res.status(500).json({ error: 'No se pudo guardar el presupuesto' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await asegurar();
    const d = leer(req.body || {});
    if (d.error) return res.status(400).json({ error: d.error });
    const r = await pool.query(
      `UPDATE presupuestos SET cliente_id=$1, cliente_nombre=$2, cliente_telefono=$3, items=$4, descuento_pct=$5, subtotal=$6, total=$7,
         validez_dias=$8, nota=$9, actualizado_en=NOW()
       WHERE id=$10 AND estado <> 'vendido' RETURNING *`,
      [d.cliente_id, d.cliente_nombre, d.cliente_telefono, JSON.stringify(d.items), d.descuento_pct, d.subtotal, d.total, d.validez_dias, d.nota, req.params.id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Ese presupuesto ya se vendió y no se puede cambiar' });
    res.json(conVencimiento(r.rows[0]));
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar el presupuesto' }); }
});

// Cambiar estado a mano (aceptado / rechazado / pendiente)
router.put('/:id/estado', async (req, res) => {
  try {
    await asegurar();
    const estado = String((req.body && req.body.estado) || '');
    if (!ESTADOS.includes(estado) || estado === 'vendido') return res.status(400).json({ error: 'Estado no válido' });
    const r = await pool.query(`UPDATE presupuestos SET estado=$1, actualizado_en=NOW() WHERE id=$2 AND estado <> 'vendido' RETURNING *`, [estado, req.params.id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Ese presupuesto ya se vendió' });
    res.json(conVencimiento(r.rows[0]));
  } catch (e) { res.status(500).json({ error: 'No se pudo cambiar el estado' }); }
});

// Lo marca el Punto de Venta cuando se cobra la venta hecha desde el presupuesto
router.put('/:id/vendido', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query(`UPDATE presupuestos SET estado='vendido', venta_id=$1, actualizado_en=NOW() WHERE id=$2 RETURNING *`,
      [parseInt(req.body && req.body.venta_id) || null, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró el presupuesto' });
    res.json(conVencimiento(r.rows[0]));
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar como vendido' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query(`DELETE FROM presupuestos WHERE id=$1 AND estado <> 'vendido' RETURNING id`, [req.params.id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Un presupuesto vendido no se puede borrar' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar el presupuesto' }); }
});

module.exports = router;
