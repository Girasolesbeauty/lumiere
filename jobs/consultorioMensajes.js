// Mensajes automaticos del consultorio (recordatorios de turnos y "volver a sacar turno")
// por WhatsApp oficial. Cada 15 minutos revisa los negocios con el modulo Consultorio y el
// envio automatico activado; cada turno recibe un solo recordatorio (queda marcado).
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');
const modulos = require('../lib/modulos');
const { enviarAutomaticos } = require('../routes/consultorio');

const CADA_MS = 15 * 60 * 1000;

async function revisar() {
  let lista = [];
  try { lista = await negocios.listarNegocios(); }
  catch (e) { lista = [negocios.ORIGINAL]; }
  for (const n of lista) {
    if (n.estado === 'suspendido') continue;
    await enNegocio({ id: n.id, schema: n.schema }, async () => {
      try {
        const m = await modulos.leer();
        if (!m.consultorio) return;
        const r = await enviarAutomaticos();
        if (r.enviados || r.fallidos || r.volver) console.log(`[consultorio] ${n.nombre}: ${r.enviados} recordatorios enviados, ${r.fallidos} con error, ${r.volver} "volver a sacar turno"`);
      } catch (e) { console.error('[consultorio] mensajes automaticos:', e.message); }
    });
  }
}

function iniciar() {
  setTimeout(revisar, 90 * 1000);
  setInterval(revisar, CADA_MS);
}

module.exports = { iniciar, revisar };
