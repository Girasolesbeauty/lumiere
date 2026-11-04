const express = require('express');
const router = express.Router();
const controller = require('../controllers/productosController');
router.get('/', controller.getAll);
router.get('/sugerencia-compra', controller.getSugerenciaCompra);
router.get('/rotacion', controller.getRotacion);
router.put('/lead-time-proveedor', controller.guardarLeadTimeProveedor);
router.post('/guardar-minimos', controller.guardarMinimos);
router.get('/alertas/stock', controller.getAlertas);
router.get('/stock/transito', controller.getTransito);
router.get('/stock/ajustes', controller.getHistorialAjustes);
router.get('/stock/ajustes-pendientes', controller.getAjustesPendientes);
router.get('/imagenes/todas', controller.getImagenes);
router.post('/recalcular-stock-minimo', controller.recalcularStockMinimo);
// "Tambien llevan" para el Punto de Venta: lo que otros clientes compraron junto con lo del carrito
// (misma venta o el mismo cliente en los 90 dias siguientes) y, si faltan, lo que completa la rutina facial.
// Solo productos activos con stock en el local.
const pool = require('../config/database');
const { VENTA_VALIDA } = require('../lib/niveles');
const { pasoDe } = require('../lib/logros');
// Kits, sets y combos traen varios pasos juntos: no se ofrecen como "el paso que le falta"
const esKit = (p) => /\b(kits?|sets?|packs?|combos?|d[uú]o|tr[ií]o|box)\b/i.test([p.nombre, p.categoria].join(' '));
router.get('/tambien-llevan', async (req, res) => {
  try {
    const ids = [...new Set(String(req.query.ids || '').split(',').map(x => parseInt(x)).filter(x => x > 0))].slice(0, 20);
    if (!ids.length) return res.json([]);
    const col = req.query.local === 'ush' || req.query.local === '2' ? 'stock_ush' : 'stock_rg';
    const co = (await pool.query(`
      WITH base AS (
        SELECT DISTINCT v.id, v.cliente_id, v.creado_en FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
        WHERE vi.producto_id = ANY($1::int[]) AND v.creado_en > NOW() - INTERVAL '12 months' AND ${VENTA_VALIDA})
      SELECT p.id, p.nombre, p.marca, p.precio, p.categoria, COALESCE(p.${col}, 0) AS stock, COUNT(DISTINCT COALESCE('c' || v.cliente_id::text, 'v' || v.id::text))::int AS n
      FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
      JOIN base b ON v.id = b.id OR (b.cliente_id IS NOT NULL AND v.cliente_id = b.cliente_id AND v.creado_en BETWEEN b.creado_en AND b.creado_en + INTERVAL '90 days')
      JOIN productos p ON p.id = vi.producto_id
      WHERE NOT (vi.producto_id = ANY($1::int[])) AND p.activo = TRUE AND COALESCE(p.${col}, 0) > 0 AND COALESCE(p.tiene_variantes, FALSE) = FALSE AND ${VENTA_VALIDA}
      GROUP BY p.id HAVING COUNT(DISTINCT COALESCE('c' || v.cliente_id::text, 'v' || v.id::text)) >= 2
      ORDER BY n DESC LIMIT 4`, [ids])).rows.map(x => ({ ...x, motivo: 'Lo llevan ' + x.n + ' clientes que compraron esto' }));
    let sug = co;
    if (sug.length < 4) {
      // Completar la rutina: si lleva skincare facial y le falta un paso clave, lo mas vendido de ese paso
      const enCarrito = (await pool.query('SELECT id, nombre, categoria FROM productos WHERE id = ANY($1::int[])', [ids])).rows;
      const pasos = new Set(enCarrito.map(pasoDe).filter(Boolean));
      const yaSugeridos = new Set(sug.map(pasoDe).filter(Boolean));
      if (pasos.size) {
        const faltan = ['solar', 'hidratante', 'limpieza', 'serum', 'tonico'].filter(t => !pasos.has(t) && !yaSugeridos.has(t));
        const cands = (await pool.query(`SELECT p.id, p.nombre, p.marca, p.precio, p.categoria, COALESCE(p.${col}, 0) AS stock,
            COALESCE((SELECT SUM(vi.cantidad) FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id WHERE vi.producto_id = p.id AND v.creado_en > NOW() - INTERVAL '90 days' AND ${VENTA_VALIDA}), 0)::int AS vendidas
          FROM productos p WHERE p.activo = TRUE AND COALESCE(p.${col}, 0) > 0 AND COALESCE(p.tiene_variantes, FALSE) = FALSE AND NOT (p.id = ANY($1::int[]))`, [ids])).rows;
        const NOMBRE = { solar: 'protector solar', hidratante: 'crema', limpieza: 'limpiador', serum: 'sérum', tonico: 'tónico' };
        for (const t of faltan) {
          if (sug.length >= 4) break;
          const mejor = cands.filter(c => !esKit(c) && pasoDe(c) === t && !sug.some(s => s.id === c.id)).sort((a, b) => b.vendidas - a.vendidas)[0];
          if (mejor) sug.push({ id: mejor.id, nombre: mejor.nombre, marca: mejor.marca, precio: mejor.precio, stock: mejor.stock, motivo: 'Completa la rutina: le falta ' + NOMBRE[t] });
        }
      }
    }
    res.json(sug.map(x => ({ id: x.id, nombre: x.nombre, marca: x.marca, precio: parseFloat(x.precio) || 0, stock: Number(x.stock) || 0, motivo: x.motivo })));
  } catch (e) { console.error('[productos] tambien llevan:', e.message); res.json([]); }
});
// Marcas: la lista con cuántos productos tiene cada una, agrupando las que están escritas distinto
// ("Skin1004", "SKIN 1004", "skin 1004"), y corregir el nombre en todos los productos de una vez.
const claveMarca = (m) => String(m || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
async function puedeEditarProductos(u) {
  if (!u || !u.id) return false;
  if (u.rol === 'jefe' || Number(u.rol_id) === 1) return true;
  return (await pool.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'inventario.editar'`, [u.id])).rows.length > 0;
}
router.get('/marcas/lista', async (req, res) => {
  try {
    const r = await pool.query(`SELECT TRIM(marca) AS marca, COUNT(*)::int AS productos, COUNT(*) FILTER (WHERE activo)::int AS activos
      FROM productos WHERE COALESCE(TRIM(marca), '') <> '' GROUP BY TRIM(marca) ORDER BY TRIM(marca)`);
    // Con que proveedor esta cargada cada marca (id vacio = productos sin proveedor)
    const pv = await pool.query(`SELECT TRIM(p.marca) AS marca, p.proveedor_id AS id, pr.nombre, COUNT(*)::int AS productos
      FROM productos p LEFT JOIN proveedores pr ON pr.id = p.proveedor_id WHERE COALESCE(TRIM(p.marca), '') <> '' GROUP BY 1, 2, 3 ORDER BY 4 DESC`);
    r.rows.forEach(x => { x.proveedores = pv.rows.filter(y => y.marca === x.marca).map(y => ({ id: y.id, nombre: y.nombre, productos: y.productos })); });
    const grupos = {};
    r.rows.forEach(x => { const k = claveMarca(x.marca); (grupos[k] = grupos[k] || []).push(x); });
    const sinMarca = (await pool.query(`SELECT COUNT(*)::int AS n FROM productos WHERE activo AND COALESCE(TRIM(marca), '') = ''`)).rows[0].n;
    res.json({
      marcas: Object.values(grupos).map(g => ({ formas: g.sort((a, b) => b.productos - a.productos), productos: g.reduce((s, x) => s + x.productos, 0) }))
        .sort((a, b) => (b.formas.length > 1) - (a.formas.length > 1) || a.formas[0].marca.localeCompare(b.formas[0].marca, 'es')),
      sin_marca: sinMarca,
      puede_editar: await puedeEditarProductos(req.usuario),
    });
  } catch (e) { console.error('[marcas]', e.message); res.status(500).json({ error: 'No se pudieron cargar las marcas' }); }
});
router.put('/marcas/renombrar', async (req, res) => {
  try {
    if (!(await puedeEditarProductos(req.usuario))) return res.status(403).json({ error: 'No tenés permiso para editar productos' });
    const de = [...new Set((Array.isArray(req.body.de) ? req.body.de : [req.body.de]).map(x => String(x || '').trim()).filter(Boolean))].slice(0, 50);
    const a = String(req.body.a || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!de.length || !a) return res.status(400).json({ error: 'Escribí el nombre correcto de la marca' });
    const r = await pool.query(`UPDATE productos SET marca = $1 WHERE TRIM(marca) = ANY($2::text[]) AND marca IS DISTINCT FROM $1`, [a, de]);
    res.json({ ok: true, productos_actualizados: r.rowCount });
  } catch (e) { console.error('[marcas]', e.message); res.status(500).json({ error: 'No se pudo cambiar la marca' }); }
});

// Asignar un proveedor a todos los productos de una marca de una vez. Por defecto solo completa los que no
// tienen proveedor; con "pisar" cambia tambien los que ya tienen otro. Devuelve como estaba cada uno para poder deshacer.
router.put('/marcas/proveedor', async (req, res) => {
  try {
    if (!(await puedeEditarProductos(req.usuario))) return res.status(403).json({ error: 'No tenés permiso para editar productos' });
    const de = [...new Set((Array.isArray(req.body.marcas) ? req.body.marcas : [req.body.marcas]).map(x => String(x || '').trim()).filter(Boolean))].slice(0, 50);
    const pid = parseInt(req.body.proveedor_id, 10);
    const pisar = req.body.pisar === true;
    if (!de.length || !pid) return res.status(400).json({ error: 'Elegí la marca y el proveedor' });
    const prov = (await pool.query('SELECT id, nombre FROM proveedores WHERE id = $1', [pid])).rows[0];
    if (!prov) return res.status(404).json({ error: 'No se encontró ese proveedor' });
    const antes = (await pool.query(
      `SELECT id, proveedor_id FROM productos WHERE TRIM(marca) = ANY($1::text[]) AND proveedor_id IS DISTINCT FROM $2 AND ($3 OR proveedor_id IS NULL)`, [de, pid, pisar])).rows;
    const omitidos = pisar ? 0 : (await pool.query(
      `SELECT COUNT(*)::int AS n FROM productos WHERE TRIM(marca) = ANY($1::text[]) AND proveedor_id IS NOT NULL AND proveedor_id <> $2`, [de, pid])).rows[0].n;
    if (antes.length) await pool.query('UPDATE productos SET proveedor_id = $1 WHERE id = ANY($2::int[])', [pid, antes.map(x => x.id)]);
    res.json({ ok: true, proveedor: prov.nombre, productos_actualizados: antes.length, omitidos, anteriores: antes });
  } catch (e) { console.error('[marcas] proveedor:', e.message); res.status(500).json({ error: 'No se pudo asignar el proveedor' }); }
});
router.put('/marcas/proveedor/deshacer', async (req, res) => {
  try {
    if (!(await puedeEditarProductos(req.usuario))) return res.status(403).json({ error: 'No tenés permiso para editar productos' });
    const lista = (Array.isArray(req.body.anteriores) ? req.body.anteriores : []).slice(0, 20000)
      .map(x => ({ id: parseInt(x && x.id, 10), prov: x && x.proveedor_id !== null && x.proveedor_id !== undefined ? parseInt(x.proveedor_id, 10) : null }))
      .filter(x => x.id && (x.prov === null || x.prov > 0));
    if (!lista.length) return res.json({ ok: true, productos_actualizados: 0 });
    const r = await pool.query('UPDATE productos p SET proveedor_id = v.prov FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS prov) v WHERE p.id = v.id', [lista.map(x => x.id), lista.map(x => x.prov)]);
    res.json({ ok: true, productos_actualizados: r.rowCount });
  } catch (e) { console.error('[marcas] deshacer proveedor:', e.message); res.status(500).json({ error: 'No se pudo deshacer' }); }
});

router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.put('/:id/ajustar-stock', controller.ajustarStock);
router.post('/:id/solicitar-ajuste', controller.solicitarAjuste);
router.post('/ajustes-pendientes/:id/resolver', controller.resolverAjuste);
router.put('/:id/estado', controller.cambiarEstado);
router.get('/:id/imagen', controller.getImagen);
router.put('/:id/imagen', controller.guardarImagen);
router.delete('/:id/imagen', controller.borrarImagen);
module.exports = router;