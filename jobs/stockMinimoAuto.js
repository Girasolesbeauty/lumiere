// Recalculo automatico del stock minimo: una vez por dia, desde las 3 de la mañana (hora
// argentina), si el negocio lo tiene activado en Configuracion. Revisa cada hora, asi si el
// servidor se reinicia no se pierde el recalculo del dia; la fecha del ultimo recalculo queda
// guardada para no repetirlo.
const pool = require('../config/database');
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');
const { recalcularMinimos } = require('../controllers/productosController');

const HORA_DESDE = 3;
const CADA_MS = 60 * 60 * 1000;

// Revisa un negocio (corre dentro de su cajon)
async function revisarNegocio() {
  try {
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    if (ahoraAR.getHours() < HORA_DESDE) return;
    const hoy = ahoraAR.toLocaleDateString('en-CA');

    await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS stock_minimo_auto BOOLEAN DEFAULT TRUE');
    await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS stock_minimo_auto_ultimo DATE');
    // Marca el dia antes de recalcular: si hubiera dos servidores, solo uno lo hace
    const marca = await pool.query(`
      UPDATE configuracion_negocio SET stock_minimo_auto_ultimo = $1::date
      WHERE id = 1 AND COALESCE(stock_minimo_auto, TRUE) = TRUE
        AND (stock_minimo_auto_ultimo IS NULL OR stock_minimo_auto_ultimo < $1::date)
      RETURNING id`, [hoy]);
    if (!marca.rows.length) return;

    const r = await recalcularMinimos(7);
    console.log(`[stock minimo automatico] ${hoy}: ${r.productos_actualizados} productos actualizados, ${r.omitidos_por_poca_historia} con poca historia`);
  } catch (e) {
    console.error('[stock minimo automatico] no se pudo recalcular:', e.message);
  }
}

// Una vuelta por cada negocio
async function revisar() {
  let lista = [];
  try { lista = await negocios.listarNegocios(); }
  catch (e) { console.error('[stock minimo automatico] no se pudo leer la lista de negocios, se revisa solo el original:', e.message); lista = [negocios.ORIGINAL]; }
  for (const n of lista) {
    if (n.estado === 'suspendido') continue;
    await enNegocio({ id: n.id, schema: n.schema }, revisarNegocio);
  }
}

function iniciar() {
  setTimeout(revisar, 60 * 1000); // un minuto despues de arrancar
  setInterval(revisar, CADA_MS);
}

module.exports = { iniciar, revisar };
