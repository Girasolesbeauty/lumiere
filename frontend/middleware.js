// Vista previa de los links de la tienda con dominio propio (ej: girasolesbeauty.com.ar/limpiador-facial).
// WhatsApp, Instagram y Facebook no ejecutan la pagina: leen las etiquetas <meta> del HTML. Aca, solo
// para los dominios propios de una tienda, se agregan el nombre, el texto y la foto del producto (o de
// la tienda) al HTML de siempre. Lumiere (app.sistemalumiere.com, *.vercel.app) no pasa por aca.
// Ante cualquier problema se sigue de largo y se sirve la pagina normal.
export const config = { matcher: ["/((?!assets/|api/|.*\\.[a-zA-Z0-9]+$).*)"] };

const API = (process.env.VITE_API_URL || "https://lumiere-production-79d0.up.railway.app/api").replace(/\/+$/, "");
const HOSTS_LUMIERE = /^(localhost|127\.0\.0\.1|(app|clientes|www)\.sistemalumiere\.com|sistemalumiere\.com|.*\.vercel\.app|.*\.railway\.app)$/i;
const esc = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function traer(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    if (HOSTS_LUMIERE.test(url.hostname) || url.searchParams.has("tienda")) return;
    const seg = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
    const producto = seg && !seg.includes("/") ? seg : "";
    const [paginaR, dominioR] = await Promise.all([
      traer(new URL("/index.html", url), 3000),
      traer(API + "/tienda-dominio?host=" + encodeURIComponent(url.hostname), 2500),
    ]);
    if (!paginaR.ok) return;
    let html = await paginaR.text();
    const slug = dominioR.ok ? (await dominioR.json()).slug : null;
    if (slug) {
      const r = await traer(API + "/tienda-publica/" + encodeURIComponent(slug) + "/vista-previa" + (producto ? "?p=" + encodeURIComponent(producto) : ""), 2500);
      const d = r.ok ? await r.json() : null;
      if (d && d.titulo) {
        const img = d.imagen ? (/^https:\/\//.test(d.imagen) ? d.imagen : API + d.imagen) : null;
        const link = url.origin + (d.producto ? "/" + d.producto : "/");
        const meta = [
          ["og:type", d.producto ? "product" : "website"], ["og:site_name", d.titulo.split(" | ").pop()], ["og:title", d.titulo],
          ["og:description", d.descripcion], ["og:url", link], ...(img ? [["og:image", img]] : []),
        ].map(([k, v]) => '<meta property="' + k + '" content="' + esc(v) + '" />').join("\n    ")
          + '\n    <meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '" />'
          + '\n    <meta name="description" content="' + esc(d.descripcion) + '" />'
          + '\n    <link rel="canonical" href="' + esc(link) + '" />';
        html = html.replace(/<title>[^<]*<\/title>/, "<title>" + esc(d.titulo) + "</title>").replace("</head>", "    " + meta + "\n  </head>");
      }
    }
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" } });
  } catch (e) {
    return;
  }
}
