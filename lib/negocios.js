// Registro central de negocios. Vive en su propio schema (lumiere_central), fuera de los
// cajones de cada negocio, y guarda: que negocios hay, en que cajon esta cada uno, su estado
// (prueba / activo / vencido / suspendido) y a que negocio pertenece cada mail de ingreso.
// El negocio original queda como negocio 1 y su cajon es `public`: sus datos no se mueven.
const bcrypt = require('bcryptjs');
const { base } = require('../config/database');
const { SCHEMA_BASE } = require('./contexto');
const { leerEstructura, aplicarEstructura, nombreSchemaValido } = require('./estructura');

const C = 'lumiere_central';
const DIAS_PRUEBA = 7;
const limpio = (email) => String(email || '').trim().toLowerCase();

let listo = null;
function asegurarCentral() {
  if (!listo) listo = (async () => {
    await base.query(`CREATE SCHEMA IF NOT EXISTS ${C}`);
    await base.query(`CREATE TABLE IF NOT EXISTS ${C}.negocios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      schema TEXT NOT NULL UNIQUE,
      estado TEXT NOT NULL DEFAULT 'prueba',
      plan TEXT NOT NULL DEFAULT 'estrategico',
      prueba_hasta TIMESTAMPTZ,
      pais TEXT, moneda TEXT, email_contacto TEXT, telefono TEXT, notas TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activado_en TIMESTAMPTZ)`);
    await base.query(`CREATE TABLE IF NOT EXISTS ${C}.mails (
      email TEXT PRIMARY KEY,
      negocio_id INT NOT NULL REFERENCES ${C}.negocios(id) ON DELETE CASCADE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    // El negocio original: cajon public, activo
    let nombre = 'Negocio principal';
    try {
      const r = await base.query(`SELECT nombre_negocio FROM ${SCHEMA_BASE}.configuracion_negocio WHERE id = 1`);
      if (r.rows[0] && r.rows[0].nombre_negocio) nombre = r.rows[0].nombre_negocio;
    } catch (e) { /* base recien creada */ }
    await base.query(`INSERT INTO ${C}.negocios (id, nombre, schema, estado, plan, activado_en) VALUES (1, $1, $2, 'activo', 'estrategico', NOW()) ON CONFLICT (id) DO NOTHING`, [nombre, SCHEMA_BASE]);
    await base.query(`SELECT setval(pg_get_serial_sequence('${C}.negocios', 'id'), GREATEST((SELECT MAX(id) FROM ${C}.negocios), 1))`);
    // Los mails de sus usuarios (los que ya existian y los que se hayan creado mientras tanto)
    try {
      await base.query(`INSERT INTO ${C}.mails (email, negocio_id)
        SELECT DISTINCT LOWER(TRIM(email)), 1 FROM ${SCHEMA_BASE}.usuarios WHERE email IS NOT NULL AND email NOT LIKE 'eliminado-%'
        ON CONFLICT (email) DO NOTHING`);
    } catch (e) { /* sin tabla usuarios todavia */ }
  })().catch((e) => { listo = null; throw e; });
  return listo;
}

// ---------- consultas ----------
const cachePorId = new Map(); // id -> { t, negocio }
const VIGENCIA_MS = 30 * 1000;
function olvidar(id) { if (id === undefined) cachePorId.clear(); else cachePorId.delete(Number(id)); }

// Si el registro central tuviera un problema, el negocio original tiene que poder seguir trabajando
const ORIGINAL = { id: 1, nombre: 'Negocio principal', schema: SCHEMA_BASE, estado: 'activo', plan: 'estrategico', prueba_hasta: null };

async function negocioPorId(id) {
  const n = Number(id) || 1;
  const c = cachePorId.get(n);
  if (c && Date.now() - c.t < VIGENCIA_MS) return c.negocio;
  let r;
  try {
    await asegurarCentral();
    r = await base.query(`SELECT * FROM ${C}.negocios WHERE id = $1`, [n]);
  } catch (e) {
    if (n === 1) { console.error('[negocios] registro central con problemas, se sigue con el negocio original:', e.message); return ORIGINAL; }
    throw e;
  }
  const negocio = r.rows[0] || (n === 1 ? ORIGINAL : null);
  cachePorId.set(n, { t: Date.now(), negocio });
  return negocio;
}

async function negocioDeMail(email) {
  await asegurarCentral();
  const r = await base.query(`SELECT n.* FROM ${C}.mails m JOIN ${C}.negocios n ON n.id = m.negocio_id WHERE m.email = $1`, [limpio(email)]);
  return r.rows[0] || null;
}

async function listarNegocios() {
  await asegurarCentral();
  const r = await base.query(`SELECT n.*, (SELECT COUNT(*)::int FROM ${C}.mails m WHERE m.negocio_id = n.id) AS usuarios FROM ${C}.negocios n ORDER BY n.id`);
  return r.rows;
}

// Lo que la pantalla necesita saber del negocio (sin datos internos)
function resumen(n) {
  if (!n) return null;
  const hasta = n.prueba_hasta ? new Date(n.prueba_hasta) : null;
  const dias = hasta ? Math.ceil((hasta.getTime() - Date.now()) / 86400000) : null;
  const vencida = n.estado === 'prueba' && hasta && hasta.getTime() < Date.now();
  return { id: n.id, nombre: n.nombre, estado: vencida ? 'vencido' : n.estado, plan: n.plan, prueba_hasta: n.prueba_hasta, dias_prueba: n.estado === 'prueba' ? Math.max(0, dias || 0) : null };
}

// ---------- mails de ingreso ----------
// Un mail pertenece a un solo negocio (asi se entra solo con mail y contraseña).
async function mailLibre(email, negocioId) {
  await asegurarCentral();
  const r = await base.query(`SELECT negocio_id FROM ${C}.mails WHERE email = $1`, [limpio(email)]);
  return !r.rows.length || (negocioId && Number(r.rows[0].negocio_id) === Number(negocioId));
}
async function registrarMail(email, negocioId, cli) {
  await asegurarCentral();
  await (cli || base).query(`INSERT INTO ${C}.mails (email, negocio_id) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`, [limpio(email), negocioId]);
}
async function liberarMail(email, negocioId) {
  await asegurarCentral();
  await base.query(`DELETE FROM ${C}.mails WHERE email = $1 AND negocio_id = $2`, [limpio(email), negocioId]);
}

// ---------- crear un negocio nuevo ----------
// Lo minimo para que un negocio recien creado pueda trabajar. Solo se cargan las columnas
// basicas de cada tabla; el resto queda con sus valores por defecto.
const MEDIOS_PAGO = [
  ['Efectivo', 'efectivo', 1, false, 1.0, 0, false], ['Débito', 'debito', 1, false, 1.0, 0, true],
  ['Crédito 1 cuota', 'credito', 1, false, 1.0, 0, true], ['Transferencia', 'transferencia', 1, false, 1.0, 0, true],
];
const CATEGORIAS_COSTO = [
  ['Mercadería', 'variable'], ['Comisiones', 'variable'], ['Envíos', 'variable'], ['Alquiler', 'fijo'],
  ['Servicios (luz/agua/internet)', 'fijo'], ['Marketing', 'administrativo'], ['Sueldos', 'sueldo'],
];

async function cargarDatosIniciales(cli, modelo, d) {
  const tabla = (n) => modelo.tablas.find(t => t.nombre === n);
  const tiene = (t, c) => !!(tabla(t) && tabla(t).columnas.some(x => x.nombre === c));
  const alDia = async (t) => { if (tiene(t, 'id')) await cli.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST((SELECT MAX(id) FROM ${t}), 1)) WHERE pg_get_serial_sequence('${t}', 'id') IS NOT NULL`); };

  if (tabla('locales')) { await cli.query(`INSERT INTO locales (id, nombre, direccion, activo) VALUES (1, $1, $2, TRUE)`, [d.local || 'Local principal', d.direccion || null]); await alDia('locales'); }
  if (tabla('roles')) { await cli.query(`INSERT INTO roles (id, nombre) VALUES (1, 'Jefe'), (2, 'Administrativo'), (3, 'Vendedora')`); await alDia('roles'); }
  if (tabla('configuracion_negocio')) {
    await cli.query(`INSERT INTO configuracion_negocio (id, nombre_negocio, punto_venta) VALUES (1, $1, 1)`, [d.nombre]);
    if (d.moneda && tiene('configuracion_negocio', 'moneda')) await cli.query(`UPDATE configuracion_negocio SET moneda = $1 WHERE id = 1`, [JSON.stringify({ codigo: d.moneda })]);
  }
  if (tabla('config_ticket') && tiene('config_ticket', 'mensaje_pie')) await cli.query(`INSERT INTO config_ticket (id, mensaje_pie) VALUES (1, '¡Gracias por tu compra!')`);
  if (tabla('medios_pago')) {
    for (const m of MEDIOS_PAGO) await cli.query(`INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`, m);
  }
  if (tabla('categorias_costo')) {
    for (const c of CATEGORIAS_COSTO) await cli.query(`INSERT INTO categorias_costo (nombre, tipo) VALUES ($1, $2)`, c);
  }
  // Las migraciones de permisos son para usuarios viejos: en un negocio nuevo ya estan "hechas"
  if (tabla('permisos_meta')) await cli.query(`INSERT INTO permisos_meta (clave) VALUES ('permisos_v2'), ('permisos_v3'), ('permisos_v4') ON CONFLICT DO NOTHING`);
  const hash = await bcrypt.hash(d.password, 10);
  await cli.query(`INSERT INTO usuarios (nombre, email, password, rol, rol_id, local_id) VALUES ($1, $2, $3, 'jefe', 1, 1)`, [d.nombre_dueno || d.nombre, limpio(d.email), hash]);
}

// d: { nombre, email, password, nombre_dueno?, local?, moneda?, pais?, telefono?, estado?, dias_prueba? }
async function crearNegocio(d) {
  await asegurarCentral();
  const nombre = String(d.nombre || '').trim();
  const email = limpio(d.email);
  if (nombre.length < 2) throw Object.assign(new Error('Escribí el nombre del negocio'), { codigo: 'DATOS' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('El mail no es válido'), { codigo: 'DATOS' });
  if (String(d.password || '').length < 6) throw Object.assign(new Error('La contraseña tiene que tener al menos 6 caracteres'), { codigo: 'DATOS' });
  if (!(await mailLibre(email))) throw Object.assign(new Error('Ya hay una cuenta de Lumiere con ese mail'), { codigo: 'MAIL_USADO' });

  const estado = d.estado === 'activo' ? 'activo' : 'prueba';
  const dias = Number(d.dias_prueba) > 0 ? Number(d.dias_prueba) : DIAS_PRUEBA;
  const cli = await base.connect();
  try {
    await cli.query('BEGIN');
    const provisorio = 'pendiente_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    const r = await cli.query(
      `INSERT INTO ${C}.negocios (nombre, schema, estado, plan, prueba_hasta, pais, moneda, email_contacto, telefono, activado_en)
       VALUES ($1, $2, $3::text, 'estrategico', CASE WHEN $3::text = 'prueba' THEN NOW() + ($4::text || ' days')::interval END, $5, $6, $7, $8, CASE WHEN $3::text = 'activo' THEN NOW() END) RETURNING id`,
      [nombre, provisorio, estado, String(dias), d.pais || null, d.moneda || null, email, d.telefono || null]);
    const id = r.rows[0].id;
    const schema = 'n_' + id;
    if (!nombreSchemaValido(schema)) throw new Error('Nombre de cajón inválido');
    await cli.query(`UPDATE ${C}.negocios SET schema = $1 WHERE id = $2`, [schema, id]);
    const yaEsta = await cli.query(`SELECT 1 FROM ${C}.mails WHERE email = $1`, [email]);
    if (yaEsta.rows.length) throw Object.assign(new Error('Ya hay una cuenta de Lumiere con ese mail'), { codigo: 'MAIL_USADO' });
    await cli.query(`INSERT INTO ${C}.mails (email, negocio_id) VALUES ($1, $2)`, [email, id]);

    const modelo = await leerEstructura(cli, SCHEMA_BASE);
    await aplicarEstructura(cli, schema, modelo);
    await cli.query('SET LOCAL search_path TO "' + schema + '"');
    await cargarDatosIniciales(cli, modelo, { ...d, nombre, email });
    await cli.query('COMMIT');
    olvidar(id);
    return (await base.query(`SELECT * FROM ${C}.negocios WHERE id = $1`, [id])).rows[0];
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (x) {}
    throw e;
  } finally {
    cli.__schema = null;
    cli.release();
  }
}

// Pone al dia el cajon de cada negocio con lo que tenga de nuevo el cajon modelo (tablas o
// columnas que se sumaron al sistema). No toca datos ni borra nada.
async function ponerAlDia() {
  await asegurarCentral();
  const negocios = (await base.query(`SELECT id, schema FROM ${C}.negocios WHERE schema <> $1 ORDER BY id`, [SCHEMA_BASE])).rows;
  if (!negocios.length) return [];
  const cli = await base.connect();
  const hecho = [];
  try {
    const modelo = await leerEstructura(cli, SCHEMA_BASE);
    for (const n of negocios) {
      if (!nombreSchemaValido(n.schema)) continue;
      try {
        await cli.query('BEGIN');
        const h = await aplicarEstructura(cli, n.schema, modelo);
        await cli.query('COMMIT');
        if (Object.values(h).some(v => v > 0)) hecho.push({ id: n.id, ...h });
      } catch (e) {
        try { await cli.query('ROLLBACK'); } catch (x) {}
        console.error('[negocios] no se pudo poner al dia el negocio ' + n.id + ':', e.message);
      }
    }
  } finally {
    cli.__schema = null;
    cli.release();
  }
  return hecho;
}

async function cambiarEstado(id, cambios) {
  await asegurarCentral();
  const n = await base.query(`SELECT * FROM ${C}.negocios WHERE id = $1`, [id]);
  if (!n.rows.length) return null;
  const sets = [], vals = [];
  const poner = (col, v) => { vals.push(v); sets.push(col + ' = $' + vals.length); };
  if (cambios.estado && ['prueba', 'activo', 'suspendido'].includes(cambios.estado)) {
    poner('estado', cambios.estado);
    if (cambios.estado === 'activo' && !n.rows[0].activado_en) sets.push('activado_en = NOW()');
  }
  if (cambios.plan) poner('plan', cambios.plan);
  if (cambios.prueba_hasta !== undefined) poner('prueba_hasta', cambios.prueba_hasta);
  if (cambios.notas !== undefined) poner('notas', cambios.notas);
  if (cambios.nombre) poner('nombre', cambios.nombre);
  if (!sets.length) return n.rows[0];
  vals.push(id);
  const r = await base.query(`UPDATE ${C}.negocios SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  olvidar(id);
  return r.rows[0];
}

module.exports = { ORIGINAL, asegurarCentral, negocioPorId, negocioDeMail, listarNegocios, resumen, mailLibre, registrarMail, liberarMail, crearNegocio, ponerAlDia, cambiarEstado, olvidar, DIAS_PRUEBA };
