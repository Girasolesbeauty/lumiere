// Gift cards: desde el cambio de modalidad se facturan en ARCA cuando se VENDEN (gift_cards.factura_al_emitir) y el
// canje es solo la salida de los productos (no se factura ni suma plata). Las que ya existian antes del cambio siguen
// como antes: se facturan al canjearlas. Las de migracion (ya facturadas en el sistema viejo) y los creditos por
// devolucion no se facturan nunca.
// ventas.gc_facturada: cuanto de lo pagado con gift card YA estaba facturado (no se vuelve a facturar). En las ventas
// de antes queda NULL y se usa monto_gift_card (lo de siempre). La factura de la venta es total - gc_facturada.
const pool = require('../config/database');
const { porNegocio } = require('./contexto');

const listo = porNegocio(false);
// Lo que ya esta facturado de lo pagado con gift card (para no facturarlo de nuevo)
const GC_FACTURADA = (v = 'v') => `COALESCE(${v}.gc_facturada, ${v}.monto_gift_card, 0)`;

async function asegurar() {
  if (listo.get()) return;
  await pool.query('ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS factura_al_emitir BOOLEAN NOT NULL DEFAULT FALSE');
  for (const c of ['cae TEXT', 'cae_vto TEXT', 'nro_comprobante INT', 'punto_venta INT', 'tipo_factura TEXT', 'error_facturacion TEXT',
    'intentos_facturacion INT NOT NULL DEFAULT 0', 'facturada_en TIMESTAMP', 'forma_pago TEXT']) {
    await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS ${c}`);
  }
  await pool.query('ALTER TABLE ventas ADD COLUMN IF NOT EXISTS gc_facturada NUMERIC(14,2)');
  listo.set(true);
}

// Si se paga con gift card: cuanto de ese pago ya estaba facturado
const yaFacturada = (gc) => !!gc && (gc.es_migracion === true || gc.factura_al_emitir === true);

// Factura en ARCA la venta de una gift card (Factura B, consumidor final). No toca la caja: la plata ya entro al emitirla.
async function facturar(gcId) {
  await asegurar();
  const gc = (await pool.query('SELECT * FROM gift_cards WHERE id = $1', [gcId])).rows[0];
  if (!gc || !gc.factura_al_emitir || gc.es_migracion || gc.cae) return gc || null;
  try {
    const { intentarEmitirCAE } = require('../routes/arca');
    const r = await intentarEmitirCAE({ tipo: 'B', items: [], total: Math.round(parseFloat(gc.monto_inicial) * 100) / 100, cliente_cuit: null, venta_id: null });
    return (await pool.query(`UPDATE gift_cards SET cae = $1, cae_vto = $2, nro_comprobante = $3, punto_venta = $4, tipo_factura = 'B', facturada_en = NOW(),
      error_facturacion = NULL, intentos_facturacion = intentos_facturacion + 1 WHERE id = $5 RETURNING *`, [r.cae, r.caeFch, r.nroComprobante, r.puntoVenta, gc.id])).rows[0];
  } catch (e) {
    console.error('[gift card] factura ' + gc.codigo + ':', e.message);
    return (await pool.query(`UPDATE gift_cards SET error_facturacion = $1, intentos_facturacion = intentos_facturacion + 1 WHERE id = $2 RETURNING *`,
      [String(e.message || 'Error').slice(0, 300), gc.id])).rows[0];
  }
}

// Las que se vendieron con la modalidad nueva y todavia no tienen factura (ARCA dio error): se reintentan
async function pendientes() {
  await asegurar();
  return (await pool.query(`SELECT * FROM gift_cards WHERE factura_al_emitir AND COALESCE(cae, '') = '' AND NOT COALESCE(es_migracion, FALSE) ORDER BY id`)).rows;
}

module.exports = { asegurar, facturar, pendientes, yaFacturada, GC_FACTURADA };
