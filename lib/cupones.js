// Cupones personales y "uno por clienta".
// - Personal: el cupon que gana una clienta (premio de puntos, ruleta de la tienda) es solo de ella.
//   Queda atado a su ficha (cliente_id) y, por si no hay ficha, a su DNI y a su WhatsApp.
// - Uno por clienta: un codigo general (ej: GIFT5) que cada clienta puede usar una sola vez.
//   Cada uso queda anotado en cupon_usos con la ficha, el DNI y el WhatsApp de quien lo uso.
// Una venta anulada o un pedido web cancelado devuelven el uso.
const pool = require('../config/database');
const { porNegocio } = require('./contexto');

const listo = porNegocio(false);
const soloNumeros = (x) => String(x || '').replace(/\D/g, '');
const dniDe = (x) => { const d = soloNumeros(x); return d.length >= 7 && d.length <= 11 ? d : null; };
const telDe = (x) => { const d = soloNumeros(x); return d.length >= 8 ? d.slice(-8) : null; };

// Nunca corta lo que se esta haciendo: si algo falla, los cupones siguen andando como antes
async function asegurar() {
  if (listo.get()) return true;
  try { await prepararTablas(); listo.set(true); return true; }
  catch (e) { console.error('[cupones] preparar:', e.message); return false; }
}
async function prepararTablas() {
  // Solo se agrega lo que falta (ALTER TABLE traba la tabla aunque la columna ya exista). Hay que llamarlo
  // antes de abrir una transaccion que use cupones.
  const hay = new Set((await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'cupones'`)).rows.map(r => r.column_name));
  // solo_contado: vale pagando con transferencia, efectivo, débito o crédito en 1 cuota (no en cuotas ni GoCuotas)
  // valido_desde: desde que dia vale (ej. el codigo del dia 12 del Calendario de Adviento no vale antes)
  for (const [col, tipo] of [['cliente_id', 'INT'], ['dueno_dni', 'TEXT'], ['dueno_tel', 'TEXT'], ['uno_por_clienta', 'BOOLEAN NOT NULL DEFAULT FALSE'], ['valido_desde', 'DATE'], ['solo_contado', 'BOOLEAN NOT NULL DEFAULT FALSE']]) {
    if (!hay.has(col)) await pool.query(`ALTER TABLE cupones ADD COLUMN IF NOT EXISTS ${col} ${tipo}`);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS cupon_usos (id SERIAL PRIMARY KEY, cupon_id INT NOT NULL, cliente_id INT, dni TEXT, tel TEXT,
    venta_id INT, pedido_id INT, anulado BOOLEAN NOT NULL DEFAULT FALSE, creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cupon_usos_cupon ON cupon_usos(cupon_id)`);
  // Los cupones ganados antes de este cambio: se atan a su clienta (premios canjeados y ruleta)
  const existe = async (t) => !!(await pool.query(`SELECT to_regclass($1) AS t`, [t])).rows[0].t;
  if (await existe('canjes_premios')) {
    await pool.query(`UPDATE cupones cu SET cliente_id = cj.cliente_id FROM canjes_premios cj
      WHERE cu.cliente_id IS NULL AND cu.canal = 'Premio de puntos' AND cj.codigo = cu.codigo`).catch(() => {});
  }
  if (await existe('tienda_ruleta')) {
    await pool.query(`UPDATE cupones cu SET cliente_id = tp.cliente_id, dueno_tel = COALESCE(cu.dueno_tel, RIGHT(REGEXP_REPLACE(COALESCE(tp.telefono, ''), '[^0-9]', '', 'g'), 8))
      FROM tienda_ruleta tr JOIN tienda_pedidos tp ON tp.id = tr.pedido_id
      WHERE cu.cliente_id IS NULL AND cu.dueno_tel IS NULL AND cu.canal = 'Ruleta tienda' AND tr.cupon = cu.codigo`).catch(() => {});
  }
}

// Datos de una ficha de clienta para comparar (DNI y WhatsApp)
async function fichaDe(db, clienteId) {
  if (!clienteId) return null;
  const c = (await db.query('SELECT id, nombre, cuit_dni, telefono FROM clientes WHERE id = $1', [clienteId])).rows[0];
  return c ? { id: c.id, nombre: c.nombre, dni: dniDe(c.cuit_dni), tel: telDe(c.telefono) } : null;
}

// Quien esta usando el cupon: { cliente_id, dni, telefono } -> se completa con su ficha
async function quienEs(db, q) {
  const f = await fichaDe(db, q && q.cliente_id);
  return { cliente_id: f ? f.id : null, dni: (f && f.dni) || dniDe(q && q.dni), tel: telDe(q && q.telefono) || (f && f.tel) };
}

// Datos para atar un cupon nuevo a su duena
async function duenoPara(db, { cliente_id, dni, telefono }) {
  const f = await fichaDe(db, cliente_id);
  return { cliente_id: f ? f.id : null, dueno_dni: (f && f.dni) || dniDe(dni), dueno_tel: telDe(telefono) || (f && f.tel) };
}

const esPersonal = (c) => !!(c && (c.cliente_id || c.dueno_dni || c.dueno_tel));

// Revisa si esta persona puede usar el cupon. Devuelve null si puede, o el mensaje de por que no.
// donde: 'tienda' o 'caja' (cambia como se explica que falta identificarse)
// Fechas de un cupon con el dia de Argentina (no el del servidor): vence al terminar su ultimo dia y no vale antes de valido_desde.
// Devuelve el error para mostrar o null
const diaAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const fechaTxt = (x) => { if (!x) return null; if (x instanceof Date) return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return String(x).slice(0, 10); };
function fechasCupon(c, hoy = diaAR()) {
  const vence = fechaTxt(c && c.fecha_vencimiento), desde = fechaTxt(c && c.valido_desde);
  if (vence && vence < hoy) return 'Ese código está vencido';
  if (desde && desde > hoy) return 'Ese código vale desde el ' + desde.slice(8, 10) + '/' + desde.slice(5, 7);
  return null;
}
async function revisarClienta(db, c, q, donde) {
  if (!c || (!esPersonal(c) && !c.uno_por_clienta)) return null;
  const yo = await quienEs(db, q);
  const sinDatos = !yo.cliente_id && !yo.dni && !yo.tel;
  if (esPersonal(c)) {
    if (sinDatos) return donde === 'caja' ? 'Este cupón es personal: elegí a la clienta (por DNI) para usarlo' : 'Este cupón es personal: ingresá con tu cuenta para usarlo';
    const duena = await fichaDe(db, c.cliente_id);
    const dDni = c.dueno_dni || (duena && duena.dni), dTel = c.dueno_tel || (duena && duena.tel);
    const coincide = (c.cliente_id && yo.cliente_id === c.cliente_id) || (dDni && yo.dni === dDni) || (dTel && yo.tel === dTel);
    // En la caja se dice de quien es (ayuda a la vendedora); online no se muestra el nombre de nadie
    if (!coincide) return 'Este cupón es personal y es de otra clienta' + (donde === 'caja' && duena && duena.nombre ? ' (' + String(duena.nombre).trim().split(/\s+/)[0] + ')' : '');
  }
  if (c.uno_por_clienta) {
    if (sinDatos) return donde === 'caja' ? 'Este código es uno por clienta: elegí a la clienta (por DNI) para usarlo' : 'Este código es uno por clienta: ingresá con tu cuenta para usarlo';
    const conds = [], params = [c.id];
    if (yo.cliente_id) { params.push(yo.cliente_id); conds.push('u.cliente_id = $' + params.length); }
    if (yo.dni) { params.push(yo.dni); conds.push('u.dni = $' + params.length); }
    if (yo.tel) { params.push(yo.tel); conds.push('u.tel = $' + params.length); }
    const ya = (await db.query(`SELECT 1 FROM cupon_usos u LEFT JOIN ventas v ON v.id = u.venta_id
      WHERE u.cupon_id = $1 AND NOT u.anulado AND NOT COALESCE(v.anulada, FALSE) AND (${conds.join(' OR ')}) LIMIT 1`, params)).rows.length;
    if (ya) return 'Ya usaste este código (es uno por clienta)';
  }
  return null;
}

// Anota el uso (solo para los cupones "uno por clienta" o personales)
async function registrarUso(db, c, q, { venta_id, pedido_id } = {}) {
  if (!c || (!esPersonal(c) && !c.uno_por_clienta) || !listo.get()) return;
  const yo = await quienEs(db, q);
  await db.query('INSERT INTO cupon_usos (cupon_id, cliente_id, dni, tel, venta_id, pedido_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [c.id, yo.cliente_id, yo.dni, yo.tel, venta_id || null, pedido_id || null]);
}

// Pedido web cancelado: el uso se devuelve
async function liberarPedido(db, pedidoId) {
  if (!listo.get()) return;
  await db.query('UPDATE cupon_usos SET anulado = TRUE WHERE pedido_id = $1', [pedidoId]);
}

module.exports = { fechasCupon, asegurar, revisarClienta, registrarUso, liberarPedido, duenoPara, esPersonal };
