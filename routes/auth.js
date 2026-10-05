const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { porNegocio, enNegocio, negocioActual } = require('../lib/contexto');
const negocios = require('../lib/negocios');
const legal = require('../legal/textos');

// Usuarios que se pueden desactivar (no entran, se pueden reactivar) o eliminar (desaparecen de
// la lista y liberan su email). Eliminar NO borra lo que hicieron: ventas, caja, ajustes de stock,
// etc. quedan con su nombre, para que los numeros y el historial del negocio no cambien.
const columnasListas = porNegocio(false);
async function asegurarColumnas() {
  if (columnasListas.get()) return;
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE');
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE');
  await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMP');
  columnasListas.set(true);
}
const esJefeRow = (u) => u.rol === 'jefe' || Number(u.rol_id) === 1;
// No dejar al negocio sin ningun jefe activo
async function quedaOtroJefe(id) {
  const r = await pool.query(`SELECT COUNT(*)::int AS n FROM usuarios WHERE id <> $1 AND (rol = 'jefe' OR rol_id = 1) AND COALESCE(activo, TRUE) AND NOT COALESCE(eliminado, FALSE)`, [id]);
  return r.rows[0].n > 0;
}

// Login: con el mail se sabe de que negocio es, y se busca el usuario en el cajon de ese negocio.
// Un mail que no esta en el registro central se busca en el negocio original.
router.post('/login', async (req, res) => {
  let neg;
  try {
    neg = (await negocios.negocioDeMail(req.body && req.body.email)) || (await negocios.negocioPorId(1));
  } catch (e) {
    // Con el registro central caido, el negocio original igual puede entrar
    console.error('[login] registro central:', e.message);
    neg = negocios.ORIGINAL;
  }
  if (!neg) return res.status(401).json({ error: 'Credenciales incorrectas' });
  enNegocio({ id: neg.id, schema: neg.schema }, () => iniciarSesion(req, res, neg));
});

async function iniciarSesion(req, res, neg) {
  try {
    const { email, password } = req.body;
    try { await asegurarColumnas(); } catch (e) {}
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE LOWER(email) = LOWER($1)', [String(email || '').trim()]
    );

    if (result.rows.length === 0 || result.rows[0].eliminado === true) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = result.rows[0];
    const passwordValido = await bcrypt.compare(password || '', usuario.password);

    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (usuario.activo === false) {
      return res.status(403).json({ error: 'Este usuario está desactivado. Pedile al jefe que lo vuelva a activar.' });
    }
    if (neg.estado === 'suspendido') {
      return res.status(403).json({ error: 'La cuenta de este negocio está suspendida. Escribinos a hola@sistemalumiere.com' });
    }

    // Obtener permisos del rol
    const permisosResult = await pool.query(
      'SELECT modulo, puede_ver, puede_modificar FROM permisos WHERE rol_id = $1',
      [usuario.rol_id || 1]
    );

    const permisos = {};
    permisosResult.rows.forEach(p => {
      permisos[p.modulo] = {
        ver: p.puede_ver,
        modificar: p.puede_modificar
      };
    });

    // Obtener local del usuario
    let local = null;
    if (usuario.local_id) {
      const localResult = await pool.query(
        'SELECT * FROM locales WHERE id = $1', [usuario.local_id]
      );
      if (localResult.rows.length > 0) local = localResult.rows[0];
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol, local_id: usuario.local_id, neg: neg.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        local_id: usuario.local_id,
        permisos,
        local
      },
      negocio: negocios.resumen(neg)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
}

// En que estado esta mi negocio (para el aviso de dias de prueba)
router.get('/mi-negocio', (req, res) => {
  res.json(negocios.resumen(req.negocio) || negocios.resumen(negocios.ORIGINAL));
});

// Terminos y Condiciones: los acepta el dueño (rol jefe) de cada negocio cliente, una vez por version.
// El negocio original (el de quien presta el servicio) no los necesita.
const debeAceptar = (req) => !!req.negocio && Number(req.negocio.id) !== 1 && req.usuario && req.usuario.rol === 'jefe';
router.get('/terminos', async (req, res) => {
  try {
    const requerido = debeAceptar(req);
    const cuando = requerido ? await negocios.aceptoTerminos(req.negocio.id, req.usuario.id, legal.VERSION) : null;
    res.json({ version: legal.VERSION, requerido, aceptado: !requerido || !!cuando, aceptado_en: cuando });
  } catch (e) {
    console.error('[terminos]', e.message);
    res.status(500).json({ error: 'No se pudo consultar los términos' });
  }
});
router.post('/terminos/aceptar', async (req, res) => {
  try {
    if (!req.body || req.body.version !== legal.VERSION) return res.status(400).json({ error: 'Los términos se actualizaron. Recargá la página para leer la última versión.' });
    if (req.body.acepto !== true) return res.status(400).json({ error: 'Tenés que marcar que leíste y aceptás los términos' });
    let nombre = null;
    try { nombre = (await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id])).rows[0]?.nombre || null; } catch (e) {}
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const cuando = await negocios.registrarAceptacion({
      negocio_id: req.negocio.id, usuario_id: req.usuario.id, email: req.usuario.email, nombre, negocio_nombre: req.negocio.nombre,
      version: legal.VERSION, ip, navegador: req.headers['user-agent'],
    });
    res.json({ ok: true, version: legal.VERSION, aceptado_en: cuando });
  } catch (e) {
    console.error('[terminos] aceptar:', e.message);
    res.status(500).json({ error: 'No se pudo guardar la aceptación. Probá de nuevo.' });
  }
});

// Bienvenida: la primera vez, el dueño completa los datos basicos de su negocio
// (nombre, logo, moneda y locales). Se puede omitir y completar despues en Configuracion.
const LOGO_OK = /^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+|https:\/\/\S+)$/;
router.get('/bienvenida', async (req, res) => {
  try {
    const c = (await pool.query('SELECT * FROM configuracion_negocio WHERE id = 1')).rows[0] || {};
    const locales = (await pool.query('SELECT id, nombre, direccion FROM locales ORDER BY id LIMIT 2')).rows;
    res.json({ nombre_negocio: c.nombre_negocio || '', logo_url: c.logo_url || '', moneda: (c.moneda && c.moneda.codigo) || 'ARS', locales });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron cargar los datos del negocio' });
  }
});
router.post('/bienvenida', async (req, res) => {
  if (!req.usuario || req.usuario.rol !== 'jefe') return res.status(403).json({ error: 'Solo el dueño puede configurar el negocio' });
  const b = req.body || {};
  const negId = (negocioActual() || {}).id || 1;
  if (b.omitir === true) {
    try { await negocios.marcarBienvenida(negId); return res.json({ ok: true, omitida: true }); }
    catch (e) { return res.status(500).json({ error: 'No se pudo guardar' }); }
  }
  const nombre = String(b.nombre_negocio || '').trim();
  if (nombre.length < 2) return res.status(400).json({ error: 'Escribí el nombre de tu negocio' });
  const logo = String(b.logo_url || '').trim();
  if (logo && (!LOGO_OK.test(logo) || logo.length > 400000)) return res.status(400).json({ error: 'El logo no se pudo usar. Probá con otra imagen (PNG o JPG).' });
  const moneda = String(b.moneda || '').trim().toUpperCase();
  if (moneda && !/^[A-Z]{3}$/.test(moneda)) return res.status(400).json({ error: 'Elegí la moneda' });
  const locales = (Array.isArray(b.locales) ? b.locales : []).slice(0, 2).map(l => ({ nombre: String((l && l.nombre) || '').trim(), direccion: String((l && l.direccion) || '').trim() }));
  if (!locales[0] || locales[0].nombre.length < 2) return res.status(400).json({ error: 'Escribí el nombre de tu local' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO configuracion_negocio (id, nombre_negocio) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [nombre]);
    await client.query('UPDATE configuracion_negocio SET nombre_negocio = $1, logo_url = $2 WHERE id = 1', [nombre, logo || null]);
    if (moneda) {
      await client.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS moneda JSONB');
      await client.query(`UPDATE configuracion_negocio SET moneda = COALESCE(moneda, '{}'::jsonb) || $1::jsonb WHERE id = 1`, [JSON.stringify({ codigo: moneda })]);
    }
    for (let i = 0; i < locales.length; i++) {
      const l = locales[i];
      if (!l.nombre) continue;
      await client.query(`INSERT INTO locales (id, nombre, direccion, activo) VALUES ($1, $2, $3, TRUE)
                          ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, direccion = EXCLUDED.direccion, activo = TRUE`, [i + 1, l.nombre, l.direccion || null]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('locales', 'id'), GREATEST((SELECT MAX(id) FROM locales), 1))`);
    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[bienvenida]', e.message);
    return res.status(500).json({ error: 'No se pudieron guardar los datos. Probá de nuevo.' });
  } finally {
    client.release();
  }
  try { await negocios.marcarBienvenida(negId, nombre); } catch (e) { console.error('[bienvenida] central:', e.message); }
  res.json({ ok: true });
});

// Registrar usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password, rol, rol_id, local_id } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Completá nombre, email y contraseña' });
    if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres' });
    const existe = await pool.query('SELECT 1 FROM usuarios WHERE LOWER(email) = LOWER($1)', [email]);
    if (existe.rows.length) return res.status(400).json({ error: 'Ya hay un usuario con ese email' });
    // Un mail entra a un solo negocio de Lumiere
    const negId = (negocioActual() || {}).id || 1;
    if (!(await negocios.mailLibre(email, negId))) return res.status(400).json({ error: 'Ese mail ya se usa en otra cuenta de Lumiere. Probá con otro.' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, rol_id, local_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, email, rol`,
      [nombre, String(email).trim(), hashedPassword, rol || 'vendedora', rol_id || 3, local_id || 1]
    );
    await negocios.registrarMail(email, negId);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    try { await asegurarColumnas(); } catch (e) {}
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.rol_id, u.local_id, l.nombre AS local_nombre, COALESCE(u.activo, TRUE) AS activo
       FROM usuarios u
       LEFT JOIN locales l ON u.local_id = l.id
       WHERE NOT COALESCE(u.eliminado, FALSE)
       ORDER BY COALESCE(u.activo, TRUE) DESC, u.id ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Cambiar contraseña
router.put('/usuarios/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hashedPassword, id]);
    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Actualizar usuario
router.put('/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, rol_id, local_id } = req.body;
    const actual = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (!actual.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Si deja de ser jefe, que quede algun otro jefe
    if (esJefeRow(actual.rows[0]) && rol !== 'jefe' && Number(rol_id) !== 1 && !(await quedaOtroJefe(id))) {
      return res.status(400).json({ error: 'Tiene que quedar al menos un jefe' });
    }
    const repetido = await pool.query('SELECT 1 FROM usuarios WHERE LOWER(email) = LOWER($1) AND id <> $2', [email, id]);
    if (repetido.rows.length) return res.status(400).json({ error: 'Ya hay otro usuario con ese email' });
    const negId = (negocioActual() || {}).id || 1;
    const mailAntes = actual.rows[0].email;
    const cambiaMail = String(mailAntes || '').trim().toLowerCase() !== String(email || '').trim().toLowerCase();
    if (cambiaMail && !(await negocios.mailLibre(email, negId))) return res.status(400).json({ error: 'Ese mail ya se usa en otra cuenta de Lumiere. Probá con otro.' });
    const result = await pool.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, rol_id=$4, local_id=$5
       WHERE id=$6 RETURNING id, nombre, email, rol, local_id`,
      [nombre, email, rol, rol_id, local_id, id]
    );
    if (cambiaMail) { await negocios.liberarMail(mailAntes, negId); await negocios.registrarMail(email, negId); }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Activar / desactivar un usuario (desactivado no puede entrar; se puede volver a activar)
router.put('/usuarios/:id/estado', async (req, res) => {
  try {
    await asegurarColumnas();
    const { id } = req.params;
    const activo = req.body.activo === true;
    const u = await pool.query('SELECT * FROM usuarios WHERE id = $1 AND NOT COALESCE(eliminado, FALSE)', [id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!activo && esJefeRow(u.rows[0]) && !(await quedaOtroJefe(id))) return res.status(400).json({ error: 'No se puede desactivar al único jefe' });
    await pool.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, id]);
    res.json({ ok: true, activo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Que hizo un usuario (para mostrar en el aviso antes de eliminarlo)
router.get('/usuarios/:id/actividad', async (req, res) => {
  const { id } = req.params;
  const contar = async (sql) => { try { const r = await pool.query(sql, [id]); return parseInt(r.rows[0].n) || 0; } catch (e) { return 0; } };
  const [ventas, caja, ajustes, controles, tareas] = await Promise.all([
    contar('SELECT COUNT(*) AS n FROM ventas WHERE usuario_id = $1'),
    contar('SELECT COUNT(*) AS n FROM movimientos_caja WHERE usuario_id = $1'),
    contar('SELECT COUNT(*) AS n FROM ajustes_stock WHERE usuario_id = $1'),
    contar('SELECT COUNT(*) AS n FROM controles_inventario WHERE usuario_id = $1'),
    contar(`SELECT COUNT(*) AS n FROM tareas WHERE asignado_a = $1 AND estado <> 'finalizada'`),
  ]);
  res.json({ ventas, caja, ajustes, controles, tareas_pendientes: tareas });
});

// Eliminar un usuario: no puede entrar mas, desaparece de la lista y su email queda libre.
// Lo que hizo (ventas, caja, ajustes de stock, controles...) NO se borra: queda con su nombre.
router.delete('/usuarios/:id', async (req, res) => {
  try {
    await asegurarColumnas();
    const { id } = req.params;
    const u = await pool.query('SELECT * FROM usuarios WHERE id = $1 AND NOT COALESCE(eliminado, FALSE)', [id]);
    if (!u.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (esJefeRow(u.rows[0]) && !(await quedaOtroJefe(id))) return res.status(400).json({ error: 'No se puede eliminar al único jefe' });
    await pool.query(`UPDATE usuarios SET eliminado = TRUE, activo = FALSE, eliminado_en = NOW(),
                        email = 'eliminado-' || id || '-' || email WHERE id = $1`, [id]);
    await negocios.liberarMail(u.rows[0].email, (negocioActual() || {}).id || 1).catch(() => {});
    await pool.query('DELETE FROM permisos_usuario WHERE usuario_id = $1', [id]).catch(() => {});
    // Sus tareas sin terminar quedan sin asignar para que alguien las tome
    await pool.query(`UPDATE tareas SET asignado_a = NULL, asignado_nombre = NULL WHERE asignado_a = $1 AND estado <> 'finalizada'`, [id]).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;