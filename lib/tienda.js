const pool = require('../config/database');
const negocios = require('./negocios');
const { porNegocio } = require('./contexto');

// Tienda web del negocio: configuracion, productos publicados y pedidos.
// El stock de lo pedido se APARTA en el momento (se descuenta del local), asi no se vende dos
// veces en el mostrador; si el pedido se cancela o vence sin pagar, vuelve. Cuando el cliente
// retira o se entrega, el pedido se cobra en el Punto de Venta (ahi vuelve el stock un instante
// y la venta lo descuenta como cualquier otra), asi factura y entra a la caja como siempre.
// Estados: pendiente_pago -> confirmado -> preparado -> en_caja -> entregado; o cancelado.

const C = 'lumiere_central';
// Las tablas se crean una sola vez aunque lleguen varios pedidos juntos (al abrir la tienda se
// piden datos y productos a la vez, y dos CREATE TABLE simultaneos chocan en Postgres)
let centralLista = null;
function asegurarCentral() {
  if (!centralLista) centralLista = (async () => {
    await negocios.asegurarCentral();
    await negocios.baseQuery(`CREATE TABLE IF NOT EXISTS ${C}.tiendas (
      slug TEXT PRIMARY KEY,
      negocio_id INT NOT NULL UNIQUE,
      creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  })().catch((e) => { centralLista = null; throw e; });
  return centralLista;
}

const listo = porNegocio(null);
function asegurar() {
  if (!listo.get()) {
    const p = crearTablas().catch((e) => { listo.set(null); throw e; });
    listo.set(p);
  }
  return listo.get();
}
async function crearTablas() {
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_config (
    id INT PRIMARY KEY DEFAULT 1,
    activo BOOLEAN NOT NULL DEFAULT FALSE,
    slug TEXT,
    titulo TEXT,
    mensaje TEXT,
    color TEXT,
    whatsapp TEXT,
    retiro_activo BOOLEAN NOT NULL DEFAULT TRUE,
    retiro_locales INT[],
    envio_activo BOOLEAN NOT NULL DEFAULT FALSE,
    envio_zonas JSONB NOT NULL DEFAULT '[]',
    envio_gratis_desde NUMERIC(14,2),
    envio_local INT NOT NULL DEFAULT 1,
    pago_mp BOOLEAN NOT NULL DEFAULT TRUE,
    pago_transferencia BOOLEAN NOT NULL DEFAULT TRUE,
    transferencia_datos TEXT,
    pago_retiro BOOLEAN NOT NULL DEFAULT TRUE,
    horas_reserva INT NOT NULL DEFAULT 24)`);
  await pool.query(`INSERT INTO tienda_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_productos (
    producto_id INT PRIMARY KEY,
    publicado BOOLEAN NOT NULL DEFAULT FALSE,
    descripcion TEXT,
    orden INT NOT NULL DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_pedidos (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    cliente_id INT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    entrega TEXT NOT NULL,
    local_id INT NOT NULL DEFAULT 1,
    direccion TEXT,
    zona TEXT,
    costo_envio NUMERIC(14,2) NOT NULL DEFAULT 0,
    pago TEXT NOT NULL,
    pagado BOOLEAN NOT NULL DEFAULT FALSE,
    pago_ref TEXT,
    mp_link TEXT,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    nota TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente_pago',
    stock_apartado BOOLEAN NOT NULL DEFAULT TRUE,
    venta_id INT,
    vence_en TIMESTAMP,
    motivo TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    variante_id INT,
    nombre TEXT NOT NULL,
    variante_valor TEXT,
    cantidad INT NOT NULL,
    precio NUMERIC(14,2) NOT NULL)`);
  // Diseño de la tienda: frases de la tira de arriba, productos destacados (van al banner) y videos
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS anuncios TEXT`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS logo TEXT`); // si no hay, se usa el logo del negocio
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS video_url TEXT`);
  // Fotos extra de un producto (la portada es la de producto_imagenes, la misma del Punto de Venta)
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_fotos (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL,
    imagen TEXT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS tienda_fotos_producto ON tienda_fotos (producto_id, orden)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_videos (
    producto_id INT PRIMARY KEY,
    tipo TEXT NOT NULL,
    datos BYTEA NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
}

// Video de un producto: un link (YouTube, Vimeo o un archivo .mp4) o un video subido desde Lumiere
const VIDEO_MAX_MB = 25;
function videoDeLink(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u);
  if (m) return { tipo: 'youtube', id: m[1] };
  m = /vimeo\.com\/(?:video\/)?(\d{6,12})/.exec(u);
  if (m) return { tipo: 'vimeo', id: m[1] };
  if (/^https:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(u)) return { tipo: 'archivo', url: u };
  return null;
}

const num = (x) => parseFloat(x) || 0;
const colLocal = (l) => (Number(l) === 2 ? 'stock_ush' : 'stock_rg');

async function leerConfig(db = pool) {
  await asegurar();
  const c = (await db.query('SELECT * FROM tienda_config WHERE id = 1')).rows[0];
  return { ...c, envio_zonas: c.envio_zonas || [], envio_gratis_desde: c.envio_gratis_desde === null ? null : num(c.envio_gratis_desde) };
}

// Mueve stock de los items de un pedido: signo -1 aparta (descuenta), +1 devuelve
async function moverStock(db, pedido, signo) {
  const col = colLocal(pedido.local_id);
  const items = (await db.query('SELECT * FROM tienda_pedido_items WHERE pedido_id = $1', [pedido.id])).rows;
  for (const it of items) {
    const delta = signo * it.cantidad;
    if (it.variante_id) {
      await db.query(`UPDATE producto_variantes SET ${col} = COALESCE(${col}, 0) + $1 WHERE id = $2`, [delta, it.variante_id]);
    } else {
      await db.query(`UPDATE productos SET ${col} = COALESCE(${col}, 0) + $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) + $1 WHERE id = $2`, [delta, it.producto_id]);
    }
  }
}

// Cancela un pedido (y devuelve el stock si estaba apartado)
async function cancelar(id, motivo) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!p || ['entregado', 'cancelado'].includes(p.estado)) { await client.query('ROLLBACK'); return false; }
    if (p.stock_apartado) await moverStock(client, p, +1);
    await client.query(`UPDATE tienda_pedidos SET estado = 'cancelado', stock_apartado = FALSE, motivo = $1, actualizado_en = NOW() WHERE id = $2`, [motivo || null, id]);
    await client.query('COMMIT');
    return true;
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} throw e; } finally { client.release(); }
}

// Los pedidos sin pagar que pasaron su plazo se cancelan solos (se revisa en cada consulta)
async function vencerPendientes() {
  await asegurar();
  const r = await pool.query(`SELECT id FROM tienda_pedidos WHERE estado = 'pendiente_pago' AND vence_en IS NOT NULL AND vence_en < NOW() LIMIT 50`);
  for (const x of r.rows) { try { await cancelar(x.id, 'Venció sin pagar'); } catch (e) { console.error('[tienda] vencer:', e.message); } }
}

// Slug -> negocio (para la tienda publica)
async function negocioDeSlug(slug) {
  await asegurarCentral();
  const r = await negocios.baseQuery(`SELECT negocio_id FROM ${C}.tiendas WHERE slug = $1`, [String(slug || '').toLowerCase()]);
  if (!r.rows.length) return null;
  return negocios.negocioPorId(r.rows[0].negocio_id);
}
async function guardarSlug(slug, negocioId) {
  await asegurarCentral();
  const otro = await negocios.baseQuery(`SELECT negocio_id FROM ${C}.tiendas WHERE slug = $1`, [slug]);
  if (otro.rows.length && Number(otro.rows[0].negocio_id) !== Number(negocioId)) return false;
  await negocios.baseQuery(`DELETE FROM ${C}.tiendas WHERE negocio_id = $1`, [negocioId]);
  await negocios.baseQuery(`INSERT INTO ${C}.tiendas (slug, negocio_id) VALUES ($1, $2)`, [slug, negocioId]);
  return true;
}

const FOTOS_EXTRA_MAX = 8;
module.exports = { FOTOS_EXTRA_MAX, VIDEO_MAX_MB, videoDeLink, asegurar, leerConfig, moverStock, cancelar, vencerPendientes, negocioDeSlug, guardarSlug, colLocal, num };
