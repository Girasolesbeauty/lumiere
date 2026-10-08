const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Listas de precios (ej: Mayorista, Revendedores): cada lista tiene un ajuste general sobre el
// precio normal (ej: -20%) con redondeo, y precios especiales por producto que pisan ese ajuste.
// A un cliente se le puede asignar una lista: en el Punto de Venta se aplica sola al cargarlo.
// El precio normal de cada producto ("Minorista") no cambia.

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS listas_precios (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    ajuste_pct NUMERIC(7,2) NOT NULL DEFAULT 0,
    redondeo INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS listas_precios_items (
    lista_id INT NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
    producto_id INT NOT NULL,
    precio NUMERIC(14,2) NOT NULL,
    PRIMARY KEY (lista_id, producto_id))`);
  await pool.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS lista_precio_id INT');
  listo.set(true);
}

const puedeEditar = async (req) => {
  const u = req.usuario || {};
  if (['jefe', 'admin', 'administrativo'].includes(u.rol)) return true;
  try { return (await pool.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'inventario.editar'`, [u.id])).rows.length > 0; } catch (e) { return false; }
};
const REDONDEOS = [0, 1, 10, 50, 100, 500, 1000];
const leerLista = (b) => {
  const nombre = String(b.nombre || '').trim().slice(0, 60);
  const ajuste = parseFloat(b.ajuste_pct);
  if (!nombre) return { error: 'Poné el nombre de la lista (ej: Mayorista)' };
  if (isNaN(ajuste) || ajuste <= -100 || ajuste > 500) return { error: 'El ajuste tiene que estar entre -99% y 500%' };
  return { nombre, ajuste_pct: Math.round(ajuste * 100) / 100, redondeo: REDONDEOS.includes(Number(b.redondeo)) ? Number(b.redondeo) : 0 };
};

// Todas las listas activas, con sus precios especiales y los clientes que la tienen asignada
router.get('/', async (req, res) => {
  try {
    await asegurar();
    const listas = (await pool.query('SELECT * FROM listas_precios WHERE activo ORDER BY id')).rows;
    const items = (await pool.query('SELECT i.lista_id, i.producto_id, i.precio FROM listas_precios_items i JOIN listas_precios l ON l.id = i.lista_id WHERE l.activo')).rows;
    const clientes = (await pool.query('SELECT id, nombre, lista_precio_id FROM clientes WHERE lista_precio_id IS NOT NULL')).rows;
    res.json(listas.map(l => ({
      id: l.id, nombre: l.nombre, ajuste_pct: parseFloat(l.ajuste_pct), redondeo: l.redondeo,
      precios: Object.fromEntries(items.filter(i => i.lista_id === l.id).map(i => [i.producto_id, parseFloat(i.precio)])),
      clientes: clientes.filter(c => c.lista_precio_id === l.id).map(c => ({ id: c.id, nombre: c.nombre })),
    })));
  } catch (e) {
    console.error('[listas] lista:', e.message);
    res.status(500).json({ error: 'No se pudieron cargar las listas de precios' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para editar listas de precios' });
    await asegurar();
    const d = leerLista(req.body || {});
    if (d.error) return res.status(400).json({ error: d.error });
    const r = await pool.query('INSERT INTO listas_precios (nombre, ajuste_pct, redondeo) VALUES ($1, $2, $3) RETURNING *', [d.nombre, d.ajuste_pct, d.redondeo]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo crear la lista' }); }
});

router.put('/:id', async (req, res) => {
  try {
    if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para editar listas de precios' });
    await asegurar();
    const d = leerLista(req.body || {});
    if (d.error) return res.status(400).json({ error: d.error });
    const r = await pool.query('UPDATE listas_precios SET nombre = $1, ajuste_pct = $2, redondeo = $3 WHERE id = $4 AND activo RETURNING *', [d.nombre, d.ajuste_pct, d.redondeo, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró la lista' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar la lista' }); }
});

// Borrar: la lista deja de existir y sus clientes vuelven al precio normal
router.delete('/:id', async (req, res) => {
  try {
    if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para editar listas de precios' });
    await asegurar();
    await pool.query('UPDATE listas_precios SET activo = FALSE WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE clientes SET lista_precio_id = NULL WHERE lista_precio_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar la lista' }); }
});

// Precios especiales: [{ producto_id, precio }] (precio vacío = vuelve al ajuste general)
router.put('/:id/precios', async (req, res) => {
  if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para editar listas de precios' });
  const lista = Array.isArray(req.body && req.body.precios) ? req.body.precios : [];
  let client;
  try {
    await asegurar();
    client = await pool.connect();
    await client.query('BEGIN');
    for (const it of lista) {
      const pid = parseInt(it.producto_id);
      if (!pid) continue;
      const precio = it.precio === '' || it.precio === null || it.precio === undefined ? null : parseFloat(it.precio);
      if (precio === null || isNaN(precio)) await client.query('DELETE FROM listas_precios_items WHERE lista_id = $1 AND producto_id = $2', [req.params.id, pid]);
      else if (precio >= 0) await client.query(`INSERT INTO listas_precios_items (lista_id, producto_id, precio) VALUES ($1, $2, $3)
        ON CONFLICT (lista_id, producto_id) DO UPDATE SET precio = EXCLUDED.precio`, [req.params.id, pid, precio]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    res.status(500).json({ error: 'No se pudieron guardar los precios' });
  } finally { if (client) client.release(); }
});

// Asignar (o sacar) la lista de un cliente
router.put('/cliente/:clienteId', async (req, res) => {
  try {
    if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para editar listas de precios' });
    await asegurar();
    const lid = req.body && req.body.lista_precio_id ? parseInt(req.body.lista_precio_id) : null;
    await pool.query('UPDATE clientes SET lista_precio_id = $1 WHERE id = $2', [lid, req.params.clienteId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo asignar la lista' }); }
});

module.exports = router;
