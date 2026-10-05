const jwt = require('jsonwebtoken');

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
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    if (datos.tipo === 'cliente') return res.status(401).json({ error: 'Iniciá sesión para continuar', sesion: true });
    req.usuario = datos;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Tu sesión venció. Volvé a iniciar sesión.', sesion: true });
  }
};

module.exports.rutaLibre = rutaLibre;
