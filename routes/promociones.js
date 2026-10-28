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
      // Solo en un local (null = en todos): ej. un producto que en Ushuaia no se mueve
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS local_id INT');
      // Combo: llevando todos estos productos (productos_ids, cada uno con su cantidad) tienen valor% sobre esos productos
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS combo_cantidades JSONB');
      enTiendaLista.set(true);
    } catch (e) {}
  }
  next();
});

// Rutina en cuotas: llevando N productos faciales distintos (sin los tipos excluidos, ej. mascarillas, y desde un precio)
// se puede pagar en X cuotas sin interés. En el local el Punto de Venta no deja usar ese medio si no se cumple; en la tienda
// es un aviso en el carrito. Con fechas (desde/hasta, hora argentina).
const FECHA_R = /^\d{4}-\d{2}-\d{2}$/;
function rutinaCuotasDe(v) {
  const k = v && typeof v === 'object' ? v : {};
  return {
    activo: !!k.activo,
    desde: FECHA_R.test(k.desde || '') ? k.desde : '', hasta: FECHA_R.test(k.hasta || '') ? k.hasta : '',
    minimo: Math.max(2, Math.min(10, parseInt(k.minimo) || 4)),
    cuotas: [3, 6, 9, 12].includes(parseInt(k.cuotas)) ? parseInt(k.cuotas) : 6,
    precio_min: Math.max(0, Math.round(parseFloat(k.precio_min) || 0)),
    excluir: [...new Set((Array.isArray(k.excluir) ? k.excluir : ['mascarilla']).map(x => String(x || '').slice(0, 30)).filter(Boolean))].slice(0, 20),
    medio_id: parseInt(k.medio_id) || null,
    online: !!k.online,
  };
}
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const rutinaVigente = (r) => r.activo && (!r.desde || r.desde <= hoyAR()) && (!r.hasta || hoyAR() <= r.hasta);
async function leerRutinaCuotas(db = pool) {
  await db.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS promo_rutina JSONB');
  const r = rutinaCuotasDe(((await db.query('SELECT promo_rutina FROM configuracion_negocio LIMIT 1')).rows[0] || {}).promo_rutina);
  return { ...r, vigente: rutinaVigente(r) };
}
router.get('/rutina-cuotas', async (req, res) => {
  try { res.json(await leerRutinaCuotas()); } catch (e) { res.status(500).json({ error: 'No se pudo leer' }); }
});
router.put('/rutina-cuotas', async (req, res) => {
  try {
    const r = rutinaCuotasDe(req.body);
    if (r.activo && (!r.desde || !r.hasta || r.desde > r.hasta)) return res.status(400).json({ error: 'Revisá las fechas' });
    if (r.activo && !r.medio_id) return res.status(400).json({ error: 'Elegí con qué medio de pago se cobran las cuotas en el local' });
    await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS promo_rutina JSONB');
    await pool.query('UPDATE configuracion_negocio SET promo_rutina = $1', [JSON.stringify(r)]);
    res.json({ ...r, vigente: rutinaVigente(r) });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Plan de Cyber Monday (ofertas armadas, producto -> oferta, comisiones, fechas): uno solo por negocio, compartido
// por todas las que entran al sector (antes quedaba en el navegador de cada una)
async function asegurarPlan() {
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS plan_liquidacion JSONB');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS plan_liquidacion_por TEXT');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS plan_liquidacion_en TIMESTAMP');
}
// Modo Cyber de la tienda online (lo ven y editan quienes entran a Cyber Monday)
router.get('/cyber-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    const c = await tienda.leerConfig();
    const k = tienda.cyberDe(c);
    res.json({ cyber: k, en_curso: tienda.cyberVigente(k), slug: c.slug || null, publicada: !!c.activo, dominio: await tienda.dominioDe((req.negocio && req.negocio.id) || 1).catch(() => null) });
  } catch (e) { console.error('[cyber tienda]', e.message); res.status(500).json({ error: 'No se pudo leer' }); }
});
router.put('/cyber-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    const c = await tienda.leerConfig();
    const ant = tienda.cyberDe(c), b = req.body || {};
    const k = tienda.cyberDe({ cyber: { ...b, token: ant.token || require('crypto').randomBytes(12).toString('hex') } });
    if (b.desde && b.hasta && k.desde > k.hasta) return res.status(400).json({ error: 'La fecha de fin tiene que ser después de la de inicio' });
    await pool.query('UPDATE tienda_config SET cyber = $1 WHERE id = 1', [JSON.stringify(k)]);
    res.json({ cyber: k, en_curso: tienda.cyberVigente(k) });
  } catch (e) { console.error('[cyber tienda]', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Calendario de Adviento de la tienda online
router.get('/adviento-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    await tienda.asegurar();
    const c = await tienda.leerConfig();
    const a = tienda.advientoDe(c);
    res.json({ adviento: a, hoy: tienda.advientoHoy(a), slug: c.slug || null, publicada: !!c.activo, dominio: await tienda.dominioDe((req.negocio && req.negocio.id) || 1).catch(() => null), titulo_tienda: c.titulo || null });
  } catch (e) { console.error('[adviento]', e.message); res.status(500).json({ error: 'No se pudo leer' }); }
});
router.put('/adviento-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    await tienda.asegurar();
    const c = await tienda.leerConfig();
    const ant = tienda.advientoDe(c);
    const a = tienda.advientoDe({ adviento: { ...(req.body || {}), token: ant.token || require('crypto').randomBytes(12).toString('hex') } });
    const falta = a.dias.find(d => tienda.advientoFalta(d));
    if (falta) return res.status(400).json({ error: 'Día ' + falta.dia + ': ' + tienda.advientoFalta(falta), dia: falta.dia });
    // Primero los cupones y descuentos (si un código ya existe no se guarda nada)
    const sync = await tienda.sincronizarAdviento(a);
    if (sync.error) return res.status(400).json({ error: sync.error });
    await pool.query('UPDATE tienda_config SET adviento = $1 WHERE id = 1', [JSON.stringify(a)]);
    res.json({ adviento: a, hoy: tienda.advientoHoy(a) });
  } catch (e) { console.error('[adviento]', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});
// Halloween en la tienda online (diseño, juego "¿Dulce o truco?" y sector de productos)
router.get('/halloween-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    await tienda.asegurar();
    const c = await tienda.leerConfig();
    const h = tienda.halloweenDe(c);
    const jugadas = (await pool.query(`SELECT texto, tipo, COUNT(*)::int AS n FROM tienda_halloween WHERE temporada = $1 GROUP BY texto, tipo ORDER BY n DESC`, ['hw-' + h.desde.slice(0, 10)]).catch(() => ({ rows: [] }))).rows;
    const usados = (await pool.query(`SELECT COUNT(*)::int AS n FROM tienda_halloween th JOIN cupones cu ON cu.codigo = th.cupon WHERE th.temporada = $1 AND COALESCE(cu.usos, 0) > 0`, ['hw-' + h.desde.slice(0, 10)]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    res.json({ halloween: h, en_curso: tienda.halloweenVigente(h), slug: c.slug || null, publicada: !!c.activo, dominio: await tienda.dominioDe((req.negocio && req.negocio.id) || 1).catch(() => null), jugadas, cupones_usados: usados });
  } catch (e) { console.error('[halloween tienda]', e.message); res.status(500).json({ error: 'No se pudo leer' }); }
});
router.put('/halloween-tienda', async (req, res) => {
  try {
    const tienda = require('../lib/tienda');
    await tienda.asegurar();
    const c = await tienda.leerConfig();
    const ant = tienda.halloweenDe(c), b = req.body || {};
    const h = tienda.halloweenDe({ halloween: { ...b, token: ant.token || require('crypto').randomBytes(12).toString('hex') } });
    if (h.desde > h.hasta) return res.status(400).json({ error: 'La fecha de fin tiene que ser después de la de inicio' });
    if (h.juego && !h.premios.some(x => x.chance > 0)) return res.status(400).json({ error: 'Poné chances a los premios del juego' });
    await pool.query('UPDATE tienda_config SET halloween = $1 WHERE id = 1', [JSON.stringify(h)]);
    res.json({ halloween: h, en_curso: tienda.halloweenVigente(h) });
  } catch (e) { console.error('[halloween tienda]', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.get('/plan-liquidacion', async (req, res) => {
  try {
    await asegurarPlan();
    const r = (await pool.query('SELECT plan_liquidacion, plan_liquidacion_por, plan_liquidacion_en FROM configuracion_negocio LIMIT 1')).rows[0] || {};
    res.json({ plan: r.plan_liquidacion || null, por: r.plan_liquidacion_por || null, en: r.plan_liquidacion_en || null });
  } catch (e) { res.status(500).json({ error: 'No se pudo leer el plan' }); }
});
router.put('/plan-liquidacion', async (req, res) => {
  try {
    const plan = (req.body || {}).plan;
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return res.status(400).json({ error: 'Plan inválido' });
    const txt = JSON.stringify(plan);
    if (txt.length > 800000) return res.status(400).json({ error: 'El plan es demasiado grande' });
    await asegurarPlan();
    const u = req.usuario || {};
    const por = u.nombre || (u.id ? ((await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre : null) || null;
    const r = (await pool.query('UPDATE configuracion_negocio SET plan_liquidacion = $1, plan_liquidacion_por = $2, plan_liquidacion_en = NOW() RETURNING plan_liquidacion_por, plan_liquidacion_en', [txt, por])).rows[0] || {};
    res.json({ ok: true, por: r.plan_liquidacion_por, en: r.plan_liquidacion_en });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar el plan' }); }
});

// Listar promociones. ?activas=true&vigentes=true para el POS
router.get('/', async (req, res) => {
  try {
    const { activas, vigentes } = req.query;
    let q = 'SELECT * FROM promociones WHERE 1=1';
    if (activas === 'true') q += ' AND activo = TRUE';
    if (vigentes === 'true') q += " AND (fecha_inicio IS NULL OR fecha_inicio <= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AND (fecha_fin IS NULL OR fecha_fin >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)";
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
    pago: ['efectivo', 'transferencia', 'debito', 'credito'].includes(g.pago) ? g.pago : null,
    sin: g.sin === 'credito' && !g.pago ? 'credito' : null,
    cuotas: Math.min(24, Math.max(0, parseInt(g.cuotas) || 0)),
    // Cómo se llama en la lista de promociones (ej. "Oferta 2: 30% OFF con transferencia")
    etiqueta: String(g.etiqueta || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    local: parseInt(g.local) > 0 ? parseInt(g.local) : null,
    combo: g.tipo === 'combo',
    cantidades: g.tipo === 'combo' && g.cantidades && typeof g.cantidades === 'object'
      ? Object.fromEntries(Object.entries(g.cantidades).map(([k, v]) => [parseInt(k), Math.min(10, Math.max(1, parseInt(v) || 1))]).filter(([k, v]) => k > 0 && v > 1)) : null,
  })).filter(g => g.pct && g.productos.length && (!g.combo || g.productos.reduce((s, id) => s + ((g.cantidades || {})[id] || 1), 0) >= 2)).slice(0, 200);
  if (!grupos.length) return res.status(400).json({ error: 'No hay productos con descuento' });
  const enTienda = b.en_tienda !== false;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const viejas = await client.query(`DELETE FROM promociones WHERE nombre LIKE $1 RETURNING id`, [nombre.replace(/[%_\\]/g, '\\$&') + ' · %']);
    const PAGO_TXT = { efectivo: 'en efectivo', transferencia: 'con transferencia', debito: 'con débito' };
    for (const g of grupos) {
      const txt = g.pago === 'credito' ? ' + ' + (g.cuotas || '') + ' cuotas sin interés (crédito)' : g.pago ? ' ' + PAGO_TXT[g.pago] : g.sin ? ' otros medios (menos crédito)' : ' otros medios';
      // La de crédito es solo del local: en la tienda las cuotas las da Mercado Pago
      // Los combos en la tienda online van como combos de la tienda (ver combos_tienda): la promo es para el local
      await client.query(`INSERT INTO promociones (nombre, tipo, valor, aplica_a, productos_ids, categorias, mismo_producto, medio_pago_tipo, sin_medio_pago, combinable, fecha_inicio, fecha_fin, activo, en_tienda, local_id, combo_cantidades)
        VALUES ($1, $10, $2, 'productos', $3, '{}', TRUE, $4, $5, FALSE, $6, $7, TRUE, $8, $9, $11)`,
        [(nombre + ' · ' + (g.etiqueta || g.pct + '% OFF' + txt)).slice(0, 120), g.pct, g.productos, g.pago, g.sin, b.desde, b.hasta, enTienda && g.pago !== 'credito' && !g.combo, g.local,
          g.combo ? 'combo' : 'descuento', g.combo ? JSON.stringify(g.cantidades || {}) : null]);
    }
    // Combos en la tienda online: con precio especial y solo entre las fechas del evento (reemplaza los de este evento)
    let combosTienda = 0;
    if (Array.isArray(b.combos_tienda) && enTienda) {
      const tiendaLib = require('../lib/tienda');
      await tiendaLib.asegurar();
      const pref = 'cy' + nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 6);
      const c = (await client.query('SELECT ofertas FROM tienda_config WHERE id = 1')).rows[0] || {};
      const o = tiendaLib.ofertasDe(c);
      const nuevos = b.combos_tienda.slice(0, 12).map((x, i) => ({ id: (pref + String(x.id || i).replace(/[^a-z0-9]/gi, '')).slice(0, 20), nombre: String(x.nombre || 'Combo').slice(0, 60),
        productos: x.productos, cantidades: x.cantidades || {}, precio: Math.round(parseFloat(x.precio) || 0), activo: true, desde: b.desde, hasta: b.hasta }));
      const otros = o.combos.filter(x => !String(x.id).startsWith(pref));
      const todos = tiendaLib.ofertasDe({ ofertas: { dia: o.dia, combos: [...otros, ...nuevos] } });
      await client.query('UPDATE tienda_config SET ofertas = $1 WHERE id = 1', [JSON.stringify({ ...(c.ofertas || {}), dia: (c.ofertas || {}).dia || o.dia, combos: todos.combos })]);
      combosTienda = todos.combos.filter(x => String(x.id).startsWith(pref)).length;
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
    res.status(201).json({ creadas: grupos.length, reemplazadas: viejas.rows.length, sector, combos_tienda: combosTienda });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[promos] liquidacion:', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudieron crear las ofertas' });
  } finally { client.release(); }
});

module.exports = router;
module.exports.leerRutinaCuotas = leerRutinaCuotas;