const crypto = require('crypto');
const cuponesLib = require('./cupones');
const pool = require('../config/database');
const negocios = require('./negocios');
const { porNegocio, schemaActual } = require('./contexto');

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
    // Dominio propio de la tienda (ej: girasolesbeauty.com.ar): entrando por ahi se ve la tienda
    await negocios.baseQuery(`ALTER TABLE ${C}.tiendas ADD COLUMN IF NOT EXISTS dominio TEXT`);
    await negocios.baseQuery(`CREATE UNIQUE INDEX IF NOT EXISTS tiendas_dominio ON ${C}.tiendas (dominio) WHERE dominio IS NOT NULL`);
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
  // Portada armada a mano: orden del banner, filas con nombre propio y sectores del menu
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS banner JSONB NOT NULL DEFAULT '[]'`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS filas JSONB NOT NULL DEFAULT '[]'`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS sectores JSONB NOT NULL DEFAULT '[]'`);
  // Banners con imagen propia (arriba de todo), cada uno con a donde lleva
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS banners_img JSONB NOT NULL DEFAULT '[]'`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS redes JSONB NOT NULL DEFAULT '{}'`); // instagram, tiktok, facebook
  // Sector de videos: reels de Instagram (por link), videos de YouTube o subidos, con los productos que aparecen
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS reels_titulo TEXT`);
  // Ruleta de premios para compras grandes: { activo, minimo, premios: [{ id, texto, tipo, valor, chance }] }
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS ruleta JSONB`);
  // Icono de la tienda para el acceso directo del celular y la pestaña del navegador (imagen cuadrada)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS icono TEXT`);
  // Mensajes de WhatsApp editables (carrito sin terminar, aviso de reposicion): { carrito, aviso }
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS mensajes JSONB`);
  // Favoritos de las clientas con cuenta, pedidos de "avisame cuando llegue" y carritos sin terminar
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_favoritos (cliente_id INT NOT NULL, producto_id INT NOT NULL, creado_en TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (cliente_id, producto_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_avisos (id SERIAL PRIMARY KEY, producto_id INT NOT NULL, cliente_id INT, nombre TEXT NOT NULL, telefono TEXT NOT NULL,
    local_id INT NOT NULL DEFAULT 1, creado_en TIMESTAMP NOT NULL DEFAULT NOW(), avisado_en TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_carritos (cliente_id INT PRIMARY KEY, items JSONB NOT NULL, subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, local_id INT,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW(), recordado_en TIMESTAMP)`);
  // Reseñas: solo de quien compro el producto; se publican cuando la tienda las aprueba (pendiente/aprobada/rechazada)
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_resenas (id SERIAL PRIMARY KEY, producto_id INT NOT NULL, cliente_id INT NOT NULL, estrellas SMALLINT NOT NULL,
    texto TEXT NOT NULL, foto BYTEA, foto_tipo TEXT, estado TEXT NOT NULL DEFAULT 'pendiente', creado_en TIMESTAMP NOT NULL DEFAULT NOW(), revisado_en TIMESTAMP,
    UNIQUE (producto_id, cliente_id))`);
  // Cuando se acredito el pago online (Mercado Pago o transferencia confirmada): ese dia cuenta en el cierre de caja.
  // Los pagados que siguen abiertos toman la fecha aproximada (los ya entregados no: se contaron con su venta).
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMP`);
  await pool.query(`UPDATE tienda_pedidos SET pagado_en = CASE WHEN pago = 'mp' THEN creado_en ELSE actualizado_en END
    WHERE pagado AND pagado_en IS NULL AND pago IN ('mp', 'transferencia', 'gocuotas') AND estado NOT IN ('entregado', 'cancelado')`);
  // Descuento por forma de pago: { mp, gocuotas, transferencia, retiro } en % (ej: 10% con transferencia)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS descuentos_pago JSONB`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_pago NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_pago_pct NUMERIC(5,2)`);
  // Ofertas del dia y combos (ver ofertasDe); descuento de combos de cada pedido
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS ofertas JSONB`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_combo NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS combos TEXT`);
  // GoCuotas (cuotas sin interes con debito) como forma de pago de la tienda
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS pago_gocuotas BOOLEAN NOT NULL DEFAULT FALSE`);
  // Puntos por dejar reseña: { activo, puntos, extra_foto }. Se suman una sola vez, cuando se publica.
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS resenas_puntos JSONB`);
  await pool.query(`ALTER TABLE tienda_resenas ADD COLUMN IF NOT EXISTS puntos_dados INT NOT NULL DEFAULT 0`);
  // Cuando se le pidio la reseña por WhatsApp a una clienta por sus compras del local
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_resenas_pedidas (cliente_id INT PRIMARY KEY, pedido_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  // Cuando se le pidio la reseña por WhatsApp a quien retiro el pedido
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS resena_pedida_en TIMESTAMP`);
  // Preventa: productos que vienen en camino (orden de ingreso). { activo, titulo, incluir_no_publicados }
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS preventa JSONB`);
  // Item de un pedido comprado en preventa: reserva sobre lo que esta en camino (reservado_rg/ush,
  // igual que la preventa de la caja) hasta que llega y se marca "Llegó la preventa"
  await pool.query(`ALTER TABLE tienda_pedido_items ADD COLUMN IF NOT EXISTS preventa BOOLEAN NOT NULL DEFAULT FALSE`);
  // "Paga al retirar" tambien vence (antes no): a los abiertos sin vencimiento se les da el plazo desde ahora
  // (menos los que esperan una preventa: vencen recien cuando llega)
  await pool.query(`UPDATE tienda_pedidos SET vence_en = NOW() + make_interval(hours => COALESCE((SELECT horas_reserva FROM tienda_config WHERE id = 1), 24))
    WHERE pago = 'retiro' AND estado IN ('confirmado', 'preparado') AND vence_en IS NULL
      AND NOT EXISTS (SELECT 1 FROM tienda_pedido_items i WHERE i.pedido_id = tienda_pedidos.id AND i.preventa)`).catch(() => {});
  // Un giro por pedido. El cupon ganado nace apagado y se activa cuando el pedido se entrega.
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_ruleta (
    pedido_id INT PRIMARY KEY,
    premio_id TEXT NOT NULL,
    texto TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor NUMERIC(6,2) NOT NULL DEFAULT 0,
    cupon TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  // Codigo de descuento usado en el pedido (cupon de Lumiere, por ejemplo un premio de puntos)
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS cupon TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS cupon_tipo TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS cupon_valor NUMERIC(14,2)`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_reels (
    id SERIAL PRIMARY KEY,
    titulo TEXT,
    tipo TEXT NOT NULL,
    codigo TEXT,
    mime TEXT,
    datos BYTEA,
    productos INT[] NOT NULL DEFAULT '{}',
    orden INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_banner_imagenes (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,
    datos BYTEA NOT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  // Sector automatico "Nuevamente en stock": productos que estaban agotados en un local y volvieron
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS reingreso_activo BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS reingreso_dias INT NOT NULL DEFAULT 14`);
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS reingreso_nombre TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_reingresos (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL,
    local_id INT NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS tienda_reingresos_prod ON tienda_reingresos (producto_id, local_id, fecha)`);
  await prepararReingresos();
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS video_url TEXT`);
  // Segmentos elegidos a mano (tipo de producto, tipo de piel, necesidad). Lo que no esta, se detecta solo.
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS etiquetas JSONB`);
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
  // Sector "¿Querés hacer un regalo?": gift cards online y armador de regalos (ver regalosDe)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS regalos JSONB`);
  // Pedido de gift card: tipo = 'giftcard', sin productos. Cuando se acredita el pago se emite la gift card
  // en Lumiere (la misma tabla de Gift Cards del Punto de Venta) y gc_codigo queda con su codigo.
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS tipo TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_para TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_para_tel TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_mensaje TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_codigo TEXT`);
  // Mensaje de la gift card online (el link para abrir el regalo lo muestra)
  await pool.query(`ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS mensaje TEXT`).catch(() => {});
  // Fecha estimada de ingreso de las ordenes (se muestra en los productos en preventa)
  await pool.query(`ALTER TABLE ordenes_ingreso ADD COLUMN IF NOT EXISTS fecha_estimada DATE`).catch(() => {});
  // Gift card usada para pagar un pedido de la tienda: el saldo se descuenta al hacer el pedido (gc_mov_id es ese
  // movimiento de canje) y vuelve si el pedido se cancela. En la caja se registra como pagado con gift card, sin volver a descontar.
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_usado_id INT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_usado_codigo TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_usado_monto NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS gc_mov_id INT`);
  await pool.query(`UPDATE gift_cards g SET mensaje = tp.gc_mensaje FROM tienda_pedidos tp WHERE tp.gc_codigo = g.codigo AND g.mensaje IS NULL AND tp.gc_mensaje IS NOT NULL`).catch(() => {});
}

// Link para abrir una gift card online (?regalo=CODIGO.FIRMA): solo con la firma se ve el regalo
const firmaRegalo = (codigo) => crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'lumiere')).update('regalo:' + schemaActual() + ':' + String(codigo || '').toUpperCase()).digest('hex').slice(0, 16);
const firmaRegaloOk = (codigo, f) => { const a = Buffer.from(firmaRegalo(codigo)), b = Buffer.from(String(f || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// ---------- Regalos ----------
// { activo, giftcards, montos, libre, minimo, maximo, armador, presupuestos, tema, titulo, texto }
// tema 'auto': se viste solo para la fecha que se viene (Dia de la Madre, del Padre, Navidad, San Valentin)
const TEMAS_REGALO = ['auto', 'general', 'madre', 'padre', 'navidad', 'enamorados'];
// Oferta del dia (un producto a precio especial hasta una fecha y hora) y combos (varios productos juntos a un precio)
function ofertasDe(c) {
  const o = (c && c.ofertas) || {};
  const d = o.dia || {};
  const fecha = (x) => { const t = x ? new Date(x) : null; return t && !isNaN(t) ? t.toISOString() : null; };
  const dia = { activo: !!d.activo, producto_id: parseInt(d.producto_id) || null, precio: Math.max(0, Math.round(num(d.precio))), hasta: fecha(d.hasta), titulo: String(d.titulo || '').trim().slice(0, 60) };
  const combos = (Array.isArray(o.combos) ? o.combos : []).slice(0, 20).map((x, i) => ({
    id: String(x.id || ('c' + Date.now().toString(36) + i)).replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'c' + i,
    nombre: String(x.nombre || '').trim().slice(0, 60) || 'Combo',
    productos: [...new Set((Array.isArray(x.productos) ? x.productos : []).map(n => parseInt(n)).filter(n => n > 0))].slice(0, 6),
    precio: Math.max(0, Math.round(num(x.precio))), activo: x.activo !== false,
  })).filter(x => x.productos.length >= 2);
  return { dia, combos };
}
function ofertaDiaActiva(c, ahora = new Date()) {
  const { dia } = ofertasDe(c);
  return dia.activo && dia.producto_id && dia.precio > 0 && dia.hasta && new Date(dia.hasta) > ahora ? dia : null;
}
// Descuento por combos de un carrito: cada combo completo descuenta (suma de precios - precio del combo).
// lineas: [{ producto_id, cantidad, precio, preventa }]. Un mismo producto no se usa en dos combos.
function descuentoCombos(c, lineas) {
  const queda = new Map(), precio = new Map();
  lineas.filter(l => !l.preventa).forEach(l => { queda.set(l.producto_id, (queda.get(l.producto_id) || 0) + l.cantidad); if (!precio.has(l.producto_id)) precio.set(l.producto_id, num(l.precio)); });
  let total = 0; const usados = [];
  ofertasDe(c).combos.filter(x => x.activo && x.precio > 0).forEach(x => {
    const veces = Math.min(...x.productos.map(id => queda.get(id) || 0));
    if (!(veces > 0)) return;
    const suma = x.productos.reduce((s, id) => s + (precio.get(id) || 0), 0);
    const ahorro = Math.max(0, suma - x.precio);
    if (!ahorro) return;
    x.productos.forEach(id => queda.set(id, queda.get(id) - veces));
    total += ahorro * veces; usados.push({ id: x.id, nombre: x.nombre, veces, ahorro: ahorro * veces });
  });
  return { descuento: Math.round(total * 100) / 100, combos: usados };
}
function regalosDe(c) {
  const r = (c && c.regalos) || {};
  const ent = (x, d, max) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };
  const lista = (x, d) => { const l = [...new Set((Array.isArray(x) ? x : []).map(n => Math.round(Number(n))).filter(n => n >= 1000 && n <= 5000000))].sort((a, b) => a - b).slice(0, 8); return l.length ? l : d; };
  const minimo = ent(r.minimo, 5000, 5000000);
  return {
    activo: r.activo !== false, giftcards: r.giftcards !== false, armador: r.armador !== false, libre: r.libre !== false,
    montos: lista(r.montos, [10000, 20000, 30000, 50000, 100000]), minimo, maximo: Math.max(minimo, ent(r.maximo, 500000, 5000000)),
    presupuestos: lista(r.presupuestos, [20000, 35000, 50000, 100000, 200000, 300000]),
    tema: TEMAS_REGALO.includes(r.tema) ? r.tema : 'auto',
    titulo: String(r.titulo || '').trim().slice(0, 80), texto: String(r.texto || '').trim().slice(0, 200),
  };
}
// Fecha (UTC, a las 0 h) de cada festejo en el año: el Dia de la Madre es el 3er domingo de octubre y el del Padre el 3er domingo de junio
function fechaFestejo(tema, y) {
  const tercerDomingo = (m) => { const dow = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - dow) % 7) + 14); };
  return { madre: tercerDomingo(9), padre: tercerDomingo(5), navidad: Date.UTC(y, 11, 24), enamorados: Date.UTC(y, 1, 14) }[tema] || null;
}
// Tema que se ve hoy (hora de Argentina) y cuantos dias faltan para la fecha
function temaRegaloHoy(r, ahora = new Date()) {
  const ar = new Date(ahora.getTime() - 3 * 3600e3);
  const hoy = Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate());
  const proxima = (t) => { const f = fechaFestejo(t, ar.getUTCFullYear()); return f !== null && f < hoy ? fechaFestejo(t, ar.getUTCFullYear() + 1) : f; };
  const con = (t) => { const f = proxima(t); const faltan = f === null ? null : Math.round((f - hoy) / 864e5); return { tema: t, fecha: f === null ? null : new Date(f).toISOString().slice(0, 10), faltan: faltan !== null && faltan <= 60 ? faltan : null }; };
  if (r.tema !== 'auto') return r.tema === 'general' ? { tema: 'general', fecha: null, faltan: null } : con(r.tema);
  // Automatico: las semanas antes de cada fecha
  for (const [t, dias] of [['madre', 21], ['padre', 18], ['navidad', 24], ['enamorados', 14]]) { const x = con(t); if (x.faltan !== null && x.faltan <= dias) return x; }
  return { tema: 'general', fecha: null, faltan: null };
}

// Emite en Lumiere la gift card de un pedido de gift card ya pagado (una sola vez). Entra a la caja del
// local elegido como venta de gift card, el dia que se acredito el pago. Devuelve el pedido actualizado.
async function emitirGiftCard(pedidoId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [pedidoId])).rows[0];
    if (!p || p.tipo !== 'giftcard' || !p.pagado || p.gc_codigo || p.estado === 'cancelado') { await client.query('ROLLBACK'); return p || null; }
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = null;
    for (let i = 0; i < 12 && !codigo; i++) {
      const c = 'GIFT-' + Array.from(crypto.randomBytes(6), b => letras[b % letras.length]).join('');
      if (!(await client.query('SELECT 1 FROM gift_cards WHERE codigo = $1', [c])).rows.length) codigo = c;
    }
    if (!codigo) throw new Error('no se pudo generar el codigo');
    const monto = num(p.total);
    const gc = (await client.query(`INSERT INTO gift_cards (codigo, monto_inicial, saldo, beneficiario_nombre, beneficiario_telefono, cliente_id, comprador_nombre, estado, local_id, mensaje)
      VALUES ($1, $2, $2, $3, $4, $5, $6, 'activa', $7, $8) RETURNING id`, [codigo, monto, p.gc_para || p.nombre, p.gc_para_tel || null, p.cliente_id || null, p.nombre, p.local_id || 1, p.gc_mensaje || null])).rows[0];
    await client.query(`INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante) VALUES ($1, 'emision', $2, $2)`, [gc.id, monto]);
    const forma = p.pago === 'mp' ? 'Mercado Pago (tienda web)' : p.pago === 'gocuotas' ? 'GoCuotas (tienda web)' : 'Transferencia (tienda web)';
    await client.query(`INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id, forma_pago, creado_en) VALUES ($1, 'I', $2, $3, $4, $5, COALESCE($6, NOW()))`,
      ['Gift Card ' + codigo + ' (tienda web)', monto, codigo, p.local_id || 1, forma, p.pagado_en]);
    const r = (await client.query(`UPDATE tienda_pedidos SET gc_codigo = $1, estado = 'entregado', vence_en = NULL, actualizado_en = NOW() WHERE id = $2 RETURNING *`, [codigo, p.id])).rows[0];
    await client.query('COMMIT');
    return r;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error('[tienda] emitir gift card:', e.message);
    return null;
  } finally { client.release(); }
}
// Por si alguno quedo pagado sin emitir (se revisa al ver los pedidos)
async function emitirGiftCardsPendientes() {
  const r = await pool.query(`SELECT id FROM tienda_pedidos WHERE tipo = 'giftcard' AND pagado AND gc_codigo IS NULL AND estado <> 'cancelado' LIMIT 20`).catch(() => ({ rows: [] }));
  for (const x of r.rows) await emitirGiftCard(x.id);
}

// Valida un codigo de descuento (tabla cupones de Lumiere) para un subtotal. db puede ser una conexion en transaccion.
// quien: { cliente_id, telefono } de quien compra (para los cupones personales y los "uno por clienta")
async function revisarCupon(db, codigo, subtotal, bloquear, quien) {
  const cod = String(codigo || '').trim().toUpperCase().slice(0, 40);
  if (!cod) return null;
  const c = (await db.query('SELECT * FROM cupones WHERE UPPER(codigo) = $1 AND activo = TRUE' + (bloquear ? ' FOR UPDATE' : ''), [cod])).rows[0];
  if (!c) {
    const ruleta = (await db.query(`SELECT 1 FROM cupones WHERE UPPER(codigo) = $1 AND activo = FALSE AND canal = 'Ruleta tienda'`, [cod]).catch(() => ({ rows: [] }))).rows.length;
    return { error: ruleta ? 'Este cupón de la ruleta se activa cuando retirás el pedido con el que lo ganaste' : 'Ese código no existe o ya no está activo' };
  }
  if (c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date(new Date().toDateString())) return { error: 'Ese código está vencido' };
  if (c.max_usos && (c.usos || 0) >= c.max_usos) return { error: 'Ese código ya fue usado' };
  if (c.condicion_medio_pago || c.regalo_producto_id) return { error: 'Ese código se usa en el local' };
  const deOtra = await cuponesLib.revisarClienta(db, c, quien, 'tienda');
  if (deOtra) return { error: deOtra };
  const minimo = parseFloat(c.descuento_monto_minimo) || 0;
  if (minimo && subtotal < minimo) return { error: 'Ese código es para compras desde $' + Math.round(minimo).toLocaleString('es-AR') };
  const valor = parseFloat(c.valor) || 0;
  const descuento = Math.round(Math.min(subtotal, c.tipo === '%' ? subtotal * valor / 100 : valor) * 100) / 100;
  return { codigo: c.codigo, tipo: c.tipo === '%' ? '%' : '$', valor, descuento, descripcion: c.descripcion || '', personal: cuponesLib.esPersonal(c), _cupon: c };
}

// Cada vez que el stock de un local pasa de 0 (o menos) a mas de 0, queda anotado: es lo que
// muestra el sector "Nuevamente en stock". Lo hace la base de datos (un trigger), asi cuenta
// venga el stock de donde venga (compras, ajustes, traspasos). Los movimientos propios de la
// tienda (apartar y devolver lo de un pedido) no cuentan: ver moverStock.
async function prepararReingresos() {
  await pool.query(`CREATE OR REPLACE FUNCTION tienda_marcar_reingreso() RETURNS trigger AS $f$
    DECLARE pid INT;
    BEGIN
      IF current_setting('lumiere.sin_reingreso', true) = '1' THEN RETURN NEW; END IF;
      -- Nunca frena la venta o el cambio de stock: si algo falla aca, se sigue sin anotar
      BEGIN
        IF TG_TABLE_NAME = 'producto_variantes' THEN pid := (to_jsonb(NEW) ->> 'producto_id')::int; ELSE pid := (to_jsonb(NEW) ->> 'id')::int; END IF;
        IF COALESCE(OLD.stock_rg, 0) <= 0 AND COALESCE(NEW.stock_rg, 0) > 0 THEN
          EXECUTE format('INSERT INTO %I.tienda_reingresos (producto_id, local_id) VALUES ($1, 1)', TG_TABLE_SCHEMA) USING pid;
        END IF;
        IF COALESCE(OLD.stock_ush, 0) <= 0 AND COALESCE(NEW.stock_ush, 0) > 0 THEN
          EXECUTE format('INSERT INTO %I.tienda_reingresos (producto_id, local_id) VALUES ($1, 2)', TG_TABLE_SCHEMA) USING pid;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'tienda_marcar_reingreso: %', SQLERRM;
      END;
      RETURN NEW;
    END $f$ LANGUAGE plpgsql`);
  for (const tabla of ['productos', 'producto_variantes']) {
    const existe = (await pool.query('SELECT to_regclass($1) AS t', [tabla])).rows[0].t;
    if (!existe) continue;
    const tiene = (await pool.query(`SELECT 1 FROM pg_trigger WHERE tgname = 'tienda_reingreso' AND tgrelid = $1::regclass`, [tabla])).rows.length;
    if (!tiene) await pool.query(`CREATE TRIGGER tienda_reingreso AFTER UPDATE OF stock_rg, stock_ush ON ${tabla} FOR EACH ROW EXECUTE FUNCTION tienda_marcar_reingreso()`);
  }
}

// Video de un producto: un link (YouTube, Vimeo o un archivo .mp4) o un video subido desde Lumiere
const VIDEO_MAX_MB = 25;
// Link de un reel o publicacion de Instagram -> su codigo (instagram.com/reel/ABC123/ -> ABC123)
function reelDeLink(url) {
  const m = /instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})/.exec(String(url || ''));
  return m ? m[1] : null;
}

// Link de un video de TikTok -> su numero. Los links cortos (vm.tiktok.com/...) se siguen hasta el largo.
async function tiktokDeLink(url) {
  let u = String(url || '').trim();
  const largo = (x) => { const m = /tiktok\.com\/(?:@[^/?#]+\/)?(?:video|v|embed(?:\/v2)?|player\/v1)\/(\d{8,25})/.exec(x); return m ? m[1] : null; };
  if (largo(u)) return largo(u);
  if (/^https?:\/\/(vm|vt|www)\.tiktok\.com\/(t\/)?[A-Za-z0-9]+\/?(\?.*)?$/.test(u)) {
    try {
      for (let i = 0; i < 3; i++) {
        const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } });
        const loc = r.headers.get('location');
        if (!loc) break;
        u = new URL(loc, u).href;
        if (!/^https:\/\/([a-z0-9-]+\.)*tiktok\.com\//.test(u)) break;
        if (largo(u)) return largo(u);
      }
    } catch (e) {}
  }
  return null;
}

// Manda un video guardado en la base por partes (Range), para que empiece a verse sin bajarlo entero
async function servirVideo(req, res, tabla, columnaId, id) {
  const r = (await pool.query(`SELECT ${tabla === 'tienda_reels' ? 'mime' : 'tipo'} AS tipo, octet_length(datos) AS largo FROM ${tabla} WHERE ${columnaId} = $1 AND datos IS NOT NULL`, [id])).rows[0];
  if (!r) return res.status(404).end();
  const largo = parseInt(r.largo);
  let desde = 0, hasta = largo - 1, parcial = false;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) {
    if (m[1]) { desde = parseInt(m[1]); if (m[2]) hasta = Math.min(parseInt(m[2]), largo - 1); }
    else { desde = Math.max(0, largo - parseInt(m[2])); }
    hasta = Math.min(hasta, desde + 2 * 1024 * 1024 - 1); // de a 2 MB
    if (desde >= largo || desde > hasta) return res.status(416).set('Content-Range', 'bytes */' + largo).end();
    parcial = true;
  }
  const d = (await pool.query(`SELECT substring(datos FROM $2 FOR $3) AS trozo FROM ${tabla} WHERE ${columnaId} = $1`, [id, desde + 1, hasta - desde + 1])).rows[0];
  res.status(parcial ? 206 : 200).set({
    'Content-Type': r.tipo, 'Accept-Ranges': 'bytes', 'Content-Length': String(d.trozo.length), 'Cache-Control': 'public, max-age=600',
    ...(parcial ? { 'Content-Range': 'bytes ' + desde + '-' + (desde + d.trozo.length - 1) + '/' + largo } : {}),
  }).send(d.trozo);
}

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

// Descuento por forma de pago, en % (entre 0 y 50)
const FORMAS_PAGO = ['mp', 'gocuotas', 'transferencia', 'retiro'];
function descuentosPagoDe(c) {
  const d = (c && c.descuentos_pago) || {};
  return Object.fromEntries(FORMAS_PAGO.map(k => { const n = Number(d[k]); return [k, Number.isFinite(n) ? Math.min(50, Math.max(0, Math.round(n * 100) / 100)) : 0]; }));
}

// Puntos por reseña (si no se configuro: prendido, 200 puntos y 100 mas con foto)
function puntosResenaDe(c) {
  const r = (c && c.resenas_puntos) || {};
  const ent = (x, d) => { const n = parseInt(x); return Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : d; };
  return { activo: r.activo !== false, puntos: ent(r.puntos, 200), extra_foto: ent(r.extra_foto, 100) };
}

async function leerConfig(db = pool) {
  await asegurar();
  const c = (await db.query('SELECT * FROM tienda_config WHERE id = 1')).rows[0];
  // Cada zona de envio sale del local de su ciudad (las zonas viejas, sin ciudad, del local de envio)
  const zonas = (c.envio_zonas || []).map(z => ({ ...z, local: Number(z.local || c.envio_local) === 2 ? 2 : 1 }));
  return { ...c, envio_zonas: zonas, envio_gratis_desde: c.envio_gratis_desde === null ? null : num(c.envio_gratis_desde) };
}

// Mueve stock de los items de un pedido: signo -1 aparta (descuenta), +1 devuelve
async function moverStock(db, pedido, signo) {
  const col = colLocal(pedido.local_id);
  // Apartar o devolver lo de un pedido no es "volvio a entrar stock" (db siempre esta en una transaccion)
  await db.query(`SELECT set_config('lumiere.sin_reingreso', '1', true)`);
  // Los items en preventa no tocan el stock: van sobre lo reservado de lo que viene en camino (ver reservarPreventa)
  const items = (await db.query('SELECT * FROM tienda_pedido_items WHERE pedido_id = $1 AND NOT preventa', [pedido.id])).rows;
  for (const it of items) {
    const delta = signo * it.cantidad;
    if (it.variante_id) {
      await db.query(`UPDATE producto_variantes SET ${col} = COALESCE(${col}, 0) + $1 WHERE id = $2`, [delta, it.variante_id]);
    } else {
      await db.query(`UPDATE productos SET ${col} = COALESCE(${col}, 0) + $1, stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) + $1 WHERE id = $2`, [delta, it.producto_id]);
    }
  }
}

// Preventa: suma (+1) o libera (-1) lo reservado sobre lo que viene en camino, para los items en preventa
async function reservarPreventa(db, pedido, signo) {
  const col = Number(pedido.local_id) === 2 ? 'reservado_ush' : 'reservado_rg';
  const items = (await db.query('SELECT producto_id, cantidad FROM tienda_pedido_items WHERE pedido_id = $1 AND preventa', [pedido.id])).rows;
  for (const it of items) await db.query(`UPDATE productos SET ${col} = GREATEST(COALESCE(${col}, 0) + $1, 0) WHERE id = $2`, [signo * it.cantidad, it.producto_id]);
  return items.length;
}
const PREVENTA_DEFECTO = { activo: false, titulo: 'Próximos a ingresar', incluir_no_publicados: true };
function preventaDe(c) {
  const p = (c && c.preventa) || {};
  return { activo: !!p.activo, titulo: String(p.titulo || '').trim().slice(0, 40) || PREVENTA_DEFECTO.titulo, incluir_no_publicados: p.incluir_no_publicados !== false };
}
// Disponible en un local: para vender ya (stock menos lo reservado por preventas, como en la caja)
// y en preventa (lo que viene en camino y nadie reservo todavia)
function disponibles(p, local) {
  const u = Number(local) === 2;
  const stock = parseInt(u ? p.stock_ush : p.stock_rg) || 0, transito = parseInt(u ? p.transito_ush : p.transito_rg) || 0, reservado = parseInt(u ? p.reservado_ush : p.reservado_rg) || 0;
  return { ya: Math.max(0, stock - reservado), preventa: Math.max(0, Math.min(transito, stock + transito - reservado)) };
}

// Cancela un pedido (y devuelve el stock si estaba apartado)
async function cancelar(id, motivo) {
  await cuponesLib.asegurar();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT * FROM tienda_pedidos WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!p || ['entregado', 'cancelado'].includes(p.estado)) { await client.query('ROLLBACK'); return false; }
    if (p.stock_apartado) await moverStock(client, p, +1);
    await reservarPreventa(client, p, -1);
    // El codigo de descuento vuelve a quedar disponible
    if (p.cupon && p.estado !== 'en_caja') {
      await client.query('UPDATE cupones SET usos = GREATEST(COALESCE(usos, 0) - 1, 0) WHERE codigo = $1', [p.cupon]);
      await cuponesLib.liberarPedido(client, p.id);
    }
    // Lo que se pago con gift card vuelve a su saldo
    if (num(p.gc_usado_monto) > 0 && p.gc_usado_id && p.estado !== 'en_caja') {
      const g = (await client.query('UPDATE gift_cards SET saldo = saldo + $1, estado = \'activa\' WHERE id = $2 RETURNING saldo', [num(p.gc_usado_monto), p.gc_usado_id])).rows[0];
      if (g) await client.query(`INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante) VALUES ($1, 'reintegro', $2, $3)`, [p.gc_usado_id, num(p.gc_usado_monto), g.saldo]);
    }
    await client.query(`UPDATE tienda_pedidos SET estado = 'cancelado', stock_apartado = FALSE, motivo = $1, actualizado_en = NOW() WHERE id = $2`, [motivo || null, id]);
    await client.query('COMMIT');
    return true;
  } catch (e) { try { await client.query('ROLLBACK'); } catch (x) {} throw e; } finally { client.release(); }
}

// Los pedidos sin pagar que pasaron su plazo se cancelan solos (se revisa en cada consulta)
// Mercado Pago: si la clienta pago pero cerro la pagina antes de volver a la tienda, el pago no se
// enteraba nunca (y el pedido se cancelaba por "vencido"). Aca se le pregunta a Mercado Pago.
// Como mucho una consulta por pedido por minuto (salvo forzar).
const consultasMP = new Map();
async function revisarPagoMP(p, forzar) {
  // Tambien los que se cancelaron solos por "vencidos" en los ultimos dias: si pagaron igual, hay que avisar
  const cancelado = p && p.estado === 'cancelado' && p.motivo === 'Venció sin pagar';
  if (!p || p.pago !== 'mp' || p.pagado || (p.estado !== 'pendiente_pago' && !cancelado)) return p;
  const k = schemaActual() + ':' + p.id;
  if (!forzar && Date.now() - (consultasMP.get(k) || 0) < 60000) return p;
  consultasMP.set(k, Date.now());
  try {
    const { ayudaMP } = require('../routes/mercadopago'); // aca adentro: evita la referencia circular
    await ayudaMP.asegurar();
    const tok = await ayudaMP.token();
    if (!tok) return p;
    const r = await ayudaMP.mp(tok, 'GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' + encodeURIComponent('tienda-' + p.codigo));
    const ok = ((r && r.results) || []).find(x => x.status === 'approved' && Math.abs(num(x.transaction_amount) - num(p.total)) < 0.01);
    if (!ok) return p;
    const pagadoEn = ok.date_approved ? new Date(ok.date_approved) : new Date();
    if (cancelado) return (await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, $3), pago_ref = $1,
      motivo = 'Pagó por Mercado Pago después de cancelarse: devolvele la plata o registrá la venta', actualizado_en = NOW() WHERE id = $2 AND estado = 'cancelado' RETURNING *`,
      [String(ok.id), p.id, isNaN(pagadoEn) ? new Date() : pagadoEn])).rows[0] || p;
    const pagado = (await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, $3), pago_ref = $1, estado = 'confirmado', vence_en = NULL, actualizado_en = NOW()
      WHERE id = $2 AND estado = 'pendiente_pago' RETURNING *`, [String(ok.id), p.id, isNaN(pagadoEn) ? new Date() : pagadoEn])).rows[0] || p;
    return pagado.tipo === 'giftcard' ? (await emitirGiftCard(pagado.id)) || pagado : pagado;
  } catch (e) { return p; } // sin respuesta de Mercado Pago: se vuelve a preguntar despues
}

async function vencerPendientes() {
  await asegurar();
  // Sin pagar (transferencia / Mercado Pago) o "paga al retirar" que no vino a buscarlo a tiempo
  const r = await pool.query(`SELECT * FROM tienda_pedidos WHERE vence_en IS NOT NULL AND vence_en < NOW()
    AND (estado = 'pendiente_pago' OR (pago = 'retiro' AND estado IN ('confirmado', 'preparado'))) LIMIT 50`);
  for (const x of r.rows) { try {
    // Antes de cancelar uno de Mercado Pago, se confirma que de verdad no pago
    if (x.pago === 'mp' && x.estado === 'pendiente_pago' && (await revisarPagoMP(x, true)).pagado) continue; await cancelar(x.id, x.pago === 'retiro' && x.estado !== 'pendiente_pago' ? 'No lo retiró a tiempo' : 'Venció sin pagar'); } catch (e) { console.error('[tienda] vencer:', e.message); } }
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
  // Se actualiza la fila del negocio (asi no se pierde su dominio propio)
  const r = await negocios.baseQuery(`UPDATE ${C}.tiendas SET slug = $1 WHERE negocio_id = $2`, [slug, negocioId]);
  if (!r.rowCount) await negocios.baseQuery(`INSERT INTO ${C}.tiendas (slug, negocio_id) VALUES ($1, $2)`, [slug, negocioId]);
  dominiosCache = null;
  return true;
}

const FOTOS_EXTRA_MAX = 8;
// "https://www.GirasolesBeauty.com.ar/algo" -> "girasolesbeauty.com.ar" (sin www); null si no es un dominio valido
function limpiarDominio(x) {
  const d = String(x || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#:]/)[0].replace(/^www\./, '').replace(/\.$/, '');
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d) ? d : null;
}
async function guardarDominio(negocioId, dominio) {
  await asegurarCentral();
  if (dominio) {
    const otro = await negocios.baseQuery(`SELECT negocio_id FROM ${C}.tiendas WHERE dominio = $1`, [dominio]);
    if (otro.rows.length && Number(otro.rows[0].negocio_id) !== Number(negocioId)) return false;
  }
  await negocios.baseQuery(`UPDATE ${C}.tiendas SET dominio = $1 WHERE negocio_id = $2`, [dominio || null, negocioId]);
  dominiosCache = null;
  return true;
}
async function dominioDe(negocioId) {
  await asegurarCentral();
  const r = await negocios.baseQuery(`SELECT dominio FROM ${C}.tiendas WHERE negocio_id = $1`, [negocioId]);
  return r.rows[0] ? r.rows[0].dominio : null;
}
// Todos los dominios propios (para saber que tienda mostrar y para permitirlos en el servidor). Se refresca cada 5 minutos.
let dominiosCache = null;
async function dominios() {
  if (dominiosCache && Date.now() - dominiosCache.t < 5 * 60 * 1000) return dominiosCache.m;
  await asegurarCentral();
  const r = await negocios.baseQuery(`SELECT slug, dominio FROM ${C}.tiendas WHERE dominio IS NOT NULL`);
  const m = new Map(r.rows.map(x => [x.dominio, x.slug]));
  dominiosCache = { t: Date.now(), m };
  return m;
}

// Segmentos elegidos a mano: { tipo: [...], piel: [...], necesidad: [...] }. Un grupo que no esta = automatico.
// null = todo automatico.
function limpiarEtiquetas(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const r = {};
  for (const k of ['tipo', 'piel', 'necesidad']) {
    if (!Array.isArray(e[k])) continue;
    r[k] = [...new Set(e[k].map(x => String(x)).filter(x => /^[a-z]{2,20}$/.test(x)))].slice(0, 15);
  }
  return Object.keys(r).length ? r : null;
}

// Link lindo de cada producto: "Limpiador Facial Espumoso" -> "limpiador-facial-espumoso".
// Si dos productos publicados se llaman igual, se le suma el numero ("...-503"). La tienda arma
// los links con la misma regla (twSlug en App.jsx).
function slugProducto(nombre) {
  const s = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
  return s || 'producto';
}
function slugsProductos(lista) {
  const cuenta = new Map();
  lista.forEach(p => { const b = slugProducto(p.nombre); cuenta.set(b, (cuenta.get(b) || 0) + 1); });
  return new Map(lista.map(p => { const b = slugProducto(p.nombre); return [p.id, cuenta.get(b) > 1 ? b + '-' + p.id : b]; }));
}

// ---- Ruleta de premios ----
// Al terminar una compra que supera el minimo, la clienta gira una vez. El premio lo elige el servidor
// (segun las chances de cada porcion). Los cupones ganados nacen apagados y se activan al entregar el
// pedido: si lo cancela, el premio no vale.
const RULETA_DEFECTO = {
  activo: false, minimo: 100000,
  premios: [
    { id: 'regalo', texto: 'REGALO', tipo: 'regalo', valor: 0, chance: 5 },
    { id: 'nada1', texto: 'Seguí participando', tipo: 'nada', valor: 0, chance: 22 },
    { id: 'off10', texto: '10% OFF', tipo: 'cupon', valor: 10, chance: 10 },
    { id: 'nada2', texto: 'Seguí participando', tipo: 'nada', valor: 0, chance: 22 },
    { id: 'off5', texto: '5% OFF', tipo: 'cupon', valor: 5, chance: 20 },
    { id: 'nada3', texto: 'Seguí participando', tipo: 'nada', valor: 0, chance: 20 },
    // sale en promedio 1 de cada 100 giros (2% de chance + nunca dos veces en 50 giros)
    { id: 'mega', texto: 'MEGA REGALO', tipo: 'regalo', valor: 0, chance: 2, cada: 50 },
  ],
};
function limpiarRuleta(r) {
  const b = r && typeof r === 'object' ? r : {};
  const vistos = new Set();
  const premios = (Array.isArray(b.premios) ? b.premios : []).slice(0, 12).map((x, i) => {
    const tipo = ['regalo', 'cupon', 'nada'].includes(x && x.tipo) ? x.tipo : 'nada';
    let id = /^[a-z0-9]{1,16}$/.test(String(x && x.id || '')) ? String(x.id) : 'p' + i;
    while (vistos.has(id)) id = id + 'x';
    vistos.add(id);
    return {
      id, tipo,
      texto: String(x && x.texto || '').trim().slice(0, 24) || (tipo === 'nada' ? 'Seguí participando' : tipo === 'regalo' ? 'REGALO' : 'Descuento'),
      valor: tipo === 'cupon' ? Math.min(90, Math.max(1, Math.round(num(x.valor)) || 5)) : 0,
      chance: Math.min(1000, Math.max(0, Math.round(num(x.chance)))),
      // tope opcional: como maximo 1 cada "cada" giros (ej: MEGA REGALO 1 cada 100). 0 = sin tope
      cada: Math.min(100000, Math.max(0, Math.round(num(x.cada)) || 0)),
    };
  });
  return { activo: !!b.activo, minimo: Math.max(1, Math.round(num(b.minimo)) || RULETA_DEFECTO.minimo), aviso_carrito: !!b.aviso_carrito, premios };
}
const ruletaDe = (c) => { const r = c && c.ruleta; return r && Array.isArray(r.premios) && r.premios.length >= 2 ? limpiarRuleta(r) : { ...RULETA_DEFECTO, activo: !!(r && r.activo) }; };
// bloqueados: ids que ya llegaron a su tope (no pueden salir en este giro)
function elegirPremio(todos, bloqueados = []) {
  const premios = todos.map(p => bloqueados.includes(p.id) ? { ...p, chance: 0 } : p);
  const total = premios.reduce((t, p) => t + p.chance, 0);
  if (total <= 0) return premios.find(p => p.tipo === 'nada') || premios[0];
  let n = crypto.randomInt(total);
  for (const p of premios) { if (n < p.chance) return p; n -= p.chance; }
  return premios[premios.length - 1];
}

module.exports = { ofertasDe, ofertaDiaActiva, descuentoCombos, firmaRegalo, firmaRegaloOk, regalosDe, temaRegaloHoy, emitirGiftCard, emitirGiftCardsPendientes, descuentosPagoDe, puntosResenaDe, revisarPagoMP, reservarPreventa, preventaDe, disponibles, ruletaDe, limpiarRuleta, elegirPremio, RULETA_DEFECTO, slugProducto, slugsProductos, limpiarEtiquetas, limpiarDominio, guardarDominio, dominioDe, dominios, revisarCupon, tiktokDeLink, reelDeLink, servirVideo, FOTOS_EXTRA_MAX, VIDEO_MAX_MB, videoDeLink, asegurar, leerConfig, moverStock, cancelar, vencerPendientes, negocioDeSlug, guardarSlug, colLocal, num };
