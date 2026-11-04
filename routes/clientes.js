const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientesController');

router.get('/', controller.getAll);
// Buscar un cliente por DNI desde el Punto de Venta (rápido: no baja toda la lista). Encuentra el mismo número
// escrito con puntos o espacios, con ceros adelante, y también si el cliente está guardada con su CUIT
// (27-32456789-4 → DNI 32456789) o si escriben el CUIT y está guardada con el DNI.
const pool = require('../config/database');
// Buscar clientes por celular (Punto de Venta, señas y preventas): se comparan los últimos 6 números, así encuentra
// el mismo celular escrito con o sin 0, 15, código de área o +54 9. Devuelve hasta 6, las más parecidas primero.
router.get('/buscar-tel', async (req, res) => {
  try {
    const q = String(req.query.tel || '').replace(/[^0-9]/g, '');
    if (q.length < 6) return res.json([]);
    const r = await pool.query(`
      WITH c AS (SELECT cl.*, regexp_replace(COALESCE(cl.telefono, ''), '[^0-9]', '', 'g') AS dig FROM clientes cl)
      SELECT c.id, c.nombre, c.email, c.cuit_dni, c.telefono, c.fecha_nacimiento, c.puntos, c.nivel, c.total_compras, c.local_id, c.creado_en,
             (c.password_hash IS NOT NULL) AS portal_activo, c.portal_registrado_en,
             (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND COALESCE(v.anulada, FALSE) = FALSE AND v.total > 0)::int AS compras
      FROM c
      WHERE length(c.dig) >= 6 AND right(c.dig, 6) = right($1, 6)
      ORDER BY (right(c.dig, 8) = right($1, 8)) DESC, (c.dig = $1) DESC, compras DESC, c.id
      LIMIT 6`, [q]);
    res.json(r.rows);
  } catch (e) { console.error('[clientes] buscar-tel:', e.message); res.status(500).json({ error: 'No se pudo buscar el cliente' }); }
});
router.get('/buscar-dni', async (req, res) => {
  try {
    const d = String(req.query.dni || '').replace(/\D/g, '').replace(/^0+/, '');
    if (d.length < 6) return res.json(null);
    const dniDeCuit = d.length === 11 ? d.slice(2, 10).replace(/^0+/, '') : null;
    const r = await pool.query(`
      WITH c AS (
        SELECT cl.*, ltrim(regexp_replace(COALESCE(cl.cuit_dni, ''), '[^0-9]', '', 'g'), '0') AS dig FROM clientes cl
      )
      SELECT c.id, c.nombre, c.email, c.cuit_dni, c.telefono, c.fecha_nacimiento, c.puntos, c.nivel, c.total_compras, c.local_id, c.creado_en,
             (c.password_hash IS NOT NULL) AS portal_activo, c.portal_registrado_en,
             (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND COALESCE(v.anulada, FALSE) = FALSE AND v.total > 0)::int AS compras,
             (SELECT MAX(v.creado_en) FROM ventas v WHERE v.cliente_id = c.id AND COALESCE(v.anulada, FALSE) = FALSE) AS ultima_compra
      FROM c
      WHERE c.dig = $1
         OR (length(c.dig) BETWEEN 10 AND 11 AND ltrim(substring(lpad(c.dig, 11, '0') FROM 3 FOR 8), '0') = $1)
         OR ($2::text IS NOT NULL AND c.dig = $2::text)
      ORDER BY (c.dig = $1) DESC, c.id
      LIMIT 1`, [d, dniDeCuit]);
    res.json(r.rows[0] || null);
  } catch (e) { console.error('[clientes] buscar-dni:', e.message); res.status(500).json({ error: 'No se pudo buscar el cliente' }); }
});
router.get('/config/niveles', controller.getNiveles);
router.get('/config/cumple', controller.getCumple);
router.put('/config/cumple', controller.guardarMensajeCumple);
router.post('/:id/saludo-cumple', controller.saludoCumple);
router.put('/config/niveles', controller.guardarNiveles);
router.get('/portal/resumen', controller.getPortalResumen);
router.get('/:id/portal-vista', controller.getPortalVista);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/historial', controller.getHistorial);
router.post('/:id/puntos', controller.agregarPuntos);
router.post('/:id/resetear-portal', controller.resetearPortal);
router.post('/:id/migrar-puntos', controller.migrarPuntos);
router.get('/:id/migrar-puntos', controller.getMigracionPuntos);

module.exports = router;