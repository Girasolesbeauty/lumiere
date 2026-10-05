const jwt = require('jsonwebtoken');
const negocios = require('../lib/negocios');
const { enNegocio } = require('../lib/contexto');

// Exige haber iniciado sesion para usar el sistema. Al entrar, el servidor entrega una
// "llave" (token) y desde ahora cada pedido tiene que traerla; sin ella no se ve ningun dato.
// Quedan libres solo el inicio de sesion y el portal de clientes (que tiene su propia llave).
function rutaLibre(req) {
  if (req.method === 'OPTIONS') return true;
  const p = req.path;
  if (p === '/auth/login') return true;
  if (p === '/portal' || p.startsWith('/portal/')) return true;
  if (p === '/legal' || p === '/legal/') return true; // los terminos se pueden leer sin sesion
  return false;
}

module.exports = function exigirSesion(req, res, next) {
  if (rutaLibre(req)) return next();
  const cab = req.headers.authorization || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Iniciá sesión para continuar', sesion: true });
  let datos;
  try {
    datos = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Tu sesión venció. Volvé a iniciar sesión.', sesion: true });
  }
  if (datos.tipo === 'cliente') return res.status(401).json({ error: 'Iniciá sesión para continuar', sesion: true });
  req.usuario = datos;
  // La llave dice de que negocio es (las llaves anteriores a multi-negocio son del negocio 1).
  // Todo lo que sigue en este pedido lee y escribe solo en el cajon de ese negocio.
  negocios.negocioPorId(datos.neg || 1).then((neg) => {
    if (!neg) return res.status(401).json({ error: 'Iniciá sesión para continuar', sesion: true });
    req.negocio = neg;
    const estado = negocios.resumen(neg).estado;
    if (estado === 'suspendido') return res.status(403).json({ error: 'La cuenta de este negocio está suspendida. Escribinos a hola@sistemalumiere.com', suspendido: true });
    // Prueba gratis terminada: se puede entrar y ver todo, pero no cargar ni modificar nada
    if (estado === 'vencido' && req.method !== 'GET' && req.path !== '/auth/terminos/aceptar') {
      return res.status(402).json({ error: 'Tu prueba gratis terminó. Podés seguir viendo tus datos; para volver a cargar y vender hay que activar la cuenta. Escribinos a hola@sistemalumiere.com', prueba_vencida: true });
    }
    enNegocio({ id: neg.id, schema: neg.schema }, next);
  }).catch((e) => {
    console.error('[sesion] no se pudo leer el negocio:', e.message);
    res.status(500).json({ error: 'No pudimos abrir tu negocio. Probá de nuevo en un momento.' });
  });
};

module.exports.rutaLibre = rutaLibre;
