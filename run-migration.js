// Ejecuta un archivo .sql contra una base de PostgreSQL.
// Uso: node run-migration.js nombre_del_archivo.sql
//   -> usa la conexion del .env local (config/database.js)
// Uso con conexion especifica (ej: produccion en Railway):
//   node run-migration.js nombre_del_archivo.sql 'postgresql://usuario:password@host:puerto/basededatos'
//   (usar comillas SIMPLES en PowerShell para que no rompa passwords con simbolos como $)
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const archivo = process.argv[2];
const conexionManual = process.argv[3];

if (!archivo) {
  console.error('Falta el nombre del archivo. Uso: node run-migration.js nombre.sql ["connection string" opcional]');
  process.exit(1);
}

const ruta = path.resolve(__dirname, archivo);
if (!fs.existsSync(ruta)) {
  console.error('No encontre el archivo: ' + ruta);
  process.exit(1);
}

const sql = fs.readFileSync(ruta, 'utf8');

const pool = conexionManual
  ? new Pool({ connectionString: conexionManual, ssl: { rejectUnauthorized: false } })
  : require('./config/database');

if (conexionManual) {
  console.log('Usando la conexion pasada por parametro (no el .env local)');
}

pool.query(sql)
  .then(() => {
    console.log('Migracion aplicada correctamente: ' + archivo);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error al aplicar la migracion:', err.message);
    process.exit(1);
  });
