const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Comprobantes: facturas emitidas en ARCA, ventas que quedaron sin facturar y anuladas.
// Las fechas son dias argentinos (las ventas se guardan sin zona horaria).
const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
// Mismo criterio que el aviso de "facturas pendientes" del POS
const PENDIENTE = `(v.canal = 'presencial' AND COALESCE(v.es_preventa, FALSE) = FALSE AND COALESCE(v.cae, '') = ''
  AND COALESCE(v.monto_gift_card, 0) < v.total AND COALESCE(v.estado_facturacion, '') <> 'no_aplica')`;

const hayVentaPagos = porNegocio(null);
const tieneVentaPagos = async () => {
  if (hayVentaPagos.get() === null) {
    const r = await pool.query(`SELECT to_regclass('venta_pagos') AS t`);
    hayVentaPagos.set(!!r.rows[0].t);
  }
  return hayVentaPagos.get();
};
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));

router.get('/', async (req, res) => {
  try {
    const { desde, hasta, local_id, q, tipo, estado } = req.query;
    if (!esFecha(desde) || !esFecha(hasta)) return res.status(400).json({ error: 'Elegí el período' });
    const conPagos = await tieneVentaPagos();
    const params = [desde, hasta];
    let where = `${AR('v.creado_en')}::date BETWEEN $1::date AND $2::date
      AND COALESCE(v.canal, '') <> 'prueba'
      AND (COALESCE(v.cae, '') <> '' OR ${PENDIENTE})`;
    const localNum = parseInt(local_id);
    if (localNum) { params.push(localNum); where += ` AND v.local_id = $${params.length}`; }
    if (['A', 'B', 'C'].includes(tipo)) { params.push(tipo); where += ` AND COALESCE(v.tipo_factura, 'B') = $${params.length}`; }
    if (q && String(q).trim()) {
      params.push('%' + String(q).trim() + '%');
      const i = params.length;
      where += ` AND (v.numero_factura ILIKE $${i} OR v.nro_comprobante::text ILIKE $${i} OR v.cae ILIKE $${i}
        OR c.nombre ILIKE $${i} OR c.cuit_dni ILIKE $${i})`;
    }
    const r = await pool.query(`
      SELECT v.id, v.numero_factura, v.tipo_factura, v.punto_venta, v.nro_comprobante, v.cae, v.cae_vto,
        v.total, COALESCE(v.monto_gift_card, 0) AS monto_gift_card, v.medio_pago, v.local_id, v.canal,
        COALESCE(v.anulada, FALSE) AS anulada, v.motivo_anulacion, v.anulada_por,
        v.ultimo_error_facturacion, v.intentos_facturacion,
        ${PENDIENTE} AS pendiente,
        c.nombre AS cliente_nombre, c.cuit_dni, u.nombre AS vendedora_nombre,
        v.creado_en, to_char(${AR('v.creado_en')}, 'YYYY-MM-DD') AS fecha, to_char(${AR('v.creado_en')}, 'HH24:MI') AS hora,
        COALESCE((SELECT json_agg(json_build_object('nombre', COALESCE(p.nombre, 'Ajuste'), 'marca', p.marca, 'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario) ORDER BY vi.id)
          FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = v.id), '[]') AS items
        ${conPagos ? `, COALESCE((SELECT json_agg(json_build_object('nombre', vp.medio_pago_nombre, 'importe', vp.importe))
          FROM venta_pagos vp WHERE vp.venta_id = v.id), '[]') AS pagos` : ''}
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE ${where}
      ORDER BY v.creado_en DESC
      LIMIT 2000`, params);

    let filas = r.rows;
    // Resumen del periodo (antes de filtrar por estado, asi los contadores de arriba no cambian)
    const emitidos = filas.filter(f => f.cae && !f.anulada);
    const resumen = {
      emitidos: emitidos.length,
      total_emitido: emitidos.reduce((s, f) => s + parseFloat(f.total || 0), 0),
      pendientes: filas.filter(f => f.pendiente && !f.anulada).length,
      total_pendiente: filas.filter(f => f.pendiente && !f.anulada).reduce((s, f) => s + parseFloat(f.total || 0), 0),
      anulados: filas.filter(f => f.anulada).length,
      anulados_con_cae: filas.filter(f => f.anulada && f.cae).length,
      por_tipo: ['A', 'B', 'C'].map(t => {
        const l = emitidos.filter(f => (f.tipo_factura || 'B') === t);
        return { tipo: t, cantidad: l.length, total: l.reduce((s, f) => s + parseFloat(f.total || 0), 0) };
      }).filter(x => x.cantidad > 0),
    };
    if (estado === 'emitidos') filas = emitidos;
    else if (estado === 'pendientes') filas = filas.filter(f => f.pendiente && !f.anulada);
    else if (estado === 'anulados') filas = filas.filter(f => f.anulada);
    res.json({ comprobantes: filas, resumen });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener comprobantes: ' + error.message });
  }
});

module.exports = router;
