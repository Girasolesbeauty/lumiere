const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Actualizar precios en masa: subir o bajar un % (o calcular desde el costo con un recargo) a
// todos los productos, o a los de una categoria, marca o proveedor. Primero se ve como quedan
// y despues se aplica. Cada cambio queda guardado con los precios de antes, asi se puede deshacer.

const tablaLista = porNegocio(false);
async function asegurarTabla() {
  if (tablaLista.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS precios_cambios (
    id SERIAL PRIMARY KEY,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_id INT,
    usuario_nombre TEXT,
    descripcion TEXT,
    cantidad INT NOT NULL DEFAULT 0,
    detalle JSONB NOT NULL DEFAULT '[]',
    deshecho_en TIMESTAMPTZ)`);
  tablaLista.set(true);
}

// Puede cambiar precios: el jefe, un administrativo, o quien tenga el permiso de editar productos
async function puedeEditar(req) {
  const u = req.usuario || {};
  if (u.rol === 'jefe' || u.rol === 'admin' || u.rol === 'administrativo') return true;
  try {
    const r = await pool.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'inventario.editar'`, [u.id]);
    return r.rows.length > 0;
  } catch (e) { return false; }
}

const REDONDEOS = [0, 1, 10, 50, 100, 500, 1000];

// Lee y valida lo que pidio la pantalla
function leerPedido(b) {
  const alcance = ['todos', 'categoria', 'marca', 'proveedor'].includes(b.alcance) ? b.alcance : null;
  const modo = ['subir', 'bajar', 'margen'].includes(b.modo) ? b.modo : null;
  const valor = parseFloat(b.valor);
  const redondeo = REDONDEOS.includes(Number(b.redondeo)) ? Number(b.redondeo) : 0;
  if (!alcance) return { error: 'Elegí a qué productos aplicar el cambio' };
  if (alcance !== 'todos' && !String(b.filtro || '').trim()) return { error: alcance === 'categoria' ? 'Elegí la categoría' : alcance === 'marca' ? 'Elegí la marca' : 'Elegí el proveedor' };
  if (!modo) return { error: 'Elegí cómo cambiar los precios' };
  if (!(valor > 0)) return { error: 'Poné un porcentaje mayor a 0' };
  if (modo === 'bajar' && valor >= 100) return { error: 'No se puede bajar 100% o más' };
  if (valor > 1000) return { error: 'El porcentaje es demasiado alto' };
  return { alcance, filtro: String(b.filtro || '').trim(), modo, valor, redondeo };
}

function describir(p, nombreProveedor) {
  const a = p.alcance === 'todos' ? 'todos los productos' : p.alcance === 'categoria' ? 'categoría ' + p.filtro
    : p.alcance === 'marca' ? 'marca ' + p.filtro : 'proveedor ' + (nombreProveedor || p.filtro);
  const m = p.modo === 'subir' ? 'Subir ' + p.valor + '%' : p.modo === 'bajar' ? 'Bajar ' + p.valor + '%' : 'Costo + ' + p.valor + '% de recargo';
  return m + ' · ' + a + (p.redondeo > 1 ? ' · redondeado a $' + p.redondeo : '');
}

// Precio nuevo de un producto (null si no se puede calcular)
function precioNuevo(prod, p) {
  const precio = parseFloat(prod.precio) || 0;
  const costo = parseFloat(prod.costo) || 0;
  let n;
  if (p.modo === 'margen') { if (costo <= 0) return null; n = costo * (1 + p.valor / 100); }
  else { if (precio <= 0) return null; n = precio * (p.modo === 'subir' ? 1 + p.valor / 100 : 1 - p.valor / 100); }
  // Primero a centavos: 12000 * 1.1 da 13200.000000000002 y sin esto se redondearia mal
  n = Math.round(n * 100) / 100;
  // Redondeo al mas cercano, pero sin ir en contra de lo pedido: si se sube no puede quedar
  // igual o mas barato, si se baja no puede quedar igual o mas caro, y nunca en $0
  const paso = p.redondeo || 0;
  if (paso) {
    let r = Math.round(n / paso) * paso;
    if (p.modo === 'subir' && r <= precio) r = Math.ceil(n / paso) * paso;
    if (p.modo === 'bajar' && r >= precio) r = Math.floor(n / paso) * paso;
    if (r > 0 && !(p.modo === 'bajar' && r >= precio)) n = r;
  }
  return n > 0 ? n : null;
}

async function calcular(p) {
  let where = 'COALESCE(activo, TRUE)';
  const vals = [];
  if (p.alcance === 'categoria') { vals.push(p.filtro); where += ' AND categoria = $1'; }
  if (p.alcance === 'marca') { vals.push(p.filtro); where += ' AND marca = $1'; }
  if (p.alcance === 'proveedor') { vals.push(parseInt(p.filtro) || 0); where += ' AND proveedor_id = $1'; }
  const r = await pool.query(`SELECT id, nombre, marca, categoria, precio, costo FROM productos WHERE ${where} ORDER BY nombre`, vals);
  const cambian = [], sinCalcular = [];
  for (const prod of r.rows) {
    const n = precioNuevo(prod, p);
    const antes = parseFloat(prod.precio) || 0;
    if (n === null) { sinCalcular.push({ id: prod.id, nombre: prod.nombre, marca: prod.marca, motivo: p.modo === 'margen' ? 'sin costo cargado' : 'sin precio' }); continue; }
    if (n === antes) continue;
    cambian.push({ id: prod.id, nombre: prod.nombre, marca: prod.marca, costo: parseFloat(prod.costo) || 0, antes, despues: n });
  }
  return { total: r.rows.length, cambian, sinCalcular };
}

async function nombreProveedor(p) {
  if (p.alcance !== 'proveedor') return null;
  try { const r = await pool.query('SELECT nombre FROM proveedores WHERE id = $1', [parseInt(p.filtro) || 0]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
}

// Ver como quedarian los precios (no cambia nada)
router.post('/vista', async (req, res) => {
  try {
    if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para cambiar precios' });
    const p = leerPedido(req.body || {});
    if (p.error) return res.status(400).json({ error: p.error });
    const c = await calcular(p);
    res.json({ ...c, descripcion: describir(p, await nombreProveedor(p)) });
  } catch (e) {
    console.error('[precios] vista:', e.message);
    res.status(500).json({ error: 'No se pudo calcular' });
  }
});

// Aplicar el cambio. Se recalcula en el servidor (no se confia en la lista que manda la pantalla)
router.post('/aplicar', async (req, res) => {
  if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para cambiar precios' });
  const p = leerPedido(req.body || {});
  if (p.error) return res.status(400).json({ error: p.error });
  let client;
  try {
    await asegurarTabla();
    const c = await calcular(p);
    if (!c.cambian.length) return res.status(400).json({ error: 'Ningún precio cambia con estos datos' });
    const descripcion = describir(p, await nombreProveedor(p));
    let quien = null;
    try { const u = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); quien = u.rows[0] ? u.rows[0].nombre : null; } catch (e) {}
    client = await pool.connect();
    await client.query('BEGIN');
    for (const it of c.cambian) await client.query('UPDATE productos SET precio = $1 WHERE id = $2', [it.despues, it.id]);
    const detalle = c.cambian.map(it => ({ id: it.id, nombre: it.nombre, antes: it.antes, despues: it.despues }));
    const r = await client.query(
      `INSERT INTO precios_cambios (usuario_id, usuario_nombre, descripcion, cantidad, detalle) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.usuario.id || null, quien || req.usuario.email || null, descripcion, detalle.length, JSON.stringify(detalle)]);
    await client.query('COMMIT');
    res.json({ ok: true, id: r.rows[0].id, cantidad: detalle.length, descripcion });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    console.error('[precios] aplicar:', e.message);
    res.status(500).json({ error: 'No se pudieron actualizar los precios. No se cambió nada.' });
  } finally {
    if (client) client.release();
  }
});

// Ultimos cambios en masa (para poder deshacerlos)
router.get('/historial', async (req, res) => {
  try {
    await asegurarTabla();
    const r = await pool.query(`SELECT id, creado_en, usuario_nombre, descripcion, cantidad, deshecho_en FROM precios_cambios ORDER BY id DESC LIMIT 15`);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar el historial' });
  }
});

// Productos de un cambio en masa (para imprimir sus etiquetas nuevas)
router.get('/:id/productos', async (req, res) => {
  try {
    await asegurarTabla();
    const r = await pool.query('SELECT detalle, deshecho_en FROM precios_cambios WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'No se encontró ese cambio' });
    res.json({ deshecho: !!r.rows[0].deshecho_en, ids: (r.rows[0].detalle || []).map(it => it.id) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer el cambio' });
  }
});

// Deshacer: vuelve cada producto a su precio anterior, salvo los que se cambiaron a mano
// despues (esos se dejan como estan, para no pisar un cambio mas nuevo)
router.post('/:id/deshacer', async (req, res) => {
  if (!(await puedeEditar(req))) return res.status(403).json({ error: 'No tenés permiso para cambiar precios' });
  let client;
  try {
    await asegurarTabla();
    client = await pool.connect();
    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM precios_cambios WHERE id = $1 FOR UPDATE', [req.params.id]);
    const cambio = r.rows[0];
    if (!cambio) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró ese cambio' }); }
    if (cambio.deshecho_en) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ese cambio ya se deshizo' }); }
    let vueltos = 0, salteados = 0;
    for (const it of cambio.detalle || []) {
      const u = await client.query('UPDATE productos SET precio = $1 WHERE id = $2 AND precio = $3', [it.antes, it.id, it.despues]);
      if (u.rowCount) vueltos++; else salteados++;
    }
    await client.query('UPDATE precios_cambios SET deshecho_en = NOW() WHERE id = $1', [cambio.id]);
    await client.query('COMMIT');
    res.json({ ok: true, vueltos, salteados });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    console.error('[precios] deshacer:', e.message);
    res.status(500).json({ error: 'No se pudo deshacer. No se cambió nada.' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
