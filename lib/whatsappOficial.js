// Envio de mensajes por la API oficial de WhatsApp Business (Cloud API de Meta).
// Cada negocio usa su propia cuenta: token de acceso, ID del numero y plantillas aprobadas
// por Meta. Solo se pueden mandar plantillas (Meta cobra cada mensaje a la cuenta del negocio).
const API_WA = process.env.WA_API_BASE || 'https://graph.facebook.com/v21.0';

// Numero argentino para la API: 549 + codigo de area + numero (sin 0 ni 15)
function numeroWA(tel) {
  let n = String(tel || '').replace(/[^0-9]/g, '');
  if (!n) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (!n.startsWith('54')) n = '549' + n;
  else if (!n.startsWith('549')) n = '549' + n.slice(2);
  // "15" despues del codigo de area (ej: 2964 15 123456): se saca
  n = n.replace(/^549(\d{2,4})15(\d{6,8})$/, '549$1$2');
  return n.length >= 12 && n.length <= 13 ? n : null;
}

// Manda una plantilla con parametros de texto en el cuerpo ({{1}}, {{2}}, ...)
async function enviarPlantilla({ token, phoneId, telefono, plantilla, idioma, parametros }) {
  const para = numeroWA(telefono);
  if (!para) throw new Error('El teléfono no es válido para WhatsApp');
  if (!token || !phoneId || !plantilla) throw new Error('Faltan datos de la cuenta de WhatsApp');
  const r = await fetch(API_WA + '/' + encodeURIComponent(phoneId) + '/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: para, type: 'template',
      template: {
        name: plantilla, language: { code: idioma || 'es_AR' },
        components: [{ type: 'body', parameters: (parametros || []).map(v => ({ type: 'text', text: String(v == null ? '' : v).slice(0, 200) || '-' })) }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const er = data && data.error;
    const msj = er ? (er.error_user_msg || er.message || 'Error de WhatsApp') + (er.code ? ' (código ' + er.code + ')' : '') : 'HTTP ' + r.status;
    throw new Error(msj);
  }
  return { id: data && data.messages && data.messages[0] && data.messages[0].id };
}

module.exports = { enviarPlantilla, numeroWA };
