const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Permisos v2: cada seccion del menu tiene su propio permiso de "ver". Antes algunas las veia
// cualquiera (Ventas Online, Buscar Precio, Cambios, Compras, Pedidos, Tareas) y otras colgaban
// del permiso de otra seccion (Rotacion de Inventario, Toma de decisiones de Finanzas, etc.).
// La primera vez se le dan a cada usuario los permisos nuevos de lo que YA veia, asi nadie
// pierde acceso de un dia para el otro; despues el jefe los ajusta como quiera.
let migrado = false;
async function asegurarPermisosV2() {
  if (migrado) return;
  await pool.query('CREATE TABLE IF NOT EXISTS permisos_meta (clave TEXT PRIMARY KEY, hecho_en TIMESTAMP DEFAULT NOW())');
  const ya = await pool.query(`SELECT 1 FROM permisos_meta WHERE clave = 'permisos_v2'`);
  if (!ya.rows.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Lo que veia cualquier usuario
      for (const perm of ['ventas_online.ver', 'buscar_precio.ver', 'cambios.ver', 'compras.ver', 'pedidos.ver', 'tareas.ver']) {
        await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT id, $1 FROM usuarios ON CONFLICT DO NOTHING`, [perm]);
      }
      // Lo que colgaba del permiso de otra seccion
      const deriva = [['rotacion.ver', 'inventario.ver'], ['inconsistencias.ver', 'ordenes.ver'], ['portal.ver', 'clientes.ver'],
        ['promociones.ver', 'cupones.ver'], ['decisiones.ver', 'finanzas.flujo']];
      for (const [nuevo, viejo] of deriva) {
        await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT usuario_id, $1 FROM permisos_usuario WHERE permiso = $2 ON CONFLICT DO NOTHING`, [nuevo, viejo]);
      }
      await client.query(`INSERT INTO permisos_meta (clave) VALUES ('permisos_v2') ON CONFLICT DO NOTHING`);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  // v3: permisos de acciones. Se dan a quien ya podia hacerlo antes, para no cortarle nada a nadie.
  const ya3 = await pool.query(`SELECT 1 FROM permisos_meta WHERE clave = 'permisos_v3'`);
  if (!ya3.rows.length) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const perm of ['inventario.editar', 'inventario.ajustar']) {
        await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT usuario_id, $1 FROM permisos_usuario WHERE permiso = 'inventario.ver' ON CONFLICT DO NOTHING`, [perm]);
      }
      await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT usuario_id, 'inventario.crear' FROM permisos_usuario WHERE permiso = 'inventario.ver' ON CONFLICT DO NOTHING`);
      await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT usuario_id, 'pos.descuento' FROM permisos_usuario WHERE permiso = 'pos.ver' ON CONFLICT DO NOTHING`);
      // Antes anulaban el jefe y los administrativos
      await client.query(`INSERT INTO permisos_usuario (usuario_id, permiso) SELECT id, 'ventas.anular' FROM usuarios WHERE rol = 'administrativo' ON CONFLICT DO NOTHING`);
      await client.query(`INSERT INTO permisos_meta (clave) VALUES ('permisos_v3') ON CONFLICT DO NOTHING`);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  migrado = true;
}

// Obtener permisos de un usuario
router.get('/:usuario_id', async (req, res) => {
  try {
    try { await asegurarPermisosV2(); } catch (e) { console.error('permisos v2:', e.message); }
    // Un usuario desactivado o eliminado no puede seguir usando el sistema (la pantalla lo saca)
    try {
      const u = await pool.query('SELECT activo, eliminado FROM usuarios WHERE id = $1', [req.params.usuario_id]);
      if (!u.rows.length || u.rows[0].activo === false || u.rows[0].eliminado === true) return res.status(403).json({ error: 'Usuario desactivado', inactivo: true });
    } catch (e) { /* base sin las columnas nuevas todavia */ }
    const result = await pool.query(
      'SELECT permiso FROM permisos_usuario WHERE usuario_id = $1',
      [req.params.usuario_id]
    );
    res.json(result.rows.map(r => r.permiso));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Guardar permisos de un usuario (reemplaza todos)
router.put('/:usuario_id', async (req, res) => {
  const client = await pool.connect();
  try {
    try { await asegurarPermisosV2(); } catch (e) {}
    await client.query('BEGIN');
    const { permisos } = req.body;
    if (!Array.isArray(permisos)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Permisos inválidos' }); }
    await client.query('DELETE FROM permisos_usuario WHERE usuario_id = $1', [req.params.usuario_id]);
    for (const permiso of permisos) {
      await client.query(
        'INSERT INTO permisos_usuario (usuario_id, permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.usuario_id, permiso]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, total: permisos.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Verificar si un usuario tiene un permiso especifico
router.get('/:usuario_id/check/:permiso', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = $2',
      [req.params.usuario_id, req.params.permiso]
    );
    res.json({ tiene: result.rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;