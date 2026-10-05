const express = require('express');
const zlib = require('zlib');
const router = express.Router();
const pool = require('../config/database');

// Copia de seguridad: el dueño baja a su compu un archivo con TODOS los datos del negocio
// (cada tabla completa). Va comprimido (.json.gz) y se arma de a tandas para no cargar
// todo en memoria. Solo el jefe puede pedirla.
const TANDA = 2000;

function soloJefe(req, res, next) {
  if (!req.usuario || req.usuario.rol !== 'jefe') return res.status(403).json({ error: 'Solo el dueño puede descargar la copia de seguridad' });
  next();
}

// Los datos binarios (ej: la imagen de fondo del portal) van como texto base64
function aTexto(fila) {
  return JSON.stringify(fila, (k, v) => (v && v.type === 'Buffer' && Array.isArray(v.data) ? { __binario: Buffer.from(v.data).toString('base64') } : v));
}

async function listarTablas() {
  const r = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  return r.rows.map(x => x.table_name);
}

// Cuanto pesa, para avisar antes de bajar
router.get('/info', soloJefe, async (req, res) => {
  try {
    const tablas = await listarTablas();
    const r = await pool.query(
      "SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))), 0)::bigint AS bytes FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    );
    res.json({ tablas: tablas.length, bytes: Number(r.rows[0].bytes) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo calcular el tamaño de la copia' });
  }
});

router.get('/descargar', soloJefe, async (req, res) => {
  let tablas;
  try { tablas = await listarTablas(); }
  catch (e) { return res.status(500).json({ error: 'No se pudo armar la copia de seguridad' }); }

  const fecha = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', 'attachment; filename="lumiere-copia-' + fecha + '.json.gz"');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  const gz = zlib.createGzip();
  gz.pipe(res);
  const escribir = (txt) => new Promise((ok) => { if (gz.write(txt)) ok(); else gz.once('drain', ok); });

  // Una sola "foto" de la base: aunque se siga vendiendo mientras baja, la copia queda coherente
  let cli = null;
  try {
    cli = await pool.connect();
    await cli.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await escribir('{"lumiere_copia":1,"generado":' + JSON.stringify(new Date().toISOString()) + ',"tablas":{');
    for (let t = 0; t < tablas.length; t++) {
      const nombre = tablas[t];
      const id = '"' + nombre.replace(/"/g, '""') + '"';
      await escribir((t ? ',' : '') + JSON.stringify(nombre) + ':[');
      let desde = 0, primera = true;
      // ctid da un orden estable sin depender de que la tabla tenga columna id
      for (;;) {
        const r = await cli.query('SELECT * FROM ' + id + ' ORDER BY ctid LIMIT ' + TANDA + ' OFFSET ' + desde);
        if (r.rows.length) {
          await escribir((primera ? '' : ',') + r.rows.map(aTexto).join(','));
          primera = false;
        }
        if (r.rows.length < TANDA) break;
        desde += TANDA;
      }
      await escribir(']');
    }
    await escribir('},"completa":true}');
    gz.end();
  } catch (e) {
    console.error('Copia de seguridad:', e.message);
    // El archivo ya empezo a bajar: se corta sin la marca "completa" para que se note que quedo incompleto
    gz.end();
  } finally {
    if (cli) { try { await cli.query('ROLLBACK'); } catch (e) {} cli.release(); }
  }
});

module.exports = router;
module.exports.aTexto = aTexto;
