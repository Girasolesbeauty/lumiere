// Genera las paginas de la web (terminos.html y privacidad.html) a partir de legal/textos.js,
// para que la web y el sistema muestren siempre el mismo texto.
// Uso:  node legal/generar-web.js   (escribe en ../lumiere-web)
const fs = require('fs');
const path = require('path');
const T = require('./textos');

const DESTINO = process.argv[2] || path.join(__dirname, '..', '..', 'lumiere-web');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pagina(doc, archivo, otra) {
  const cuerpo = (doc.intro || []).map(p => '<p>' + esc(p) + '</p>').join('\n') + '\n' +
    doc.secciones.map(s => '<h2>' + esc(s.t) + '</h2>\n' + s.p.map(p => '<p>' + esc(p) + '</p>').join('\n')).join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.titulo)} — Lumiere</title>
<meta name="description" content="${esc(doc.titulo)} de Lumiere, software de gestión para negocios.">
<link rel="canonical" href="https://www.sistemalumiere.com/${archivo}">
<link rel="icon" type="image/svg+xml" href="/icono.svg">
<meta name="theme-color" content="#0b0e14">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0e14; color: #d7dbe4; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height: 1.7; font-size: 16px; }
  a { color: #f5b400; }
  header { border-bottom: 1px solid #1c212c; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; max-width: 820px; margin: 0 auto; }
  header a.marca { font-weight: 900; font-size: 22px; color: #fff; text-decoration: none; letter-spacing: -.01em; }
  header a.marca b { color: #f5b400; }
  main { max-width: 820px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { color: #fff; font-size: clamp(26px, 5vw, 38px); line-height: 1.15; margin: 8px 0 6px; letter-spacing: -.02em; }
  h2 { color: #ffd45a; font-size: 18px; margin: 30px 0 8px; }
  p { margin: 0 0 12px; }
  .vig { color: #8b93a3; font-size: 14px; margin-bottom: 22px; }
  footer { max-width: 820px; margin: 0 auto; padding: 20px; border-top: 1px solid #1c212c; color: #8b93a3; font-size: 14px; display: flex; gap: 16px; flex-wrap: wrap; }
  @media print { body { background: #fff; color: #111; } h1, h2 { color: #111; } header, footer { display: none; } }
</style>
</head>
<body>
<header>
  <a class="marca" href="/"><b>L</b>umiere</a>
  <a href="/">← Volver a la web</a>
</header>
<main>
  <h1>${esc(doc.titulo)}</h1>
  <div class="vig">Versión ${esc(T.VERSION)} · vigente desde el ${esc(T.VIGENCIA)}</div>
${cuerpo}
</main>
<footer>
  <a href="/${otra.archivo}">${esc(otra.titulo)}</a>
  <a href="mailto:${esc(T.MAIL)}">${esc(T.MAIL)}</a>
  <span>© ${new Date().getFullYear()} Lumiere</span>
</footer>
</body>
</html>
`;
}

const A = { archivo: 'terminos.html', titulo: T.terminos.titulo };
const B = { archivo: 'privacidad.html', titulo: T.privacidad.titulo };
fs.writeFileSync(path.join(DESTINO, A.archivo), pagina(T.terminos, A.archivo, B), 'utf8');
fs.writeFileSync(path.join(DESTINO, B.archivo), pagina(T.privacidad, B.archivo, A), 'utf8');
console.log('Listo: ' + A.archivo + ' y ' + B.archivo + ' en ' + DESTINO + ' (versión ' + T.VERSION + ')');
