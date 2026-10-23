// Preventas: se facturan en ARCA cuando se entregan (desde el 22/10/2026). ventas.entregado_en guarda cuando se
// entrego, para que la factura figure ese dia en Comprobantes y el cobro sume en el cierre de ese dia.
// Las entregadas desde el 22/10 sin factura quedan "pendientes de facturar" (para emitirlas desde Comprobantes
// o el aviso del Punto de Venta); las de antes no se tocan (no se factura de golpe lo viejo). Una vez por negocio.
const pool = require('../config/database');
const { porNegocio } = require('./contexto');

const DESDE = '2026-10-22';
const listo = porNegocio(false);
const DIA_AR = (col) => `((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
// Movimiento de caja del saldo al entregar (el concepto lleva el numero de la venta)
const MOV_ENTREGA = `m.concepto IN ('Saldo entrega preventa ' || v.numero_factura, 'Entrega preventa ' || v.numero_factura)`;

async function asegurar() {
  if (listo.get()) return;
  try {
    await require('./giftCardFactura').asegurar();
    await pool.query('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS entregado_en TIMESTAMP');
    await pool.query(`UPDATE ventas v SET entregado_en = (SELECT MIN(m.creado_en) FROM movimientos_caja m WHERE ${MOV_ENTREGA})
      WHERE v.es_preventa = TRUE AND v.estado_pago = 'confirmada' AND v.entregado_en IS NULL
        AND EXISTS (SELECT 1 FROM movimientos_caja m WHERE ${MOV_ENTREGA} AND ${DIA_AR('m.creado_en')} >= DATE '${DESDE}')`);
    await pool.query(`UPDATE ventas v SET estado_facturacion = 'pendiente'
      WHERE v.es_preventa = TRUE AND v.estado_pago = 'confirmada' AND COALESCE(v.cae, '') = '' AND v.estado_facturacion = 'no_aplica'
        AND COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.monto_gift_card, 0) < v.total
        AND v.entregado_en IS NOT NULL AND ${DIA_AR('v.entregado_en')} >= DATE '${DESDE}'`);
    listo.set(true);
  } catch (e) { console.error('[preventas] facturar al entregar:', e.message); }
}

module.exports = { asegurar, DESDE };
