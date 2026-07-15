// Ejecuta un archivo .sql contra la base de Railway, usando la misma conexion
// que ya usa el backend (config/database.js / variable DATABASE_URL del .env).
// Uso: node run-migration.js nombre_del_archivo.sql
const fs = require('fs');
const path = require('path');
const pool = require('./config/database');

const archivo = process.argv[2];
if (!archivo) {
  console.error('Falta el nombre del archivo. Uso: node run-migration.js nombre.sql');
  process.exit(1);
}

const ruta = path.resolve(__dirname, archivo);
if (!fs.existsSync(ruta)) {
  console.error('No encontre el archivo: ' + ruta);
  process.exit(1);
}

const sql = fs.readFileSync(ruta, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('Migracion aplicada correctamente: ' + archivo);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error al aplicar la migracion:', err.message);
    process.exit(1);
  });
