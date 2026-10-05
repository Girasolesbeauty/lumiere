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
    enNegocio({ id: neg.id, schema: neg.schema }, next);
  }).catch((e) => {
    console.error('[sesion] no se pudo leer el negocio:', e.message);
    res.status(500).json({ error: 'No pudimos abrir tu negocio. Probá de nuevo en un momento.' });
  });
};

module.exports.rutaLibre = rutaLibre;
