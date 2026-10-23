const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
// "También en la tienda online" (solo para promos de tipo Descuento %; ver lib/tienda.js promosTienda)
const enTiendaLista = porNegocio(false);
router.use(async (req, res, next) => {
  if (!enTiendaLista.get()) {
    try {
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS en_tienda BOOLEAN NOT NULL DEFAULT FALSE');
      // "Con cualquier medio menos este" (ej. el % OFF del Cyber no va con crédito: con crédito va la oferta en cuotas)
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS sin_medio_pago TEXT');
      enTiendaLista.set(true);
    } catch (e) {}
  }
  next();
});

// Listar promociones. ?activas=true&vigentes=true para el POS
router.get('/', async (req, res) => {
  try {
    const { activas, vigentes } = req.query;
    let q = 'SELECT * FROM promociones WHERE 1=1';
    if (activas === 'true') q += ' AND activo = TRUE';
    if (vigentes === 'true') q += " AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE) AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)";
    q += ' ORDER BY creado_en DESC';
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Crear
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.nombre || !b.tipo) return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    const r = await pool.query(
      `INSERT INTO promociones
        (nombre, tipo, valor, aplica_a, productos_ids, categorias, nx, ny, mismo_producto,
         producto_descuento_id, cross_producto_id, cross_producto_regalo_id, monto_minimo,
         medio_pago_tipo, combinable, fecha_inicio, fecha_fin, activo, en_tienda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        b.nombre, b.tipo, parseFloat(b.valor) || 0, b.aplica_a || 'todo',
        b.productos_ids || [], b.categorias || [],
        b.nx || null, b.ny || null, b.mismo_producto !== false,
        b.producto_descuento_id || null, b.cross_producto_id || null, b.cross_producto_regalo_id || null,
        b.monto_minimo || null, b.medio_pago_tipo || null,
        b.combinable === true, b.fecha_inicio || null, b.fecha_fin || null,
        b.activo !== false, b.en_tienda === true && b.tipo === 'descuento'
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Editar
router.put('/:id', async (req, res) => {
  try {
    const b = req.body;
    const r = await pool.query(
      `UPDATE promociones SET
        nombre=$1, tipo=$2, valor=$3, aplica_a=$4, productos_ids=$5, categorias=$6,
        nx=$7, ny=$8, mismo_producto=$9, producto_descuento_id=$10, cross_producto_id=$11,
        cross_producto_regalo_id=$12, monto_minimo=$13, medio_pago_tipo=$14, combinable=$15,
        fecha_inicio=$16, fecha_fin=$17, activo=$18, en_tienda=$20
       WHERE id=$19 RETURNING *`,
      [
        b.nombre, b.tipo, parseFloat(b.valor) || 0, b.aplica_a || 'todo',
        b.productos_ids || [], b.categorias || [],
        b.nx || null, b.ny || null, b.mismo_producto !== false,
        b.producto_descuento_id || null, b.cross_producto_id || null, b.cross_producto_regalo_id || null,
        b.monto_minimo || null, b.medio_pago_tipo || null,
        b.combinable === true, b.fecha_inicio || null, b.fecha_fin || null,
        b.activo !== false, req.params.id, b.en_tienda === true && b.tipo === 'descuento'
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Promocion no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Activar/desactivar rapido
router.put('/:id/toggle', async (req, res) => {
  try {
    const r = await pool.query('UPDATE promociones SET activo = NOT activo WHERE id = $1 RETURNING *', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM promociones WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Liquidación (Cyber Monday, Black Friday...): crea de una vez las promos que armó el plan de Lumiere.
// grupos: [{ pct, productos: [ids], pago: null | 'efectivo' | 'transferencia' }]. Las promos de un evento se llaman
// "<evento> · ..." y volver a crearlo reemplaza las anteriores. Opcional: sector en la tienda solo en esas fechas.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
router.post('/liquidacion', async (req, res) => {
  const b = req.body || {};
  const nombre = String(b.nombre || '').trim().slice(0, 40);
  if (nombre.length < 3) return res.status(400).json({ error: 'Ponele un nombre al evento' });
  if (!FECHA.test(b.desde || '') || !FECHA.test(b.hasta || '') || b.desde > b.hasta) return res.status(400).json({ error: 'Revisá las fechas' });
  const grupos = (Array.isArray(b.grupos) ? b.grupos : []).map(g => ({
    pct: Math.round(Math.min(80, Math.max(1, parseFloat(g.pct) || 0))),
    productos: [...new Set((Array.isArray(g.productos) ? g.productos : []).map(Number).filter(n => Number.isInteger(n) && n > 0))],
    pago: ['efectivo', 'transferencia', 'credito'].includes(g.pago) ? g.pago : null,
    sin: g.sin === 'credito' && !g.pago ? 'credito' : null,
    cuotas: Math.min(24, Math.max(0, parseInt(g.cuotas) || 0)),
  })).filter(g => g.pct && g.productos.length).slice(0, 60);
  if (!grupos.length) return res.status(400).json({ error: 'No hay productos con descuento' });
  const enTienda = b.en_tienda !== false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const viejas = await client.query(`DELETE FROM promociones WHERE nombre LIKE $1 RETURNING id`, [nombre.replace(/[%_\\]/g, '\\$&') + ' · %']);
    const PAGO_TXT = { efectivo: 'en efectivo', transferencia: 'con transferencia' };
    for (const g of grupos) {
      const txt = g.pago === 'credito' ? ' + ' + (g.cuotas || '') + ' cuotas sin interés (crédito)' : g.pago ? ' ' + PAGO_TXT[g.pago] : g.sin ? ' (menos crédito)' : '';
      // La de crédito es solo del local: en la tienda las cuotas las da Mercado Pago
      await client.query(`INSERT INTO promociones (nombre, tipo, valor, aplica_a, productos_ids, categorias, mismo_producto, medio_pago_tipo, sin_medio_pago, combinable, fecha_inicio, fecha_fin, activo, en_tienda)
        VALUES ($1, 'descuento', $2, 'productos', $3, '{}', TRUE, $4, $5, FALSE, $6, $7, TRUE, $8)`,
        [(nombre + ' · ' + g.pct + '% OFF' + txt).slice(0, 120), g.pct, g.productos, g.pago, g.sin, b.desde, b.hasta, enTienda && g.pago !== 'credito']);
    }
    let sector = false;
    if (b.sector && enTienda) {
      const tienda = require('../lib/tienda');
      await tienda.asegurar();
      const todos = [...new Set(grupos.flatMap(g => g.productos))].slice(0, 300);
      const c = (await client.query('SELECT sectores FROM tienda_config WHERE id = 1')).rows[0];
      const id = 'liq' + nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 14);
      const otros = ((c && c.sectores) || []).filter(x => x.id !== id);
      if (otros.length >= 12) throw Object.assign(new Error('La tienda ya tiene 12 sectores: borrá alguno en Portada y sectores'), { status: 400 });
      const nuevo = { id, nombre: ('⚡ ' + nombre).slice(0, 40), categorias: [], productos: todos, combos: [], desde: b.desde, hasta: b.hasta };
      await client.query('UPDATE tienda_config SET sectores = $1 WHERE id = 1', [JSON.stringify([nuevo, ...otros])]);
      sector = true;
    }
    await client.query('COMMIT');
    res.status(201).json({ creadas: grupos.length, reemplazadas: viejas.rows.length, sector });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[promos] liquidacion:', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudieron crear las ofertas' });
  } finally { client.release(); }
});

module.exports = router;