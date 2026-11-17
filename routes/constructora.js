const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
const modulos = require('../lib/modulos');

// Constructora: obras (con etapas, avance y responsables), presupuesto por obra contra lo realmente
// gastado, stock en galpones y en obras (entradas, salidas y traspasos) y compras con factura.
//
// Galpones y obras son "ubicaciones". Cada movimiento de mercaderia tiene un origen y/o un destino:
//   entrada  (destino)            compra, devolucion de un proveedor al reves, ajuste a favor
//   salida   (origen)             consumo, perdida, ajuste en contra
//   traspaso (origen -> destino)  galpon -> obra, galpon -> galpon, obra -> galpon (devolucion)
// El stock de un material en una ubicacion = suma de lo que entro - suma de lo que salio.
//
// Costo de una obra = (lo que ENTRO a su ubicacion, a costo) - (lo que volvio a otra ubicacion)
//                     + gastos cargados a mano (mano de obra, subcontratos, alquileres...).
// Lo que se consume dentro de la obra sigue contando como costo (ya se pago al entrar).
// Nada de esto toca la caja ni los impuestos: es control de obra.

const RUBROS = ['Materiales', 'Mano de obra', 'Subcontratos', 'Equipos y alquileres', 'Fletes y combustible', 'Gastos generales', 'Otros'];
const ESTADOS_OBRA = ['planificada', 'en_curso', 'pausada', 'terminada', 'cancelada'];
const ESTADOS_ETAPA = ['pendiente', 'en_curso', 'terminada'];
const UNIDADES = ['u', 'kg', 'm', 'm2', 'm3', 'l', 'bolsa', 'tn', 'rollo', 'caja', 'hs', 'gl'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const txt = (v) => { const s = String(v == null ? '' : v).trim(); return s || null; };
const fechaOk = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null);
const quien = (req) => (req.usuario && (req.usuario.nombre || req.usuario.email)) || null;
const falla = (res, e, donde) => {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error('[constructora] ' + donde + ':', e && e.message);
  res.status(500).json({ error: 'No se pudo completar. Probá de nuevo.' });
};
const err = (status, message) => Object.assign(new Error(message), { status });

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_obras (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    cliente_id INT,
    cliente_nombre TEXT,
    direccion TEXT,
    estado TEXT NOT NULL DEFAULT 'planificada',
    responsable TEXT,
    fecha_inicio DATE,
    fecha_fin_prevista DATE,
    fecha_fin_real DATE,
    avance_manual NUMERIC(5,2) NOT NULL DEFAULT 0,
    notas TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_etapas (
    id SERIAL PRIMARY KEY,
    obra_id INT NOT NULL,
    nombre TEXT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    avance NUMERIC(5,2) NOT NULL DEFAULT 0,
    peso NUMERIC(8,2) NOT NULL DEFAULT 1,
    fecha_desde DATE,
    fecha_hasta DATE,
    responsable TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_presupuesto (
    id SERIAL PRIMARY KEY,
    obra_id INT NOT NULL,
    rubro TEXT NOT NULL,
    monto NUMERIC(16,2) NOT NULL DEFAULT 0,
    UNIQUE (obra_id, rubro))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_gastos (
    id SERIAL PRIMARY KEY,
    obra_id INT NOT NULL,
    rubro TEXT NOT NULL,
    concepto TEXT,
    monto NUMERIC(16,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    proveedor_id INT,
    usuario TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_ubicaciones (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'galpon',
    obra_id INT,
    direccion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_materiales (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'u',
    categoria TEXT,
    codigo TEXT,
    costo_promedio NUMERIC(16,4) NOT NULL DEFAULT 0,
    stock_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_compras (
    id SERIAL PRIMARY KEY,
    proveedor_id INT,
    proveedor_nombre TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    numero TEXT,
    destino_id INT NOT NULL,
    total NUMERIC(16,2) NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    vence DATE,
    pagada_en DATE,
    anulada BOOLEAN NOT NULL DEFAULT FALSE,
    nota TEXT,
    usuario TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_compra_items (
    id SERIAL PRIMARY KEY,
    compra_id INT NOT NULL,
    material_id INT NOT NULL,
    descripcion TEXT,
    cantidad NUMERIC(14,3) NOT NULL,
    costo_unitario NUMERIC(16,4) NOT NULL DEFAULT 0,
    subtotal NUMERIC(16,2) NOT NULL DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_movimientos (
    id SERIAL PRIMARY KEY,
    material_id INT NOT NULL,
    cantidad NUMERIC(14,3) NOT NULL,
    origen_id INT,
    destino_id INT,
    tipo TEXT NOT NULL,
    motivo TEXT,
    costo_unitario NUMERIC(16,4) NOT NULL DEFAULT 0,
    compra_id INT,
    lote TEXT,
    nota TEXT,
    usuario TEXT,
    fecha TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query('CREATE INDEX IF NOT EXISTS cn_mov_material ON cn_movimientos (material_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS cn_mov_origen ON cn_movimientos (origen_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS cn_mov_destino ON cn_movimientos (destino_id)');
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_licitaciones (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    organismo TEXT,
    numero TEXT,
    estado TEXT NOT NULL DEFAULT 'en_estudio',
    fecha_apertura DATE,
    fecha_presentacion DATE,
    presupuesto_oficial NUMERIC(16,2) NOT NULL DEFAULT 0,
    monto_ofertado NUMERIC(16,2) NOT NULL DEFAULT 0,
    monto_adjudicado NUMERIC(16,2) NOT NULL DEFAULT 0,
    garantia_monto NUMERIC(16,2) NOT NULL DEFAULT 0,
    garantia_vence DATE,
    obra_id INT,
    notas TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cn_lic_hitos (
    id SERIAL PRIMARY KEY,
    licitacion_id INT NOT NULL,
    nombre TEXT NOT NULL,
    vence DATE,
    cumplido BOOLEAN NOT NULL DEFAULT FALSE,
    cumplido_en DATE)`);
  // Siempre hay un galpon para empezar
  const g = await pool.query("SELECT 1 FROM cn_ubicaciones WHERE tipo = 'galpon' LIMIT 1");
  if (!g.rows.length) await pool.query("INSERT INTO cn_ubicaciones (nombre, tipo) VALUES ('Galpón principal', 'galpon')");
  listo.set(true);
}

// Solo funciona en los negocios que tienen prendido el modulo
router.use(async (req, res, next) => {
  try {
    const m = await modulos.leer();
    if (!m.constructora) return res.status(403).json({ error: 'Este negocio no tiene activado el módulo de constructora' });
    await asegurar();
    next();
  } catch (e) { falla(res, e, 'acceso'); }
});

// ---------- cuentas ----------
// Stock de un material en una ubicacion (con el cliente de la transaccion si hace falta)
async function stockDe(db, materialId, ubicacionId) {
  const r = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN destino_id = $2 THEN cantidad ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN origen_id = $2 THEN cantidad ELSE 0 END), 0) AS s
     FROM cn_movimientos WHERE material_id = $1 AND (destino_id = $2 OR origen_id = $2)`, [materialId, ubicacionId]);
  return num(r.rows[0].s);
}

// Lo que costo en materiales lo que esta/estuvo en la ubicacion de una obra
const SQL_COSTO_MATERIALES = `
  SELECT u.obra_id,
         COALESCE(SUM(CASE WHEN m.destino_id = u.id THEN m.cantidad * m.costo_unitario ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN m.origen_id = u.id AND m.destino_id IS NOT NULL THEN m.cantidad * m.costo_unitario ELSE 0 END), 0) AS costo
  FROM cn_ubicaciones u JOIN cn_movimientos m ON (m.destino_id = u.id OR m.origen_id = u.id)
  WHERE u.tipo = 'obra' AND u.obra_id IS NOT NULL GROUP BY u.obra_id`;

async function costosPorObra() {
  const mat = await pool.query(SQL_COSTO_MATERIALES);
  const gas = await pool.query('SELECT obra_id, rubro, SUM(monto) AS monto FROM cn_gastos GROUP BY obra_id, rubro');
  const pre = await pool.query('SELECT obra_id, rubro, monto FROM cn_presupuesto');
  const out = new Map();
  const de = (id) => { if (!out.has(id)) out.set(id, { real: {}, presup: {} }); return out.get(id); };
  mat.rows.forEach(r => { const o = de(r.obra_id); o.real['Materiales'] = (o.real['Materiales'] || 0) + num(r.costo); });
  gas.rows.forEach(r => { const o = de(r.obra_id); o.real[r.rubro] = (o.real[r.rubro] || 0) + num(r.monto); });
  pre.rows.forEach(r => { de(r.obra_id).presup[r.rubro] = num(r.monto); });
  return { de: (id) => out.get(id) || { real: {}, presup: {} } };
}

const suma = (o) => Object.values(o).reduce((a, b) => a + num(b), 0);

function armarRubros(c) {
  const nombres = [...new Set(RUBROS.concat(Object.keys(c.presup), Object.keys(c.real)))];
  return nombres.map(r => {
    const p = num(c.presup[r]), real = num(c.real[r]);
    return { rubro: r, presupuestado: p, real, desvio: real - p, pct: p > 0 ? Math.round(real / p * 1000) / 10 : null };
  }).filter(x => x.presupuestado || x.real || RUBROS.includes(x.rubro));
}

// Avance de la obra: promedio de sus etapas (segun el peso de cada una); sin etapas, el que se cargo a mano
function avanceDe(obra, etapas) {
  if (!etapas.length) return num(obra.avance_manual);
  const pesos = etapas.reduce((a, e) => a + num(e.peso || 1), 0) || 1;
  return Math.round(etapas.reduce((a, e) => a + num(e.avance) * num(e.peso || 1), 0) / pesos * 10) / 10;
}

// ---------- panel ----------
router.get('/resumen', async (req, res) => {
  try {
    const [ob, comp, bajo, venc, lic, hitos] = await Promise.all([
      pool.query("SELECT estado, COUNT(*)::int AS n FROM cn_obras GROUP BY estado"),
      pool.query("SELECT COUNT(*)::int AS n, COALESCE(SUM(total), 0) AS total FROM cn_compras WHERE estado = 'pendiente' AND NOT anulada"),
      pool.query(`SELECT m.id, m.nombre, m.unidad, m.stock_minimo,
          (SELECT COALESCE(SUM(CASE WHEN x.destino_id IN (SELECT id FROM cn_ubicaciones WHERE tipo = 'galpon') THEN x.cantidad ELSE 0 END) - SUM(CASE WHEN x.origen_id IN (SELECT id FROM cn_ubicaciones WHERE tipo = 'galpon') THEN x.cantidad ELSE 0 END), 0)
           FROM cn_movimientos x WHERE x.material_id = m.id) AS stock
        FROM cn_materiales m WHERE m.activo AND m.stock_minimo > 0`),
      pool.query("SELECT id, proveedor_nombre, numero, total, vence FROM cn_compras WHERE estado = 'pendiente' AND NOT anulada AND vence IS NOT NULL AND vence <= CURRENT_DATE + 7 ORDER BY vence LIMIT 8"),
      pool.query("SELECT id, nombre, estado, fecha_presentacion, garantia_vence FROM cn_licitaciones WHERE estado IN ('en_estudio', 'presentada') ORDER BY COALESCE(fecha_presentacion, fecha_apertura) NULLS LAST LIMIT 20"),
      pool.query(`SELECT h.id, h.nombre, h.vence, l.nombre AS licitacion, l.id AS licitacion_id FROM cn_lic_hitos h JOIN cn_licitaciones l ON l.id = h.licitacion_id
        WHERE NOT h.cumplido AND h.vence IS NOT NULL AND h.vence <= CURRENT_DATE + 7 AND l.estado NOT IN ('perdida', 'desistida') ORDER BY h.vence LIMIT 10`),
    ]);
    const porEstado = {}; ob.rows.forEach(r => { porEstado[r.estado] = r.n; });
    const bajos = bajo.rows.filter(m => num(m.stock) < num(m.stock_minimo)).map(m => ({ id: m.id, nombre: m.nombre, unidad: m.unidad, stock: num(m.stock), minimo: num(m.stock_minimo) }));
    // Obras que se pasaron del presupuesto o gastan mas rapido de lo que avanzan
    const obras = (await pool.query("SELECT * FROM cn_obras WHERE estado IN ('en_curso', 'pausada', 'planificada')")).rows;
    const etapas = (await pool.query('SELECT * FROM cn_etapas')).rows;
    const costos = await costosPorObra();
    const alertas = [];
    obras.forEach(o => {
      const c = costos.de(o.id), pre = suma(c.presup), real = suma(c.real), av = avanceDe(o, etapas.filter(e => e.obra_id === o.id));
      if (pre > 0 && real > pre) alertas.push({ obra_id: o.id, obra: o.nombre, tipo: 'pasada', texto: 'Se pasó ' + Math.round(real - pre) + ' del presupuesto', monto: real - pre });
      else if (pre > 0 && real / pre * 100 > av + 15 && real > 0) alertas.push({ obra_id: o.id, obra: o.nombre, tipo: 'rapido', texto: 'Gastó el ' + Math.round(real / pre * 100) + '% del presupuesto y avanzó el ' + av + '%' });
    });
    res.json({
      obras: porEstado, compras_pendientes: comp.rows[0].n, a_pagar: num(comp.rows[0].total), materiales_bajo_minimo: bajos.length,
      bajo_minimo: bajos.slice(0, 8), compras_por_vencer: venc.rows.map(c => ({ ...c, total: num(c.total) })), alertas_obras: alertas,
      licitaciones_abiertas: lic.rows, hitos_por_vencer: hitos.rows,
    });
  } catch (e) { falla(res, e, 'resumen'); }
});

// ---------- obras ----------
router.get('/obras', async (req, res) => {
  try {
    const obras = (await pool.query('SELECT * FROM cn_obras ORDER BY (estado IN (\'terminada\', \'cancelada\')), creado_en DESC')).rows;
    const etapas = (await pool.query('SELECT * FROM cn_etapas')).rows;
    const costos = await costosPorObra();
    res.json(obras.map(o => {
      const c = costos.de(o.id);
      const presup = suma(c.presup), real = suma(c.real);
      return { ...o, avance: avanceDe(o, etapas.filter(e => e.obra_id === o.id)), etapas: etapas.filter(e => e.obra_id === o.id).length, presupuesto: presup, gastado: real, desvio: real - presup };
    }));
  } catch (e) { falla(res, e, 'obras'); }
});

router.post('/obras', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Ponele un nombre a la obra');
    await client.query('BEGIN');
    const estado = ESTADOS_OBRA.includes(b.estado) ? b.estado : 'planificada';
    const r = await client.query(
      `INSERT INTO cn_obras (nombre, cliente_id, cliente_nombre, direccion, estado, responsable, fecha_inicio, fecha_fin_prevista, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [txt(b.nombre), b.cliente_id || null, txt(b.cliente_nombre), txt(b.direccion), estado, txt(b.responsable), fechaOk(b.fecha_inicio), fechaOk(b.fecha_fin_prevista), txt(b.notas)]);
    // Cada obra tiene su "lugar" donde se guarda lo que llega
    await client.query("INSERT INTO cn_ubicaciones (nombre, tipo, obra_id, direccion) VALUES ($1, 'obra', $2, $3)", [r.rows[0].nombre, r.rows[0].id, r.rows[0].direccion]);
    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'nueva obra'); }
  finally { client.release(); }
});

router.get('/obras/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const o = (await pool.query('SELECT * FROM cn_obras WHERE id = $1', [id])).rows[0];
    if (!o) return res.status(404).json({ error: 'No encontramos esa obra' });
    const etapas = (await pool.query('SELECT * FROM cn_etapas WHERE obra_id = $1 ORDER BY orden, id', [id])).rows;
    const gastos = (await pool.query('SELECT g.* FROM cn_gastos g WHERE g.obra_id = $1 ORDER BY g.fecha DESC, g.id DESC', [id])).rows;
    const ub = (await pool.query("SELECT id FROM cn_ubicaciones WHERE tipo = 'obra' AND obra_id = $1", [id])).rows[0];
    const costos = await costosPorObra();
    const c = costos.de(id);
    let enObra = [];
    if (ub) enObra = (await pool.query(
      `SELECT m.id AS material_id, m.nombre, m.unidad, m.costo_promedio,
              SUM(CASE WHEN x.destino_id = $1 THEN x.cantidad ELSE 0 END) - SUM(CASE WHEN x.origen_id = $1 THEN x.cantidad ELSE 0 END) AS stock,
              SUM(CASE WHEN x.destino_id = $1 THEN x.cantidad ELSE 0 END) AS llego
       FROM cn_movimientos x JOIN cn_materiales m ON m.id = x.material_id
       WHERE x.destino_id = $1 OR x.origen_id = $1 GROUP BY m.id ORDER BY m.nombre`, [ub.id])).rows;
    res.json({ ...o, ubicacion_id: ub ? ub.id : null, avance: avanceDe(o, etapas), etapas, gastos,
      rubros: armarRubros(c), presupuesto: suma(c.presup), gastado: suma(c.real), desvio: suma(c.real) - suma(c.presup),
      materiales: enObra.map(x => ({ ...x, stock: num(x.stock), llego: num(x.llego) })) });
  } catch (e) { falla(res, e, 'obra'); }
});

router.put('/obras/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const id = Number(req.params.id);
    const sets = [], p = [];
    const poner = (col, val) => { p.push(val); sets.push(col + ' = $' + p.length); };
    if (b.nombre !== undefined) { if (!txt(b.nombre)) throw err(400, 'La obra necesita un nombre'); poner('nombre', txt(b.nombre)); }
    ['cliente_nombre', 'direccion', 'responsable', 'notas'].forEach(k => { if (b[k] !== undefined) poner(k, txt(b[k])); });
    if (b.cliente_id !== undefined) poner('cliente_id', b.cliente_id || null);
    ['fecha_inicio', 'fecha_fin_prevista', 'fecha_fin_real'].forEach(k => { if (b[k] !== undefined) poner(k, fechaOk(b[k])); });
    if (b.estado !== undefined) {
      if (!ESTADOS_OBRA.includes(b.estado)) throw err(400, 'Estado no válido');
      poner('estado', b.estado);
      if (b.estado === 'terminada' && b.fecha_fin_real === undefined) poner('fecha_fin_real', new Date().toISOString().slice(0, 10));
    }
    if (b.avance_manual !== undefined) poner('avance_manual', Math.max(0, Math.min(100, num(b.avance_manual))));
    if (!sets.length) return res.json({ ok: true });
    p.push(id);
    const r = await pool.query('UPDATE cn_obras SET ' + sets.join(', ') + ' WHERE id = $' + p.length + ' RETURNING *', p);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontramos esa obra' });
    if (b.nombre !== undefined) await pool.query("UPDATE cn_ubicaciones SET nombre = $1 WHERE tipo = 'obra' AND obra_id = $2", [r.rows[0].nombre, id]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'editar obra'); }
});

// ---------- etapas ----------
router.post('/obras/:id/etapas', async (req, res) => {
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Ponele un nombre a la etapa');
    const id = Number(req.params.id);
    const o = (await pool.query('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM cn_etapas WHERE obra_id = $1', [id])).rows[0].n;
    const r = await pool.query(
      `INSERT INTO cn_etapas (obra_id, nombre, orden, estado, avance, peso, fecha_desde, fecha_hasta, responsable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, txt(b.nombre), o, ESTADOS_ETAPA.includes(b.estado) ? b.estado : 'pendiente', Math.max(0, Math.min(100, num(b.avance))), num(b.peso) > 0 ? num(b.peso) : 1, fechaOk(b.fecha_desde), fechaOk(b.fecha_hasta), txt(b.responsable)]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'nueva etapa'); }
});
router.put('/etapas/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], p = [];
    const poner = (col, val) => { p.push(val); sets.push(col + ' = $' + p.length); };
    if (b.nombre !== undefined && txt(b.nombre)) poner('nombre', txt(b.nombre));
    if (b.estado !== undefined && ESTADOS_ETAPA.includes(b.estado)) {
      poner('estado', b.estado);
      if (b.estado === 'terminada' && b.avance === undefined) poner('avance', 100);
    }
    if (b.avance !== undefined) {
      const av = Math.max(0, Math.min(100, num(b.avance)));
      poner('avance', av);
      if (b.estado === undefined) poner('estado', av >= 100 ? 'terminada' : av > 0 ? 'en_curso' : 'pendiente');
    }
    if (b.peso !== undefined && num(b.peso) > 0) poner('peso', num(b.peso));
    ['fecha_desde', 'fecha_hasta'].forEach(k => { if (b[k] !== undefined) poner(k, fechaOk(b[k])); });
    if (b.responsable !== undefined) poner('responsable', txt(b.responsable));
    if (!sets.length) return res.json({ ok: true });
    p.push(Number(req.params.id));
    const r = await pool.query('UPDATE cn_etapas SET ' + sets.join(', ') + ' WHERE id = $' + p.length + ' RETURNING *', p);
    res.json(r.rows[0] || {});
  } catch (e) { falla(res, e, 'editar etapa'); }
});
router.delete('/etapas/:id', async (req, res) => {
  try { await pool.query('DELETE FROM cn_etapas WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e) { falla(res, e, 'borrar etapa'); }
});

// ---------- presupuesto y gastos ----------
router.put('/obras/:id/presupuesto', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const rubros = Array.isArray((req.body || {}).rubros) ? req.body.rubros : [];
    await client.query('BEGIN');
    for (const r of rubros) {
      const nombre = txt(r.rubro);
      if (!nombre) continue;
      const monto = Math.max(0, num(r.monto));
      await client.query(`INSERT INTO cn_presupuesto (obra_id, rubro, monto) VALUES ($1, $2, $3) ON CONFLICT (obra_id, rubro) DO UPDATE SET monto = EXCLUDED.monto`, [id, nombre, monto]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'presupuesto'); }
  finally { client.release(); }
});
router.post('/obras/:id/gastos', async (req, res) => {
  try {
    const b = req.body || {};
    const monto = num(b.monto);
    if (!(monto > 0)) throw err(400, 'Poné cuánto fue el gasto');
    const r = await pool.query(
      `INSERT INTO cn_gastos (obra_id, rubro, concepto, monto, fecha, proveedor_id, usuario) VALUES ($1,$2,$3,$4,COALESCE($5, CURRENT_DATE),$6,$7) RETURNING *`,
      [Number(req.params.id), txt(b.rubro) || 'Otros', txt(b.concepto), monto, fechaOk(b.fecha), b.proveedor_id || null, quien(req)]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'gasto'); }
});
router.delete('/gastos/:id', async (req, res) => {
  try { await pool.query('DELETE FROM cn_gastos WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e) { falla(res, e, 'borrar gasto'); }
});

// ---------- galpones y obras (ubicaciones) ----------
router.get('/ubicaciones', async (req, res) => {
  try {
    const r = await pool.query(`SELECT u.*, o.estado AS obra_estado FROM cn_ubicaciones u LEFT JOIN cn_obras o ON o.id = u.obra_id
      WHERE u.activo ORDER BY (u.tipo = 'obra'), u.nombre`);
    res.json(r.rows);
  } catch (e) { falla(res, e, 'ubicaciones'); }
});
router.post('/ubicaciones', async (req, res) => {
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Ponele un nombre al galpón');
    const r = await pool.query("INSERT INTO cn_ubicaciones (nombre, tipo, direccion) VALUES ($1, 'galpon', $2) RETURNING *", [txt(b.nombre), txt(b.direccion)]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'nuevo galpon'); }
});
router.put('/ubicaciones/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const u = (await pool.query('SELECT * FROM cn_ubicaciones WHERE id = $1', [Number(req.params.id)])).rows[0];
    if (!u) return res.status(404).json({ error: 'No encontramos ese lugar' });
    if (u.tipo === 'obra') throw err(400, 'El nombre de una obra se cambia desde la obra');
    if (b.activo === false) {
      const stock = await pool.query(`SELECT 1 FROM (SELECT material_id, SUM(CASE WHEN destino_id = $1 THEN cantidad ELSE -cantidad END) AS s FROM cn_movimientos WHERE destino_id = $1 OR origen_id = $1 GROUP BY material_id) q WHERE s <> 0 LIMIT 1`, [u.id]);
      if (stock.rows.length) throw err(400, 'Ese galpón todavía tiene mercadería. Pasala a otro lugar antes de cerrarlo.');
    }
    const r = await pool.query('UPDATE cn_ubicaciones SET nombre = COALESCE($1, nombre), direccion = COALESCE($2, direccion), activo = COALESCE($3, activo) WHERE id = $4 RETURNING *',
      [txt(b.nombre), b.direccion !== undefined ? txt(b.direccion) : null, typeof b.activo === 'boolean' ? b.activo : null, u.id]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'editar galpon'); }
});

// ---------- materiales ----------
router.get('/materiales', async (req, res) => {
  try {
    const mats = (await pool.query('SELECT * FROM cn_materiales WHERE activo ORDER BY nombre')).rows;
    const st = (await pool.query(`SELECT material_id, ubicacion_id, SUM(c) AS s FROM (
        SELECT material_id, destino_id AS ubicacion_id, cantidad AS c FROM cn_movimientos WHERE destino_id IS NOT NULL
        UNION ALL SELECT material_id, origen_id, -cantidad FROM cn_movimientos WHERE origen_id IS NOT NULL) q GROUP BY material_id, ubicacion_id`)).rows;
    const porMat = new Map();
    st.forEach(r => { if (!porMat.has(r.material_id)) porMat.set(r.material_id, {}); porMat.get(r.material_id)[r.ubicacion_id] = num(r.s); });
    const gal = new Set((await pool.query("SELECT id FROM cn_ubicaciones WHERE tipo = 'galpon'")).rows.map(r => r.id));
    res.json(mats.map(m => {
      const por = porMat.get(m.id) || {};
      const enGalpones = Object.entries(por).filter(([u]) => gal.has(Number(u))).reduce((a, [, v]) => a + v, 0);
      const total = Object.values(por).reduce((a, v) => a + v, 0);
      return { ...m, costo_promedio: num(m.costo_promedio), stock_minimo: num(m.stock_minimo), por_ubicacion: por, en_galpones: enGalpones, total, bajo_minimo: num(m.stock_minimo) > 0 && enGalpones < num(m.stock_minimo) };
    }));
  } catch (e) { falla(res, e, 'materiales'); }
});
router.post('/materiales', async (req, res) => {
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Ponele un nombre al material');
    const dup = await pool.query('SELECT * FROM cn_materiales WHERE activo AND LOWER(nombre) = LOWER($1) AND unidad = $2', [txt(b.nombre), txt(b.unidad) || 'u']);
    if (dup.rows.length) return res.json(dup.rows[0]);
    const r = await pool.query('INSERT INTO cn_materiales (nombre, unidad, categoria, codigo, costo_promedio, stock_minimo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [txt(b.nombre), txt(b.unidad) || 'u', txt(b.categoria), txt(b.codigo), Math.max(0, num(b.costo)), Math.max(0, num(b.stock_minimo))]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'nuevo material'); }
});
router.put('/materiales/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query(`UPDATE cn_materiales SET nombre = COALESCE($1, nombre), unidad = COALESCE($2, unidad), categoria = COALESCE($3, categoria),
      stock_minimo = COALESCE($4, stock_minimo), activo = COALESCE($5, activo) WHERE id = $6 RETURNING *`,
      [txt(b.nombre), txt(b.unidad), b.categoria !== undefined ? txt(b.categoria) : null, b.stock_minimo !== undefined ? Math.max(0, num(b.stock_minimo)) : null, typeof b.activo === 'boolean' ? b.activo : null, Number(req.params.id)]);
    res.json(r.rows[0] || {});
  } catch (e) { falla(res, e, 'editar material'); }
});

// ---------- movimientos ----------
// Registra varios renglones de golpe (una "salida" con muchos materiales) en una sola operacion.
// body: { tipo: entrada|salida|traspaso, origen_id, destino_id, motivo, nota, items: [{ material_id, cantidad }], permitir_negativo }
async function registrarMovimientos(client, { tipo, origen_id, destino_id, motivo, nota, items, usuario, compra_id, costos, permitir_negativo }) {
  if (!['entrada', 'salida', 'traspaso'].includes(tipo)) throw err(400, 'Tipo de movimiento no válido');
  if (tipo !== 'entrada' && !origen_id) throw err(400, 'Elegí de dónde sale');
  if (tipo !== 'salida' && !destino_id) throw err(400, 'Elegí a dónde va');
  if (tipo === 'traspaso' && Number(origen_id) === Number(destino_id)) throw err(400, 'El origen y el destino son el mismo lugar');
  if (!Array.isArray(items) || !items.length) throw err(400, 'Agregá al menos un material');
  const lote = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ids = [origen_id, destino_id].filter(Boolean).map(Number);
  const ub = (await client.query('SELECT id, nombre FROM cn_ubicaciones WHERE id = ANY($1) AND activo', [ids])).rows;
  if (ub.length !== new Set(ids).size) throw err(400, 'Uno de los lugares ya no existe o está cerrado');
  const nombreUb = (id) => (ub.find(u => u.id === Number(id)) || {}).nombre;
  // Si el mismo material viene dos veces, se juntan para controlar bien el stock
  const juntos = new Map();
  items.forEach(i => { const c = num(i.cantidad); if (i.material_id && c > 0) juntos.set(Number(i.material_id), (juntos.get(Number(i.material_id)) || 0) + c); });
  if (!juntos.size) throw err(400, 'Poné la cantidad de cada material');
  const hechos = [];
  for (const [matId, cant] of juntos) {
    const m = (await client.query('SELECT * FROM cn_materiales WHERE id = $1 FOR UPDATE', [matId])).rows[0];
    if (!m) throw err(400, 'Un material ya no existe');
    if (origen_id && !permitir_negativo) {
      const hay = await stockDe(client, matId, Number(origen_id));
      if (cant > hay + 0.0005) throw err(400, 'En ' + nombreUb(origen_id) + ' hay ' + hay + ' ' + m.unidad + ' de ' + m.nombre + ' y querés sacar ' + cant + '.');
    }
    const costo = costos && costos[matId] !== undefined ? num(costos[matId]) : num(m.costo_promedio);
    const r = await client.query(
      `INSERT INTO cn_movimientos (material_id, cantidad, origen_id, destino_id, tipo, motivo, costo_unitario, compra_id, lote, nota, usuario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [matId, cant, origen_id ? Number(origen_id) : null, destino_id ? Number(destino_id) : null, tipo, txt(motivo), costo, compra_id || null, lote, txt(nota), usuario]);
    hechos.push({ ...r.rows[0], material: m.nombre, unidad: m.unidad });
  }
  return hechos;
}

router.post('/movimientos', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    await client.query('BEGIN');
    const hechos = await registrarMovimientos(client, { ...b, usuario: quien(req) });
    await client.query('COMMIT');
    res.json({ ok: true, movimientos: hechos });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'movimiento'); }
  finally { client.release(); }
});

router.get('/movimientos', async (req, res) => {
  try {
    const { ubicacion_id, material_id, obra_id } = req.query;
    const p = [], w = [];
    if (ubicacion_id) { p.push(Number(ubicacion_id)); w.push('(x.origen_id = $' + p.length + ' OR x.destino_id = $' + p.length + ')'); }
    if (material_id) { p.push(Number(material_id)); w.push('x.material_id = $' + p.length); }
    if (obra_id) { p.push(Number(obra_id)); w.push('(uo.obra_id = $' + p.length + ' OR ud.obra_id = $' + p.length + ')'); }
    p.push(Math.min(500, Number(req.query.limit) || 100));
    const r = await pool.query(
      `SELECT x.*, m.nombre AS material, m.unidad, uo.nombre AS origen, ud.nombre AS destino
       FROM cn_movimientos x JOIN cn_materiales m ON m.id = x.material_id
       LEFT JOIN cn_ubicaciones uo ON uo.id = x.origen_id LEFT JOIN cn_ubicaciones ud ON ud.id = x.destino_id
       ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY x.fecha DESC, x.id DESC LIMIT $${p.length}`, p);
    res.json(r.rows.map(x => ({ ...x, cantidad: num(x.cantidad), costo_unitario: num(x.costo_unitario) })));
  } catch (e) { falla(res, e, 'movimientos'); }
});

// ---------- compras ----------
// Una compra guarda la factura, hace entrar la mercaderia a su galpon (u obra) y actualiza el costo de cada material.
router.get('/compras', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.nombre AS destino, (SELECT COUNT(*)::int FROM cn_compra_items i WHERE i.compra_id = c.id) AS renglones
       FROM cn_compras c LEFT JOIN cn_ubicaciones u ON u.id = c.destino_id ORDER BY c.fecha DESC, c.id DESC LIMIT 300`);
    res.json(r.rows.map(c => ({ ...c, total: num(c.total) })));
  } catch (e) { falla(res, e, 'compras'); }
});
router.get('/compras/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const c = (await pool.query('SELECT c.*, u.nombre AS destino FROM cn_compras c LEFT JOIN cn_ubicaciones u ON u.id = c.destino_id WHERE c.id = $1', [id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No encontramos esa compra' });
    const items = (await pool.query('SELECT i.*, m.nombre AS material, m.unidad FROM cn_compra_items i JOIN cn_materiales m ON m.id = i.material_id WHERE i.compra_id = $1 ORDER BY i.id', [id])).rows;
    res.json({ ...c, total: num(c.total), items: items.map(i => ({ ...i, cantidad: num(i.cantidad), costo_unitario: num(i.costo_unitario), subtotal: num(i.subtotal) })) });
  } catch (e) { falla(res, e, 'compra'); }
});

router.post('/compras', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    if (!b.destino_id) throw err(400, 'Elegí a qué galpón u obra entra la mercadería');
    const itemsIn = (Array.isArray(b.items) ? b.items : []).filter(i => num(i.cantidad) > 0);
    if (!itemsIn.length) throw err(400, 'Agregá al menos un material con su cantidad');
    await client.query('BEGIN');
    let provNombre = txt(b.proveedor_nombre);
    if (b.proveedor_id) {
      const p = (await client.query('SELECT nombre FROM proveedores WHERE id = $1', [Number(b.proveedor_id)])).rows[0];
      if (p) provNombre = p.nombre;
    }
    // Materiales nuevos (los que vinieron sin id) se crean al guardar
    const items = [];
    for (const i of itemsIn) {
      let matId = Number(i.material_id) || null;
      if (!matId) {
        const nom = txt(i.nombre || i.descripcion);
        if (!nom) throw err(400, 'Hay un renglón sin material');
        const ex = (await client.query('SELECT id FROM cn_materiales WHERE activo AND LOWER(nombre) = LOWER($1) AND unidad = $2', [nom, txt(i.unidad) || 'u'])).rows[0];
        matId = ex ? ex.id : (await client.query('INSERT INTO cn_materiales (nombre, unidad, costo_promedio) VALUES ($1,$2,0) RETURNING id', [nom, txt(i.unidad) || 'u'])).rows[0].id;
      }
      const costo = Math.max(0, num(i.costo_unitario));
      items.push({ material_id: matId, cantidad: num(i.cantidad), costo_unitario: costo, descripcion: txt(i.descripcion) });
    }
    const total = items.reduce((a, i) => a + i.cantidad * i.costo_unitario, 0);
    const pagada = b.estado === 'pagada';
    const c = (await client.query(
      `INSERT INTO cn_compras (proveedor_id, proveedor_nombre, fecha, numero, destino_id, total, estado, vence, pagada_en, nota, usuario)
       VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.proveedor_id || null, provNombre, fechaOk(b.fecha), txt(b.numero), Number(b.destino_id), Math.round(total * 100) / 100, pagada ? 'pagada' : 'pendiente', fechaOk(b.vence), pagada ? new Date().toISOString().slice(0, 10) : null, txt(b.nota), quien(req)])).rows[0];
    for (const i of items) {
      await client.query('INSERT INTO cn_compra_items (compra_id, material_id, descripcion, cantidad, costo_unitario, subtotal) VALUES ($1,$2,$3,$4,$5,$6)',
        [c.id, i.material_id, i.descripcion, i.cantidad, i.costo_unitario, Math.round(i.cantidad * i.costo_unitario * 100) / 100]);
    }
    // Costo promedio ponderado: antes de que entre lo nuevo, con el stock que ya hay en total
    for (const i of items) {
      const t = (await client.query(`SELECT COALESCE(SUM(CASE WHEN destino_id IS NOT NULL THEN cantidad ELSE 0 END) - SUM(CASE WHEN origen_id IS NOT NULL THEN cantidad ELSE 0 END), 0) AS s FROM cn_movimientos WHERE material_id = $1`, [i.material_id])).rows[0];
      const m = (await client.query('SELECT costo_promedio FROM cn_materiales WHERE id = $1 FOR UPDATE', [i.material_id])).rows[0];
      const hay = Math.max(0, num(t.s));
      const nuevo = i.costo_unitario > 0 ? ((hay * num(m.costo_promedio)) + (i.cantidad * i.costo_unitario)) / (hay + i.cantidad) : num(m.costo_promedio);
      await client.query('UPDATE cn_materiales SET costo_promedio = $1 WHERE id = $2', [Math.round(nuevo * 10000) / 10000, i.material_id]);
    }
    const costos = {}; items.forEach(i => { costos[i.material_id] = i.costo_unitario; });
    await registrarMovimientos(client, { tipo: 'entrada', destino_id: c.destino_id, motivo: 'Compra' + (c.numero ? ' ' + c.numero : '') + (provNombre ? ' · ' + provNombre : ''),
      items: items.map(i => ({ material_id: i.material_id, cantidad: i.cantidad })), usuario: quien(req), compra_id: c.id, costos });
    await client.query('COMMIT');
    res.json({ ...c, total: num(c.total) });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'nueva compra'); }
  finally { client.release(); }
});

router.put('/compras/:id/pagar', async (req, res) => {
  try {
    const r = await pool.query("UPDATE cn_compras SET estado = 'pagada', pagada_en = CURRENT_DATE WHERE id = $1 AND NOT anulada RETURNING *", [Number(req.params.id)]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontramos esa compra' });
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'pagar compra'); }
});

// Anular una compra cargada por error: la mercaderia sale del lugar donde entro (aunque haya que dejar el stock en negativo)
router.delete('/compras/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query('BEGIN');
    const c = (await client.query('SELECT * FROM cn_compras WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!c) throw err(404, 'No encontramos esa compra');
    if (c.anulada) throw err(400, 'Esa compra ya estaba anulada');
    const items = (await client.query('SELECT * FROM cn_compra_items WHERE compra_id = $1', [id])).rows;
    const costos = {}; items.forEach(i => { costos[i.material_id] = num(i.costo_unitario); });
    await registrarMovimientos(client, { tipo: 'salida', origen_id: c.destino_id, motivo: 'Compra anulada' + (c.numero ? ' ' + c.numero : ''),
      items: items.map(i => ({ material_id: i.material_id, cantidad: num(i.cantidad) })), usuario: quien(req), compra_id: id, costos, permitir_negativo: true });
    await client.query('UPDATE cn_compras SET anulada = TRUE WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'anular compra'); }
  finally { client.release(); }
});

// Lee una factura del proveedor (PDF, foto o Excel) con el mismo lector de Ingresos, y propone a que material
// de la obra corresponde cada renglon. No guarda nada: la pantalla lo muestra para revisar y confirmar.
const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
function parecido(a, b) {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = new Set(na.split(' ').filter(w => w.length > 2)), wb = new Set(nb.split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let comunes = 0; wa.forEach(w => { if (wb.has(w)) comunes++; });
  return comunes / Math.max(wa.size, wb.size);
}
router.post('/compras/leer-factura', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo de la factura' });
    const { analizarFactura } = require('./facturas-proveedor');
    const out = await analizarFactura(req.file, req.body.proveedor_id || null);
    const mats = (await pool.query('SELECT id, nombre, unidad FROM cn_materiales WHERE activo')).rows;
    const items = (out.items || []).map(it => {
      const ranking = mats.map(m => ({ m, s: parecido(it.nombre_crudo, m.nombre) })).filter(x => x.s >= 0.34).sort((a, b) => b.s - a.s);
      const mejor = ranking[0] && ranking[0].s >= 0.6 && (!ranking[1] || ranking[0].s - ranking[1].s >= 0.15) ? ranking[0].m : null;
      return { descripcion: it.nombre_crudo, cantidad: num(it.cantidad), costo_unitario: num(it.costo_unitario), dudoso: !!it.dudoso,
        material_id: mejor ? mejor.id : null, material: mejor ? mejor.nombre : null, unidad: mejor ? mejor.unidad : 'u',
        sugerencias: ranking.slice(0, 3).map(x => ({ id: x.m.id, nombre: x.m.nombre })) };
    });
    res.json({ items, total_factura: out.total_factura || null });
  } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    console.error('[constructora] leer factura:', e && e.message);
    res.status(500).json({ error: 'No pudimos leer esa factura. Probá con otro archivo o cargala a mano.' });
  }
});

// ---------- licitaciones ----------
// Estados: en_estudio -> presentada -> adjudicada (-> se pasa a obra) / perdida / desistida
const ESTADOS_LIC = ['en_estudio', 'presentada', 'adjudicada', 'perdida', 'desistida'];
router.get('/licitaciones', async (req, res) => {
  try {
    const r = await pool.query(`SELECT l.*, (SELECT COUNT(*)::int FROM cn_lic_hitos h WHERE h.licitacion_id = l.id) AS hitos,
        (SELECT COUNT(*)::int FROM cn_lic_hitos h WHERE h.licitacion_id = l.id AND h.cumplido) AS hitos_ok, o.nombre AS obra
      FROM cn_licitaciones l LEFT JOIN cn_obras o ON o.id = l.obra_id
      ORDER BY (l.estado IN ('perdida', 'desistida')), COALESCE(l.fecha_presentacion, l.fecha_apertura) NULLS LAST, l.id DESC`);
    res.json(r.rows.map(l => ({ ...l, presupuesto_oficial: num(l.presupuesto_oficial), monto_ofertado: num(l.monto_ofertado), monto_adjudicado: num(l.monto_adjudicado), garantia_monto: num(l.garantia_monto) })));
  } catch (e) { falla(res, e, 'licitaciones'); }
});
router.post('/licitaciones', async (req, res) => {
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Ponele un nombre a la licitación');
    const r = await pool.query(
      `INSERT INTO cn_licitaciones (nombre, organismo, numero, estado, fecha_apertura, fecha_presentacion, presupuesto_oficial, monto_ofertado, garantia_monto, garantia_vence, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [txt(b.nombre), txt(b.organismo), txt(b.numero), ESTADOS_LIC.includes(b.estado) ? b.estado : 'en_estudio', fechaOk(b.fecha_apertura), fechaOk(b.fecha_presentacion),
        Math.max(0, num(b.presupuesto_oficial)), Math.max(0, num(b.monto_ofertado)), Math.max(0, num(b.garantia_monto)), fechaOk(b.garantia_vence), txt(b.notas)]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'nueva licitacion'); }
});
router.get('/licitaciones/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const l = (await pool.query('SELECT * FROM cn_licitaciones WHERE id = $1', [id])).rows[0];
    if (!l) return res.status(404).json({ error: 'No encontramos esa licitación' });
    const hitos = (await pool.query('SELECT * FROM cn_lic_hitos WHERE licitacion_id = $1 ORDER BY cumplido, vence NULLS LAST, id', [id])).rows;
    let obra = null;
    if (l.obra_id) {
      const o = (await pool.query('SELECT * FROM cn_obras WHERE id = $1', [l.obra_id])).rows[0];
      if (o) {
        const etapas = (await pool.query('SELECT * FROM cn_etapas WHERE obra_id = $1', [o.id])).rows;
        const c = (await costosPorObra()).de(o.id);
        obra = { id: o.id, nombre: o.nombre, estado: o.estado, avance: avanceDe(o, etapas), gastado: suma(c.real), presupuesto: suma(c.presup), fecha_fin_prevista: o.fecha_fin_prevista };
      }
    }
    res.json({ ...l, presupuesto_oficial: num(l.presupuesto_oficial), monto_ofertado: num(l.monto_ofertado), monto_adjudicado: num(l.monto_adjudicado), garantia_monto: num(l.garantia_monto), hitos, obra });
  } catch (e) { falla(res, e, 'licitacion'); }
});
router.put('/licitaciones/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], p = [];
    const poner = (col, val) => { p.push(val); sets.push(col + ' = $' + p.length); };
    if (b.nombre !== undefined) { if (!txt(b.nombre)) throw err(400, 'Falta el nombre'); poner('nombre', txt(b.nombre)); }
    ['organismo', 'numero', 'notas'].forEach(k => { if (b[k] !== undefined) poner(k, txt(b[k])); });
    ['fecha_apertura', 'fecha_presentacion', 'garantia_vence'].forEach(k => { if (b[k] !== undefined) poner(k, fechaOk(b[k])); });
    ['presupuesto_oficial', 'monto_ofertado', 'monto_adjudicado', 'garantia_monto'].forEach(k => { if (b[k] !== undefined) poner(k, Math.max(0, num(b[k]))); });
    if (b.estado !== undefined) { if (!ESTADOS_LIC.includes(b.estado)) throw err(400, 'Estado no válido'); poner('estado', b.estado); }
    if (!sets.length) return res.json({ ok: true });
    p.push(Number(req.params.id));
    const r = await pool.query('UPDATE cn_licitaciones SET ' + sets.join(', ') + ' WHERE id = $' + p.length + ' RETURNING *', p);
    res.json(r.rows[0] || {});
  } catch (e) { falla(res, e, 'editar licitacion'); }
});
router.delete('/licitaciones/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query('BEGIN');
    await client.query('DELETE FROM cn_lic_hitos WHERE licitacion_id = $1', [id]);
    await client.query('DELETE FROM cn_licitaciones WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'borrar licitacion'); }
  finally { client.release(); }
});
router.post('/licitaciones/:id/hitos', async (req, res) => {
  try {
    const b = req.body || {};
    if (!txt(b.nombre)) throw err(400, 'Escribí qué hay que cumplir');
    const r = await pool.query('INSERT INTO cn_lic_hitos (licitacion_id, nombre, vence) VALUES ($1,$2,$3) RETURNING *', [Number(req.params.id), txt(b.nombre), fechaOk(b.vence)]);
    res.json(r.rows[0]);
  } catch (e) { falla(res, e, 'nuevo hito'); }
});
router.put('/hitos/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query(`UPDATE cn_lic_hitos SET cumplido = COALESCE($1, cumplido), cumplido_en = CASE WHEN $1 IS TRUE THEN CURRENT_DATE WHEN $1 IS FALSE THEN NULL ELSE cumplido_en END,
      vence = CASE WHEN $3 THEN $2 ELSE vence END WHERE id = $4 RETURNING *`,
      [typeof b.cumplido === 'boolean' ? b.cumplido : null, fechaOk(b.vence), b.vence !== undefined, Number(req.params.id)]);
    res.json(r.rows[0] || {});
  } catch (e) { falla(res, e, 'editar hito'); }
});
router.delete('/hitos/:id', async (req, res) => {
  try { await pool.query('DELETE FROM cn_lic_hitos WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
  catch (e) { falla(res, e, 'borrar hito'); }
});
// Una licitacion ganada pasa a ser una obra (con el mismo nombre, el organismo como cliente y el monto adjudicado de referencia)
router.post('/licitaciones/:id/pasar-a-obra', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query('BEGIN');
    const l = (await client.query('SELECT * FROM cn_licitaciones WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!l) throw err(404, 'No encontramos esa licitación');
    if (l.obra_id) throw err(400, 'Esta licitación ya tiene su obra');
    const o = (await client.query(`INSERT INTO cn_obras (nombre, cliente_nombre, estado, notas) VALUES ($1,$2,'planificada',$3) RETURNING *`,
      [l.nombre, l.organismo, 'Viene de la licitación' + (l.numero ? ' ' + l.numero : '')])).rows[0];
    await client.query("INSERT INTO cn_ubicaciones (nombre, tipo, obra_id) VALUES ($1, 'obra', $2)", [o.nombre, o.id]);
    await client.query("UPDATE cn_licitaciones SET obra_id = $1, estado = 'adjudicada', monto_adjudicado = CASE WHEN monto_adjudicado > 0 THEN monto_adjudicado ELSE monto_ofertado END WHERE id = $2", [o.id, id]);
    await client.query('COMMIT');
    res.json({ obra_id: o.id });
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} falla(res, e, 'pasar a obra'); }
  finally { client.release(); }
});

router.get('/rubros', (req, res) => res.json({ rubros: RUBROS, unidades: UNIDADES, estados_obra: ESTADOS_OBRA }));

module.exports = router;
