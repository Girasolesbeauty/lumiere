const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool(
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

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL - Lumiere DB');
});

pool.on('error', (err) => {
  console.error('Error en la conexión a PostgreSQL:', err);
});

module.exports = pool;