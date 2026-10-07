// Cuenta corriente (fiado): cada cliente tiene una lista de movimientos. Una venta pagada con el
// medio "Cuenta corriente" suma deuda (cargo); un cobro la baja (pago); un ajuste sirve para cargar
// una deuda anterior o corregir. Saldo = cargos + ajustes - pagos. La venta en si se registra
// igual que cualquier otra (stock, puntos, factura); lo unico distinto es que no entra plata a la caja.
const pool = require('../config/database');
const { porNegocio } = require('./contexto');

const TIPO_MEDIO = 'cuenta_corriente';

const tablaLista = porNegocio(false);
async function asegurar(db = pool) {
  if (tablaLista.get()) return;
  await db.query(`CREATE TABLE IF NOT EXISTS cc_movimientos (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL,
    tipo TEXT NOT NULL,
    importe NUMERIC(14,2) NOT NULL,
    venta_id INT,
    numero_factura TEXT,
    medio_pago TEXT,
    nota TEXT,
    local_id INT,
    usuario_id INT,
    usuario_nombre TEXT,
    anulado BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_cc_movimientos_cliente ON cc_movimientos(cliente_id)');
  await db.query('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cc_limite NUMERIC(14,2)');
  tablaLista.set(true);
}

// Suma con signo: lo que aumenta la deuda es positivo, lo que la baja negativo
const SALDO_SQL = `COALESCE(SUM(CASE WHEN tipo = 'pago' THEN -importe ELSE importe END) FILTER (WHERE NOT anulado), 0)`;

async function saldoDe(db, clienteId) {
  await asegurar(db);
  const r = await db.query(`SELECT ${SALDO_SQL} AS saldo FROM cc_movimientos WHERE cliente_id = $1`, [clienteId]);
  return parseFloat(r.rows[0].saldo) || 0;
}

// Cuanto de una venta se paga con cuenta corriente (puede ser parte de un pago mixto)
async function montoEnCuentaCorriente(db, { pagos, medio_pago_id, total, monto_gift_card }) {
  const tramos = (Array.isArray(pagos) && pagos.length > 0)
    ? pagos.map(p => ({ id: p.medio_pago_id, importe: parseFloat(p.importe) || 0 }))
    : [{ id: medio_pago_id, importe: (parseFloat(total) || 0) - (parseFloat(monto_gift_card) || 0) }];
  const ids = [...new Set(tramos.map(t => parseInt(t.id)).filter(Boolean))];
  if (!ids.length) return 0;
  const r = await db.query('SELECT id FROM medios_pago WHERE id = ANY($1) AND tipo = $2', [ids, TIPO_MEDIO]);
  const deCC = new Set(r.rows.map(x => x.id));
  return Math.round(tramos.filter(t => deCC.has(parseInt(t.id))).reduce((a, t) => a + Math.max(0, t.importe), 0) * 100) / 100;
}

// Desde cuando debe: se van cancelando las deudas mas viejas con los pagos (la primera que no
// llega a cubrirse es la fecha desde la que debe)
function deudaDesde(movs) {
  const cargos = movs.filter(m => !m.anulado && m.tipo !== 'pago' && parseFloat(m.importe) > 0)
    .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
  let credito = movs.filter(m => !m.anulado && (m.tipo === 'pago' || parseFloat(m.importe) < 0))
    .reduce((a, m) => a + Math.abs(parseFloat(m.importe) || 0), 0);
  for (const c of cargos) {
    const imp = parseFloat(c.importe) || 0;
    if (credito >= imp - 0.005) { credito -= imp; continue; }
    return c.creado_en;
  }
  return null;
}

module.exports = { TIPO_MEDIO, asegurar, saldoDe, montoEnCuentaCorriente, deudaDesde, SALDO_SQL };
