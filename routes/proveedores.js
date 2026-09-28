const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE activo = TRUE ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// Reporte de compras por proveedor en un rango de fechas (usa fecha_factura de cada
// orden de ingreso). Va ANTES de /:id para que Express no confunda "reporte-compras"
// con un id de proveedor.
// Reporte de VENTAS por proveedor: cuanto se vendio de los productos de cada proveedor
// en un rango de fechas (distinto del reporte de compras -- ese mira lo que le compraste
// vos al proveedor, este mira lo que le vendiste a tus clientas de su mercaderia).
router.get('/reporte-ventas', async (req, res) => {
  try {
    const { desde, hasta, local_id, proveedor_id } = req.query;
    let q = `
      SELECT p.id AS proveedor_id, p.nombre AS proveedor_nombre,
             COUNT(DISTINCT vi.venta_id) AS cantidad_ventas,
             COALESCE(SUM(vi.cantidad), 0) AS unidades_vendidas,
             COALESCE(SUM(vi.cantidad * vi.precio_unitario), 0) AS total_vendido
      FROM proveedores p
      JOIN productos pr ON pr.proveedor_id = p.id
      JOIN venta_items vi ON vi.producto_id = pr.id
      JOIN ventas v ON v.id = vi.venta_id
      WHERE COALESCE(v.es_preventa, FALSE) = FALSE
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND v.creado_en >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND v.creado_en < ($${params.length}::date + interval '1 day')`; }
    if (local_id) { params.push(local_id); q += ` AND v.local_id = $${params.length}`; }
    if (proveedor_id) { params.push(proveedor_id); q += ` AND p.id = $${params.length}`; }
    q += ' GROUP BY p.id, p.nombre ORDER BY total_vendido DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el reporte de ventas: ' + error.message });
  }
});

// Detalle: que productos puntuales de ese proveedor se vendieron en el periodo.
router.get('/:id/productos-vendidos', async (req, res) => {
  try {
    const { desde, hasta, local_id } = req.query;
    let q = `
      SELECT pr.id AS producto_id, pr.nombre AS producto_nombre,
             SUM(vi.cantidad) AS unidades_vendidas,
             SUM(vi.cantidad * vi.precio_unitario) AS total_vendido
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos pr ON pr.id = vi.producto_id
      WHERE pr.proveedor_id = $1 AND COALESCE(v.es_preventa, FALSE) = FALSE
    `;
    const params = [req.params.id];
    if (desde) { params.push(desde); q += ` AND v.creado_en >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND v.creado_en < ($${params.length}::date + interval '1 day')`; }
    if (local_id) { params.push(local_id); q += ` AND v.local_id = $${params.length}`; }
    q += ' GROUP BY pr.id, pr.nombre ORDER BY total_vendido DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el detalle: ' + error.message });
  }
});

// ¿Llegamos a pagarle? Por proveedor: lo que se le debe (ordenes sin pagar, incluidos los
// pedidos en camino), cuanto se vendio de sus productos en el periodo, el ritmo actual de
// venta y si a ese ritmo se llega a juntar la plata antes del vencimiento. Si no llega,
// sugiere que productos suyos empujar (los que mas plata tienen parada en stock).
router.get('/cobertura-pagos', async (req, res) => {
  try {
    const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
    const VALIDA = `COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
      AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')`;
    const hoyAR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : hoyAR;
    const desdeElegido = esFecha(req.query.desde) ? req.query.desde : null;
    const provId = parseInt(req.query.proveedor_id) || null;

    // Deuda: ordenes no pagadas
    const deudaRes = await pool.query(`
      SELECT o.id, o.proveedor_id, o.numero_factura, to_char(o.fecha_factura, 'YYYY-MM-DD') AS fecha,
             to_char(o.fecha_vencimiento, 'YYYY-MM-DD') AS vence, o.total, o.estado
      FROM ordenes_ingreso o
      WHERE COALESCE(o.estado, 'pendiente') <> 'pagada' ${provId ? 'AND o.proveedor_id = $1' : ''}
      ORDER BY o.fecha_vencimiento NULLS LAST`, provId ? [provId] : []);
    const deudas = {};
    deudaRes.rows.forEach(o => { (deudas[o.proveedor_id] = deudas[o.proveedor_id] || []).push(o); });

    // Proveedores a mostrar: el elegido, o todos los que tienen deuda o ventas en el periodo
    const provRes = await pool.query(`SELECT id, nombre, dias_pago FROM proveedores WHERE activo = TRUE ${provId ? 'AND id = $1' : ''} ORDER BY nombre`, provId ? [provId] : []);

    // Ventas por proveedor y dia (sirve para el periodo elegido y para "desde la compra impaga mas vieja")
    const desdeMin = desdeElegido || (deudaRes.rows.length ? deudaRes.rows.reduce((m, o) => (o.fecha < m ? o.fecha : m), hoyAR) : hoyAR);
    const desdeConsulta = [desdeMin, new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })].sort()[0];
    const vRes = await pool.query(`
      SELECT p.proveedor_id, ${AR('v.creado_en')}::date::text AS dia, SUM(vi.cantidad * vi.precio_unitario) AS monto, SUM(vi.cantidad) AS unidades
      FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
      WHERE ${VALIDA} AND p.proveedor_id IS NOT NULL ${provId ? 'AND p.proveedor_id = $3' : ''}
        AND ${AR('v.creado_en')}::date BETWEEN $1::date AND $2::date
      GROUP BY p.proveedor_id, dia`, provId ? [desdeConsulta, hasta, provId] : [desdeConsulta, hasta]);
    const ventasDia = {};
    vRes.rows.forEach(r => { (ventasDia[r.proveedor_id] = ventasDia[r.proveedor_id] || []).push({ dia: r.dia, monto: parseFloat(r.monto) || 0, unidades: parseFloat(r.unidades) || 0 }); });
    const sumar = (lista, d, h) => (lista || []).filter(x => x.dia >= d && x.dia <= h).reduce((s, x) => ({ monto: s.monto + x.monto, unidades: s.unidades + x.unidades }), { monto: 0, unidades: 0 });
    const hace30 = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);

    const resultado = [];
    for (const pr of provRes.rows) {
      const ords = deudas[pr.id] || [];
      const deuda = ords.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      const desdeProv = desdeElegido || (ords.length ? ords.reduce((m, o) => (o.fecha < m ? o.fecha : m), hoyAR) : hace30);
      const vendido = sumar(ventasDia[pr.id], desdeProv, hasta);
      if (!provId && deuda <= 0 && vendido.monto <= 0) continue;
      const ritmo = sumar(ventasDia[pr.id], hace30, hoyAR).monto / 30;
      const proxVence = ords.map(o => o.vence).filter(Boolean).sort()[0] || null;
      const diasAlVenc = proxVence ? dias(hoyAR, proxVence) : null;
      const proyeccion = vendido.monto + (diasAlVenc !== null && diasAlVenc > 0 ? ritmo * diasAlVenc : 0);
      let estado = 'sin_deuda';
      if (deuda > 0) estado = vendido.monto >= deuda ? 'cubierto' : proyeccion >= deuda ? 'llega' : 'no_llega';
      resultado.push({
        proveedor_id: pr.id, proveedor_nombre: pr.nombre,
        deuda, ordenes: ords, cantidad_ordenes: ords.length,
        desde: desdeProv, hasta,
        vendido: vendido.monto, unidades: vendido.unidades,
        cobertura_pct: deuda > 0 ? Math.round(vendido.monto / deuda * 100) : null,
        ritmo_diario: ritmo, proximo_vencimiento: proxVence, dias_al_vencimiento: diasAlVenc,
        proyeccion_al_vencimiento: proyeccion, falta: Math.max(0, deuda - vendido.monto),
        venta_diaria_necesaria: deuda > vendido.monto && diasAlVenc > 0 ? (deuda - vendido.monto) / diasAlVenc : null,
        estado,
      });
    }

    // Para los que no llegan: sus productos con mas plata parada en stock (para promocionar)
    const flojos = resultado.filter(r => r.estado === 'no_llega' || (provId && r.deuda > r.vendido)).map(r => r.proveedor_id);
    if (flojos.length) {
      const empujar = await pool.query(`
        SELECT * FROM (
          SELECT p.proveedor_id, p.id, p.nombre, p.marca, COALESCE(p.precio, 0) AS precio,
            COALESCE(p.stock_rg, 0) + COALESCE(p.stock_ush, 0) AS stock,
            (COALESCE(p.stock_rg, 0) + COALESCE(p.stock_ush, 0)) * COALESCE(p.precio, 0) AS valor_stock,
            ROW_NUMBER() OVER (PARTITION BY p.proveedor_id ORDER BY (COALESCE(p.stock_rg, 0) + COALESCE(p.stock_ush, 0)) * COALESCE(p.precio, 0) DESC) AS rn
          FROM productos p WHERE p.activo = TRUE AND p.proveedor_id = ANY($1::int[]) AND COALESCE(p.stock_rg, 0) + COALESCE(p.stock_ush, 0) > 0
        ) x WHERE rn <= 6`, [flojos]);
      resultado.forEach(r => { r.para_empujar = empujar.rows.filter(e => e.proveedor_id === r.proveedor_id); });
    }

    const pesoEstado = { no_llega: 0, llega: 1, cubierto: 2, sin_deuda: 3 };
    resultado.sort((a, b) => pesoEstado[a.estado] - pesoEstado[b.estado] || b.deuda - a.deuda || b.vendido - a.vendido);
    res.json({ hoy: hoyAR, proveedores: resultado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular la cobertura de pagos: ' + error.message });
  }
});

router.get('/reporte-compras', async (req, res) => {
  try {
    const { desde, hasta, proveedor_id } = req.query;
    let q = `
      SELECT p.id AS proveedor_id, p.nombre AS proveedor_nombre,
             COUNT(o.id) AS cantidad_ordenes, COALESCE(SUM(o.total), 0) AS total_comprado
      FROM proveedores p
      JOIN ordenes_ingreso o ON o.proveedor_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { params.push(desde); q += ` AND o.fecha_factura >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND o.fecha_factura <= $${params.length}`; }
    if (proveedor_id) { params.push(proveedor_id); q += ` AND p.id = $${params.length}`; }
    q += ' GROUP BY p.id, p.nombre ORDER BY total_comprado DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el reporte: ' + error.message });
  }
});

// Detalle de las ordenes individuales de un proveedor en el mismo rango (para desplegar
// y ver factura por factura, no solo el total).
router.get('/:id/ordenes', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let q = `SELECT id, numero_factura, fecha_factura, total, estado FROM ordenes_ingreso WHERE proveedor_id = $1`;
    const params = [req.params.id];
    if (desde) { params.push(desde); q += ` AND fecha_factura >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND fecha_factura <= $${params.length}`; }
    q += ' ORDER BY fecha_factura DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las ordenes: ' + error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas } = req.body;
    const result = await pool.query(
      `INSERT INTO proveedores (nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago || 30, forma_pago || 'transferencia', banco, cbu, alias, titular_cuenta, cuit_banco, categoria || 'mercaderia', notas]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo } = req.body;
    const result = await pool.query(
      `UPDATE proveedores SET nombre=$1, cuit=$2, email=$3, telefono=$4, whatsapp=$5, dias_pago=$6, forma_pago=$7, banco=$8, cbu=$9, alias=$10, titular_cuenta=$11, cuit_banco=$12, categoria=$13, notas=$14, activo=$15 WHERE id=$16 RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo !== undefined ? activo : true, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

module.exports = router;