// Catalogo de productos para Google (Merchant Center / Shopping gratis) e Instagram/Facebook (Meta Commerce).
// Un solo archivo XML (formato RSS de Google, que Meta tambien acepta) con los productos publicados que tienen
// foto y precio. Google y Meta lo leen solos todos los dias desde el link.
const pool = require('../config/database');
const tienda = require('./tienda');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const precio = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2) + ' ARS';
// Titulo prolijo: "345 RELIEF CREAM MASK" -> "345 Relief Cream Mask" (Google penaliza los titulos todo en mayusculas)
const titulo = (t) => { const s = String(t || '').trim(); return s === s.toUpperCase() && /[A-Z]{4,}/.test(s) ? s.toLowerCase().replace(/(^|[\s\-/(])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase()) : s; };

// Productos del catalogo y los que quedan afuera (con el motivo)
async function productos() {
  const r = (await pool.query(`SELECT p.id, p.nombre, p.marca, p.categoria, p.precio, p.codigo_barras, tp.descripcion,
      GREATEST(COALESCE(p.stock_rg, 0) - COALESCE(p.reservado_rg, 0), 0) + GREATEST(COALESCE(p.stock_ush, 0) - COALESCE(p.reservado_ush, 0), 0) AS stock,
      EXISTS (SELECT 1 FROM producto_imagenes i WHERE i.producto_id = p.id) AS foto
    FROM productos p JOIN tienda_productos tp ON tp.producto_id = p.id
    WHERE tp.publicado AND p.activo = TRUE AND COALESCE(p.precio, 0) > 0 ORDER BY p.nombre`)).rows;
  const slugs = tienda.slugsProductos(r);
  return r.map(p => ({ ...p, slug: slugs.get(p.id), stock: Number(p.stock) || 0, incluido: !!p.foto, motivo: p.foto ? null : 'sin foto' }));
}

// XML del catalogo. base = URL publica del servidor (para las fotos); urlProducto(p) = link a la ficha en la tienda
async function xml({ c, base, slug, urlProducto }) {
  const lista = (await productos()).filter(p => p.incluido);
  const of = tienda.ofertaDiaActiva(c);
  const items = lista.map(p => {
    const desc = String(p.descripcion || '').trim() || [p.nombre, p.marca].filter(Boolean).join(' · ');
    const gtin = /^\d{8}$|^\d{12,14}$/.test(String(p.codigo_barras || '').trim()) ? String(p.codigo_barras).trim() : null;
    const oferta = of && of.producto_id === p.id && of.precio < Number(p.precio) ? of : null;
    return `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${esc(titulo(p.nombre).slice(0, 150))}</g:title>
      <g:description>${esc(desc.slice(0, 4900))}</g:description>
      <g:link>${esc(urlProducto(p))}</g:link>
      <g:image_link>${esc(base + '/api/tienda-publica/' + encodeURIComponent(slug) + '/foto/' + p.id)}</g:image_link>
      <g:availability>${p.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${precio(p.precio)}</g:price>${oferta ? `
      <g:sale_price>${precio(oferta.precio)}</g:sale_price>
      <g:sale_price_effective_date>${new Date().toISOString().slice(0, 19)}Z/${new Date(oferta.hasta).toISOString().slice(0, 19)}Z</g:sale_price_effective_date>` : ''}
      <g:condition>new</g:condition>${p.marca ? `
      <g:brand>${esc(p.marca)}</g:brand>` : ''}${gtin ? `
      <g:gtin>${gtin}</g:gtin>` : `
      <g:identifier_exists>no</g:identifier_exists>`}${p.categoria ? `
      <g:product_type>${esc(p.categoria)}</g:product_type>` : ''}
      <g:google_product_category>469</g:google_product_category>
    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(c.titulo || 'Tienda')}</title>
    <link>${esc(urlProducto(null))}</link>
    <description>${esc(c.mensaje || c.titulo || 'Tienda online')}</description>
${items.join('\n')}
  </channel>
</rss>
`;
}

module.exports = { productos, xml };
