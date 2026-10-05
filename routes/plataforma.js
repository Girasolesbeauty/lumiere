const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const pool = require('../config/database');
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');
const { nombreSchemaValido } = require('../lib/estructura');

// Panel de la plataforma: lo usa solo quien administra Lumiere (no los clientes). Desde aca
// se ven todos los negocios, se crean nuevos, se activan cuando pagan, se les da mas dias de
// prueba o se suspenden.
// Quien puede entrar: el dueño (rol jefe) del negocio original (negocio 1). Si se define la
// variable de entorno PLATAFORMA_ADMINS (mails separados por coma), solo esos mails.
function esAdmin(req) {
  if (!req.usuario || !req.negocio) return false;
  if (Number(req.negocio.id) !== 1 || req.usuario.rol !== 'jefe') return false;
  const lista = (process.env.PLATAFORMA_ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (lista.length && !lista.includes(String(req.usuario.email || '').toLowerCase())) return false;
  return true;
}
function soloAdmin(req, res, next) {
  if (!esAdmin(req)) return res.status(403).json({ error: 'Esta sección es solo para la administración de Lumiere' });
  next();
}

// La pantalla pregunta si tiene que mostrar el panel (no da error si no corresponde)
router.get('/acceso', (req, res) => res.json({ admin: esAdmin(req) }));

// Cuanto se usa cada negocio: ventas, productos y ultima venta (leido de su propio cajon)
async function actividad(n) {
  if (!nombreSchemaValido(n.schema)) return {};
  const s = '"' + n.schema + '"';
  const uno = async (sql) => { try { return (await negocios.baseQuery(sql)).rows[0] || {}; } catch (e) { return {}; } };
  const [v, p] = await Promise.all([
    uno(`SELECT COUNT(*)::int AS ventas, MAX(creado_en) AS ultima_venta FROM ${s}.ventas`),
    uno(`SELECT COUNT(*)::int AS productos FROM ${s}.productos`),
  ]);
  return { ventas: v.ventas || 0, ultima_venta: v.ultima_venta || null, productos: p.productos || 0 };
}

router.get('/negocios', soloAdmin, async (req, res) => {
  try {
    const lista = await negocios.listarNegocios();
    const acept = await negocios.ultimaAceptacionPorNegocio().catch(() => ({}));
    const out = [];
    for (const n of lista) {
      const r = negocios.resumen(n);
      out.push({
        id: n.id, nombre: n.nombre, estado: r.estado, plan: n.plan, prueba_hasta: n.prueba_hasta, dias_prueba: r.dias_prueba,
        pais: n.pais, moneda: n.moneda, email_contacto: n.email_contacto, telefono: n.telefono, notas: n.notas,
        creado_en: n.creado_en, activado_en: n.activado_en, usuarios: n.usuarios, original: Number(n.id) === 1,
        terminos: acept[n.id] ? { version: acept[n.id].version, aceptado_en: acept[n.id].aceptado_en, email: acept[n.id].email } : null,
        ...(await actividad(n)),
      });
    }
    res.json(out);
  } catch (e) {
    console.error('[plataforma] lista:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la lista de negocios' });
  }
});

router.post('/negocios', soloAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const n = await negocios.crearNegocio({
      nombre: b.nombre, email: b.email, password: b.password, nombre_dueno: b.nombre_dueno, local: b.local,
      moneda: b.moneda, pais: b.pais, telefono: b.telefono, estado: b.estado, dias_prueba: b.dias_prueba,
    });
    if (b.notas) await negocios.cambiarEstado(n.id, { notas: String(b.notas) });
    res.status(201).json({ id: n.id, nombre: n.nombre, ...negocios.resumen(n) });
  } catch (e) {
    if (e.codigo === 'DATOS' || e.codigo === 'MAIL_USADO') return res.status(400).json({ error: e.message });
    console.error('[plataforma] alta:', e.message);
    res.status(500).json({ error: 'No se pudo crear el negocio. No quedó nada a medias: probá de nuevo.' });
  }
});

// Cambios: activar, suspender, volver a prueba, sumar dias de prueba, plan, notas, nombre
router.put('/negocios/:id', soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body || {};
    const actual = await negocios.negocioPorId(id);
    if (!actual) return res.status(404).json({ error: 'Negocio no encontrado' });
    const cambios = {};
    if (b.estado) {
      if (id === 1 && b.estado !== 'activo') return res.status(400).json({ error: 'El negocio original no se puede suspender ni pasar a prueba' });
      cambios.estado = b.estado;
    }
    if (b.plan) cambios.plan = String(b.plan);
    if (b.notas !== undefined) cambios.notas = String(b.notas || '');
    if (b.nombre) cambios.nombre = String(b.nombre).trim();
    // Mas dias de prueba: se cuentan desde hoy si ya vencio, o se suman a lo que le queda
    const sumar = Number(b.sumar_dias);
    if (sumar > 0 && sumar <= 365) {
      const desde = actual.prueba_hasta && new Date(actual.prueba_hasta).getTime() > Date.now() ? new Date(actual.prueba_hasta) : new Date();
      cambios.prueba_hasta = new Date(desde.getTime() + sumar * 86400000).toISOString();
      if (!cambios.estado && actual.estado !== 'activo') cambios.estado = 'prueba';
    }
    const n = await negocios.cambiarEstado(id, cambios);
    res.json({ id: n.id, nombre: n.nombre, ...negocios.resumen(n) });
  } catch (e) {
    console.error('[plataforma] cambio:', e.message);
    res.status(500).json({ error: 'No se pudo guardar el cambio' });
  }
});

// Soporte: poner una contraseña nueva al dueño de un negocio (cuando se la olvido)
router.put('/negocios/:id/password', soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (id === 1) return res.status(400).json({ error: 'La contraseña del negocio original se cambia desde Usuarios' });
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres' });
    const n = await negocios.negocioPorId(id);
    if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });
    const hash = await bcrypt.hash(String(password), 10);
    const r = await enNegocio({ id: n.id, schema: n.schema }, () =>
      pool.query(`UPDATE usuarios SET password = $1 WHERE LOWER(email) = LOWER($2) AND NOT COALESCE(eliminado, FALSE) RETURNING id`, [hash, n.email_contacto || '']));
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró al dueño de ese negocio (¿cambió su mail?)' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[plataforma] password:', e.message);
    res.status(500).json({ error: 'No se pudo cambiar la contraseña' });
  }
});

module.exports = router;
module.exports.esAdmin = esAdmin;
