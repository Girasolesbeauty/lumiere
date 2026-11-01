// Club de WhatsApp: mensajes listos para mandar a los grupos de clientas (novedades, lo más vendido,
// últimas unidades, ofertas, beneficio exclusivo con cupón, tip y encuesta). Los arma con los datos reales
// de la tienda; la dueña los revisa, los copia o los comparte (WhatsApp no deja mandar a grupos desde un sistema).
const express = require('express');
const pool = require('../config/database');
const Anthropic = require('@anthropic-ai/sdk').default;
const { VENTA_VALIDA } = require('../lib/niveles');
const tienda = require('../lib/tienda');

const router = express.Router();
const num = (x) => parseFloat(x) || 0;
const esJefe = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const q = async (sql, params) => { try { return (await pool.query(sql, params)).rows; } catch (e) { console.error('[club]', e.message); return []; } };
const plata = (n) => '$' + Math.round(num(n)).toLocaleString('es-AR');
// Elige una variante distinta con cada "otra versión"
const una = (lista, v) => lista[Math.abs(parseInt(v) || 0) % lista.length];

const TIPS = [
  'El protector solar va *todos los días*, aunque esté nublado o no salgas: la mayoría de las manchas y arrugas vienen del sol de todos los días ☀️',
  'Aplicá los productos del más liviano al más denso: primero tónico y sérum, después crema, y a la mañana siempre terminá con protector 🧴',
  'Limpiá tu cara también a la noche, aunque no te hayas maquillado: sacás el protector, la grasa y la contaminación del día 🌙',
  'El sérum se absorbe mejor con la piel apenas húmeda, justo después del tónico 💧',
  'Exfoliá una o dos veces por semana, no más: exfoliar de más irrita y deja la piel sensible ✨',
  'Cambiá la funda de la almohada una vez por semana: ayuda un montón si tenés granitos 🛏️',
  'Si arrancás con un activo nuevo (retinol, ácidos), empezá dos o tres noches por semana y andá subiendo de a poco 🌱',
  'No te olvides del cuello y las manos: también envejecen y también necesitan crema y protector 🤲',
  'Tomá agua y dormí bien: ninguna crema reemplaza el descanso 😴',
  'Probá los productos nuevos de a uno, así si algo no te cae bien sabés cuál fue 🔎',
];
const ENCUESTAS = [
  ['¿Qué te gustaría que traigamos para el Club?', ['Más skincare coreano', 'Más maquillaje', 'Perfumes y body splash', 'Cuidado del pelo']],
  ['¿Cuál es tu mayor preocupación con la piel?', ['Granitos y poros', 'Manchas', 'Sequedad', 'Líneas de expresión']],
  ['¿Cómo preferís comprar?', ['En el local', 'Por la tienda online', 'Por WhatsApp', 'Me da igual 😅']],
  ['¿Qué te gustaría ver más seguido en este grupo?', ['Ofertas exclusivas', 'Tips de rutina', 'Novedades apenas llegan', 'Sorteos']],
];

// Productos publicados en la tienda (con su link) y los datos para elegir qué mostrar
async function base(req) {
  const c = await tienda.leerConfig();
  const lista = await q(`SELECT p.id, p.nombre, p.marca, p.precio, p.categoria, tp.descripcion,
      GREATEST(COALESCE(p.stock_rg, 0) - COALESCE(p.reservado_rg, 0), 0) + GREATEST(COALESCE(p.stock_ush, 0) - COALESCE(p.reservado_ush, 0), 0) AS stock,
      EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto
    FROM productos p JOIN tienda_productos tp ON tp.producto_id = p.id AND tp.publicado
    WHERE p.activo = TRUE AND COALESCE(p.precio, 0) > 0`);
  const slugs = tienda.slugsProductos(lista);
  const dominio = await tienda.dominioDe(req.negocio ? req.negocio.id : 1).catch(() => null);
  return { c, lista: lista.map(p => ({ ...p, precio: num(p.precio), stock: num(p.stock), slug: slugs.get(p.id) })), dominio };
}
const vendidos = async (dias) => new Map((await q(`SELECT vi.producto_id AS id, SUM(vi.cantidad)::int AS u FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
  WHERE ${VENTA_VALIDA} AND v.creado_en > NOW() - ($1 || ' days')::interval GROUP BY 1`, [String(dias)])).map(r => [r.id, num(r.u)]));

router.get('/contenido', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  try {
    const v = parseInt(req.query.v) || 0;
    const { c, lista, dominio } = await base(req);
    const neg = (await q('SELECT nombre_negocio FROM configuracion_negocio LIMIT 1'))[0] || {};
    const titulo = c.titulo || neg.nombre_negocio || 'la tienda';
    const club = String(req.query.club || '').trim().slice(0, 40) || 'Club ' + titulo;
    const linkTienda = c.slug ? (dominio ? 'https://' + dominio : String(req.query.origen || '').replace(/\/+$/, '') + '/?tienda=' + encodeURIComponent(c.slug)) : '';
    const link = (p) => !c.slug ? '' : dominio ? 'https://' + dominio + '/' + p.slug : linkTienda + '&producto=' + p.slug;
    const [v7, v30, ingresos, promos] = await Promise.all([
      vendidos(7), vendidos(30),
      q(`SELECT oii.producto_id AS id, MAX(oi.creado_en) AS f FROM ordenes_ingreso_items oii JOIN ordenes_ingreso oi ON oi.id = oii.orden_id
         WHERE oi.creado_en > NOW() - INTERVAL '21 days' GROUP BY 1`),
      tienda.promosTienda(pool),
    ]);
    const conStock = lista.filter(p => p.stock > 0);
    const corto = (p) => ({ id: p.id, nombre: p.nombre, marca: p.marca, precio: p.precio, stock: p.stock, foto: !!p.foto, link: link(p) });
    const linea = (p) => '• ' + p.nombre + (p.marca && !p.nombre.toLowerCase().includes(String(p.marca).toLowerCase()) ? ' (' + p.marca + ')' : '') + ' — ' + plata(p.precio);
    const piezas = [];

    // 1) Novedades: lo que entró en las últimas 3 semanas (o lo último que se cargó en la tienda)
    const fIng = new Map(ingresos.map(r => [r.id, new Date(r.f).getTime()]));
    let nov = conStock.filter(p => fIng.has(p.id)).sort((a, b) => fIng.get(b.id) - fIng.get(a.id) || (v30.get(b.id) || 0) - (v30.get(a.id) || 0));
    if (nov.length < 3) nov = [...nov, ...conStock.filter(p => !fIng.has(p.id)).sort((a, b) => b.id - a.id)].slice(0, 6);
    nov = nov.filter(p => p.foto).concat(nov.filter(p => !p.foto)).slice(0, 4);
    if (nov.length) piezas.push({ tipo: 'novedades', dia: 'Lunes', emoji: '✨', titulo: 'Llegó mercadería nueva', productos: nov.map(corto),
      texto: una([
        `🌻 *¡Llegó mercadería nueva!* 🌻\n\nSe lo mostramos primero al ${club}:\n\n${nov.map(linea).join('\n')}\n\nSon pocas unidades de cada uno: si algo te gusta, respondé este mensaje y te lo separamos 💛${linkTienda ? '\n\n🛍️ ' + linkTienda : ''}`,
        `✨ *Novedades de la semana* ✨\n\nRecién llegado, para vos que sos del Club:\n\n${nov.map(linea).join('\n')}\n\n¿Cuál te llevás? Escribinos y te lo guardamos 🙌${linkTienda ? '\n\n🛍️ ' + linkTienda : ''}`,
      ], v) });

    // 2) Lo más vendido de la semana
    const top = conStock.filter(p => (v7.get(p.id) || 0) > 0).sort((a, b) => v7.get(b.id) - v7.get(a.id)).slice(0, 5);
    const topF = top.length >= 3 ? top : conStock.filter(p => (v30.get(p.id) || 0) > 0).sort((a, b) => v30.get(b.id) - v30.get(a.id)).slice(0, 5);
    if (topF.length) piezas.push({ tipo: 'mas_vendidos', dia: 'Miércoles', emoji: '🔥', titulo: 'Los más pedidos', productos: topF.slice(0, 4).map(corto),
      texto: una([
        `🔥 *Los más pedidos ${top.length >= 3 ? 'de la semana' : 'del mes'}* 🔥\n\nEsto es lo que más se llevaron estos días:\n\n${topF.map((p, i) => ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i] + ' ' + linea(p).slice(2)).join('\n')}\n\n¿Ya probaste alguno? Contanos qué te pareció 👇${linkTienda ? '\n\n🛍️ ' + linkTienda : ''}`,
        `🏆 *Top ${topF.length} del ${club}* 🏆\n\nLos favoritos de estos días:\n\n${topF.map((p, i) => (i + 1) + '. ' + linea(p).slice(2)).join('\n')}\n\nSi querés alguno, escribinos y te lo separamos 💛${linkTienda ? '\n\n🛍️ ' + linkTienda : ''}`,
      ], v) });

    // 3) Últimas unidades: se venden bien y quedan pocas
    const ult = conStock.filter(p => p.stock <= 3 && (v30.get(p.id) || 0) >= 2).sort((a, b) => (v30.get(b.id) || 0) - (v30.get(a.id) || 0)).slice(0, 4);
    if (ult.length) piezas.push({ tipo: 'ultimas', dia: 'Viernes', emoji: '⏳', titulo: 'Últimas unidades', productos: ult.map(corto),
      texto: una([
        `⏳ *¡Últimas unidades!* ⏳\n\nSe están terminando y no sabemos cuándo vuelven:\n\n${ult.map(p => linea(p) + ' · ' + (p.stock === 1 ? 'queda 1' : 'quedan ' + p.stock)).join('\n')}\n\nSi lo venías pensando, es ahora 😉 Respondé y te lo guardamos.`,
        `🚨 *Se agotan* 🚨\n\nAvisamos primero al Club:\n\n${ult.map(p => linea(p) + ' · ' + (p.stock === 1 ? 'queda 1' : 'quedan ' + p.stock)).join('\n')}\n\n¿Lo querés? Escribinos 💛`,
      ], v) });

    // 4) Ofertas vigentes (promos de la tienda)
    const conPromo = conStock.map(p => { const pr = tienda.promoDe(promos.filter(x => !x.pago), p, null) || promos.filter(x => tienda.promoDe([x], p, x.pago)).sort((a, b) => b.pct - a.pct)[0]; return pr ? { p, pr } : null; })
      .filter(Boolean).sort((a, b) => b.pr.pct - a.pr.pct || (v30.get(b.p.id) || 0) - (v30.get(a.p.id) || 0)).slice(0, 4);
    const NOMBRE_PAGO = { transferencia: 'con transferencia', retiro: 'en efectivo', mp: 'con Mercado Pago', gocuotas: 'con GoCuotas' };
    if (conPromo.length) piezas.push({ tipo: 'ofertas', dia: 'Viernes', emoji: '🏷️', titulo: 'Ofertas de la semana',
      productos: conPromo.map(({ p, pr }) => ({ ...corto(p), precio_oferta: Math.round(p.precio * (1 - pr.pct / 100)), pct: pr.pct })),
      texto: `🏷️ *Ofertas para aprovechar* 🏷️\n\n${conPromo.map(({ p, pr }) => '• ' + p.nombre + ' — ~' + plata(p.precio) + '~ *' + plata(p.precio * (1 - pr.pct / 100)) + '*' + (pr.pago ? ' ' + (NOMBRE_PAGO[pr.pago] || '') : '') + ' (' + Math.round(pr.pct) + '% OFF)').join('\n')}\n\n¡Hasta agotar stock! 🏃‍♀️${linkTienda ? '\n\n🛍️ ' + linkTienda : ''}` });

    // 5) Beneficio exclusivo del Club (el cupón lo crea la dueña desde la pantalla)
    piezas.push({ tipo: 'beneficio', dia: 'Jueves', emoji: '💛', titulo: 'Beneficio exclusivo del Club', productos: [], texto: '' });

    // 6) Tip con un producto recomendado (de los que se venden, con descripción)
    const tip = una(TIPS, v + new Date().getDate());
    const reco = conStock.filter(p => p.foto && p.descripcion && (v30.get(p.id) || 0) > 0).sort((a, b) => (v30.get(b.id) || 0) - (v30.get(a.id) || 0));
    const r1 = reco.length ? reco[Math.abs(v) % Math.min(reco.length, 5)] : null;
    piezas.push({ tipo: 'tip', dia: 'Martes', emoji: '💡', titulo: 'Tip del Club', tip, productos: r1 ? [corto(r1)] : [],
      texto: `💡 *Tip del ${club}*\n\n${tip}${r1 ? `\n\n🌟 *Nuestra recomendación:* ${r1.nombre}${r1.marca ? ' de ' + r1.marca : ''} — ${plata(r1.precio)}\n${String(r1.descripcion).split(/(?<=\.)\s/)[0]}${link(r1) ? '\n👉 ' + link(r1) : ''}` : ''}\n\n¿Dudas con tu rutina? Preguntanos acá y te asesoramos 🌻` });

    // 7) Encuesta (en WhatsApp también se puede hacer como encuesta del grupo)
    const [preg, ops] = una(ENCUESTAS, v);
    piezas.push({ tipo: 'encuesta', dia: 'Sábado', emoji: '🗳️', titulo: 'Encuesta', pregunta: preg, opciones: ops, productos: [],
      texto: `🗳️ *Queremos saber tu opinión*\n\n${preg}\n\n${ops.map((o, i) => ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i] + ' ' + o).join('\n')}\n\nRespondé con el número 👇 ¡Nos ayuda un montón! 💛` });

    const orden = { Lunes: 1, Martes: 2, 'Miércoles': 3, Jueves: 4, Viernes: 5, 'Sábado': 6 };
    res.json({ club, titulo, color: c.color || '#c9a84c', slug: c.slug, link_tienda: linkTienda, ia: !!process.env.ANTHROPIC_API_KEY,
      piezas: piezas.sort((a, b) => orden[a.dia] - orden[b.dia]) });
  } catch (e) {
    console.error('[club] contenido:', e.message);
    res.status(500).json({ error: 'No se pudo armar el contenido' });
  }
});

// Cupón exclusivo del Club: un código para todo el grupo, con vencimiento
router.post('/cupon', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  try {
    const pct = Math.round(num(req.body.pct));
    if (!(pct >= 1 && pct <= 50)) return res.status(400).json({ error: 'El descuento tiene que ser entre 1% y 50%' });
    const dias = Math.min(30, Math.max(1, parseInt(req.body.dias) || 3));
    const codigo = String(req.body.codigo || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    if (codigo.length < 4) return res.status(400).json({ error: 'El código tiene que tener al menos 4 letras o números' });
    const cuponesLib = require('../lib/cupones');
    await cuponesLib.asegurar();
    const vence = (await pool.query(`SELECT to_char(((NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date + $1::int), 'YYYY-MM-DD') AS f`, [dias])).rows[0].f;
    const r = await pool.query(`INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, uno_por_clienta)
      VALUES ($1, $2, '%', $3, 'Club WhatsApp', $4, $5, TRUE) RETURNING id, codigo, valor, fecha_vencimiento`,
      [codigo, 'Beneficio exclusivo del Club (grupos de WhatsApp)', pct, parseInt(req.body.max_usos) > 0 ? parseInt(req.body.max_usos) : null, vence]);
    res.json({ ...r.rows[0], vence });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ya hay un cupón con ese código. Elegí otro.' });
    console.error('[club] cupon:', e.message);
    res.status(500).json({ error: 'No se pudo crear el cupón' });
  }
});

// Reescribir un mensaje con IA (mismo contenido, otras palabras), si el servidor tiene la clave
let clienteIA = null;
router.post('/redactar', async (req, res) => {
  if (!esJefe(req)) return res.status(403).json({ error: 'Solo la dueña o encargada' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'La escritura con IA no está configurada en este servidor' });
  const texto = String(req.body.texto || '').slice(0, 3000);
  if (!texto.trim()) return res.status(400).json({ error: 'No hay mensaje para reescribir' });
  try {
    if (!clienteIA) clienteIA = new Anthropic();
    const r = await clienteIA.beta.messages.create({
      model: 'claude-opus-5', max_tokens: 1200, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' },
      system: `Reescribís mensajes para un grupo de WhatsApp de clientas de una tienda de belleza y skincare de Argentina. Español rioplatense (vos), cálido, cercano y entusiasta, como una amiga que trabaja en la tienda. Usá el formato de WhatsApp (*negrita*, _cursiva_, ~tachado~) y algunos emojis, sin exagerar. Mantené exactamente los mismos productos, precios, porcentajes, códigos de cupón, fechas, cantidades y links: no inventes nada que no esté. Corto: que se lea en 15 segundos. Devolvé solo el mensaje.`,
      messages: [{ role: 'user', content: 'Reescribí este mensaje con otras palabras' + (req.body.tono ? ' (tono: ' + String(req.body.tono).slice(0, 40) + ')' : '') + ':\n\n' + texto }],
    });
    if (r.stop_reason === 'refusal') return res.status(400).json({ error: 'No se pudo reescribir este mensaje' });
    const t = r.content.filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
    res.json({ texto: t || texto });
  } catch (e) {
    console.error('[club] redactar:', e.message);
    res.status(502).json({ error: 'No se pudo reescribir ahora. Probá de nuevo en un rato.' });
  }
});

module.exports = router;
