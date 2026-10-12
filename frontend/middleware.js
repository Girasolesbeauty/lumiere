// Vista previa de los links de la tienda con dominio propio (ej: girasolesbeauty.com.ar/limpiador-facial).
// WhatsApp, Instagram y Facebook no ejecutan la pagina: leen las etiquetas <meta> del HTML. Aca, solo
// para los dominios propios de una tienda, se agregan el nombre, el texto y la foto del producto (o de
// la tienda) al HTML de siempre. Lumiere (app.sistemalumiere.com, *.vercel.app) no pasa por aca.
// Ante cualquier problema se sigue de largo y se sirve la pagina normal.
export const config = { matcher: ["/((?!assets/|api/|.*\\.[a-zA-Z0-9]+$).*)", "/manifest.webmanifest", "/apple-touch-icon.png", "/favicon-32.png", "/icono-192.png", "/icono-512.png", "/icono-maskable-512.png"] };
// En un dominio propio, el icono del acceso directo, el de la pestaña y el manifest son los de la tienda
const ICONOS = /^\/(apple-touch-icon|favicon-32|icono-192|icono-512|icono-maskable-512)\.png$/;

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
    if (ICONOS.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
      const dr = await traer(API + "/tienda-dominio?host=" + encodeURIComponent(url.hostname), 2500);
      const sl = dr.ok ? (await dr.json()).slug : null;
      if (!sl) return;
      const vr = await traer(API + "/tienda-publica/" + encodeURIComponent(sl) + "/vista-previa", 2500);
      const v = vr.ok ? await vr.json() : null;
      if (!v || !v.icono) return;
      if (url.pathname === "/manifest.webmanifest") {
        const nombre = v.nombre || "Tienda";
        return new Response(JSON.stringify({ name: nombre, short_name: nombre.slice(0, 20), start_url: "/", scope: "/", display: "standalone", background_color: "#ffffff", theme_color: v.color || "#111111",
          icons: [{ src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }] }),
          { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=0, s-maxage=600" } });
      }
      const ir = await traer(API + v.icono, 3000);
      if (!ir.ok) return;
      return new Response(await ir.arrayBuffer(), { headers: { "content-type": ir.headers.get("content-type") || "image/png", "cache-control": "public, max-age=3600, s-maxage=3600" } });
    }
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
        // Nombre y colores de la tienda (en vez de Lumiere) para el acceso directo del celular
        const nombre = esc(d.nombre || d.titulo.split(" | ").pop());
        html = html.replace(/(<meta name="(?:apple-mobile-web-app-title|application-name)" content=")[^"]*(")/g, "$1" + nombre + "$2")
          .replace(/(<meta name="theme-color" content=")[^"]*(")/, "$1" + esc(d.color || "#ffffff") + "$2");
        if (d.icono) html = html.replace(/\s*<link rel="icon" type="image\/svg\+xml"[^>]*>/, "").replace(/(<link rel="icon" type="image\/png" sizes="32x32" href=")[^"]*(")/, "$1/favicon-32.png?t=" + encodeURIComponent(d.icono.split("v=")[1] || "1") + "$2")
          .replace(/(<link rel="apple-touch-icon" href=")[^"]*(")/, "$1/apple-touch-icon.png?t=" + encodeURIComponent(d.icono.split("v=")[1] || "1") + "$2");
      }
    }
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=300" } });
  } catch (e) {
    return;
  }
}
