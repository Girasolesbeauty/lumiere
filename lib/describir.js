// Propuesta de descripcion y segmentos (tipo, piel, necesidad, ingrediente) de un producto de la tienda online.
// Usa Claude si el servidor tiene ANTHROPIC_API_KEY; si no, arma una descripcion simple con los datos del producto.
// Siempre es una PROPUESTA: la tienda la revisa y la guarda desde Lumiere.
const Anthropic = require('@anthropic-ai/sdk').default;

const OPCIONES = {
  tipo: ['limpiador', 'desmaquillante', 'tonico', 'serum', 'hidratante', 'solar', 'ojos', 'exfoliante', 'mascarilla', 'labios', 'corporal'],
  piel: ['grasa', 'seca', 'mixta', 'sensible', 'normal', 'todo'],
  necesidad: ['acne', 'manchas', 'antiedad', 'rojeces', 'hidratacion', 'poros', 'ojeras'],
  ingrediente: ['hialuronico', 'niacinamida', 'vitaminac', 'retinol', 'salicilico', 'aha', 'centella', 'ceramidas', 'peptidos', 'colageno', 'caracol', 'azelaico', 'teatree', 'aloe'],
};

const INSTRUCCIONES = `Escribís las descripciones de los productos de una tienda online de belleza y skincare de Argentina.

Para cada producto devolvés:
- "descripcion": 2 a 4 oraciones en español rioplatense (vos), cálidas y claras, para la ficha del producto. Contá para qué sirve, para quién es ideal y cómo se usa. Sin emojis, sin mayúsculas sostenidas, sin precios ni stock, sin promesas médicas ("cura", "elimina para siempre"). Hasta 500 caracteres.
- Los segmentos del producto, eligiendo solo de las opciones permitidas. "piel" = "todo" si sirve para todo tipo de piel. Si un segmento no aplica (por ejemplo, un perfume o un maquillaje no tiene tipo de piel), dejalo vacío.

No inventes datos que no se puedan deducir del nombre, la marca, la categoría o la descripción actual: si no sabés un ingrediente, no lo nombres ni lo marques. Si ya hay una descripción, mejorala manteniendo los datos concretos que tenga (tamaño, modo de uso, ingredientes).`;

const ESQUEMA = {
  type: 'object',
  properties: {
    descripcion: { type: 'string' },
    tipo: { type: 'array', items: { type: 'string', enum: OPCIONES.tipo } },
    piel: { type: 'array', items: { type: 'string', enum: OPCIONES.piel } },
    necesidad: { type: 'array', items: { type: 'string', enum: OPCIONES.necesidad } },
    ingrediente: { type: 'array', items: { type: 'string', enum: OPCIONES.ingrediente } },
  },
  required: ['descripcion', 'tipo', 'piel', 'necesidad', 'ingrediente'],
  additionalProperties: false,
};

let cliente = null;
const obtenerCliente = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cliente) cliente = new Anthropic();
  return cliente;
};

const limpiarLista = (x, k) => [...new Set((Array.isArray(x) ? x : []).filter(v => OPCIONES[k].includes(v)))];

// Sin IA: una descripcion corta y prolija con lo que se sabe del producto
function descripcionSimple(p) {
  const nombre = String(p.nombre || '').trim();
  const marca = String(p.marca || '').trim();
  const cat = String(p.categoria || '').trim().toLowerCase();
  const partes = [nombre + (marca && !nombre.toLowerCase().includes(marca.toLowerCase()) ? ' de ' + marca : '') + '.'];
  if (cat) partes.push('Ideal para sumar a tu rutina de ' + cat + '.');
  partes.push('Si tenés dudas sobre cómo usarlo o si es para vos, escribinos y te asesoramos.');
  return partes.join(' ');
}

async function proponer(p) {
  const client = obtenerCliente();
  if (!client) return { descripcion: descripcionSimple(p), etiquetas: null, ia: false };
  const datos = [
    'Nombre: ' + String(p.nombre || '').slice(0, 200),
    p.marca ? 'Marca: ' + String(p.marca).slice(0, 100) : null,
    p.categoria ? 'Categoría: ' + String(p.categoria).slice(0, 100) : null,
    p.descripcion ? 'Descripción actual: ' + String(p.descripcion).slice(0, 1500) : 'Descripción actual: (no tiene)',
  ].filter(Boolean).join('\n');
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
    system: [{ type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: datos }],
  });
  if (response.stop_reason === 'refusal') return { descripcion: descripcionSimple(p), etiquetas: null, ia: false };
  const texto = response.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  let r;
  try { r = JSON.parse(texto); } catch (e) { return { descripcion: descripcionSimple(p), etiquetas: null, ia: false }; }
  const etiquetas = {};
  Object.keys(OPCIONES).forEach(k => { const l = limpiarLista(r[k], k); if (l.length) etiquetas[k] = l; });
  return { descripcion: String(r.descripcion || '').trim().slice(0, 1500) || descripcionSimple(p), etiquetas: Object.keys(etiquetas).length ? etiquetas : null, ia: true };
}

module.exports = { proponer, descripcionSimple, OPCIONES, hayIA: () => !!process.env.ANTHROPIC_API_KEY };
