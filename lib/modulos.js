const pool = require('../config/database');
const { porNegocio } = require('./contexto');

// Actividad del negocio y modulos opcionales que tiene activados (por negocio, en su cajon).
// La actividad se elige en la bienvenida (o la cambia el administrador de la plataforma) y
// prende los modulos que corresponden; despues cada modulo se puede prender o apagar aparte.
//   gastronomia: Mesas y Cocina en el menu (ver routes/gastro.js)

const ACTIVIDADES = {
  comercio: { nombre: 'Comercio / tienda', modulos: { gastronomia: false } },
  gastronomia: { nombre: 'Bar, café o restaurante', modulos: { gastronomia: true } },
  servicios: { nombre: 'Servicios (estética, peluquería, talleres…)', modulos: { gastronomia: false } },
  otro: { nombre: 'Otro', modulos: {} },
};
const MODULOS = ['gastronomia'];

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS modulos_negocio (
    id INT PRIMARY KEY DEFAULT 1,
    actividad TEXT,
    gastronomia BOOLEAN NOT NULL DEFAULT FALSE,
    imprimir_comanda BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query('INSERT INTO modulos_negocio (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  listo.set(true);
}

async function leer() {
  await asegurar();
  const r = (await pool.query('SELECT * FROM modulos_negocio WHERE id = 1')).rows[0] || {};
  return { actividad: r.actividad || null, gastronomia: !!r.gastronomia, imprimir_comanda: !!r.imprimir_comanda };
}

// cambios: { actividad?, gastronomia?, imprimir_comanda? }. Si viene la actividad (y no se dice
// nada de un modulo), el modulo toma el valor que corresponde a esa actividad.
async function guardar(cambios = {}) {
  await asegurar();
  const act = cambios.actividad !== undefined && ACTIVIDADES[cambios.actividad] ? cambios.actividad : undefined;
  const val = { ...(act ? ACTIVIDADES[act].modulos : {}) };
  MODULOS.concat(['imprimir_comanda']).forEach(m => { if (cambios[m] !== undefined) val[m] = !!cambios[m]; });
  const sets = [];
  const params = [];
  if (act) { params.push(act); sets.push('actividad = $' + params.length); }
  Object.keys(val).forEach(k => { params.push(val[k]); sets.push(k + ' = $' + params.length); });
  if (sets.length) await pool.query('UPDATE modulos_negocio SET ' + sets.join(', ') + ', actualizado_en = NOW() WHERE id = 1', params);
  return leer();
}

module.exports = { ACTIVIDADES, MODULOS, leer, guardar };
