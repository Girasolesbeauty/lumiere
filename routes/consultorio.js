const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
const wa = require('../lib/whatsappOficial');

// Consultorio: agenda de turnos por profesional, tratamientos (duracion, precio y cada cuanto
// conviene volver), historia del paciente (datos clinicos, evoluciones y fotos antes/despues),
// recordatorios de turnos y "volver a sacar turno".
// Los pacientes son los clientes del sistema (asi el cobro, la cuenta corriente y Postventa
// funcionan igual). El turno no mueve caja: se cobra en el Punto de Venta.
// Estados del turno: reservado -> confirmado -> presente -> atendido; o ausente / cancelado.

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_config (
    id INT PRIMARY KEY DEFAULT 1,
    hora_desde TEXT NOT NULL DEFAULT '09:00',
    hora_hasta TEXT NOT NULL DEFAULT '20:00',
    intervalo INT NOT NULL DEFAULT 30,
    msj_recordatorio TEXT,
    msj_volver TEXT)`);
  await pool.query(`INSERT INTO cons_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  // Como se mandan los mensajes: 'toque' (la recepcion toca Enviar) o 'automatico' (WhatsApp oficial)
  for (const col of [
    "modo_mensajes TEXT NOT NULL DEFAULT 'toque'", 'wa_token TEXT', 'wa_phone_id TEXT', 'wa_plantilla_recordatorio TEXT', 'wa_plantilla_volver TEXT',
    "wa_idioma TEXT NOT NULL DEFAULT 'es_AR'", "hora_recordatorio TEXT NOT NULL DEFAULT '10:00'", 'volver_auto BOOLEAN NOT NULL DEFAULT FALSE',
  ]) await pool.query('ALTER TABLE cons_config ADD COLUMN IF NOT EXISTS ' + col);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_profesionales (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    especialidad TEXT,
    color TEXT,
    usuario_id INT,
    activo BOOLEAN NOT NULL DEFAULT TRUE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_servicios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    duracion_min INT NOT NULL DEFAULT 30,
    precio NUMERIC(14,2) NOT NULL DEFAULT 0,
    volver_dias INT,
    color TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_turnos (
    id SERIAL PRIMARY KEY,
    paciente_id INT,
    paciente_nombre TEXT,
    telefono TEXT,
    profesional_id INT,
    servicio_id INT,
    servicio_nombre TEXT,
    inicio TIMESTAMP NOT NULL,
    fin TIMESTAMP NOT NULL,
    precio NUMERIC(14,2),
    estado TEXT NOT NULL DEFAULT 'reservado',
    nota TEXT,
    recordatorio_en TIMESTAMP,
    venta_id INT,
    local_id INT NOT NULL DEFAULT 1,
    creado_por TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS cons_turnos_inicio_idx ON cons_turnos (inicio)`);
  await pool.query('ALTER TABLE cons_turnos ADD COLUMN IF NOT EXISTS recordatorio_auto BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query('ALTER TABLE cons_turnos ADD COLUMN IF NOT EXISTS recordatorio_error TEXT');
  await pool.query('ALTER TABLE cons_turnos ADD COLUMN IF NOT EXISTS recordatorio_intentos INT NOT NULL DEFAULT 0');
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_fichas (
    paciente_id INT PRIMARY KEY,
    obra_social TEXT,
    nro_afiliado TEXT,
    antecedentes TEXT,
    alergias TEXT,
    medicacion TEXT,
    notas TEXT,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_evoluciones (
    id SERIAL PRIMARY KEY,
    paciente_id INT NOT NULL,
    turno_id INT,
    profesional TEXT,
    texto TEXT NOT NULL,
    creado_por TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_fotos (
    id SERIAL PRIMARY KEY,
    paciente_id INT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'otra',
    zona TEXT,
    nota TEXT,
    imagen TEXT NOT NULL,
    miniatura TEXT,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_por TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS cons_contactos (
    id SERIAL PRIMARY KEY,
    paciente_id INT NOT NULL,
    servicio_id INT,
    creado_por TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query('ALTER TABLE cons_contactos ADD COLUMN IF NOT EXISTS auto BOOLEAN NOT NULL DEFAULT FALSE');
  listo.set(true);
}

const ESTADOS = ['reservado', 'confirmado', 'presente', 'atendido', 'ausente', 'cancelado'];
const esJefe = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const num = (x) => parseFloat(x) || 0;
const loc = (req) => (String((req.query && req.query.local_id) || (req.body && req.body.local_id) || 1) === '2' ? 2 : 1);
const fechaOk = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
const fechaHoraOk = (f) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(f || ''));
const hoyAR = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
const isoDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
async function nombreUsuario(req) {
  try { const r = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
}
// Se trabaja con la hora local de Argentina guardada "tal cual" (sin zona), como la escribe la agenda
const sinZona = (s) => String(s).slice(0, 16).replace('T', ' ') + ':00';
const fmtTurno = (t) => ({ ...t, precio: t.precio === null ? null : num(t.precio), inicio: String(t.inicio_txt || '').replace(' ', 'T'), fin: String(t.fin_txt || '').replace(' ', 'T') });
const SELECT_TURNO = `SELECT t.*, to_char(t.inicio, 'YYYY-MM-DD HH24:MI') AS inicio_txt, to_char(t.fin, 'YYYY-MM-DD HH24:MI') AS fin_txt,
  p.nombre AS profesional_nombre, p.color AS profesional_color FROM cons_turnos t LEFT JOIN cons_profesionales p ON p.id = t.profesional_id`;

// ---------- Configuracion ----------
const MSJ_RECORDATORIO = 'Hola {nombre}! Te recordamos tu turno de {tratamiento} el {dia} a las {hora} en {negocio}. ¿Nos confirmás si venís? Si no podés, avisanos así se lo damos a otra persona. ¡Gracias!';
const MSJ_VOLVER = 'Hola {nombre}! ¿Cómo estás? Ya pasaron {tiempo} de tu último {tratamiento} en {negocio}. Para mantener los resultados te recomendamos repetirlo. ¿Querés que te reservemos un turno? 😊';

router.get('/config', async (req, res) => {
  try {
    await asegurar();
    const c = (await pool.query('SELECT * FROM cons_config WHERE id = 1')).rows[0];
    const prof = (await pool.query('SELECT * FROM cons_profesionales WHERE activo ORDER BY id')).rows;
    const serv = (await pool.query('SELECT * FROM cons_servicios WHERE activo ORDER BY nombre')).rows.map(s => ({ ...s, precio: num(s.precio) }));
    const neg = (await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    res.json({
      hora_desde: c.hora_desde, hora_hasta: c.hora_hasta, intervalo: c.intervalo,
      msj_recordatorio: c.msj_recordatorio || MSJ_RECORDATORIO, msj_volver: c.msj_volver || MSJ_VOLVER,
      modo_mensajes: c.modo_mensajes || 'toque', wa_conectado: !!(c.wa_token && c.wa_phone_id), wa_phone_id: c.wa_phone_id || '',
      wa_plantilla_recordatorio: c.wa_plantilla_recordatorio || '', wa_plantilla_volver: c.wa_plantilla_volver || '', wa_idioma: c.wa_idioma || 'es_AR',
      hora_recordatorio: c.hora_recordatorio || '10:00', volver_auto: !!c.volver_auto,
      negocio: neg.nombre_negocio || '', profesionales: prof, servicios: serv,
    });
  } catch (e) {
    console.error('[consultorio] config:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la configuración' });
  }
});

router.put('/config', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado puede cambiar esto' });
    await asegurar();
    const b = req.body || {};
    const hora = (h, def) => /^\d{2}:\d{2}$/.test(String(h || '')) ? h : def;
    const intervalo = [10, 15, 20, 30, 45, 60].includes(parseInt(b.intervalo)) ? parseInt(b.intervalo) : 30;
    await pool.query(`UPDATE cons_config SET hora_desde=$1, hora_hasta=$2, intervalo=$3, msj_recordatorio=$4, msj_volver=$5 WHERE id=1`,
      [hora(b.hora_desde, '09:00'), hora(b.hora_hasta, '20:00'), intervalo,
       String(b.msj_recordatorio || '').trim().slice(0, 600) || null, String(b.msj_volver || '').trim().slice(0, 600) || null]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Mensajes automaticos (WhatsApp oficial). El token no vuelve nunca al navegador.
router.put('/whatsapp', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado puede cambiar esto' });
    await asegurar();
    const b = req.body || {};
    const modo = b.modo_mensajes === 'automatico' ? 'automatico' : 'toque';
    const c = (await pool.query('SELECT wa_token FROM cons_config WHERE id = 1')).rows[0] || {};
    const token = String(b.wa_token || '').trim() || c.wa_token || null;
    const phone = String(b.wa_phone_id || '').replace(/[^0-9]/g, '') || null;
    const plRec = String(b.wa_plantilla_recordatorio || '').trim().slice(0, 100) || null;
    if (modo === 'automatico' && (!token || !phone || !plRec)) return res.status(400).json({ error: 'Para el modo automático completá el token, el ID del número y el nombre de la plantilla de recordatorio' });
    await pool.query(`UPDATE cons_config SET modo_mensajes=$1, wa_token=$2, wa_phone_id=$3, wa_plantilla_recordatorio=$4, wa_plantilla_volver=$5, wa_idioma=$6, hora_recordatorio=$7, volver_auto=$8 WHERE id=1`,
      [modo, token, phone, plRec, String(b.wa_plantilla_volver || '').trim().slice(0, 100) || null, String(b.wa_idioma || 'es_AR').trim().slice(0, 10) || 'es_AR',
       /^\d{2}:\d{2}$/.test(String(b.hora_recordatorio || '')) ? b.hora_recordatorio : '10:00', !!b.volver_auto && !!String(b.wa_plantilla_volver || '').trim()]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Mandar un mensaje de prueba con la plantilla de recordatorio
router.post('/whatsapp/probar', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await asegurar();
    const c = (await pool.query('SELECT * FROM cons_config WHERE id = 1')).rows[0] || {};
    const neg = (await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {};
    const r = await wa.enviarPlantilla({ token: c.wa_token, phoneId: c.wa_phone_id, telefono: req.body && req.body.telefono, plantilla: c.wa_plantilla_recordatorio,
      idioma: c.wa_idioma, parametros: ['Prueba', 'Consulta', 'mañana', '10:00', neg.nombre_negocio || 'el consultorio'] });
    res.json({ ok: true, id: r.id });
  } catch (e) { res.status(400).json({ error: 'WhatsApp no aceptó el mensaje: ' + e.message }); }
});

// Envio automatico (lo llama jobs/consultorioMensajes.js dentro del cajon de cada negocio).
// Recordatorios: a partir de la hora elegida, a los turnos de manana que no lo recibieron.
// Volver a sacar turno (si esta activado): a los que ya les toca y no fueron contactados.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
async function enviarAutomaticos() {
  await asegurar();
  const c = (await pool.query('SELECT * FROM cons_config WHERE id = 1')).rows[0] || {};
  if (c.modo_mensajes !== 'automatico' || !c.wa_token || !c.wa_phone_id || !c.wa_plantilla_recordatorio) return { omitido: true };
  const ahora = hoyAR();
  const hhmm = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
  if (hhmm < (c.hora_recordatorio || '10:00')) return { temprano: true };
  const neg = ((await pool.query('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1').catch(() => ({ rows: [] }))).rows[0] || {}).nombre_negocio || 'el consultorio';
  const man = new Date(ahora); man.setDate(man.getDate() + 1);
  const turnos = (await pool.query(`SELECT id, paciente_nombre, telefono, servicio_nombre, inicio, to_char(inicio, 'HH24:MI') AS hora FROM cons_turnos
    WHERE inicio >= $1::date AND inicio < $1::date + 1 AND estado IN ('reservado','confirmado') AND recordatorio_en IS NULL
      AND recordatorio_intentos < 3 AND COALESCE(telefono, '') <> '' ORDER BY inicio LIMIT 200`, [isoDia(man)])).rows;
  let enviados = 0, fallidos = 0;
  for (const t of turnos) {
    // Se marca el intento antes de mandar: si hubiera dos servidores, no se manda dos veces
    const marca = await pool.query('UPDATE cons_turnos SET recordatorio_intentos = recordatorio_intentos + 1 WHERE id = $1 AND recordatorio_en IS NULL RETURNING recordatorio_intentos', [t.id]);
    if (!marca.rows.length) continue;
    const d = new Date(t.inicio);
    try {
      await wa.enviarPlantilla({ token: c.wa_token, phoneId: c.wa_phone_id, telefono: t.telefono, plantilla: c.wa_plantilla_recordatorio, idioma: c.wa_idioma,
        parametros: [String(t.paciente_nombre || '').split(' ')[0], t.servicio_nombre || 'tu turno', DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1), t.hora, neg] });
      await pool.query('UPDATE cons_turnos SET recordatorio_en = NOW(), recordatorio_auto = TRUE, recordatorio_error = NULL WHERE id = $1', [t.id]);
      enviados++;
    } catch (e) {
      await pool.query('UPDATE cons_turnos SET recordatorio_error = $1 WHERE id = $2', [String(e.message).slice(0, 300), t.id]);
      fallidos++;
    }
  }
  let volver = 0;
  if (c.volver_auto && c.wa_plantilla_volver) {
    const lista = (await pool.query(`
      WITH ult AS (
        SELECT DISTINCT ON (t.paciente_id, t.servicio_id) t.paciente_id, t.servicio_id, t.inicio, s.nombre AS servicio, s.volver_dias
        FROM cons_turnos t JOIN cons_servicios s ON s.id = t.servicio_id
        WHERE t.estado = 'atendido' AND t.paciente_id IS NOT NULL AND s.volver_dias IS NOT NULL
        ORDER BY t.paciente_id, t.servicio_id, t.inicio DESC)
      SELECT u.*, cl.nombre, cl.telefono, (CURRENT_DATE - u.inicio::date) AS dias FROM ult u JOIN clientes cl ON cl.id = u.paciente_id
      WHERE CURRENT_DATE - u.inicio::date >= u.volver_dias AND COALESCE(cl.telefono, '') <> ''
        AND NOT EXISTS (SELECT 1 FROM cons_turnos f WHERE f.paciente_id = u.paciente_id AND f.inicio > NOW() AND f.estado NOT IN ('cancelado','ausente'))
        AND NOT EXISTS (SELECT 1 FROM cons_contactos k WHERE k.paciente_id = u.paciente_id AND k.servicio_id = u.servicio_id AND k.creado_en > u.inicio)
      LIMIT 30`)).rows;
    for (const x of lista) {
      await pool.query('INSERT INTO cons_contactos (paciente_id, servicio_id, creado_por, auto) VALUES ($1,$2,$3,TRUE)', [x.paciente_id, x.servicio_id, 'Automático']);
      const dias = parseInt(x.dias);
      try {
        await wa.enviarPlantilla({ token: c.wa_token, phoneId: c.wa_phone_id, telefono: x.telefono, plantilla: c.wa_plantilla_volver, idioma: c.wa_idioma,
          parametros: [String(x.nombre || '').split(' ')[0], x.servicio, dias >= 60 ? Math.round(dias / 30) + ' meses' : dias + ' días', neg] });
        volver++;
      } catch (e) { console.error('[consultorio] volver automatico:', e.message); }
    }
  }
  return { enviados, fallidos, volver };
}

// Profesionales y tratamientos (alta / edicion / baja)
router.post('/profesionales', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await asegurar();
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim().slice(0, 80);
    if (!nombre) return res.status(400).json({ error: 'Poné el nombre del profesional' });
    const vals = [nombre, String(b.especialidad || '').trim().slice(0, 80) || null, String(b.color || '').slice(0, 20) || null];
    const r = b.id
      ? await pool.query('UPDATE cons_profesionales SET nombre=$1, especialidad=$2, color=$3 WHERE id=$4 RETURNING *', [...vals, b.id])
      : await pool.query('INSERT INTO cons_profesionales (nombre, especialidad, color) VALUES ($1,$2,$3) RETURNING *', vals);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.delete('/profesionales/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await asegurar();
    await pool.query('UPDATE cons_profesionales SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});
router.post('/servicios', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await asegurar();
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim().slice(0, 100);
    if (!nombre) return res.status(400).json({ error: 'Poné el nombre del tratamiento' });
    const dur = Math.min(600, Math.max(5, parseInt(b.duracion_min) || 30));
    const vals = [nombre, dur, Math.max(0, num(b.precio)), parseInt(b.volver_dias) > 0 ? parseInt(b.volver_dias) : null, String(b.color || '').slice(0, 20) || null];
    const r = b.id
      ? await pool.query('UPDATE cons_servicios SET nombre=$1, duracion_min=$2, precio=$3, volver_dias=$4, color=$5 WHERE id=$6 RETURNING *', [...vals, b.id])
      : await pool.query('INSERT INTO cons_servicios (nombre, duracion_min, precio, volver_dias, color) VALUES ($1,$2,$3,$4,$5) RETURNING *', vals);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});
router.delete('/servicios/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    await asegurar();
    await pool.query('UPDATE cons_servicios SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

// ---------- Turnos ----------
router.get('/turnos', async (req, res) => {
  try {
    await asegurar();
    const desde = fechaOk(req.query.desde) ? req.query.desde : isoDia(hoyAR());
    const hasta = fechaOk(req.query.hasta) ? req.query.hasta : desde;
    const r = await pool.query(`${SELECT_TURNO} WHERE t.inicio >= $1::date AND t.inicio < $2::date + 1 AND t.local_id = $3 ORDER BY t.inicio`, [desde, hasta, loc(req)]);
    res.json(r.rows.map(fmtTurno));
  } catch (e) {
    console.error('[consultorio] turnos:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la agenda' });
  }
});

// Valida y arma un turno; avisa si el profesional ya tiene otro turno en ese horario
async function leerTurno(b, excluirId) {
  if (!fechaHoraOk(b.inicio)) return { error: 'Elegí el día y la hora' };
  let paciente_id = parseInt(b.paciente_id) || null;
  let nombre = String(b.paciente_nombre || '').trim().slice(0, 120);
  let tel = String(b.telefono || '').trim().slice(0, 40);
  if (paciente_id) {
    const c = (await pool.query('SELECT nombre, telefono FROM clientes WHERE id = $1', [paciente_id])).rows[0];
    if (!c) return { error: 'No se encontró el paciente' };
    nombre = c.nombre; tel = tel || c.telefono || '';
  }
  if (!nombre) return { error: 'Elegí o escribí el paciente' };
  const serv = parseInt(b.servicio_id) ? (await pool.query('SELECT * FROM cons_servicios WHERE id = $1', [parseInt(b.servicio_id)])).rows[0] : null;
  const dur = Math.min(600, Math.max(5, parseInt(b.duracion_min) || (serv && serv.duracion_min) || 30));
  const inicio = sinZona(b.inicio);
  const fin = (await pool.query(`SELECT to_char($1::timestamp + ($2 || ' minutes')::interval, 'YYYY-MM-DD HH24:MI:SS') AS f`, [inicio, String(dur)])).rows[0].f;
  const prof = parseInt(b.profesional_id) || null;
  if (prof) {
    const choca = (await pool.query(`SELECT paciente_nombre, to_char(inicio, 'HH24:MI') AS h FROM cons_turnos
      WHERE profesional_id = $1 AND estado NOT IN ('cancelado','ausente') AND inicio < $3::timestamp AND fin > $2::timestamp AND id <> $4 LIMIT 1`,
      [prof, inicio, fin, excluirId || 0])).rows[0];
    if (choca && !b.forzar) return { error: 'Ese horario se superpone con el turno de ' + choca.paciente_nombre + ' (' + choca.h + ')', choca: true };
  }
  return {
    paciente_id, paciente_nombre: nombre, telefono: tel || null, profesional_id: prof,
    servicio_id: serv ? serv.id : null, servicio_nombre: serv ? serv.nombre : (String(b.servicio_nombre || '').trim().slice(0, 100) || null),
    inicio, fin, precio: b.precio !== undefined && b.precio !== '' && b.precio !== null ? Math.max(0, num(b.precio)) : (serv ? num(serv.precio) : null),
    nota: String(b.nota || '').trim().slice(0, 500) || null,
  };
}

router.post('/turnos', async (req, res) => {
  try {
    await asegurar();
    const d = await leerTurno(req.body || {});
    if (d.error) return res.status(d.choca ? 409 : 400).json(d);
    const r = await pool.query(`INSERT INTO cons_turnos (paciente_id, paciente_nombre, telefono, profesional_id, servicio_id, servicio_nombre, inicio, fin, precio, nota, local_id, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [d.paciente_id, d.paciente_nombre, d.telefono, d.profesional_id, d.servicio_id, d.servicio_nombre, d.inicio, d.fin, d.precio, d.nota, loc(req), await nombreUsuario(req)]);
    res.status(201).json(fmtTurno((await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [r.rows[0].id])).rows[0]));
  } catch (e) {
    console.error('[consultorio] nuevo turno:', e.message);
    res.status(500).json({ error: 'No se pudo guardar el turno' });
  }
});

// Cambiar el turno (otro dia/hora, profesional, tratamiento) o solo el estado / la nota
router.put('/turnos/:id', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const t = (await pool.query('SELECT * FROM cons_turnos WHERE id = $1', [req.params.id])).rows[0];
    if (!t) return res.status(404).json({ error: 'No se encontró el turno' });
    if (b.estado !== undefined && Object.keys(b).filter(k => k !== 'forzar').length === 1) {
      if (!ESTADOS.includes(b.estado)) return res.status(400).json({ error: 'Estado no válido' });
      await pool.query('UPDATE cons_turnos SET estado = $1 WHERE id = $2', [b.estado, t.id]);
    } else {
      const d = await leerTurno({ paciente_id: t.paciente_id, paciente_nombre: t.paciente_nombre, telefono: t.telefono, ...b }, t.id);
      if (d.error) return res.status(d.choca ? 409 : 400).json(d);
      await pool.query(`UPDATE cons_turnos SET paciente_id=$1, paciente_nombre=$2, telefono=$3, profesional_id=$4, servicio_id=$5, servicio_nombre=$6,
          inicio=$7, fin=$8, precio=$9, nota=$10, estado = COALESCE($11, estado),
          recordatorio_en = CASE WHEN inicio <> $7::timestamp THEN NULL ELSE recordatorio_en END WHERE id=$12`,
        [d.paciente_id, d.paciente_nombre, d.telefono, d.profesional_id, d.servicio_id, d.servicio_nombre, d.inicio, d.fin, d.precio, d.nota,
         ESTADOS.includes(b.estado) ? b.estado : null, t.id]);
    }
    res.json(fmtTurno((await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [t.id])).rows[0]));
  } catch (e) {
    console.error('[consultorio] cambiar turno:', e.message);
    res.status(500).json({ error: 'No se pudo guardar el turno' });
  }
});

router.get('/turnos/:id', async (req, res) => {
  try {
    await asegurar();
    const r = (await pool.query(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'No se encontró el turno' });
    res.json(fmtTurno(r));
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar el turno' }); }
});

router.put('/turnos/:id/recordatorio', async (req, res) => {
  try {
    await asegurar();
    await pool.query('UPDATE cons_turnos SET recordatorio_en = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar' }); }
});

// Lo llama el Punto de Venta al cobrar el turno
router.put('/turnos/:id/cobrado', async (req, res) => {
  try {
    await asegurar();
    await pool.query(`UPDATE cons_turnos SET venta_id = $1, estado = CASE WHEN estado IN ('reservado','confirmado','presente') THEN 'atendido' ELSE estado END WHERE id = $2`,
      [parseInt(req.body && req.body.venta_id) || null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar como cobrado' }); }
});

// ---------- Recordatorios y "volver a sacar turno" ----------
// Turnos de un dia (manana por defecto) para mandar el recordatorio
router.get('/recordatorios', async (req, res) => {
  try {
    await asegurar();
    const man = hoyAR(); man.setDate(man.getDate() + 1);
    const dia = fechaOk(req.query.fecha) ? req.query.fecha : isoDia(man);
    const r = await pool.query(`${SELECT_TURNO} WHERE t.inicio >= $1::date AND t.inicio < $1::date + 1 AND t.local_id = $2 AND t.estado IN ('reservado','confirmado') ORDER BY t.inicio`, [dia, loc(req)]);
    res.json({ fecha: dia, turnos: r.rows.map(fmtTurno) });
  } catch (e) { res.status(500).json({ error: 'No se pudieron cargar los recordatorios' }); }
});

// Pacientes a los que ya les toca volver (segun "volver cada X dias" del tratamiento) y no tienen turno sacado
router.get('/volver', async (req, res) => {
  try {
    await asegurar();
    const r = await pool.query(`
      WITH ult AS (
        SELECT DISTINCT ON (t.paciente_id, t.servicio_id) t.paciente_id, t.servicio_id, t.inicio, s.nombre AS servicio, s.volver_dias
        FROM cons_turnos t JOIN cons_servicios s ON s.id = t.servicio_id
        WHERE t.estado = 'atendido' AND t.paciente_id IS NOT NULL AND s.volver_dias IS NOT NULL
        ORDER BY t.paciente_id, t.servicio_id, t.inicio DESC)
      SELECT u.*, c.nombre, c.telefono, (CURRENT_DATE - u.inicio::date) AS dias,
             (SELECT MAX(k.creado_en) FROM cons_contactos k WHERE k.paciente_id = u.paciente_id AND k.servicio_id = u.servicio_id) AS contactado_en
      FROM ult u JOIN clientes c ON c.id = u.paciente_id
      WHERE CURRENT_DATE - u.inicio::date >= u.volver_dias - 7
        AND NOT EXISTS (SELECT 1 FROM cons_turnos f WHERE f.paciente_id = u.paciente_id AND f.inicio > NOW() AND f.estado NOT IN ('cancelado','ausente'))
      ORDER BY (CURRENT_DATE - u.inicio::date) - u.volver_dias DESC`);
    res.json(r.rows.map(x => ({ ...x, dias: parseInt(x.dias), atrasado: parseInt(x.dias) - x.volver_dias })));
  } catch (e) {
    console.error('[consultorio] volver:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la lista' });
  }
});
router.post('/volver/contactado', async (req, res) => {
  try {
    await asegurar();
    await pool.query('INSERT INTO cons_contactos (paciente_id, servicio_id, creado_por) VALUES ($1,$2,$3)',
      [parseInt(req.body.paciente_id), parseInt(req.body.servicio_id) || null, await nombreUsuario(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo marcar' }); }
});

// ---------- Pacientes ----------
// Historia: datos del paciente, ficha clinica, turnos, evoluciones y fotos (sin la imagen grande)
router.get('/pacientes/:id', async (req, res) => {
  try {
    await asegurar();
    const id = parseInt(req.params.id);
    const c = (await pool.query('SELECT id, nombre, telefono, email, cuit_dni, fecha_nacimiento FROM clientes WHERE id = $1', [id])).rows[0];
    if (!c) return res.status(404).json({ error: 'No se encontró el paciente' });
    const ficha = (await pool.query('SELECT * FROM cons_fichas WHERE paciente_id = $1', [id])).rows[0] || null;
    const turnos = (await pool.query(`${SELECT_TURNO} WHERE t.paciente_id = $1 ORDER BY t.inicio DESC LIMIT 100`, [id])).rows.map(fmtTurno);
    const evol = (await pool.query('SELECT * FROM cons_evoluciones WHERE paciente_id = $1 ORDER BY creado_en DESC', [id])).rows;
    const fotos = (await pool.query(`SELECT id, tipo, zona, nota, miniatura, to_char(fecha, 'YYYY-MM-DD') AS fecha, creado_por FROM cons_fotos WHERE paciente_id = $1 ORDER BY fecha DESC, id DESC`, [id])).rows;
    res.json({ paciente: c, ficha, turnos, evoluciones: evol, fotos });
  } catch (e) {
    console.error('[consultorio] paciente:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la historia' });
  }
});

router.put('/pacientes/:id/ficha', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const t = (k, n = 1000) => String(b[k] || '').trim().slice(0, n) || null;
    await pool.query(`INSERT INTO cons_fichas (paciente_id, obra_social, nro_afiliado, antecedentes, alergias, medicacion, notas, actualizado_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (paciente_id) DO UPDATE SET obra_social=EXCLUDED.obra_social, nro_afiliado=EXCLUDED.nro_afiliado,
      antecedentes=EXCLUDED.antecedentes, alergias=EXCLUDED.alergias, medicacion=EXCLUDED.medicacion, notas=EXCLUDED.notas, actualizado_en=NOW()`,
      [parseInt(req.params.id), t('obra_social', 100), t('nro_afiliado', 60), t('antecedentes'), t('alergias'), t('medicacion'), t('notas')]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar la ficha' }); }
});

router.post('/pacientes/:id/evoluciones', async (req, res) => {
  try {
    await asegurar();
    const texto = String((req.body && req.body.texto) || '').trim().slice(0, 4000);
    if (!texto) return res.status(400).json({ error: 'Escribí qué se hizo o qué se observó' });
    const quien = await nombreUsuario(req);
    const r = await pool.query('INSERT INTO cons_evoluciones (paciente_id, turno_id, profesional, texto, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [parseInt(req.params.id), parseInt(req.body.turno_id) || null, String(req.body.profesional || '').slice(0, 80) || quien, texto, quien]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Fotos: la pantalla las achica antes de mandarlas (imagen hasta ~1600px y miniatura)
const IMG_OK = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
router.post('/pacientes/:id/fotos', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const img = String(b.imagen || ''); const mini = String(b.miniatura || '');
    if (!IMG_OK.test(img) || img.length > 2500000) return res.status(400).json({ error: 'La foto no se pudo usar (¿es muy pesada?)' });
    if (mini && (!IMG_OK.test(mini) || mini.length > 200000)) return res.status(400).json({ error: 'La miniatura no es válida' });
    const tipo = ['antes', 'despues', 'otra'].includes(b.tipo) ? b.tipo : 'otra';
    const r = await pool.query(`INSERT INTO cons_fotos (paciente_id, tipo, zona, nota, imagen, miniatura, fecha, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::date, CURRENT_DATE),$8) RETURNING id, tipo, zona, nota, miniatura, to_char(fecha, 'YYYY-MM-DD') AS fecha`,
      [parseInt(req.params.id), tipo, String(b.zona || '').trim().slice(0, 80) || null, String(b.nota || '').trim().slice(0, 300) || null, img, mini || null,
       fechaOk(b.fecha) ? b.fecha : null, await nombreUsuario(req)]);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error('[consultorio] foto:', e.message);
    res.status(500).json({ error: 'No se pudo guardar la foto' });
  }
});
router.get('/fotos/:id', async (req, res) => {
  try {
    await asegurar();
    const r = (await pool.query('SELECT imagen FROM cons_fotos WHERE id = $1', [req.params.id])).rows[0];
    if (!r) return res.status(404).json({ error: 'No se encontró la foto' });
    res.json({ imagen: r.imagen });
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la foto' }); }
});
router.delete('/fotos/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño o encargado puede borrar fotos' });
    await asegurar();
    await pool.query('DELETE FROM cons_fotos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

// ---------- Indicadores ----------
// Ocupacion, ausentismo y lo facturado por profesional y por tratamiento (ultimos 30 dias)
router.get('/indicadores', async (req, res) => {
  try {
    await asegurar();
    const l = loc(req);
    const r = (await pool.query(`SELECT
        COUNT(*) FILTER (WHERE estado <> 'cancelado') AS turnos,
        COUNT(*) FILTER (WHERE estado = 'atendido') AS atendidos,
        COUNT(*) FILTER (WHERE estado = 'ausente') AS ausentes,
        COUNT(*) FILTER (WHERE estado = 'cancelado') AS cancelados,
        COALESCE(SUM(precio) FILTER (WHERE estado = 'atendido'), 0) AS facturado,
        COUNT(DISTINCT paciente_id) FILTER (WHERE estado = 'atendido') AS pacientes
      FROM cons_turnos WHERE inicio >= NOW() - INTERVAL '30 days' AND inicio < NOW() AND local_id = $1`, [l])).rows[0];
    const porProf = (await pool.query(`SELECT COALESCE(p.nombre, 'Sin asignar') AS nombre, COUNT(*) AS atendidos, COALESCE(SUM(t.precio), 0) AS facturado
      FROM cons_turnos t LEFT JOIN cons_profesionales p ON p.id = t.profesional_id
      WHERE t.estado = 'atendido' AND t.inicio >= NOW() - INTERVAL '30 days' AND t.local_id = $1 GROUP BY 1 ORDER BY 3 DESC`, [l])).rows;
    const porServ = (await pool.query(`SELECT COALESCE(servicio_nombre, 'Otro') AS nombre, COUNT(*) AS atendidos, COALESCE(SUM(precio), 0) AS facturado
      FROM cons_turnos WHERE estado = 'atendido' AND inicio >= NOW() - INTERVAL '30 days' AND local_id = $1 GROUP BY 1 ORDER BY 3 DESC LIMIT 10`, [l])).rows;
    const proximos = (await pool.query(`SELECT COUNT(*) AS n FROM cons_turnos WHERE inicio >= NOW() AND inicio < NOW() + INTERVAL '7 days' AND estado IN ('reservado','confirmado') AND local_id = $1`, [l])).rows[0];
    const turnos = parseInt(r.turnos) || 0;
    res.json({
      turnos, atendidos: parseInt(r.atendidos) || 0, ausentes: parseInt(r.ausentes) || 0, cancelados: parseInt(r.cancelados) || 0,
      ausentismo_pct: turnos ? Math.round((parseInt(r.ausentes) || 0) / turnos * 100) : 0,
      facturado: num(r.facturado), pacientes: parseInt(r.pacientes) || 0, proximos_7: parseInt(proximos.n) || 0,
      por_profesional: porProf.map(x => ({ ...x, atendidos: parseInt(x.atendidos), facturado: num(x.facturado) })),
      por_tratamiento: porServ.map(x => ({ ...x, atendidos: parseInt(x.atendidos), facturado: num(x.facturado) })),
    });
  } catch (e) {
    console.error('[consultorio] indicadores:', e.message);
    res.status(500).json({ error: 'No se pudieron calcular los indicadores' });
  }
});

module.exports = router;
module.exports.enviarAutomaticos = enviarAutomaticos;
