const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
const modulos = require('../lib/modulos');

// Gastronomia: mesas, cuentas abiertas, comandas a cocina y cobro (todo o dividido).
// Se activa por negocio (modo gastronomia). Las cuentas no mueven stock ni caja: al cobrar,
// los items pasan al Punto de Venta y se registra una venta normal (stock, caja, factura).
// Cuando todos los items de una cuenta estan pagados, la cuenta se cierra y la mesa queda libre.
//
// Estados de cada item: pendiente (cargado, sin mandar) -> en_cocina -> listo -> (entregado)
// y aparte pagado (venta_id). Un item anulado no se cobra.

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gastro_mesas (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    zona TEXT,
    capacidad INT,
    orden INT NOT NULL DEFAULT 0,
    local_id INT NOT NULL DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT TRUE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gastro_cuentas (
    id SERIAL PRIMARY KEY,
    mesa_id INT,
    local_id INT NOT NULL DEFAULT 1,
    estado TEXT NOT NULL DEFAULT 'abierta',
    personas INT,
    mozo TEXT,
    nota TEXT,
    pidio_cuenta BOOLEAN NOT NULL DEFAULT FALSE,
    abierta_en TIMESTAMP NOT NULL DEFAULT NOW(),
    cerrada_en TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gastro_comandas (
    id SERIAL PRIMARY KEY,
    cuenta_id INT NOT NULL,
    numero INT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'en_cocina',
    local_id INT NOT NULL DEFAULT 1,
    mozo TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    lista_en TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gastro_items (
    id SERIAL PRIMARY KEY,
    cuenta_id INT NOT NULL,
    producto_id INT,
    nombre TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio NUMERIC(14,2) NOT NULL DEFAULT 0,
    nota TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    comanda_id INT,
    venta_id INT,
    usuario TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gastro_items_cuenta_idx ON gastro_items (cuenta_id)`);
  listo.set(true);
}

const local = (req) => (String((req.query && req.query.local_id) || (req.body && req.body.local_id) || 1) === '2' ? 2 : 1);
const esJefe = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
async function nombreUsuario(req) {
  try { const r = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
}
const num = (x) => parseFloat(x) || 0;

// Cuenta con sus items y totales
async function cuentaCompleta(id, db = pool) {
  const c = (await db.query(`SELECT c.*, m.nombre AS mesa_nombre FROM gastro_cuentas c LEFT JOIN gastro_mesas m ON m.id = c.mesa_id WHERE c.id = $1`, [id])).rows[0];
  if (!c) return null;
  const items = (await db.query(`SELECT * FROM gastro_items WHERE cuenta_id = $1 ORDER BY id`, [id])).rows.map(i => ({ ...i, precio: num(i.precio) }));
  const vivos = items.filter(i => i.estado !== 'anulado');
  const total = vivos.reduce((t, i) => t + i.cantidad * i.precio, 0);
  const pagado = vivos.filter(i => i.venta_id).reduce((t, i) => t + i.cantidad * i.precio, 0);
  return { ...c, items, total: Math.round(total * 100) / 100, pagado: Math.round(pagado * 100) / 100, falta: Math.round((total - pagado) * 100) / 100 };
}

// Si ya no queda nada por cobrar (y hay algo cobrado o nada cargado), cierra la cuenta
async function cerrarSiCorresponde(id, db = pool) {
  const r = (await db.query(`SELECT COUNT(*) FILTER (WHERE estado <> 'anulado' AND venta_id IS NULL) AS falta FROM gastro_items WHERE cuenta_id = $1`, [id])).rows[0];
  if (parseInt(r.falta) === 0) await db.query(`UPDATE gastro_cuentas SET estado = 'cerrada', cerrada_en = NOW() WHERE id = $1 AND estado = 'abierta'`, [id]);
}

// ---------- Configuracion ----------
// Si el modulo esta prendido (ver lib/modulos.js)
router.get('/estado', async (req, res) => {
  try {
    const m = await modulos.leer();
    res.json({ activo: m.gastronomia, imprimir_comanda: m.imprimir_comanda, actividad: m.actividad });
  } catch (e) { res.status(500).json({ error: 'No se pudo leer la configuración' }); }
});

router.put('/estado', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede cambiar esto' });
    const b = req.body || {};
    await modulos.guardar({ gastronomia: !!b.activo, imprimir_comanda: !!b.imprimir_comanda });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// ---------- Mesas ----------
// Mesas del local con su cuenta abierta (si tiene): total, desde cuando, si hay cosas en cocina
router.get('/mesas', async (req, res) => {
  try {
    await asegurar();
    const loc = local(req);
    const mesas = (await pool.query('SELECT * FROM gastro_mesas WHERE activo AND local_id = $1 ORDER BY orden, id', [loc])).rows;
    const cuentas = (await pool.query(`
      SELECT c.id, c.mesa_id, c.personas, c.mozo, c.abierta_en, c.pidio_cuenta,
             COALESCE(SUM(i.cantidad * i.precio) FILTER (WHERE i.estado <> 'anulado'), 0) AS total,
             COALESCE(SUM(i.cantidad * i.precio) FILTER (WHERE i.estado <> 'anulado' AND i.venta_id IS NOT NULL), 0) AS pagado,
             COUNT(*) FILTER (WHERE i.estado = 'pendiente') AS sin_mandar,
             COUNT(*) FILTER (WHERE i.estado = 'en_cocina') AS en_cocina,
             COUNT(*) FILTER (WHERE i.estado = 'listo') AS listos
      FROM gastro_cuentas c LEFT JOIN gastro_items i ON i.cuenta_id = c.id
      WHERE c.estado = 'abierta' AND c.local_id = $1
      GROUP BY c.id`, [loc])).rows;
    const norm = (c) => ({ ...c, total: num(c.total), pagado: num(c.pagado), sin_mandar: parseInt(c.sin_mandar), en_cocina: parseInt(c.en_cocina), listos: parseInt(c.listos) });
    const porMesa = {};
    cuentas.filter(c => c.mesa_id).forEach(c => { porMesa[c.mesa_id] = norm(c); });
    res.json({
      mesas: mesas.map(m => ({ ...m, cuenta: porMesa[m.id] || null })),
      sin_mesa: cuentas.filter(c => !c.mesa_id).map(norm),
    });
  } catch (e) {
    console.error('[gastro] mesas:', e.message);
    res.status(500).json({ error: 'No se pudieron cargar las mesas' });
  }
});

// Crear mesas: { nombre, zona, capacidad } o { cantidad: 10, zona } (crea "Mesa 1..10" siguiendo la numeracion)
router.post('/mesas', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede armar las mesas' });
    await asegurar();
    const b = req.body || {};
    const loc = local(req);
    const zona = String(b.zona || '').trim().slice(0, 40) || null;
    const max = (await pool.query('SELECT COALESCE(MAX(orden), 0) AS o, COUNT(*) AS n FROM gastro_mesas WHERE activo AND local_id = $1', [loc])).rows[0];
    let orden = parseInt(max.o) || 0;
    const cant = Math.min(60, parseInt(b.cantidad) || 0);
    if (cant > 0) {
      const desde = (parseInt(max.n) || 0) + 1;
      for (let k = 0; k < cant; k++) {
        await pool.query('INSERT INTO gastro_mesas (nombre, zona, capacidad, orden, local_id) VALUES ($1,$2,$3,$4,$5)', ['Mesa ' + (desde + k), zona, parseInt(b.capacidad) || null, ++orden, loc]);
      }
      return res.status(201).json({ ok: true, creadas: cant });
    }
    const nombre = String(b.nombre || '').trim().slice(0, 40);
    if (!nombre) return res.status(400).json({ error: 'Poné el nombre de la mesa (ej: Mesa 5, Barra 1)' });
    const r = await pool.query('INSERT INTO gastro_mesas (nombre, zona, capacidad, orden, local_id) VALUES ($1,$2,$3,$4,$5) RETURNING *', [nombre, zona, parseInt(b.capacidad) || null, orden + 1, loc]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo crear la mesa' }); }
});

router.put('/mesas/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede cambiar las mesas' });
    await asegurar();
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim().slice(0, 40);
    if (!nombre) return res.status(400).json({ error: 'Poné el nombre de la mesa' });
    await pool.query('UPDATE gastro_mesas SET nombre = $1, zona = $2, capacidad = $3 WHERE id = $4', [nombre, String(b.zona || '').trim().slice(0, 40) || null, parseInt(b.capacidad) || null, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

router.delete('/mesas/:id', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el dueño puede borrar mesas' });
    await asegurar();
    const ab = await pool.query(`SELECT 1 FROM gastro_cuentas WHERE mesa_id = $1 AND estado = 'abierta'`, [req.params.id]);
    if (ab.rows.length) return res.status(400).json({ error: 'La mesa tiene una cuenta abierta: cobrala o cerrala primero' });
    await pool.query('UPDATE gastro_mesas SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

// ---------- Cuentas ----------
// Abrir cuenta en una mesa (o sin mesa: para llevar / mostrador)
router.post('/cuentas', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const mesa = parseInt(b.mesa_id) || null;
    if (mesa) {
      const ya = (await pool.query(`SELECT id FROM gastro_cuentas WHERE mesa_id = $1 AND estado = 'abierta'`, [mesa])).rows[0];
      if (ya) return res.json(await cuentaCompleta(ya.id));
    }
    const r = await pool.query(`INSERT INTO gastro_cuentas (mesa_id, local_id, personas, mozo, nota) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [mesa, local(req), parseInt(b.personas) || null, String(b.mozo || '').trim().slice(0, 60) || await nombreUsuario(req), String(b.nota || '').trim().slice(0, 200) || null]);
    res.status(201).json(await cuentaCompleta(r.rows[0].id));
  } catch (e) {
    console.error('[gastro] abrir:', e.message);
    res.status(500).json({ error: 'No se pudo abrir la cuenta' });
  }
});

router.get('/cuentas/:id', async (req, res) => {
  try {
    await asegurar();
    const c = await cuentaCompleta(req.params.id);
    if (!c) return res.status(404).json({ error: 'No se encontró la cuenta' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la cuenta' }); }
});

// Cambiar personas, mozo, nota, "pidio la cuenta" o pasar a otra mesa
router.put('/cuentas/:id', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const c = (await pool.query('SELECT * FROM gastro_cuentas WHERE id = $1', [req.params.id])).rows[0];
    if (!c || c.estado !== 'abierta') return res.status(400).json({ error: 'La cuenta ya está cerrada' });
    if (b.mesa_id !== undefined && parseInt(b.mesa_id) !== c.mesa_id) {
      const ocupada = (await pool.query(`SELECT 1 FROM gastro_cuentas WHERE mesa_id = $1 AND estado = 'abierta'`, [parseInt(b.mesa_id)])).rows.length;
      if (ocupada) return res.status(400).json({ error: 'Esa mesa ya está ocupada' });
    }
    await pool.query(`UPDATE gastro_cuentas SET personas = COALESCE($1, personas), mozo = COALESCE($2, mozo), nota = COALESCE($3, nota),
        pidio_cuenta = COALESCE($4, pidio_cuenta), mesa_id = COALESCE($5, mesa_id) WHERE id = $6`,
      [b.personas !== undefined ? parseInt(b.personas) || null : null, b.mozo !== undefined ? String(b.mozo).slice(0, 60) : null,
       b.nota !== undefined ? String(b.nota).slice(0, 200) : null, b.pidio_cuenta !== undefined ? !!b.pidio_cuenta : null,
       b.mesa_id !== undefined ? parseInt(b.mesa_id) || null : null, req.params.id]);
    res.json(await cuentaCompleta(req.params.id));
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Cerrar sin cobrar (mesa que se fue sin consumir, o se cargo mal). Si tiene cosas sin cobrar, solo el dueño.
router.post('/cuentas/:id/cerrar', async (req, res) => {
  try {
    await asegurar();
    const c = await cuentaCompleta(req.params.id);
    if (!c) return res.status(404).json({ error: 'No se encontró la cuenta' });
    if (c.falta > 0 && !esJefe(req)) return res.status(403).json({ error: 'Quedan cosas sin cobrar: solo el dueño puede cerrarla así' });
    await pool.query(`UPDATE gastro_items SET estado = 'anulado' WHERE cuenta_id = $1 AND venta_id IS NULL AND estado <> 'anulado'`, [c.id]);
    await pool.query(`UPDATE gastro_cuentas SET estado = $1, cerrada_en = NOW(), nota = COALESCE(nota || ' · ', '') || $2 WHERE id = $3`,
      [c.pagado > 0 ? 'cerrada' : 'anulada', 'Cerrada sin cobrar ' + (c.falta > 0 ? '$' + c.falta : '') + ' por ' + ((await nombreUsuario(req)) || 'usuario'), c.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo cerrar' }); }
});

// ---------- Items ----------
// Agregar: { items: [{ producto_id, nombre, precio, cantidad, nota }] }
router.post('/cuentas/:id/items', async (req, res) => {
  try {
    await asegurar();
    const c = (await pool.query('SELECT estado FROM gastro_cuentas WHERE id = $1', [req.params.id])).rows[0];
    if (!c || c.estado !== 'abierta') return res.status(400).json({ error: 'La cuenta ya está cerrada' });
    const lista = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    const quien = await nombreUsuario(req);
    for (const it of lista) {
      const nombre = String(it.nombre || '').trim().slice(0, 200);
      const cant = Math.max(1, parseInt(it.cantidad) || 1);
      if (!nombre) continue;
      // Si el mismo producto ya esta cargado y sin mandar a cocina (sin aclaracion), se suma a esa linea
      const pid = parseInt(it.producto_id) || null;
      if (pid && !String(it.nota || '').trim()) {
        const ya = await pool.query(`UPDATE gastro_items SET cantidad = cantidad + $1
          WHERE id = (SELECT id FROM gastro_items WHERE cuenta_id = $2 AND producto_id = $3 AND estado = 'pendiente' AND venta_id IS NULL
                      AND precio = $4 AND COALESCE(nota, '') = '' ORDER BY id LIMIT 1) RETURNING id`, [cant, req.params.id, pid, Math.max(0, num(it.precio))]);
        if (ya.rows.length) continue;
      }
      await pool.query(`INSERT INTO gastro_items (cuenta_id, producto_id, nombre, cantidad, precio, nota, usuario) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.params.id, parseInt(it.producto_id) || null, nombre, cant, Math.max(0, num(it.precio)), String(it.nota || '').trim().slice(0, 200) || null, quien]);
    }
    res.json(await cuentaCompleta(req.params.id));
  } catch (e) {
    console.error('[gastro] items:', e.message);
    res.status(500).json({ error: 'No se pudo agregar' });
  }
});

// Cambiar cantidad / nota de un item que todavia no se mando a cocina, o anularlo
router.put('/items/:id', async (req, res) => {
  try {
    await asegurar();
    const it = (await pool.query('SELECT * FROM gastro_items WHERE id = $1', [req.params.id])).rows[0];
    if (!it) return res.status(404).json({ error: 'No se encontró' });
    if (it.venta_id) return res.status(400).json({ error: 'Ya está cobrado' });
    const b = req.body || {};
    if (b.anular) {
      if (it.estado !== 'pendiente' && !esJefe(req)) return res.status(403).json({ error: 'Ya se mandó a cocina: solo el dueño o encargado puede anularlo' });
      await pool.query(`UPDATE gastro_items SET estado = 'anulado', nota = COALESCE(nota || ' · ', '') || $1 WHERE id = $2`, ['anulado por ' + ((await nombreUsuario(req)) || 'usuario'), it.id]);
    } else {
      if (it.estado !== 'pendiente') return res.status(400).json({ error: 'Ya se mandó a cocina: no se puede cambiar' });
      await pool.query('UPDATE gastro_items SET cantidad = COALESCE($1, cantidad), nota = COALESCE($2, nota) WHERE id = $3',
        [b.cantidad !== undefined ? Math.max(1, parseInt(b.cantidad) || 1) : null, b.nota !== undefined ? String(b.nota).slice(0, 200) : null, it.id]);
    }
    res.json(await cuentaCompleta(it.cuenta_id));
  } catch (e) { res.status(500).json({ error: 'No se pudo cambiar' }); }
});

// Mandar a cocina lo pendiente: crea una comanda
router.post('/cuentas/:id/comanda', async (req, res) => {
  let client;
  try {
    await asegurar();
    client = await pool.connect();
    await client.query('BEGIN');
    const c = (await client.query('SELECT * FROM gastro_cuentas WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!c || c.estado !== 'abierta') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'La cuenta ya está cerrada' }); }
    const pend = (await client.query(`SELECT id FROM gastro_items WHERE cuenta_id = $1 AND estado = 'pendiente'`, [c.id])).rows;
    if (!pend.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No hay nada nuevo para mandar' }); }
    const n = (await client.query(`SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM gastro_comandas WHERE creado_en::date = CURRENT_DATE AND local_id = $1`, [c.local_id])).rows[0].n;
    const com = (await client.query(`INSERT INTO gastro_comandas (cuenta_id, numero, local_id, mozo) VALUES ($1,$2,$3,$4) RETURNING *`, [c.id, n, c.local_id, await nombreUsuario(req)])).rows[0];
    await client.query(`UPDATE gastro_items SET estado = 'en_cocina', comanda_id = $1 WHERE cuenta_id = $2 AND estado = 'pendiente'`, [com.id, c.id]);
    await client.query('COMMIT');
    res.status(201).json({ comanda: com, cuenta: await cuentaCompleta(c.id) });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    console.error('[gastro] comanda:', e.message);
    res.status(500).json({ error: 'No se pudo mandar a cocina' });
  } finally { if (client) client.release(); }
});

// ---------- Cocina ----------
// Comandas en cocina (y las listas de los ultimos 30 minutos)
router.get('/cocina', async (req, res) => {
  try {
    await asegurar();
    const loc = local(req);
    const com = (await pool.query(`
      SELECT k.*, m.nombre AS mesa_nombre, c.mesa_id
      FROM gastro_comandas k JOIN gastro_cuentas c ON c.id = k.cuenta_id LEFT JOIN gastro_mesas m ON m.id = c.mesa_id
      WHERE k.local_id = $1 AND (k.estado = 'en_cocina' OR k.lista_en > NOW() - INTERVAL '30 minutes')
      ORDER BY k.estado = 'en_cocina' DESC, k.creado_en`, [loc])).rows;
    const ids = com.map(k => k.id);
    const items = ids.length ? (await pool.query(`SELECT id, comanda_id, nombre, cantidad, nota, estado FROM gastro_items WHERE comanda_id = ANY($1) ORDER BY id`, [ids])).rows : [];
    res.json(com.map(k => ({ ...k, items: items.filter(i => i.comanda_id === k.id) })));
  } catch (e) { res.status(500).json({ error: 'No se pudo cargar la cocina' }); }
});

// Marcar comanda lista (o volver a cocina)
router.put('/comandas/:id', async (req, res) => {
  try {
    await asegurar();
    const lista = !(req.body && req.body.estado === 'en_cocina');
    await pool.query(`UPDATE gastro_comandas SET estado = $1, lista_en = $2 WHERE id = $3`, [lista ? 'lista' : 'en_cocina', lista ? new Date() : null, req.params.id]);
    await pool.query(`UPDATE gastro_items SET estado = $1 WHERE comanda_id = $2 AND estado IN ('en_cocina','listo')`, [lista ? 'listo' : 'en_cocina', req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo cambiar' }); }
});

// ---------- Cobro ----------
// Lo llama el Punto de Venta al registrar la venta: { item_ids: [...], venta_id }
router.put('/items-pagados', async (req, res) => {
  try {
    await asegurar();
    const ids = (Array.isArray(req.body && req.body.item_ids) ? req.body.item_ids : []).map(x => parseInt(x)).filter(Boolean);
    const venta = parseInt(req.body && req.body.venta_id) || null;
    if (!ids.length) return res.json({ ok: true });
    const r = await pool.query(`UPDATE gastro_items SET venta_id = $1 WHERE id = ANY($2) AND venta_id IS NULL RETURNING cuenta_id`, [venta, ids]);
    const cuentas = [...new Set(r.rows.map(x => x.cuenta_id))];
    for (const c of cuentas) await cerrarSiCorresponde(c);
    res.json({ ok: true, cuentas });
  } catch (e) {
    console.error('[gastro] pagados:', e.message);
    res.status(500).json({ error: 'No se pudo marcar como cobrado' });
  }
});

module.exports = router;
