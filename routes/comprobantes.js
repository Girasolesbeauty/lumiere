const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Comprobantes: facturas emitidas en ARCA, ventas que quedaron sin facturar y anuladas.
// Las fechas son dias argentinos (las ventas se guardan sin zona horaria).
const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
// Mismo criterio que el aviso de "facturas pendientes" del POS
// (las preventas entran cuando se entregan: ahi se facturan)
const PENDIENTE = `(v.canal = 'presencial' AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada') AND COALESCE(v.cae, '') = ''
  AND COALESCE(v.gc_facturada, v.monto_gift_card, 0) < v.total AND COALESCE(v.estado_facturacion, '') <> 'no_aplica')`;

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
    await require('../lib/giftCardFactura').asegurar();
    await require('../lib/preventasFactura').asegurar();
    const { desde, hasta, local_id, q, tipo, estado } = req.query;
    const texto = String(q || '').trim().slice(0, 60);
    // Con texto de busqueda se busca en todas las fechas (para encontrar una factura vieja por su numero)
    const todasLasFechas = !!texto;
    if (!todasLasFechas && (!esFecha(desde) || !esFecha(hasta))) return res.status(400).json({ error: 'Elegí el período' });
    const conPagos = await tieneVentaPagos();
    const conNC = !!(await pool.query(`SELECT to_regclass('notas_credito') AS t`)).rows[0].t;
    const params = todasLasFechas ? [] : [desde, hasta];
    // Fecha del comprobante: la de la venta; en una preventa, el dia que se entrego (ahi se factura)
    const FECHA = `COALESCE(CASE WHEN v.es_preventa THEN v.entregado_en END, v.creado_en)`;
    let where = `${todasLasFechas ? 'TRUE' : `${AR(FECHA)}::date BETWEEN $1::date AND $2::date`}
      AND COALESCE(v.canal, '') <> 'prueba'
      AND (COALESCE(v.cae, '') <> '' OR ${PENDIENTE})`;
    const localNum = parseInt(local_id);
    if (localNum) { params.push(localNum); where += ` AND v.local_id = $${params.length}`; }
    if (['A', 'B', 'C'].includes(tipo)) { params.push(tipo); where += ` AND COALESCE(v.tipo_factura, 'B') = $${params.length}`; }
    if (texto) {
      params.push('%' + texto.replace(/[\\%_]/g, '\\$&') + '%');
      const i = params.length;
      let extra = '';
      // "0005-00000123" o "5-123": punto de venta y numero exactos
      const pvNro = texto.match(/^(\d{1,5})\s*-\s*(\d{1,8})$/);
      if (pvNro) {
        params.push(parseInt(pvNro[1], 10), parseInt(pvNro[2], 10));
        extra = ` OR (COALESCE(v.punto_venta, 5) = $${params.length - 1} AND v.nro_comprobante = $${params.length})`;
      } else if (/^\d{1,8}$/.test(texto)) {
        // Solo numeros: tambien el numero de comprobante exacto, aunque lo escriban con ceros adelante
        params.push(parseInt(texto, 10));
        extra = ` OR v.nro_comprobante = $${params.length}`;
      }
      where += ` AND (v.numero_factura ILIKE $${i} OR v.nro_comprobante::text ILIKE $${i} OR v.cae ILIKE $${i}
        OR c.nombre ILIKE $${i} OR c.cuit_dni ILIKE $${i}${extra})`;
    }
    const r = await pool.query(`
      SELECT v.id, v.numero_factura, v.tipo_factura, v.punto_venta, v.nro_comprobante, v.cae, v.cae_vto,
        v.total, COALESCE(v.monto_gift_card, 0) AS monto_gift_card, COALESCE(v.gc_facturada, v.monto_gift_card, 0) AS gc_facturada, v.medio_pago, v.local_id, v.canal,
        COALESCE(v.anulada, FALSE) AS anulada, v.motivo_anulacion, v.anulada_por,
        v.ultimo_error_facturacion, v.intentos_facturacion,
        ${PENDIENTE} AS pendiente,
        c.nombre AS cliente_nombre, c.cuit_dni, c.telefono AS cliente_telefono, u.nombre AS vendedora_nombre,
        v.creado_en, to_char(${AR(FECHA)}, 'YYYY-MM-DD') AS fecha, to_char(${AR(FECHA)}, 'HH24:MI') AS hora,
        COALESCE((SELECT json_agg(json_build_object('nombre', COALESCE(p.nombre, 'Ajuste'), 'marca', p.marca, 'cantidad', vi.cantidad,
            'precio_unitario', vi.precio_unitario) ORDER BY vi.id)
          FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id WHERE vi.venta_id = v.id), '[]') AS items
        ${conPagos ? `, COALESCE((SELECT json_agg(json_build_object('nombre', vp.medio_pago_nombre, 'importe', vp.importe))
          FROM venta_pagos vp WHERE vp.venta_id = v.id), '[]') AS pagos` : ''}
        ${conNC ? `, COALESCE((SELECT json_agg(json_build_object('id', nc.id, 'tipo', nc.tipo, 'punto_venta', nc.punto_venta, 'nro', nc.nro,
            'cae', nc.cae, 'cae_vto', nc.cae_vto, 'importe', nc.importe, 'motivo', nc.motivo, 'usuario_nombre', nc.usuario_nombre,
            'fecha', to_char(${AR('nc.creado_en')}, 'YYYY-MM-DD'), 'hora', to_char(${AR('nc.creado_en')}, 'HH24:MI')) ORDER BY nc.id)
          FROM notas_credito nc WHERE nc.venta_id = v.id), '[]') AS notas_credito` : `, '[]'::json AS notas_credito`}
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE ${where}
      ORDER BY ${FECHA} DESC
      LIMIT ${todasLasFechas ? 300 : 2000}`, params);

    let filas = r.rows;
    // Ventas de gift cards (modalidad nueva: se facturan al venderlas). Van como un comprobante mas
    if (tipo !== 'A' && tipo !== 'C') {
      const gp = todasLasFechas ? [] : [desde, hasta];
      let gw = `g.factura_al_emitir AND NOT COALESCE(g.es_migracion, FALSE)${todasLasFechas ? '' : ` AND ${AR('COALESCE(g.facturada_en, g.creado_en)')}::date BETWEEN $1::date AND $2::date`}`;
      if (localNum) { gp.push(localNum); gw += ` AND g.local_id = $${gp.length}`; }
      if (texto) { gp.push('%' + texto.replace(/[\\%_]/g, '\\$&') + '%'); gw += ` AND (g.codigo ILIKE $${gp.length} OR g.comprador_nombre ILIKE $${gp.length} OR g.beneficiario_nombre ILIKE $${gp.length} OR g.cae ILIKE $${gp.length} OR g.nro_comprobante::text ILIKE $${gp.length})`; }
      const g = await pool.query(`SELECT g.*, ${AR('COALESCE(g.facturada_en, g.creado_en)')} AS fecha_ar, u.nombre AS vendedora_nombre FROM gift_cards g LEFT JOIN usuarios u ON u.id = g.emitida_por WHERE ${gw} ORDER BY g.id DESC LIMIT 500`, gp);
      const gcs = g.rows.map(x => {
        const d = new Date(x.fecha_ar), dd = (n) => String(n).padStart(2, '0');
        return {
          id: 'gc-' + x.id, gift_card_id: x.id, es_gift_card: true, numero_factura: x.codigo, tipo_factura: 'B', punto_venta: x.punto_venta, nro_comprobante: x.nro_comprobante,
          cae: x.cae, cae_vto: x.cae_vto, total: x.monto_inicial, monto_gift_card: 0, gc_facturada: 0, facturado: parseFloat(x.monto_inicial), medio_pago: x.forma_pago || 'Gift card',
          local_id: x.local_id, canal: 'gift_card', anulada: x.anulada === true, motivo_anulacion: x.motivo_anulacion, ultimo_error_facturacion: x.error_facturacion,
          intentos_facturacion: x.intentos_facturacion, pendiente: !x.cae && x.anulada !== true, cliente_nombre: x.comprador_nombre || x.beneficiario_nombre, cuit_dni: null,
          vendedora_nombre: x.vendedora_nombre, creado_en: x.creado_en,
          fecha: d.getFullYear() + '-' + dd(d.getMonth() + 1) + '-' + dd(d.getDate()), hora: dd(d.getHours()) + ':' + dd(d.getMinutes()),
          items: [{ nombre: 'Gift card ' + x.codigo + (x.beneficiario_nombre ? ' para ' + x.beneficiario_nombre : ''), cantidad: 1, precio_unitario: x.monto_inicial }],
          pagos: [], notas_credito: [], total_nc: 0, nc_disponible: 0,
        };
      });
      filas = [...filas, ...gcs].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    }
    // Cuanto de cada factura ya se anulo con nota de credito
    filas.filter(f => !f.es_gift_card).forEach(f => {
      const facturado = parseFloat(f.total || 0) - parseFloat(f.gc_facturada || 0);
      f.facturado = facturado;
      f.total_nc = (f.notas_credito || []).reduce((s, n) => s + parseFloat(n.importe || 0), 0);
      f.nc_disponible = f.cae ? Math.max(0, Math.round((facturado - f.total_nc) * 100) / 100) : 0;
    });
    // Resumen del periodo (antes de filtrar por estado, asi los contadores de arriba no cambian)
    const emitidos = filas.filter(f => f.cae && !f.anulada);
    const resumen = {
      emitidos: emitidos.length,
      total_emitido: emitidos.reduce((s, f) => s + parseFloat(f.facturado ?? f.total ?? 0), 0),
      pendientes: filas.filter(f => f.pendiente && !f.anulada).length,
      total_pendiente: filas.filter(f => f.pendiente && !f.anulada).reduce((s, f) => s + parseFloat(f.total || 0), 0),
      anulados: filas.filter(f => f.anulada).length,
      anulados_con_cae: filas.filter(f => f.anulada && f.cae && f.nc_disponible > 0).length,
      con_nc: filas.filter(f => f.total_nc > 0).length,
      total_nc: filas.reduce((s, f) => s + f.total_nc, 0),
      por_tipo: ['A', 'B', 'C'].map(t => {
        const l = emitidos.filter(f => (f.tipo_factura || 'B') === t);
        return { tipo: t, cantidad: l.length, total: l.reduce((s, f) => s + parseFloat(f.facturado ?? f.total ?? 0), 0) };
      }).filter(x => x.cantidad > 0),
    };
    if (estado === 'emitidos') filas = emitidos;
    else if (estado === 'pendientes') filas = filas.filter(f => f.pendiente && !f.anulada);
    else if (estado === 'anulados') filas = filas.filter(f => f.anulada);
    res.json({ comprobantes: filas, resumen, todas_las_fechas: todasLasFechas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener comprobantes: ' + error.message });
  }
});

module.exports = router;
