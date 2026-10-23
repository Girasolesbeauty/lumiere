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
// "Tambien llevan" para el Punto de Venta: lo que otras clientas compraron junto con lo del carrito
// (misma venta o la misma clienta en los 90 dias siguientes) y, si faltan, lo que completa la rutina facial.
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
      ORDER BY n DESC LIMIT 4`, [ids])).rows.map(x => ({ ...x, motivo: 'Lo llevan ' + x.n + ' clientas que compraron esto' }));
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