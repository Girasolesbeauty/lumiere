const crypto = require('crypto');
const cuponesLib = require('./cupones');
const pool = require('../config/database');
const negocios = require('./negocios');
const { porNegocio, schemaActual, negocioActual } = require('./contexto');

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
  // Descuento por forma de pago propio de los kits y combos (ej: 25% en transferencia); el resto usa descuentos_pago
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS descuentos_pago_kits JSONB`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_pago NUMERIC(14,2) NOT NULL DEFAULT 0`);
  // Promociones de Lumiere que valen en la tienda (ver promosTienda)
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_promo NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS promos TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_pago_pct NUMERIC(5,2)`);
  // Ofertas del dia y combos (ver ofertasDe); descuento de combos de cada pedido
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS ofertas JSONB`);
  // Rutinas armadas por el local (ver rutinasDe)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS rutinas JSONB`);
  // Misiones con puntos extra (ver lib/misiones.js)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS misiones JSONB`);
  // Invita a una amiga: codigo de cada clienta, descuento de la amiga en su primera compra y puntos para la que invito
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS referidos JSONB`);
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_amiga TEXT`);
  // Perfil de piel que la clienta guarda en su cuenta (o con el test de rutina): { piel, nec: [] }
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS perfil_piel JSONB`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS clientes_codigo_amiga_idx ON clientes (UPPER(codigo_amiga)) WHERE codigo_amiga IS NOT NULL`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS amiga_de INT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS descuento_amiga NUMERIC(14,2) NOT NULL DEFAULT 0`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_referidos (id SERIAL PRIMARY KEY, referente_id INT NOT NULL, referida_cliente_id INT, pedido_id INT NOT NULL UNIQUE, puntos INT NOT NULL DEFAULT 0, creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
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
  // Cambios de productos que se le hicieron a un pedido desde Lumiere (la clienta cambio uno por otro)
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS cambios JSONB`);
  // Si el pedido ya estaba pagado online y despues cambio el total: monto_online es lo que se pago online (el total
  // de antes) y pagos_extra lo que se cobro o devolvio aparte [{fecha, tipo: cobro|devolucion|credito, medio_pago_id, nombre, importe (+ cobrado / - devuelto), gc_codigo}]
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS monto_online NUMERIC(14,2)`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS pagos_extra JSONB`);
  // "No mostrar como nuevo": lo saca de Novedades (y de la etiqueta NUEVO) aunque se haya cargado hace menos de 30 dias
  await pool.query(`ALTER TABLE tienda_productos ADD COLUMN IF NOT EXISTS no_nuevo BOOLEAN NOT NULL DEFAULT FALSE`);
  // Numero de pedido corrido: el que ven y escriben las clientas (Pedido N° 18001). Arranca en 18001 en Girasoles y en 1001
  // en los demas negocios. El codigo al azar queda solo para el link del pedido, asi nadie ve pedidos ajenos probando numeros.
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS numero INT`);
  const desdeNro = Number((negocioActual() || {}).id) === 1 ? 18001 : 1001;
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS tienda_pedidos_numero_seq START ${desdeNro}`);
  if ((await pool.query(`SELECT 1 FROM tienda_pedidos WHERE numero IS NULL LIMIT 1`)).rows.length) {
    await pool.query(`UPDATE tienda_pedidos t SET numero = o.n FROM (
        SELECT id, (SELECT COALESCE(MAX(numero), $1 - 1) FROM tienda_pedidos) + ROW_NUMBER() OVER (ORDER BY id) AS n FROM tienda_pedidos WHERE numero IS NULL) o
      WHERE t.id = o.id`, [desdeNro]);
    await pool.query(`SELECT setval('tienda_pedidos_numero_seq', (SELECT MAX(numero) FROM tienda_pedidos))`);
  }
  await pool.query(`ALTER TABLE tienda_pedidos ALTER COLUMN numero SET DEFAULT nextval('tienda_pedidos_numero_seq')`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS tienda_pedidos_numero ON tienda_pedidos (numero)`);
  // Pagina de links para la bio de Instagram: WhatsApp, horarios y ubicacion de cada local (ver linksDe)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS links JSONB`);
  // Muestras gratis: en compras desde cierto monto la clienta elige una (ver muestrasDe); el pedido guarda cual
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS muestras JSONB`);
  // Regalo de cumpleaños: cupon personal que aparece en la cuenta de la clienta (ver regaloCumple)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS cumple JSONB`);
  // Retiro express: listo en N minutos en el horario que pone la tienda (el pedido guarda los minutos prometidos)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS express JSONB`);
  // Packs: llevando N o mas de una marca (o de ciertos productos), X% en todos (ver packsDe)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS packs JSONB`);
  // Horas para pagar con Mercado Pago o GoCuotas antes de que el pedido venza (antes eran 2 fijas)
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS horas_pago_online INT NOT NULL DEFAULT 24`);
  // Notas del local en un pedido (lo que la clienta no escribio): [{ id, texto, por, usuario_id, en }]. La clienta no las ve
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS notas_local JSONB`);
  // Pago rechazado por Mercado Pago o GoCuotas ("mp:<motivo>" / "gc:<estado>") y "ya le escribimos a la clienta"
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS pago_rechazo TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS pago_rechazo_en TIMESTAMP`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS contactado_en TIMESTAMP`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS contactado_por TEXT`);
  // Por que se vencio o se cancelo (lo anota la vendedora despues de hablar con la clienta): motivo de una lista + lo que dijo la clienta
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS venc_motivo TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS venc_nota TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS venc_por TEXT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS venc_en TIMESTAMP`);
  // Turnos de diagnostico de piel: la clienta reserva unos minutos gratis con una vendedora (ver diagnosticoDe).
  // Cuando la atienden, lo que le recomendaron queda en el turno y su tipo de piel en su perfil
  await pool.query(`ALTER TABLE tienda_config ADD COLUMN IF NOT EXISTS diagnostico JSONB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_turnos (id SERIAL PRIMARY KEY, cliente_id INT, nombre TEXT NOT NULL, telefono TEXT NOT NULL,
    local_id INT NOT NULL, fecha DATE NOT NULL, hora TEXT NOT NULL, piel TEXT, nec JSONB, nota TEXT, estado TEXT NOT NULL DEFAULT 'reservado',
    atendido_por TEXT, resultado TEXT, confirmado_en TIMESTAMP, creado_en TIMESTAMP NOT NULL DEFAULT NOW(), actualizado_en TIMESTAMP)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS tienda_turnos_fecha ON tienda_turnos (fecha, local_id)`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS express_min INT`);
  await pool.query(`ALTER TABLE tienda_pedidos ADD COLUMN IF NOT EXISTS muestra TEXT`);
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
// Invita a una amiga: { activo, pct (descuento de la amiga en su 1ra compra), puntos (para la que invito, cuando se entrega) }
function referidosDe(c) {
  const r = (c && c.referidos) || {};
  const pct = Math.round(num(r.pct)), pts = Math.round(num(r.puntos));
  return { activo: r.activo !== false, pct: pct >= 1 && pct <= 50 ? pct : 10, puntos: pts >= 0 && pts <= 100000 && r.puntos !== undefined && r.puntos !== null && r.puntos !== '' ? pts : 500 };
}
const soloDig = (x) => String(x || '').replace(/\D/g, '').slice(-8);
// Codigo para invitar de una clienta (se crea la primera vez: "SABRINA-4K7Q")
async function codigoAmiga(db, clienteId) {
  const c = (await db.query('SELECT nombre, codigo_amiga FROM clientes WHERE id = $1', [clienteId])).rows[0];
  if (!c) return null;
  if (c.codigo_amiga) return c.codigo_amiga;
  const base = (String(c.nombre || '').normalize('NFD').replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/)[0] || 'AMIGA').toUpperCase().slice(0, 8);
  for (let i = 0; i < 8; i++) {
    const cod = base + '-' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
    const r = await db.query('UPDATE clientes SET codigo_amiga = $1 WHERE id = $2 AND codigo_amiga IS NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE UPPER(codigo_amiga) = $1) RETURNING codigo_amiga', [cod, clienteId]).catch(() => ({ rows: [] }));
    if (r.rows.length) return r.rows[0].codigo_amiga;
    const ya = (await db.query('SELECT codigo_amiga FROM clientes WHERE id = $1', [clienteId])).rows[0];
    if (ya && ya.codigo_amiga) return ya.codigo_amiga;
  }
  return null;
}
// ¿Puede usar el regalo de la amiga? Tiene que ser su primera compra (ni pedidos web ni compras en el local) y no su propio codigo
async function amigaParaUsar(db, c, codigo, telefono, clienteId) {
  const cfg = referidosDe(c);
  if (!cfg.activo) return { error: 'El regalo de amiga no está disponible ahora' };
  const ref = (await db.query('SELECT id, nombre, telefono FROM clientes WHERE UPPER(codigo_amiga) = UPPER($1)', [String(codigo || '').trim().slice(0, 30)])).rows[0];
  if (!ref) return { error: 'Ese link de amiga no es válido' };
  const tel = soloDig(telefono);
  if ((clienteId && ref.id === clienteId) || (tel.length >= 6 && soloDig(ref.telefono) === tel)) return { error: 'Es tu propio link: compartilo con tus amigas 💛' };
  const prev = (await db.query(`SELECT 1 FROM tienda_pedidos WHERE estado <> 'cancelado' AND COALESCE(tipo, '') <> 'giftcard'
      AND (($1::int IS NOT NULL AND cliente_id = $1) OR ($2 <> '' AND RIGHT(regexp_replace(COALESCE(telefono, ''), '\\D', '', 'g'), 8) = $2)) LIMIT 1`, [clienteId || null, tel.length >= 6 ? tel : ''])).rows.length
    || (await db.query(`SELECT 1 FROM ventas v JOIN clientes cl ON cl.id = v.cliente_id WHERE COALESCE(v.anulada, FALSE) = FALSE
      AND (($1::int IS NOT NULL AND cl.id = $1) OR ($2 <> '' AND RIGHT(regexp_replace(COALESCE(cl.telefono, ''), '\\D', '', 'g'), 8) = $2)) LIMIT 1`, [clienteId || null, tel.length >= 6 ? tel : ''])).rows.length;
  if (prev) return { error: 'El regalo de amiga es para la primera compra' };
  return { referente_id: ref.id, nombre: String(ref.nombre || '').trim().split(/\s+/)[0] || 'Tu amiga', pct: cfg.pct };
}
// Cuando se entrega el pedido de la amiga, la que invito suma sus puntos (una sola vez por pedido)
async function premiarReferida(db, pedidoId) {
  const p = (await db.query(`SELECT id, amiga_de, cliente_id FROM tienda_pedidos WHERE id = $1 AND estado = 'entregado' AND amiga_de IS NOT NULL`, [pedidoId])).rows[0];
  if (!p) return null;
  const cfg = referidosDe(await leerConfig(db));
  const r = await db.query(`INSERT INTO tienda_referidos (referente_id, referida_cliente_id, pedido_id, puntos) VALUES ($1, $2, $3, $4) ON CONFLICT (pedido_id) DO NOTHING RETURNING id`, [p.amiga_de, p.cliente_id || null, p.id, cfg.puntos]);
  if (r.rows.length && cfg.puntos > 0) await db.query('UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2', [cfg.puntos, p.amiga_de]);
  return r.rows.length ? cfg.puntos : null;
}
// Rutinas recomendadas por el local: [{ id, titulo, autora, piel, texto, video_url, productos: [ids en orden], activo }]
const PIELES_RUT = ['grasa', 'seca', 'mixta', 'sensible', 'normal', 'todo'];
// Video de una rutina: Instagram, TikTok (link largo) o YouTube -> { tipo, codigo } (como los reels)
function videoRutina(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  const ig = reelDeLink(u); if (ig) return { tipo: 'instagram', codigo: ig };
  const tk = /tiktok\.com\/(?:@[^/?#]+\/)?(?:video|v)\/(\d{8,25})/.exec(u); if (tk) return { tipo: 'tiktok', codigo: tk[1] };
  const yt = videoDeLink(u); if (yt && yt.tipo === 'youtube') return { tipo: 'youtube', codigo: yt.id };
  return null;
}
function rutinasDe(c) {
  const l = Array.isArray(c && c.rutinas) ? c.rutinas : [];
  return l.slice(0, 20).map((x, i) => ({
    id: String(x.id || ('r' + Date.now().toString(36) + i)).replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'r' + i,
    titulo: String(x.titulo || '').trim().slice(0, 70) || 'Rutina',
    autora: String(x.autora || '').trim().slice(0, 40),
    piel: PIELES_RUT.includes(x.piel) ? x.piel : '',
    texto: String(x.texto || '').trim().slice(0, 600),
    video_url: String(x.video_url || '').trim().slice(0, 500),
    productos: [...new Set((Array.isArray(x.productos) ? x.productos : []).map(n => parseInt(n)).filter(n => n > 0))].slice(0, 10),
    activo: x.activo !== false,
  })).filter(x => x.productos.length >= 1);
}
function ofertasDe(c) {
  const o = (c && c.ofertas) || {};
  const d = o.dia || {};
  const fecha = (x) => { const t = x ? new Date(x) : null; return t && !isNaN(t) ? t.toISOString() : null; };
  const dia = { activo: !!d.activo, producto_id: parseInt(d.producto_id) || null, precio: Math.max(0, Math.round(num(d.precio))), hasta: fecha(d.hasta), titulo: String(d.titulo || '').trim().slice(0, 60) };
  const combos = (Array.isArray(o.combos) ? o.combos : []).slice(0, 20).map((x, i) => {
    const productos = [...new Set((Array.isArray(x.productos) ? x.productos : []).map(n => parseInt(n)).filter(n => n > 0))].slice(0, 6);
    // Cantidad de cada producto (si no se indica, 1). Ej: un kit de Lumiere con 2 del mismo producto.
    const cantidades = {};
    productos.forEach(id => { const n = Math.round(num(x.cantidades && x.cantidades[id])); if (n > 1) cantidades[id] = Math.min(n, 10); });
    return {
      id: String(x.id || ('c' + Date.now().toString(36) + i)).replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'c' + i,
      nombre: String(x.nombre || '').trim().slice(0, 60) || 'Combo',
      productos, cantidades, kit_id: parseInt(x.kit_id) || null,
      precio: Math.max(0, Math.round(num(x.precio))), activo: x.activo !== false,
      // Combo de un evento (ej. Cyber Monday): solo vale entre esas fechas (hora argentina)
      ...(/^\d{4}-\d{2}-\d{2}$/.test(x.desde || '') && /^\d{4}-\d{2}-\d{2}$/.test(x.hasta || '') ? { desde: x.desde, hasta: x.hasta } : {}),
    };
  }).filter(x => x.productos.reduce((s, id) => s + (x.cantidades[id] || 1), 0) >= 2);
  return { dia, combos };
}
// Combo activo y (si tiene fechas) dentro de ellas
function comboVigente(x) {
  if (!x || !x.activo) return false;
  if (!x.desde) return true;
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  return x.desde <= hoy && hoy <= x.hasta;
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
  let total = 0; const usados = []; const enCombos = {};
  // Precio del combo: el especial si se cargó (nunca más que la suma); sin precio (0) = precio de lista.
  // Un combo a precio de lista igual cuenta como combo (para el descuento de kits por forma de pago).
  ofertasDe(c).combos.filter(comboVigente).forEach(x => {
    const cant = (id) => (x.cantidades && x.cantidades[id]) || 1;
    const veces = Math.min(...x.productos.map(id => Math.floor((queda.get(id) || 0) / cant(id))));
    if (!(veces > 0)) return;
    const suma = x.productos.reduce((s, id) => s + (precio.get(id) || 0) * cant(id), 0);
    const precioCombo = x.precio > 0 ? Math.min(x.precio, suma) : suma;
    const ahorro = Math.max(0, suma - precioCombo);
    x.productos.forEach(id => { queda.set(id, queda.get(id) - veces * cant(id)); enCombos[id] = (enCombos[id] || 0) + veces * cant(id); });
    total += ahorro * veces; usados.push({ id: x.id, nombre: x.nombre, veces, ahorro: ahorro * veces, monto: precioCombo * veces });
  });
  return { descuento: Math.round(total * 100) / 100, combos: usados, enCombos };
}
function regalosDe(c) {
  const r = (c && c.regalos) || {};
  const ent = (x, d, max) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d; };
  const lista = (x, d) => { const l = [...new Set((Array.isArray(x) ? x : []).map(n => Math.round(Number(n))).filter(n => n >= 1000 && n <= 5000000))].sort((a, b) => a - b).slice(0, 8); return l.length ? l : d; };
  const minimo = ent(r.minimo, 5000, 5000000);
  return {
    // en_inicio: la franja grande en la portada (el boton del menu depende solo de activo)
    activo: r.activo !== false, en_inicio: r.en_inicio !== false, giftcards: r.giftcards !== false, armador: r.armador !== false, libre: r.libre !== false,
    montos: lista(r.montos, [10000, 20000, 30000, 50000, 100000]), minimo, maximo: Math.max(minimo, ent(r.maximo, 500000, 5000000)),
    presupuestos: lista(r.presupuestos, [20000, 35000, 50000, 100000, 200000, 300000]),
    tema: TEMAS_REGALO.includes(r.tema) ? r.tema : 'auto',
    titulo: String(r.titulo || '').trim().slice(0, 80), texto: String(r.texto || '').trim().slice(0, 200),
  };
}
// Pagina de links para Instagram (/links): por local, si se muestra, su WhatsApp, sus horarios (un renglon por dia
// o franja) y el link de Google Maps (si no hay, se busca la direccion); y hasta 6 botones extra
const linkWeb = (x) => { const u = String(x || '').trim().slice(0, 400); return /^https:\/\/[^\s<>"]+$/i.test(u) ? u : ''; };
function linksDe(c) {
  const l = (c && c.links) || {};
  const locales = {};
  for (const [id, x] of Object.entries(l.locales && typeof l.locales === 'object' ? l.locales : {})) {
    if (!/^\d+$/.test(id) || !x || typeof x !== 'object') continue;
    // WhatsApp en formato internacional de Argentina (549 + area + numero): sin el 0 del area; si falta el 54 se agrega
    let wa = String(x.whatsapp || '').replace(/\D/g, '').replace(/^0+/, '');
    if (wa && !wa.startsWith('54')) wa = '549' + wa; else if (/^54[1-8]\d{9}$/.test(wa)) wa = '549' + wa.slice(2);
    locales[id] = {
      mostrar: x.mostrar !== false, whatsapp: wa.length >= 8 && wa.length <= 15 ? wa : '',
      horarios: String(x.horarios || '').split('\n').map(r => r.trim().slice(0, 80)).filter(Boolean).slice(0, 8).join('\n'),
      mapa: linkWeb(x.mapa),
    };
  }
  const extras = (Array.isArray(l.extras) ? l.extras : []).map(x => ({ texto: String((x && x.texto) || '').trim().slice(0, 60), url: linkWeb(x && x.url) })).filter(x => x.texto && x.url).slice(0, 6);
  return { texto: String(l.texto || '').trim().slice(0, 200), locales, extras };
}
// Muestras gratis: desde un monto de productos la clienta elige una de la lista. Cada local tiene sus envases
// (se descuenta uno por pedido y vuelve si se cancela) y cada muestra dice en que locales hay tester de ese producto.
// Las listas viejas (solo texto) valen para todos los locales.
function muestrasDe(c) {
  const m = (c && c.muestras) || {};
  const envases = {};
  for (const [id, v] of Object.entries(m.envases && typeof m.envases === 'object' ? m.envases : {})) {
    if (/^\d+$/.test(id) && v !== '' && v !== null && v !== undefined) envases[id] = Math.max(0, Math.min(99999, parseInt(v) || 0));
  }
  const vistos = new Set();
  const opciones = (Array.isArray(m.opciones) ? m.opciones : []).map(x => {
    const o = typeof x === 'string' ? { nombre: x } : (x && typeof x === 'object' ? x : {});
    return { nombre: String(o.nombre || '').trim().slice(0, 80), producto_id: parseInt(o.producto_id) || null,
      locales: Array.isArray(o.locales) ? [...new Set(o.locales.map(Number).filter(n => Number.isInteger(n) && n > 0))] : null };
  }).filter(o => o.nombre && !vistos.has(o.nombre) && vistos.add(o.nombre)).slice(0, 12);
  return { activo: !!m.activo, desde: Math.max(0, Math.round(num(m.desde))), envases, opciones };
}
// Retiro express: minutos y franjas horarias (hora argentina). Cada franja tiene sus dias (1 = lunes ... 7 = domingo)
// y su local (0 = todos): asi entra el horario cortado (mañana y tarde) o un sabado distinto. Lo viejo (un solo
// horario desde/hasta con sus dias) queda como una franja.
const horaOk = (h, def) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h || '')) ? String(h) : def;
function expressDe(c) {
  const k = (c && c.express) || {};
  const lista = Array.isArray(k.franjas) ? k.franjas : [{ desde: k.desde, hasta: k.hasta, dias: k.dias }];
  const franjas = lista.map(f => ({
    desde: horaOk(f && f.desde, '10:00'), hasta: horaOk(f && f.hasta, '19:30'), local: [1, 2].includes(Number(f && f.local)) ? Number(f.local) : 0,
    dias: [...new Set((Array.isArray(f && f.dias) ? f.dias : [1, 2, 3, 4, 5, 6]).map(Number).filter(d => d >= 1 && d <= 7))].sort(),
  })).slice(0, 8);
  return { activo: !!k.activo, minutos: Math.max(10, Math.min(240, parseInt(k.minutos) || 30)), franjas };
}
// Diagnostico de piel: turnos de N minutos en las franjas que pone la tienda (mismo formato que el retiro express),
// con cupo por horario (cuantas vendedoras pueden atender a la vez) y hasta cuantos dias para adelante se puede reservar
const TITULO_DIAG = 'Diagnóstico de piel gratis';
const TEXTO_DIAG = 'Reservá unos minutos con una de nuestras chicas: te mira la piel, te arma la rutina y te explica cómo usar cada producto.';
function diagnosticoDe(c) {
  const k = (c && c.diagnostico) || {};
  const franjas = (Array.isArray(k.franjas) ? k.franjas : [{}]).map(f => ({
    desde: horaOk(f && f.desde, '10:00'), hasta: horaOk(f && f.hasta, '19:00'), local: [1, 2].includes(Number(f && f.local)) ? Number(f.local) : 0,
    dias: [...new Set((Array.isArray(f && f.dias) ? f.dias : [1, 2, 3, 4, 5, 6]).map(Number).filter(d => d >= 1 && d <= 7))].sort(),
  })).slice(0, 8);
  return { activo: !!k.activo, minutos: Math.max(10, Math.min(60, parseInt(k.minutos) || 20)), cupo: Math.max(1, Math.min(5, parseInt(k.cupo) || 1)),
    dias: Math.max(1, Math.min(30, parseInt(k.dias) || 14)), titulo: String(k.titulo || '').trim().slice(0, 60) || TITULO_DIAG,
    texto: String(k.texto || '').trim().slice(0, 300) || TEXTO_DIAG, franjas };
}
// Horarios libres de un local para los proximos dias: [{ fecha: 'AAAA-MM-DD', dia: 1..7, horas: ['10:00', ...] }].
// Hoy solo desde dentro de una hora; un horario se llena con `cupo` turnos que no esten cancelados ni ausentes
async function horariosDiagnostico(db, k, localId) {
  if (!k.activo) return [];
  const franjas = k.franjas.filter(f => !f.local || f.local === Number(localId));
  if (!franjas.length) return [];
  const ar = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const ahora = ar.getHours() * 60 + ar.getMinutes(), hoy = Date.UTC(ar.getFullYear(), ar.getMonth(), ar.getDate());
  const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const aHora = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const fechaDe = (i) => new Date(hoy + i * 864e5).toISOString().slice(0, 10);
  const ocupados = new Map((await db.query(`SELECT to_char(fecha, 'YYYY-MM-DD') || ' ' || hora AS k, COUNT(*)::int AS n FROM tienda_turnos
    WHERE local_id = $1 AND fecha >= $2::date AND estado NOT IN ('cancelado', 'ausente') GROUP BY 1`, [Number(localId), fechaDe(0)])).rows.map(r => [r.k, r.n]));
  const dias = [];
  for (let i = 0; i < k.dias; i++) {
    const fecha = fechaDe(i), dia = new Date(hoy + i * 864e5).getUTCDay() || 7;
    const horas = new Set();
    for (const f of franjas) {
      if (!f.dias.includes(dia)) continue;
      for (let m = aMin(f.desde); m + k.minutos <= aMin(f.hasta); m += k.minutos) {
        if (i === 0 && m < ahora + 60) continue;
        if ((ocupados.get(fecha + ' ' + aHora(m)) || 0) < k.cupo) horas.add(aHora(m));
      }
    }
    if (horas.size) dias.push({ fecha, dia, horas: [...horas].sort() });
  }
  return dias;
}
// Si ahora se puede prometer en ese local (o en alguno): dentro de una franja y con tiempo de prepararlo antes de que cierre
function expressAbierto(k, localId) {
  if (!k.activo) return false;
  const ar = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const dia = ar.getDay() || 7, min = ar.getHours() * 60 + ar.getMinutes();
  const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  return k.franjas.some(f => (!localId || !f.local || f.local === Number(localId)) && f.dias.includes(dia) && min >= aMin(f.desde) && min + k.minutos <= aMin(f.hasta));
}
// Hora en que tiene que estar listo: corre desde que se hizo (paga al retirar) o desde que se confirmo el pago
function listoExpress(p) {
  if (!p || !p.express_min) return null;
  const base = p.pago === 'retiro' ? p.creado_en : p.pagado ? (p.pagado_en || p.creado_en) : null;
  return base ? new Date(new Date(base).getTime() + p.express_min * 60000) : null;
}
// Regalo de cumpleaños: % o monto, desde unos dias antes hasta unos dias despues del cumple, con compra minima opcional
function cumpleDe(c) {
  const k = (c && c.cumple) || {};
  return { activo: !!k.activo, tipo: k.tipo === '$' ? '$' : '%', valor: Math.max(0, Math.min(k.tipo === '$' ? 9999999 : 100, num(k.valor))),
    antes: Math.max(0, Math.min(30, parseInt(k.antes) || 0)), dias: Math.max(1, Math.min(60, parseInt(k.dias) || 7)), minimo: Math.max(0, Math.round(num(k.minimo))) };
}
// Si hoy la clienta esta en su ventana de cumple, su cupon personal (se crea la primera vez que entra; uno por año)
async function regaloCumple(db, c, clienteId, soloVer) {
  const k = cumpleDe(c);
  if (!k.activo || !k.valor || !clienteId) return null;
  const f = (await db.query(`SELECT to_char(fecha_nacimiento, 'MM-DD') AS md FROM clientes WHERE id = $1 AND fecha_nacimiento IS NOT NULL`, [clienteId])).rows[0];
  if (!f) return null;
  const [mm, dd] = f.md.split('-').map(Number);
  const ar = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const hoy = Date.UTC(ar.getFullYear(), ar.getMonth(), ar.getDate()), DIA = 864e5;
  let anio = null, cumpleT = 0;
  for (const y of [ar.getFullYear() - 1, ar.getFullYear(), ar.getFullYear() + 1]) {
    const t = Date.UTC(y, mm - 1, Math.min(dd, new Date(Date.UTC(y, mm, 0)).getUTCDate())); // 29/2 en años no bisiestos: el 28
    if (hoy >= t - k.antes * DIA && hoy <= t + (k.dias - 1) * DIA) { anio = y; cumpleT = t; }
  }
  if (!anio) return null;
  await cuponesLib.asegurar();
  const vence = new Date(cumpleT + (k.dias - 1) * DIA).toISOString().slice(0, 10);
  let cu = (await db.query(`SELECT * FROM cupones WHERE cliente_id = $1 AND canal = 'Cumpleaños' AND codigo LIKE $2 ORDER BY id LIMIT 1`, [clienteId, 'CUMPLE' + anio + '-%'])).rows[0];
  if (!cu && soloVer) return { codigo: 'CUMPLE' + anio + '-····', tipo: k.tipo, valor: k.valor, vence, minimo: k.minimo, usado: false, hoy: hoy === cumpleT };
  if (!cu) cu = (await db.query(`INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, usos, max_usos, activo, fecha_vencimiento, cliente_id, descuento_monto_minimo)
      VALUES ($1, 'Regalo de cumpleaños', $2, $3, 'Cumpleaños', 0, 1, TRUE, $4, $5, $6) RETURNING *`,
    ['CUMPLE' + anio + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(), k.tipo, k.valor, vence, clienteId, k.minimo || null])).rows[0];
  return { codigo: cu.codigo, tipo: cu.tipo === '$' ? '$' : '%', valor: num(cu.valor), vence: cu.fecha_vencimiento ? new Date(cu.fecha_vencimiento).toISOString().slice(0, 10) : vence,
    minimo: num(cu.descuento_monto_minimo), usado: !!(cu.max_usos && (cu.usos || 0) >= cu.max_usos), hoy: hoy === cumpleT };
}
// En que locales se puede elegir cada muestra: donde hay tester y quedan envases
const localesMuestra = (m, o) => (o.locales || Object.keys(m.envases).map(Number)).filter(l => (m.envases[l] || 0) > 0);
// Un envase menos (o mas, si se cancela el pedido) en ese local. Devuelve si se pudo
async function moverEnvase(db, lid, delta) {
  const r = await db.query(`UPDATE tienda_config SET muestras = jsonb_set(muestras, ARRAY['envases', $1::text], to_jsonb(GREATEST(0, COALESCE((muestras->'envases'->>$1::text)::int, 0) + $2::int)))
    WHERE id = 1 AND jsonb_typeof(muestras->'envases') = 'object' AND COALESCE((muestras->'envases'->>$1::text)::int, 0) + $2::int >= 0 RETURNING id`, [String(lid), delta]);
  return r.rows.length > 0;
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
  const general = { tema: 'general', fecha: null, faltan: null };
  if (r.tema === 'general') return general;
  // Elegida a mano: se ve hasta que pasa la fecha; despues la tienda vuelve sola a Regalos (no queda "Dia de la Madre" todo el año)
  if (r.tema !== 'auto') { const f = fechaFestejo(r.tema, ar.getUTCFullYear()), x = con(r.tema); return f !== null && f < hoy && x.faltan === null ? general : x; }
  // Automatico: las semanas antes de cada fecha
  for (const [t, dias] of [['madre', 21], ['padre', 18], ['navidad', 24], ['enamorados', 14]]) { const x = con(t); if (x.faltan !== null && x.faltan <= dias) return x; }
  return { tema: 'general', fecha: null, faltan: null };
}

// Emite en Lumiere la gift card de un pedido de gift card ya pagado (una sola vez). Entra a la caja del
// local elegido como venta de gift card, el dia que se acredito el pago. Devuelve el pedido actualizado.
async function emitirGiftCard(pedidoId) {
  const gcFactura = require('./giftCardFactura');
  await gcFactura.asegurar();
  const client = await pool.connect();
  let gcId = null;
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
    const forma = p.pago === 'mp' ? 'Mercado Pago (tienda web)' : p.pago === 'gocuotas' ? 'GoCuotas (tienda web)' : 'Transferencia (tienda web)';
    // Modalidad nueva: se factura al venderla (ver lib/giftCardFactura.js)
    const gc = (await client.query(`INSERT INTO gift_cards (codigo, monto_inicial, saldo, beneficiario_nombre, beneficiario_telefono, cliente_id, comprador_nombre, estado, local_id, mensaje, factura_al_emitir, forma_pago)
      VALUES ($1, $2, $2, $3, $4, $5, $6, 'activa', $7, $8, TRUE, $9) RETURNING id`, [codigo, monto, p.gc_para || p.nombre, p.gc_para_tel || null, p.cliente_id || null, p.nombre, p.local_id || 1, p.gc_mensaje || null, forma])).rows[0];
    gcId = gc.id;
    await client.query(`INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante) VALUES ($1, 'emision', $2, $2)`, [gc.id, monto]);
    await client.query(`INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id, forma_pago, creado_en) VALUES ($1, 'I', $2, $3, $4, $5, COALESCE($6, NOW()))`,
      ['Gift Card ' + codigo + ' (tienda web)', monto, codigo, p.local_id || 1, forma, p.pagado_en]);
    const r = (await client.query(`UPDATE tienda_pedidos SET gc_codigo = $1, estado = 'entregado', vence_en = NULL, actualizado_en = NOW() WHERE id = $2 RETURNING *`, [codigo, p.id])).rows[0];
    await client.query('COMMIT');
    // La factura va aparte: si ARCA falla, la gift card ya esta emitida y la factura se reintenta
    gcFactura.facturar(gcId).catch(() => {});
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
function descuentosPagoKitsDe(c) {
  const d = (c && c.descuentos_pago_kits) || {};
  return Object.fromEntries(FORMAS_PAGO.map(k => { const n = Number(d[k]); return [k, Number.isFinite(n) ? Math.min(60, Math.max(0, Math.round(n * 100) / 100)) : 0]; }));
}
// Promociones de Lumiere (Clientes > Promociones) que valen tambien en la tienda online: las de tipo "Descuento %"
// marcadas "También en la tienda online", activas y vigentes. "Solo con este medio de pago": transferencia = pagando
// con transferencia; efectivo = paga al retirar (débito y crédito son del local: esas promos no van a la tienda).
const PROMO_PAGO = { transferencia: 'transferencia', efectivo: 'retiro' };
const promosLista = require('./contexto').porNegocio(false);
async function promosTienda(db = pool) {
  try {
    if (!promosLista.get()) {
      if (!(await pool.query(`SELECT to_regclass('promociones') AS t`)).rows[0].t) return [];
      await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS en_tienda BOOLEAN NOT NULL DEFAULT FALSE');
      promosLista.set(true);
    }
    await pool.query('ALTER TABLE promociones ADD COLUMN IF NOT EXISTS local_id INT').catch(() => {});
    const r = await db.query(`SELECT id, nombre, valor, aplica_a, productos_ids, categorias, medio_pago_tipo, local_id FROM promociones
      WHERE activo AND en_tienda AND tipo = 'descuento' AND valor > 0
        AND (fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE) AND (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)`);
    return r.rows.filter(x => !x.medio_pago_tipo || PROMO_PAGO[x.medio_pago_tipo]).map(x => ({
      id: x.id, nombre: x.nombre, pct: Math.min(90, Math.max(0, num(x.valor))), aplica_a: x.aplica_a || 'todo',
      productos: (x.productos_ids || []).map(Number), categorias: x.categorias || [], pago: x.medio_pago_tipo ? PROMO_PAGO[x.medio_pago_tipo] : null, local: x.local_id || null,
    }));
  } catch (e) { console.error('[tienda] promos:', e.message); return []; }
}
// La mejor promo para un producto con esa forma de pago (no se suman entre si)
function promoDe(promos, prod, pago) {
  let mejor = null;
  (promos || []).forEach(p => {
    if (p.pago && p.pago !== pago) return;
    const aplica = p.aplica_a === 'todo' || (p.aplica_a === 'productos' && p.productos.includes(prod.id)) || (p.aplica_a === 'categorias' && p.categorias.includes(prod.categoria));
    if (aplica && (!mejor || p.pct > mejor.pct)) mejor = p;
  });
  return mejor;
}
// Packs: "llevá 3 de esta marca y tenés 15%". Se arman en Lumiere > Tienda online > Ofertas y combos, por marca y/o productos
function packsDe(c) {
  return (Array.isArray(c && c.packs) ? c.packs : []).map(p => ({
    id: String((p && p.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 20) || crypto.randomBytes(4).toString('hex'),
    nombre: String((p && p.nombre) || '').trim().slice(0, 60), activo: p && p.activo !== false,
    marcas: [...new Set((Array.isArray(p && p.marcas) ? p.marcas : []).map(m => String(m || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 20),
    productos: [...new Set((Array.isArray(p && p.productos) ? p.productos : []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 200),
    cantidad: Math.max(2, Math.min(20, parseInt(p && p.cantidad) || 3)), pct: Math.max(1, Math.min(70, num(p && p.pct) || 10)),
  })).filter(p => p.nombre && (p.marcas.length || p.productos.length)).slice(0, 20);
}
const enPack = (pk, l) => pk.productos.includes(Number(l.producto_id)) || (!!l.marca && pk.marcas.some(m => m.toLowerCase() === String(l.marca).trim().toLowerCase()));
// Descuento de promos de un pedido (lineas sin preventa y sin lo que ya entro en un combo). Lo que no tiene promo
// puede entrar en un pack (el de mayor % primero; cada producto en uno solo). Tampoco se suman al descuento por forma de pago.
function descuentoPromos(promos, lineas, enCombos, pago, packs) {
  const libres = { ...(enCombos || {}) };
  let descuento = 0, monto = 0; const usadas = new Set(), resto = [];
  lineas.filter(l => !l.preventa).forEach(l => {
    const enCombo = Math.min(libres[l.producto_id] || 0, l.cantidad);
    libres[l.producto_id] = (libres[l.producto_id] || 0) - enCombo;
    const u = l.cantidad - enCombo;
    if (u <= 0) return;
    const pr = promoDe(promos, { id: l.producto_id, categoria: l.categoria }, pago);
    if (!pr) { resto.push({ l, u }); return; }
    monto += u * l.precio; descuento += u * l.precio * pr.pct / 100; usadas.add(pr.nombre);
  });
  const tomadas = new Set();
  (packs || []).filter(pk => pk.activo).sort((a, b) => b.pct - a.pct).forEach(pk => {
    const its = resto.filter(x => !tomadas.has(x) && enPack(pk, x.l));
    if (its.reduce((t, x) => t + x.u, 0) < pk.cantidad) return;
    its.forEach(x => { tomadas.add(x); monto += x.u * x.l.precio; descuento += x.u * x.l.precio * pk.pct / 100; });
    usadas.add(pk.nombre);
  });
  return { descuento: Math.round(descuento), monto, nombres: [...usadas] };
}
// Descuento por la forma de pago: los kits/combos del pedido llevan su porcentaje (si se configuro) y el resto el general.
// base = productos menos combos, cupon y amiga; montoKits = lo que suman los combos armados (a su precio de combo).
function descuentoPagoTotal(c, pago, base, montoKits) {
  const pct = descuentosPagoDe(c)[pago] || 0, pctK = descuentosPagoKitsDe(c)[pago] || 0;
  if (!pctK) return { descuento: pct ? Math.round(base * pct / 100) : 0, pct, pctKits: 0 };
  const enKits = Math.max(0, Math.min(base, montoKits || 0)), resto = Math.max(0, base - enKits);
  return { descuento: Math.round(enKits * pctK / 100 + resto * pct / 100), pct, pctKits: enKits > 0 ? pctK : 0 };
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
    // El envase de la muestra gratis vuelve al local
    if (p.muestra && p.estado !== 'en_caja') await moverEnvase(client, p.local_id, +1);
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
    if (!ok) {
      // Intento rechazado (tarjeta sin fondos, el banco no lo autorizo...): queda anotado para la pestaña "Pagos rechazados"
      const rech = ((r && r.results) || []).find(x => ['rejected', 'cancelled'].includes(x.status));
      if (rech && !p.pago_rechazo) return (await pool.query(`UPDATE tienda_pedidos SET pago_rechazo = $1, pago_rechazo_en = NOW() WHERE id = $2 AND NOT pagado RETURNING *`,
        ['mp:' + String(rech.status_detail || rech.status).slice(0, 60), p.id])).rows[0] || p;
      return p;
    }
    const pagadoEn = ok.date_approved ? new Date(ok.date_approved) : new Date();
    if (cancelado) return (await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, $3), pago_ref = $1,
      motivo = 'Pagó por Mercado Pago después de cancelarse: devolvele la plata o registrá la venta', actualizado_en = NOW() WHERE id = $2 AND estado = 'cancelado' RETURNING *`,
      [String(ok.id), p.id, isNaN(pagadoEn) ? new Date() : pagadoEn])).rows[0] || p;
    const pagado = (await pool.query(`UPDATE tienda_pedidos SET pagado = TRUE, pagado_en = COALESCE(pagado_en, $3), pago_ref = $1, estado = 'confirmado', vence_en = NULL, actualizado_en = NOW()
      WHERE id = $2 AND estado = 'pendiente_pago' RETURNING *`, [String(ok.id), p.id, isNaN(pagadoEn) ? new Date() : pagadoEn])).rows[0] || p;
    return pagado.tipo === 'giftcard' ? (await emitirGiftCard(pagado.id)) || pagado : pagado;
  } catch (e) { return p; } // sin respuesta de Mercado Pago: se vuelve a preguntar despues
}

// Horas para pagar online (Mercado Pago / GoCuotas) antes de que venza el pedido
const horasPagoOnline = (c) => Math.min(168, Math.max(1, parseInt(c && c.horas_pago_online) || 24));
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

// Segmentos elegidos a mano: { linea: [...], tipo: [...], piel: [...], necesidad: [...], cabello: [...], aroma: [...] }. Un grupo que no esta = automatico.
// null = todo automatico.
function limpiarEtiquetas(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const r = {};
  for (const k of ['tipo', 'piel', 'necesidad', 'ingrediente', 'cabello', 'aroma', 'linea']) {
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

module.exports = { comboVigente, diagnosticoDe, horariosDiagnostico, horasPagoOnline, packsDe, expressDe, expressAbierto, listoExpress, cumpleDe, regaloCumple, muestrasDe, localesMuestra, moverEnvase, videoRutina, rutinasDe, referidosDe, codigoAmiga, amigaParaUsar, premiarReferida, ofertasDe, ofertaDiaActiva, descuentoCombos, firmaRegalo, firmaRegaloOk, regalosDe, linksDe, temaRegaloHoy, emitirGiftCard, emitirGiftCardsPendientes, descuentosPagoDe, descuentosPagoKitsDe, descuentoPagoTotal, promosTienda, promoDe, descuentoPromos, puntosResenaDe, revisarPagoMP, reservarPreventa, preventaDe, disponibles, ruletaDe, limpiarRuleta, elegirPremio, RULETA_DEFECTO, slugProducto, slugsProductos, limpiarEtiquetas, limpiarDominio, guardarDominio, dominioDe, dominios, revisarCupon, tiktokDeLink, reelDeLink, servirVideo, FOTOS_EXTRA_MAX, VIDEO_MAX_MB, videoDeLink, asegurar, leerConfig, moverStock, cancelar, vencerPendientes, negocioDeSlug, guardarSlug, colLocal, num };
