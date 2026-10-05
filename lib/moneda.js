// Moneda del negocio para los textos que arma el servidor (por ej. las respuestas de "Tu gerente").
// Es la misma lista que usa la pantalla (Configuracion -> Moneda).
const pool = require('../config/database');
const { porNegocio } = require('./contexto');
const MONEDAS = {
  ARS: ['$', 2, 'es-AR'], UYU: ['$U', 2, 'es-UY'], CLP: ['$', 0, 'es-CL'], PYG: ['₲', 0, 'es-PY'], BOB: ['Bs', 2, 'es-BO'],
  PEN: ['S/', 2, 'es-PE'], COP: ['$', 0, 'es-CO'], VES: ['Bs.', 2, 'es-VE'], BRL: ['R$', 2, 'pt-BR'], MXN: ['$', 2, 'es-MX'],
  GTQ: ['Q', 2, 'es-GT'], HNL: ['L', 2, 'es-HN'], NIO: ['C$', 2, 'es-NI'], CRC: ['₡', 0, 'es-CR'], PAB: ['B/.', 2, 'es-PA'],
  DOP: ['RD$', 2, 'es-DO'], CUP: ['$', 2, 'es-CU'], USD: ['US$', 2, 'es-US'], EUR: ['€', 2, 'es-ES'],
};
const actual = porNegocio({ simbolo: '$', locale: 'es-AR' }); // la moneda de cada negocio
// Lee la moneda configurada (barato: una consulta) y la deja lista para formatear
async function cargarMoneda() {
  try {
    const r = await pool.query('SELECT moneda FROM configuracion_negocio WHERE id = 1');
    const c = r.rows[0] && r.rows[0].moneda && MONEDAS[r.rows[0].moneda.codigo] ? MONEDAS[r.rows[0].moneda.codigo] : MONEDAS.ARS;
    actual.set({ simbolo: c[0], locale: c[2] });
  } catch (e) { /* sin columna todavia: peso argentino */ }
  return actual.get();
}
// Montos redondeados (sin centavos), como en los textos de recomendaciones
const plata = (v) => { const m = actual.get(); return m.simbolo + ' ' + Math.round(parseFloat(v) || 0).toLocaleString(m.locale); };
module.exports = { cargarMoneda, plata };
