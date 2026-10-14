// Logros de las clientas (medallas en "Mi cuenta" de la tienda online).
// Se calculan en el momento a partir de sus compras, reseñas, canjes y pedidos: no hay nada que cargar a mano.
const pool = require('../config/database');
const { VENTA_VALIDA, NIVELES } = require('./niveles');

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Marcas de skincare coreano (comparadas sin mayusculas ni acentos)
const MARCAS_COREANAS = ['cosrx', 'some by mi', 'beauty of joseon', 'anua', 'skin1004', 'isntree', 'round lab', 'torriden', 'laneige', 'innisfree',
  'missha', 'etude', 'klairs', 'purito', 'mizon', 'banila', 'holika', 'tony moly', 'tonymoly', 'the face shop', 'medicube', 'axis-y', 'heimish',
  'dr. jart', 'dr.jart', 'dr jart', 'sulwhasoo', 'neogen', 'benton', 'iunik', 'pyunkang', 'haruharu', 'mediheal', 'abib', 'numbuzin', 'manyo', 'ma:nyo',
  'aestura', 'dr.g', 'illiyoon', 'nature republic', 'skinfood', 'belif', 'goodal', 'biodance', 'jumiso', 'rovectin', 'tocobo', 'thank you farmer',
  'celimax', 'mixsoon', "d'alba", 'dalba', 'hanyul', 'cnp', 'bring green', 'skin&lab', 'sungboon', 'acwell', 'elizavecca', 'apieu', "a'pieu", 'the saem',
  'peripera', 'rom&nd', 'romand', 'clio', 'espoir', 'hera', 'amorepacific', 'beplain', 'nacific', 'by wishtrend', 'wishtrend', 'kaine', 'make p:rem', 'vt cosmetics'];
const esCoreano = (p) => {
  const m = norm(p.marca), t = norm([p.nombre, p.categoria].join(' '));
  return MARCAS_COREANAS.some(k => m.includes(k) || (k.length > 4 && t.includes(k))) || /corea|korean|k-beauty|kbeauty/.test(t + ' ' + m);
};
// Paso de rutina facial al que pertenece un producto (o null)
const PASOS = [
  ['limpieza', /limpia|cleanser|cleansing|espuma|jabon|desmaquill|micelar|balsamo limpiador/],
  ['tonico', /tonico|toner|esencia|essence|bruma/],
  ['serum', /serum|ampolla|booster|concentrado/],
  ['hidratante', /hidratante|crema (facial|de dia|de noche|gel)|moistur|gel crema|emulsion/],
  ['solar', /protector solar|proteccion solar|\bfps\b|\bspf\b|sunscreen|solar/],
];
const pasoDe = (p) => { const t = norm([p.nombre, p.categoria].join(' ')); if (/corporal|body|cuerpo|manos|pies|capilar|cabello|shampoo|perfume|fragancia/.test(t)) return null; const x = PASOS.find(([, r]) => r.test(t)); return x ? x[0] : null; };
const esFragancia = (p) => /perfume|fragancia|eau de|colonia|body mist|splash/.test(norm([p.nombre, p.categoria].join(' ')));
const esSolar = (p) => pasoDe(p) === 'solar';

// Racha mas larga de meses seguidos con compras ("2026-03", "2026-04", ...)
function rachaMeses(meses) {
  const ns = [...new Set(meses)].map(m => { const [y, mm] = m.split('-').map(Number); return y * 12 + mm; }).sort((a, b) => a - b);
  let mejor = 0, act = 0, prev = null;
  ns.forEach(n => { act = prev !== null && n === prev + 1 ? act + 1 : 1; mejor = Math.max(mejor, act); prev = n; });
  return mejor;
}

async function logrosDeCliente(clienteId, nivel, marca) {
  const tienda = String(marca || '').trim() || 'la tienda';
  const gir = /girasol/i.test(tienda);
  const q = (sql, params = [clienteId]) => pool.query(sql, params).then(r => r.rows).catch(() => []);
  const [items, res, canjes, pedidos, favs, refs, cli] = await Promise.all([
    q(`SELECT v.id AS venta_id, to_char(v.creado_en, 'YYYY-MM') AS mes, EXTRACT(MONTH FROM v.creado_en)::int AS m, vi.cantidad, p.id, p.nombre, p.marca, p.categoria
       FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id LEFT JOIN productos p ON p.id = vi.producto_id
       WHERE v.cliente_id = $1 AND ${VENTA_VALIDA}`),
    q(`SELECT COUNT(*) FILTER (WHERE estado = 'aprobada')::int AS n, COUNT(*) FILTER (WHERE estado = 'aprobada' AND foto IS NOT NULL)::int AS f FROM tienda_resenas WHERE cliente_id = $1`),
    q(`SELECT COUNT(*)::int AS n FROM canjes_premios WHERE cliente_id = $1`),
    q(`SELECT COUNT(*) FILTER (WHERE COALESCE(tipo, '') <> 'giftcard')::int AS web, COUNT(*) FILTER (WHERE tipo = 'giftcard' AND pagado)::int AS gc
       FROM tienda_pedidos WHERE cliente_id = $1 AND estado <> 'cancelado'`),
    q(`SELECT COUNT(*)::int AS n FROM tienda_favoritos WHERE cliente_id = $1`),
    q(`SELECT COUNT(*)::int AS n FROM tienda_referidos WHERE referente_id = $1`),
    q(`SELECT EXTRACT(MONTH FROM fecha_nacimiento)::int AS mc FROM clientes WHERE id = $1`),
  ]);
  const prods = items.filter(i => i.id);
  const unidades = (f) => prods.filter(f).reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0);
  const ventas = [...new Set(items.map(i => i.venta_id))];
  const mesesSkin = new Set(prods.filter(i => pasoDe(i)).map(i => i.mes));
  const pasos = new Set(prods.map(pasoDe).filter(Boolean));
  const racha = rachaMeses(items.map(i => i.mes));
  const nRes = (res[0] && res[0].n) || 0, nFoto = (res[0] && res[0].f) || 0;
  const nCanjes = (canjes[0] && canjes[0].n) || 0;
  const web = (pedidos[0] && pedidos[0].web) || 0, gc = (pedidos[0] && pedidos[0].gc) || 0;
  const nFavs = (favs[0] && favs[0].n) || 0;
  const nRefs = (refs[0] && refs[0].n) || 0;
  const mesCumple = cli[0] && cli[0].mc;
  const cumpleCompra = !!mesCumple && items.some(i => i.m === mesCumple);
  const iNivel = Math.max(0, NIVELES.indexOf(nivel || 'Bronze'));

  // [id, icono, nombre, descripcion, progreso actual, meta]
  const L = [
    ['primera', '🌱', 'Primera compra', 'Hiciste tu primera compra en ' + tienda, ventas.length, 1],
    ['nivel', '✨', 'Subiste de nivel', iNivel > 0 ? 'Llegaste a ' + NIVELES[iNivel] : 'Llegá a Silver con tus compras', iNivel, 1],
    ['rutina', '💧', 'Rutina consistente', 'Compraste skincare facial en 3 meses distintos', mesesSkin.size, 3],
    ['pasos', '🧴', 'Rutina completa', 'Tenés 4 pasos de rutina: limpieza, tónico, sérum, hidratante o protector', pasos.size, 4],
    ['coreano', '🇰🇷', 'Fan del skincare coreano', 'Compraste 3 productos de skincare coreano', unidades(esCoreano), 3],
    ['fan', gir ? '🌻' : '💫', 'Fan de ' + (gir ? 'Girasoles' : tienda), 'Compraste 3 meses seguidos', racha, 3],
    ['canje', '🎁', 'Primer canje', 'Canjeaste tus puntos por un premio', nCanjes, 1],
    ['resena', '💛', gir ? 'Ayudaste a otras girasoles' : 'Ayudaste a otras clientas', 'Dejaste tu primera reseña', nRes, 1],
    ['resenas5', '🌟', 'Voz de la comunidad', 'Publicaste 5 reseñas', nRes, 5],
    ['foto', '📸', 'Reseña con foto', 'Mostraste el producto en tu reseña', nFoto, 1],
    ['solar', '☀️', 'Protegida del sol', 'Sumaste un protector solar a tu rutina', unidades(esSolar), 1],
    ['fragancia', '🌸', 'Amante de las fragancias', 'Compraste 3 perfumes o fragancias', unidades(esFragancia), 3],
    ['online', '🛍️', 'Compradora online', 'Hiciste tu primer pedido en la tienda online', web, 1],
    ['regalo', '💌', 'Regalo perfecto', 'Regalaste una gift card', gc, 1],
    ['favs', '♥', 'Wishlist lista', 'Guardaste 5 productos en favoritos', nFavs, 5],
    ['cumple', '🎂', gir ? 'Cumple girasol' : 'Cumple feliz', 'Te diste un gusto en el mes de tu cumple', cumpleCompra ? 1 : 0, 1],
    ['embajadora', '💌', 'Embajadora', 'Invitaste a una amiga y compró', nRefs, 1],
    ['habitue', '👑', 'Habitué', 'Hiciste 10 compras', ventas.length, 10],
  ];
  return L.map(([id, icono, nombre, desc, n, meta]) => ({ id, icono, nombre, desc, n: Math.min(n, meta), meta, ok: n >= meta }));
}

module.exports = { logrosDeCliente, esCoreano, pasoDe, rachaMeses };
