// "De que negocio es este pedido": cada pedido al servidor corre dentro del contexto de un
// negocio, y la base de datos (config/database.js) usa ese dato para abrir solo su "cajon"
// (schema de Postgres). Fuera de un pedido (tareas programadas, arranque) se usa el cajon
// base, `public`, que es el del negocio original.
const { AsyncLocalStorage } = require('async_hooks');

const SCHEMA_BASE = 'public';
const als = new AsyncLocalStorage();

// Datos del negocio del pedido actual ({ id, schema, ... }) o null
const negocioActual = () => als.getStore() || null;
const schemaActual = () => { const s = als.getStore(); return (s && s.schema) || SCHEMA_BASE; };

// Corre fn dentro del contexto de un negocio. datos: { id, schema, ... }
const enNegocio = (datos, fn) => als.run({ ...datos }, fn);

// Para lo que antes era una variable del modulo (ej: "ya cree esta tabla"): un valor por
// negocio, asi lo que se hizo en el cajon de uno no se da por hecho en el de otro.
function porNegocio(inicial) {
  const valores = new Map();
  return {
    get: () => { const k = schemaActual(); return valores.has(k) ? valores.get(k) : inicial; },
    set: (v) => { valores.set(schemaActual(), v); },
  };
}

module.exports = { SCHEMA_BASE, negocioActual, schemaActual, enNegocio, porNegocio };
