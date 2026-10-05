const { Pool } = require('pg');
const dotenv = require('dotenv');
const { schemaActual } = require('../lib/contexto');

dotenv.config();

const base = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

base.on('connect', () => {
  console.log('Conectado a PostgreSQL - Lumiere DB');
});

base.on('error', (err) => {
  console.error('Error en la conexión a PostgreSQL:', err);
});

// Cada negocio tiene su "cajon" (schema). Antes de usar una conexion se la apunta al cajon
// del negocio del pedido actual, asi todas las consultas del sistema ("SELECT * FROM ventas")
// leen y escriben solo ahi sin tener que cambiarlas. Cada conexion recuerda a que cajon
// apunta para no repetir el cambio cuando ya esta bien.
async function apuntar(client) {
  const schema = schemaActual();
  if (client.__schema !== schema) {
    // El nombre del schema lo arma el servidor (nunca viene del usuario) y se valida al crearlo
    await client.query('SET search_path TO "' + schema.replace(/"/g, '""') + '"');
    client.__schema = schema;
  }
  return client;
}

async function connect() {
  const client = await base.connect();
  try {
    await apuntar(client);
  } catch (e) {
    client.__schema = null;
    client.release(e);
    throw e;
  }
  return client;
}

async function query(...args) {
  const client = await connect();
  try {
    return await client.query(...args);
  } finally {
    client.release();
  }
}

// Se usa igual que antes: pool.query(...) y pool.connect().
// `base` es el pool sin apuntar a ningun cajon: solo para el registro central de negocios
// (que usa nombres completos, con el schema adelante) y para crear cajones.
module.exports = {
  query,
  connect,
  base,
  on: (...a) => base.on(...a),
  end: () => base.end(),
};
