// Llaves de solo lectura: para que alguien de confianza (por ejemplo, Claude) pueda consultar los datos del
// negocio sin usar el usuario y la contraseña de nadie. Cada llave:
//  - solo sirve para LEER (pedidos GET): no puede cargar, modificar, anular ni borrar nada
//  - no entra a lo delicado: respaldos completos, usuarios y sesiones, cuentas de Mercado Pago / Tiendanube, pagos
//  - se puede desactivar en cualquier momento, y deja registro de cada consulta
// Se guardan en el registro central (no en el cajón de cada negocio) solo como hash: el texto de la llave se ve una sola vez.
const crypto = require('crypto');
const negocios = require('./negocios');
const C = 'lumiere_central';
const PREFIJO = 'lum_ro_';
let listo = false;
async function asegurar() {
  if (listo) return;
  await negocios.asegurarCentral();
  await negocios.baseQuery(`CREATE TABLE IF NOT EXISTS ${C}.api_llaves (id SERIAL PRIMARY KEY, negocio_id INT NOT NULL, nombre TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE, pista TEXT, activo BOOLEAN NOT NULL DEFAULT TRUE, creado_en TIMESTAMP NOT NULL DEFAULT NOW(), creado_por TEXT,
    desactivado_en TIMESTAMP, desactivado_por TEXT, ultimo_uso TIMESTAMP, usos INT NOT NULL DEFAULT 0)`);
  await negocios.baseQuery(`CREATE TABLE IF NOT EXISTS ${C}.api_llaves_uso (id BIGSERIAL PRIMARY KEY, llave_id INT NOT NULL, negocio_id INT NOT NULL,
    metodo TEXT, ruta TEXT, permitido BOOLEAN NOT NULL DEFAULT TRUE, en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await negocios.baseQuery(`CREATE INDEX IF NOT EXISTS api_llaves_uso_llave ON ${C}.api_llaves_uso (llave_id, en DESC)`);
  listo = true;
}
const hashDe = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const esLlave = (t) => typeof t === 'string' && t.startsWith(PREFIJO) && t.length > 20;
// Lo que una llave nunca puede ver (aunque sea con GET)
const RUTAS_BLOQUEADAS = [/^\/auth(\/|$)/, /^\/respaldo(\/|$)/, /^\/plataforma(\/|$)/, /^\/mercadopago(\/|$)/, /^\/tiendanube(\/|$)/, /^\/pagos(\/|$)/, /^\/llaves(\/|$)/, /^\/permisos\/usuarios/];
const rutaPermitida = (metodo, ruta) => metodo === 'GET' && !RUTAS_BLOQUEADAS.some(r => r.test(ruta));
async function crear(negocioId, nombre, quien) {
  await asegurar();
  const texto = PREFIJO + crypto.randomBytes(24).toString('hex');
  const r = await negocios.baseQuery(`INSERT INTO ${C}.api_llaves (negocio_id, nombre, hash, pista, creado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, pista, activo, creado_en, creado_por`,
    [negocioId, String(nombre || 'Llave de solo lectura').trim().slice(0, 60) || 'Llave de solo lectura', hashDe(texto), '…' + texto.slice(-4), quien || null]);
  return { ...r.rows[0], llave: texto };
}
async function listar(negocioId) {
  await asegurar();
  return (await negocios.baseQuery(`SELECT id, nombre, pista, activo, creado_en, creado_por, desactivado_en, desactivado_por, ultimo_uso, usos FROM ${C}.api_llaves WHERE negocio_id = $1 ORDER BY id DESC`, [negocioId])).rows;
}
async function desactivar(negocioId, id, quien) {
  await asegurar();
  const r = await negocios.baseQuery(`UPDATE ${C}.api_llaves SET activo = FALSE, desactivado_en = NOW(), desactivado_por = $3 WHERE id = $1 AND negocio_id = $2 AND activo RETURNING id`, [id, negocioId, quien || null]);
  return r.rowCount > 0;
}
async function usos(negocioId, id) {
  await asegurar();
  return (await negocios.baseQuery(`SELECT metodo, ruta, permitido, en FROM ${C}.api_llaves_uso WHERE llave_id = $1 AND negocio_id = $2 ORDER BY en DESC LIMIT 200`, [id, negocioId])).rows;
}
// Busca la llave (activa) por su texto. Devuelve { id, negocio_id, nombre } o null
async function buscar(texto) {
  await asegurar();
  const r = await negocios.baseQuery(`SELECT id, negocio_id, nombre FROM ${C}.api_llaves WHERE hash = $1 AND activo`, [hashDe(texto)]);
  return r.rows[0] || null;
}
// Anota cada consulta (y cada intento bloqueado). No frena el pedido si falla
function registrar(llave, metodo, ruta, permitido) {
  negocios.baseQuery(`INSERT INTO ${C}.api_llaves_uso (llave_id, negocio_id, metodo, ruta, permitido) VALUES ($1, $2, $3, $4, $5)`, [llave.id, llave.negocio_id, metodo, String(ruta).slice(0, 300), permitido]).catch(() => {});
  if (permitido) negocios.baseQuery(`UPDATE ${C}.api_llaves SET ultimo_uso = NOW(), usos = usos + 1 WHERE id = $1`, [llave.id]).catch(() => {});
}
module.exports = { PREFIJO, esLlave, rutaPermitida, crear, listar, desactivar, usos, buscar, registrar };
