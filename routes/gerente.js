// ✨ Tu gerente: junta los numeros de todo el negocio (ventas, plata, stock, clientes, equipo)
// y con eso arma la mejora continua (corto / mediano / largo plazo), responde preguntas guiadas
// y le da contexto al chat con IA. Reusa los mismos calculos que Finanzas, Rotacion y Toma de
// decisiones, asi los numeros coinciden en todo el sistema.
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk').default;
const pool = require('../config/database');
const { porNegocio, schemaActual } = require('../lib/contexto');
const fin = require('../controllers/finanzasController');
const prod = require('../controllers/productosController');
const { VENTA_VALIDA } = require('../lib/niveles');
const { cargarMoneda, plata } = require('../lib/moneda');

const router = express.Router();

// ---------- utilidades ----------
const n = (x) => parseFloat(x) || 0;
const $ = (v) => plata(v);
const pct = (v) => (Math.round(n(v) * 10) / 10).toLocaleString('es-AR') + '%';
const localNumDe = (q) => (q === '2' || q === 'ush' ? 2 : q === '1' || q === 'rg' ? 1 : null);
const localTxt = (num) => (num === 1 ? 'rg' : num === 2 ? 'ush' : 'consolidado');
// Llama a un controlador existente y devuelve lo que responde (o null si falla)
const llamar = (fn, query) => new Promise((resolve) => {
  try {
    fn({ query, params: {}, body: {} }, { json: (d) => resolve(d), status: () => ({ json: () => resolve(null) }) });
  } catch (e) { resolve(null); }
});
const q1 = async (sql, params = []) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return []; } };

// ---------- resumen de todo el negocio (cache corto por local) ----------
const cache = new Map();
async function resumenNegocio(localQ) {
  await cargarMoneda();
  const localNum = localNumDe(String(localQ || ''));
  const clave = schemaActual() + ':' + String(localNum); // por negocio y por local
  const c = cache.get(clave);
  if (c && Date.now() - c.t < 2 * 60 * 1000) return c.data;

  const filtroV = localNum !== null ? `AND v.local_id = ${localNum}` : '';
  const colStock = localNum === 2 ? 'stock_ush' : localNum === 1 ? 'stock_rg' : 'stock';
  const VV = VENTA_VALIDA;

  const [analisis, base, rotacion, ventasDia, vendedoras, horas, clientes, operacion, controlInv] = await Promise.all([
    llamar(fin.getAnalisisFinanciero, { local_id: localTxt(localNum) }),
    llamar(fin.getBaseDecisiones, { local_id: localTxt(localNum) }),
    llamar(prod.getRotacion, { local_id: localNum ? String(localNum) : '', dias: '90' }),
    // Este mes hasta hoy vs el mismo tramo del mes pasado
    q1(`SELECT
          COALESCE(SUM(v.total) FILTER (WHERE v.creado_en >= date_trunc('month', NOW())), 0) AS mes_total,
          COUNT(*) FILTER (WHERE v.creado_en >= date_trunc('month', NOW())) AS mes_cant,
          COALESCE(SUM(v.total) FILTER (WHERE v.creado_en >= date_trunc('month', NOW()) - INTERVAL '1 month'
                     AND v.creado_en < NOW() - INTERVAL '1 month'), 0) AS ant_total,
          COUNT(*) FILTER (WHERE v.creado_en >= date_trunc('month', NOW()) - INTERVAL '1 month'
                     AND v.creado_en < NOW() - INTERVAL '1 month') AS ant_cant,
          EXTRACT(DAY FROM NOW())::int AS dia, EXTRACT(DAY FROM (date_trunc('month', NOW()) + INTERVAL '1 month - 1 day'))::int AS dias_mes
        FROM ventas v WHERE ${VV} ${filtroV} AND v.creado_en >= date_trunc('month', NOW()) - INTERVAL '1 month'`),
    q1(`SELECT COALESCE(u.nombre, 'Sin asignar') AS nombre, COUNT(*) AS ventas, SUM(v.total) AS total
        FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
        WHERE ${VV} ${filtroV} AND v.creado_en >= date_trunc('month', NOW())
        GROUP BY 1 ORDER BY 3 DESC LIMIT 8`),
    q1(`SELECT EXTRACT(ISODOW FROM v.creado_en)::int AS dow, EXTRACT(HOUR FROM v.creado_en)::int AS hora, COUNT(*) AS cant, SUM(v.total) AS total
        FROM ventas v WHERE ${VV} ${filtroV} AND v.creado_en >= NOW() - INTERVAL '60 days' GROUP BY 1, 2`),
    q1(`WITH g AS (SELECT c.id, c.nombre, c.telefono, c.fecha_nacimiento, c.creado_en,
                     (SELECT MAX(v.creado_en) FROM ventas v WHERE v.cliente_id = c.id AND ${VV}) AS ultima,
                     (SELECT COUNT(*) FROM ventas v WHERE v.cliente_id = c.id AND ${VV}) AS compras,
                     (SELECT COALESCE(SUM(v.total), 0) FROM ventas v WHERE v.cliente_id = c.id AND ${VV}) AS gastado
                   FROM clientes c)
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE ultima >= NOW() - INTERVAL '90 days') AS activos,
               COUNT(*) FILTER (WHERE compras > 0 AND ultima < NOW() - INTERVAL '90 days') AS recuperar,
               COUNT(*) FILTER (WHERE fecha_nacimiento IS NOT NULL AND EXTRACT(MONTH FROM fecha_nacimiento) = EXTRACT(MONTH FROM NOW())) AS cumple,
               COUNT(*) FILTER (WHERE creado_en >= date_trunc('month', NOW())) AS nuevos,
               COUNT(*) FILTER (WHERE compras = 1) AS una_compra,
               COUNT(*) FILTER (WHERE compras > 0) AS con_compras,
               COALESCE(json_agg(json_build_object('nombre', nombre, 'telefono', telefono, 'gastado', gastado, 'ultima', ultima)
                 ORDER BY gastado DESC) FILTER (WHERE compras > 0 AND ultima < NOW() - INTERVAL '90 days'), '[]') AS para_recuperar
        FROM g`),
    q1(`SELECT
          (SELECT COUNT(*) FROM pedidos_clientas p JOIN productos pr ON pr.id = p.producto_id
             WHERE p.estado = 'esperando' AND p.avisado = FALSE AND COALESCE(pr.${colStock}, 0) > 0) AS pedidos_listos,
          (SELECT COUNT(*) FROM canjes_premios WHERE estado = 'pendiente') AS premios_pendientes,
          (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND COALESCE(costo, 0) <= 0 AND COALESCE(${colStock}, 0) > 0) AS sin_costo,
          (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND COALESCE(${colStock}, 0) < 0) AS stock_negativo,
          (SELECT COALESCE(comisiones_activo, TRUE) FROM configuracion_negocio WHERE id = 1) AS comisiones_activo`),
    q1(`SELECT finalizado_en, items_correctos, items_faltantes, items_sobrantes, valor_faltante
        FROM controles_inventario WHERE estado = 'finalizado' ${localNum ? 'AND local_id = ' + localNum : ''} ORDER BY finalizado_en DESC LIMIT 1`),
  ]);

  // Ventas del mes
  const vd = ventasDia[0] || {};
  const mesTotal = n(vd.mes_total), antTotal = n(vd.ant_total), mesCant = n(vd.mes_cant), antCant = n(vd.ant_cant);
  const ventas = {
    mes_hasta_hoy: mesTotal, mismo_tramo_mes_pasado: antTotal,
    variacion_pct: antTotal > 0 ? (mesTotal - antTotal) / antTotal * 100 : null,
    cantidad: mesCant, cantidad_mes_pasado: antCant,
    ticket: mesCant > 0 ? mesTotal / mesCant : 0, ticket_mes_pasado: antCant > 0 ? antTotal / antCant : 0,
    proyeccion_mes: n(vd.dia) > 0 ? mesTotal / n(vd.dia) * n(vd.dias_mes) : 0,
    dia: n(vd.dia), dias_mes: n(vd.dias_mes),
  };
  // Mejor dia de la semana y franja horaria (ultimos 60 dias)
  const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const porDia = {}, porHora = {};
  horas.forEach(h => { porDia[h.dow] = (porDia[h.dow] || 0) + n(h.total); porHora[h.hora] = (porHora[h.hora] || 0) + n(h.cant); });
  const mejorDia = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];
  const peorDia = Object.entries(porDia).sort((a, b) => a[1] - b[1])[0];
  const mejorHora = Object.entries(porHora).sort((a, b) => b[1] - a[1])[0];
  const cl = clientes[0] || {};
  const op = operacion[0] || {};
  const ctrl = controlInv[0] || null;
  const contadosCtrl = ctrl ? n(ctrl.items_correctos) + n(ctrl.items_faltantes) + n(ctrl.items_sobrantes) : 0;
  const pe = rotacion && rotacion.por_estado ? rotacion.por_estado : {};

  const data = {
    local: localNum ? (localNum === 1 ? 'local 1' : 'local 2') : 'todos los locales',
    analisis, base, rotacion,
    ventas,
    patrones: {
      mejor_dia: mejorDia ? DIAS[mejorDia[0]] : null, peor_dia: peorDia ? DIAS[peorDia[0]] : null,
      mejor_hora: mejorHora ? Number(mejorHora[0]) : null,
    },
    vendedoras: vendedoras.map(v => ({ nombre: v.nombre, ventas: n(v.ventas), total: n(v.total) })),
    clientes: {
      total: n(cl.total), activos_90: n(cl.activos), para_recuperar: n(cl.recuperar), cumple_mes: n(cl.cumple), nuevos_mes: n(cl.nuevos),
      una_sola_compra: n(cl.una_compra), con_compras: n(cl.con_compras),
      top_para_recuperar: (cl.para_recuperar || []).slice(0, 5),
    },
    operacion: {
      pedidos_listos: n(op.pedidos_listos), premios_pendientes: n(op.premios_pendientes), sin_costo: n(op.sin_costo),
      stock_negativo: n(op.stock_negativo), comisiones_activo: op.comisiones_activo !== false,
    },
    stock: {
      valor: rotacion ? n(rotacion.valor_total) : 0,
      parado: n(pe.parado && pe.parado.valor_costo), lento: n(pe.lento && pe.lento.valor_costo),
      parado_productos: n(pe.parado && pe.parado.productos), lento_productos: n(pe.lento && pe.lento.productos),
      reponer: rotacion ? n(rotacion.reponer) : 0,
      clases: rotacion ? rotacion.clases : [],
      ultimo_control: ctrl ? { fecha: ctrl.finalizado_en, exactitud: contadosCtrl ? Math.round(n(ctrl.items_correctos) / contadosCtrl * 100) : null, faltante: n(ctrl.valor_faltante) } : null,
    },
  };
  cache.set(clave, { t: Date.now(), data });
  return data;
}

// ---------- Mejora continua: acciones concretas por plazo ----------
function armarMejoras(r) {
  const a = [];
  const add = (x) => a.push(x);
  const an = r.analisis, b = r.base && r.base.suficiente ? r.base : null, st = r.stock, cl = r.clientes, op = r.operacion, v = r.ventas;
  const ticket = v.ticket || (b ? b.ventas_mes / Math.max(1, b.cantidad_ventas_mes) : 0);
  const metrica = (nombre) => an && an.metricas ? an.metricas.find(m => m.nombre.startsWith(nombre)) : null;

  // ----- Corto plazo: esta semana -----
  if (st.reponer > 0) add({ clave: 'reponer', plazo: 'corto', area: 'Stock', titulo: `Reponé ${st.reponer} producto${st.reponer > 1 ? 's' : ''} que se venden y se están por agotar`, detalle: 'Son productos A o B: si se agotan, perdés ventas seguras.', impacto: 'Evitás perder ventas', ir: 'compras', prioridad: 1 });
  if (op.pedidos_listos > 0) add({ clave: 'pedidos', plazo: 'corto', area: 'Clientes', titulo: `Avisale a ${op.pedidos_listos} cliente${op.pedidos_listos > 1 ? 's' : ''} que llegó lo que esperaba${op.pedidos_listos > 1 ? 'n' : ''}`, detalle: 'Es una venta casi segura: el mensaje de WhatsApp ya está escrito.', impacto: ticket ? '≈ ' + $(op.pedidos_listos * ticket) + ' en ventas' : 'Ventas recuperadas', ir: 'pedidos', prioridad: 1 });
  if (op.premios_pendientes > 0) add({ clave: 'premios', plazo: 'corto', area: 'Clientes', titulo: `Entregá ${op.premios_pendientes} premio${op.premios_pendientes > 1 ? 's' : ''} canjeado${op.premios_pendientes > 1 ? 's' : ''} en el portal`, detalle: 'Un premio entregado rápido hace que el cliente vuelva a sumar puntos.', impacto: 'Clientes más fieles', ir: 'portal', prioridad: 2 });
  if (cl.para_recuperar > 0) add({ clave: 'recuperar', plazo: 'corto', area: 'Clientes', titulo: `Escribile a ${Math.min(cl.para_recuperar, 10)} de los ${cl.para_recuperar} clientes que hace más de 90 días no vuelven`, detalle: 'Empezá por los que más gastaron. Un mensaje personal con una novedad o un beneficio suele traer de vuelta a 1 de cada 5. La lista con el WhatsApp listo está en Postventa → Recuperar clientes.', impacto: ticket ? '≈ ' + $(Math.min(cl.para_recuperar, 10) * 0.2 * ticket) + ' en ventas' : 'Ventas recuperadas', ir: 'postventa:recuperar_inactivos', prioridad: 2 });
  if (cl.cumple_mes > 0) add({ clave: 'cumples', plazo: 'corto', area: 'Clientes', titulo: `Saludá a los ${cl.cumple_mes} clientes que cumplen años este mes`, detalle: 'Un saludo con un regalito o un descuento de cumpleaños es de los mensajes que más vuelven en ventas.', impacto: 'Visitas al local', ir: 'clients', prioridad: 3 });
  if (op.sin_costo > 0) add({ clave: 'costos', plazo: 'corto', area: 'Plata', titulo: `Cargá el costo de ${op.sin_costo} producto${op.sin_costo > 1 ? 's' : ''}`, detalle: 'Sin el costo, el sistema no puede decirte cuánto ganás ni qué te conviene: los análisis quedan incompletos.', impacto: 'Números confiables', ir: 'inventory', prioridad: 2 });
  if (op.stock_negativo > 0) add({ clave: 'negativo', plazo: 'corto', area: 'Stock', titulo: `Contá ${op.stock_negativo} producto${op.stock_negativo > 1 ? 's que figuran' : ' que figura'} con stock negativo`, detalle: 'Se vendió algo que el sistema no tenía: falta cargar un ingreso o hay un error de stock.', impacto: 'Stock confiable', ir: 'inventory', prioridad: 2 });
  const diasCtrl = st.ultimo_control ? Math.floor((Date.now() - new Date(st.ultimo_control.fecha).getTime()) / 86400000) : null;
  if (diasCtrl === null || diasCtrl > 30) add({ clave: 'control', plazo: 'corto', area: 'Stock', titulo: diasCtrl === null ? 'Hacé tu primer control de inventario, aunque sea de una categoría' : `Hace ${diasCtrl} días que no controlás el stock: hacé un conteo corto`, detalle: 'Con el celular, una categoría lleva pocos minutos y te dice si el stock del sistema es real.', impacto: 'Detectás faltantes a tiempo', ir: 'control-inv', prioridad: 3 });

  // ----- Mediano plazo: este mes -----
  const quieta = st.parado + st.lento;
  if (quieta > 0) add({ clave: 'liquidar', plazo: 'mediano', area: 'Stock', titulo: `Liquidá parte de los ${$(quieta)} en mercadería lenta o parada`, detalle: `Son ${st.parado_productos + st.lento_productos} productos. Una promo hasta el descuento que todavía recupera el costo libera plata para comprar lo que se vende.`, impacto: 'Liberás hasta ' + $(quieta) + ' · ahorrás ≈ ' + $(quieta * 0.25 / 12) + '/mes en costo de tenerla', ir: 'rotacion', prioridad: 2 });
  if (b && b.comisiones_pct > 2.5) add({ clave: 'tarjeta', plazo: 'mediano', area: 'Plata', titulo: `Negociá la tasa de la tarjeta (hoy pagás ${pct(b.comisiones_pct)} en comisiones)`, detalle: 'Con el volumen que facturás, bancos y procesadoras (Naranja X, Payway, Mercado Pago) suelen bajarla si se lo pedís con números.', impacto: '≈ ' + $(b.ventas_mes * 0.005) + '/mes por cada medio punto', ir: 'decisiones', prioridad: 3 });
  const varM = metrica('Costos variables');
  if (b && (varM ? varM.estado !== 'bien' : true) && b.proveedores_compras && b.proveedores_compras.length) {
    const compras = b.proveedores_compras.reduce((s, p) => s + n(p.por_mes), 0);
    if (compras > 0) add({ clave: 'proveedores', plazo: 'mediano', area: 'Plata', titulo: `Pedile un 3% de descuento a tus proveedores principales`, detalle: `Comprás ≈ ${$(compras)} por mes. Pagando en término o en efectivo, un 3% es un pedido razonable. En Toma de decisiones → Bajar costos está el mensaje listo.`, impacto: '≈ ' + $(compras * 0.03) + '/mes', ir: 'decisiones', prioridad: 2 });
  }
  if (b && b.bajo_margen && b.bajo_margen.length) add({ clave: 'margen', plazo: 'mediano', area: 'Plata', titulo: `Revisá el precio de ${b.bajo_margen.length} producto${b.bajo_margen.length > 1 ? 's' : ''} que se venden mucho pero dejan poco margen`, detalle: b.bajo_margen.slice(0, 3).map(x => `${x.nombre} (${pct(x.margen_pct)})`).join(', ') + '. Simulá una suba en Toma de decisiones antes de hacerla.', impacto: 'Más ganancia por venta', ir: 'decisiones', prioridad: 2 });
  if (v.variacion_pct !== null && v.variacion_pct < -5) add({ clave: 'ventas-bajan', plazo: 'mediano', area: 'Ventas', titulo: `Las ventas vienen ${pct(Math.abs(v.variacion_pct))} abajo del mes pasado`, detalle: v.ticket < v.ticket_mes_pasado ? 'Bajó el ticket promedio: ofrecé un producto extra en cada venta (los desafíos del POS ayudan).' : 'Vinieron menos clientes: activá postventa y avisos a clientes que no vuelven.', impacto: 'Recuperar el ritmo del mes', ir: v.ticket < v.ticket_mes_pasado ? 'comisiones' : 'postventa', prioridad: 1 });
  if (cl.con_compras > 10 && cl.una_sola_compra / cl.con_compras > 0.5) add({ clave: 'una-compra', plazo: 'mediano', area: 'Clientes', titulo: `${Math.round(cl.una_sola_compra / cl.con_compras * 100)}% de tus clientes compró una sola vez`, detalle: 'En Postventa → Recuperar clientes tenés la lista de quiénes son, con un WhatsApp listo para cada uno. Preguntar cómo le fue con lo que compró trae segundas compras.', impacto: 'Más clientes que vuelven', ir: 'postventa:recuperar', prioridad: 2 });
  if (!op.comisiones_activo) add({ clave: 'comisiones', plazo: 'mediano', area: 'Equipo', titulo: 'Activá comisiones o desafíos para tu equipo', detalle: 'Cuando vender más les cambia algo, ofrecen ese producto extra. La comisión se paga con las ventas que genera.', impacto: 'Ticket promedio más alto', ir: 'comisiones', prioridad: 3 });

  // ----- Largo plazo: 3 a 6 meses -----
  const fijosM = metrica('Costos fijos');
  if (fijosM && fijosM.estado !== 'bien') add({ clave: 'fijos', plazo: 'largo', area: 'Plata', titulo: `Bajá el peso de los costos fijos (hoy son ${pct(fijosM.valor)} de lo que vendés)`, detalle: 'Lo sano para un comercio es hasta 15-25%. Dos caminos: vender más con el mismo local, o renegociar el alquiler cuando se renueva el contrato.', impacto: 'Más margen cada mes', ir: 'finance', prioridad: 2 });
  if (an && an.margen_neto_pct < 8) add({ clave: 'rentabilidad', plazo: 'largo', area: 'Plata', titulo: `Armá un plan para llegar a 15% de margen neto (hoy ${pct(an.margen_neto_pct)})`, detalle: 'Combiná: precios revisados en los productos con poco margen, menos mercadería parada y costos fijos bajo control. En Toma de decisiones → Llegar a una ganancia ves cuánto vender por día.', impacto: 'Un negocio que gana de verdad', ir: 'decisiones', prioridad: 1 });
  const C = (st.clases || []).find(x => x.clase === 'C');
  if (C && C.valor_pct > 35) add({ clave: 'surtido', plazo: 'largo', area: 'Stock', titulo: `Achicá el surtido de productos C (tienen ${pct(C.valor_pct)} de tu plata y venden ${pct(C.ventas_pct)})`, detalle: 'No recompres lo que casi no rota y usá esa plata en los productos A, que sostienen el negocio.', impacto: 'Capital que rinde más', ir: 'rotacion', prioridad: 2 });
  if (st.ultimo_control && st.ultimo_control.exactitud !== null && st.ultimo_control.exactitud < 90) add({ clave: 'exactitud', plazo: 'largo', area: 'Stock', titulo: `Llevá la exactitud del stock del ${st.ultimo_control.exactitud}% a más del 95%`, detalle: 'Un control por categoría cada semana, cargar siempre los ingresos y anotar las roturas en el momento. En pocos meses el stock del sistema se vuelve confiable.', impacto: st.ultimo_control.faltante ? 'Faltó ' + $(st.ultimo_control.faltante) + ' en el último control' : 'Menos faltantes', ir: 'control-inv', prioridad: 2 });
  if (cl.total > 20 && cl.activos_90 / cl.total < 0.4) add({ clave: 'fidelizar', plazo: 'largo', area: 'Clientes', titulo: `Armá una base de clientes fieles (hoy solo ${Math.round(cl.activos_90 / cl.total * 100)}% compró en los últimos 90 días)`, detalle: 'Premios en el portal, niveles y mensajes de postventa: que cada compra sume para la próxima.', impacto: 'Ventas más estables', ir: 'portal', prioridad: 3 });
  a.sort((x, y) => (x.prioridad || 9) - (y.prioridad || 9));
  return a;
}

const tablaLista = porNegocio(false);
async function asegurarTabla() {
  if (tablaLista.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gerente_acciones (clave TEXT PRIMARY KEY, estado TEXT NOT NULL, actualizado TIMESTAMP DEFAULT NOW(), usuario_nombre TEXT)`);
  // "Ahora no": hasta cuando queda pospuesta
  await pool.query('ALTER TABLE gerente_acciones ADD COLUMN IF NOT EXISTS hasta TIMESTAMP');
  // Historial: cuando aparecio cada mejora y cuando dejo de aparecer (se resolvio)
  await pool.query(`CREATE TABLE IF NOT EXISTS gerente_historial (
    id SERIAL PRIMARY KEY,
    clave TEXT NOT NULL,
    local TEXT NOT NULL DEFAULT '',
    titulo TEXT,
    area TEXT,
    aparecio_en TIMESTAMP NOT NULL DEFAULT NOW(),
    visto_en TIMESTAMP NOT NULL DEFAULT NOW(),
    resuelto_en TIMESTAMP,
    como TEXT)`);
  await pool.query('CREATE INDEX IF NOT EXISTS gerente_historial_abierto ON gerente_historial (clave, local) WHERE resuelto_en IS NULL');
  tablaLista.set(true);
}

router.get('/mejoras', async (req, res) => {
  try {
    const r = await resumenNegocio(req.query.local_id);
    const acciones = armarMejoras(r);
    let estados = {};
    try {
      await asegurarTabla();
      (await pool.query('SELECT * FROM gerente_acciones')).rows.forEach(e => { estados[e.clave] = e; });
    } catch (e) {}
    const conEstado = acciones.map(x => {
      const e = estados[x.clave];
      // Lo marcado como hecho o descartado vuelve a aparecer a los 30 dias si el problema sigue;
      // lo pospuesto ("Ahora no"), cuando vence la fecha elegida
      const vigente = e && (e.estado === 'pospuesto' ? e.hasta && new Date(e.hasta).getTime() > Date.now() : Date.now() - new Date(e.actualizado).getTime() < 30 * 86400000);
      return { ...x, estado: vigente ? e.estado : 'pendiente', marcado_en: vigente ? e.actualizado : null, hasta: vigente && e.estado === 'pospuesto' ? e.hasta : null };
    });
    // Historial: lo que aparece se anota; lo que estaba y ya no aparece, se resolvio
    let resueltas = [];
    try {
      const ln = localNumDe(String(req.query.local_id || ''));
      const loc = ln === null ? 'todos' : String(ln); // 'rg' y '1' son el mismo local
      const claves = acciones.map(x => x.clave);
      const abiertas = (await pool.query('SELECT * FROM gerente_historial WHERE resuelto_en IS NULL AND local = $1', [loc])).rows;
      for (const h of abiertas) {
        if (!claves.includes(h.clave)) {
          await pool.query(`UPDATE gerente_historial SET resuelto_en = NOW(), como = $1 WHERE id = $2`, [estados[h.clave] && estados[h.clave].estado === 'hecho' ? 'hecho' : 'solo', h.id]);
        }
      }
      for (const x of acciones) {
        const ya = abiertas.find(h => h.clave === x.clave);
        if (ya) await pool.query('UPDATE gerente_historial SET visto_en = NOW(), titulo = $1 WHERE id = $2', [x.titulo, ya.id]);
        else await pool.query('INSERT INTO gerente_historial (clave, local, titulo, area) VALUES ($1,$2,$3,$4)', [x.clave, loc, x.titulo, x.area]);
      }
      resueltas = (await pool.query(`SELECT clave, titulo, area, aparecio_en, resuelto_en, como FROM gerente_historial
        WHERE resuelto_en IS NOT NULL AND local = $1 AND resuelto_en > NOW() - INTERVAL '180 days' ORDER BY resuelto_en DESC LIMIT 50`, [loc])).rows;
    } catch (e) { console.error('[gerente] historial:', e.message); }
    res.json({ acciones: conEstado, resueltas, generado: new Date().toISOString() });
  } catch (e) { console.error(e); res.status(500).json({ error: 'No se pudo armar la mejora continua: ' + e.message }); }
});

router.put('/mejoras/:clave', async (req, res) => {
  try {
    await asegurarTabla();
    const estado = ['hecho', 'descartado', 'pospuesto', 'pendiente'].includes(req.body.estado) ? req.body.estado : 'pendiente';
    const dias = Math.min(180, Math.max(1, parseInt(req.body.dias) || 7));
    const hasta = estado === 'pospuesto' ? new Date(Date.now() + dias * 86400000) : null;
    if (estado === 'pendiente') await pool.query('DELETE FROM gerente_acciones WHERE clave = $1', [req.params.clave]);
    else await pool.query(`INSERT INTO gerente_acciones (clave, estado, usuario_nombre, hasta) VALUES ($1, $2, $3, $4)
      ON CONFLICT (clave) DO UPDATE SET estado = EXCLUDED.estado, actualizado = NOW(), usuario_nombre = EXCLUDED.usuario_nombre, hasta = EXCLUDED.hasta`, [req.params.clave, estado, req.body.usuario_nombre || null, hasta]);
    res.json({ ok: true, estado, hasta });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Preguntas guiadas: se responden con los numeros, sin IA ----------
const PREGUNTAS = [
  { id: 'mes', icono: '📅', texto: '¿Cómo viene este mes?' },
  { id: 'ventas', icono: '📉', texto: '¿Por qué cambiaron mis ventas?' },
  { id: 'ganancia', icono: '💰', texto: '¿Cuánto estoy ganando?' },
  { id: 'equilibrio', icono: '⚖️', texto: '¿Cuánto tengo que vender para cubrir los costos?' },
  { id: 'empujar', icono: '🚀', texto: '¿Qué productos conviene empujar?' },
  { id: 'liquidar', icono: '🧊', texto: '¿Qué me conviene liquidar?' },
  { id: 'clientes', icono: '📞', texto: '¿A qué clientes debería escribirles?' },
  { id: 'equipo', icono: '👥', texto: '¿Cómo viene el equipo?' },
  { id: 'cuando', icono: '🕐', texto: '¿Qué día y a qué hora se vende más?' },
  { id: 'plata', icono: '🧾', texto: '¿En qué se me va la plata?' },
];
router.get('/preguntas', (req, res) => res.json(PREGUNTAS));

function responder(id, r) {
  const v = r.ventas, an = r.analisis, b = r.base && r.base.suficiente ? r.base : null, st = r.stock, cl = r.clientes;
  const L = [];
  switch (id) {
    case 'mes': {
      L.push(`Llevás vendido **${$(v.mes_hasta_hoy)}** en ${v.dia} días (${v.cantidad} ventas, ticket promedio ${$(v.ticket)}).`);
      if (v.variacion_pct !== null) L.push(`Contra el mismo tramo del mes pasado (${$(v.mismo_tramo_mes_pasado)}) vas **${v.variacion_pct >= 0 ? '+' : ''}${pct(v.variacion_pct)}**.`);
      L.push(`A este ritmo cerrarías el mes en **≈ ${$(v.proyeccion_mes)}**.`);
      if (b && b.punto_equilibrio) L.push(v.proyeccion_mes >= b.punto_equilibrio ? `✅ Eso supera tu punto de equilibrio (${$(b.punto_equilibrio)}): el mes cerraría con ganancia.` : `⚠️ Tu punto de equilibrio es ${$(b.punto_equilibrio)}: te faltarían ≈ ${$(b.punto_equilibrio - v.proyeccion_mes)}, unos ${$((b.punto_equilibrio - v.proyeccion_mes) / Math.max(1, v.dias_mes - v.dia))} más por día de acá a fin de mes.`);
      return { texto: L.join('\n\n'), ir: 'finance' };
    }
    case 'ventas': {
      if (v.variacion_pct === null) return { texto: 'Todavía no hay ventas del mes pasado para comparar.', ir: 'dashboard' };
      const varCant = v.cantidad_mes_pasado > 0 ? (v.cantidad - v.cantidad_mes_pasado) / v.cantidad_mes_pasado * 100 : null;
      const varTicket = v.ticket_mes_pasado > 0 ? (v.ticket - v.ticket_mes_pasado) / v.ticket_mes_pasado * 100 : null;
      L.push(`Contra el mismo tramo del mes pasado, las ventas ${v.variacion_pct >= 0 ? 'subieron' : 'bajaron'} **${pct(Math.abs(v.variacion_pct))}**. Se explica por dos cosas:`);
      if (varCant !== null) L.push(`- **Cantidad de ventas:** ${v.cantidad} contra ${v.cantidad_mes_pasado} (${varCant >= 0 ? '+' : ''}${pct(varCant)}). ${varCant < -5 ? 'Vinieron menos clientes.' : varCant > 5 ? 'Vinieron más clientes.' : 'Casi igual.'}`);
      if (varTicket !== null) L.push(`- **Ticket promedio:** ${$(v.ticket)} contra ${$(v.ticket_mes_pasado)} (${varTicket >= 0 ? '+' : ''}${pct(varTicket)}). ${varTicket < -5 ? 'Cada cliente llevó menos.' : varTicket > 5 ? 'Cada cliente llevó más.' : 'Casi igual.'}`);
      if (v.variacion_pct < 0) L.push(varCant !== null && varTicket !== null && varCant < varTicket ? '💡 El problema es que vino menos gente: escribile a los clientes que no vuelven y usá los avisos de Pedidos.' : '💡 El problema es el ticket: ofrecé un producto extra en cada venta. Los desafíos del Punto de Venta ayudan a tu equipo.');
      return { texto: L.join('\n'), ir: 'dashboard' };
    }
    case 'ganancia': {
      if (!an) return { texto: 'No pude calcular la ganancia todavía.', ir: 'finance' };
      L.push(`Este mes, con ${$(an.ingresos_mes)} de ingresos, el resultado es **${$(an.resultado_neto_mes)}**: un margen neto de **${pct(an.margen_neto_pct)}**.`);
      L.push(`La salud del mes es **${an.puntaje}/100**. ${an.margen_neto_pct >= 15 ? 'Es un margen muy sano.' : an.margen_neto_pct >= 8 ? 'Es un margen aceptable; hay lugar para mejorar.' : 'El margen está bajo: mirá la pestaña Mejora continua.'}`);
      if (b) L.push(`En promedio de los últimos meses cerrados ganás ≈ **${$(b.ganancia_mes)} por mes**.`);
      return { texto: L.join('\n\n'), ir: 'finance' };
    }
    case 'equilibrio': {
      if (!b || !b.punto_equilibrio) return { texto: b === null ? (r.base && r.base.motivo) || 'Todavía no hay datos suficientes.' : 'Faltan cargar los gastos fijos para calcularlo.', ir: 'finance' };
      L.push(`Tus costos fijos son ≈ **${$(b.costos_fijos)} por mes** (alquiler, servicios, sueldos, impuestos y administrativos).`);
      L.push(`De cada venta te queda ${pct(b.margen_contribucion_pct)} para cubrirlos, así que tenés que vender **${$(b.punto_equilibrio)} por mes**, unos **${$(b.punto_equilibrio / 30)} por día**.`);
      L.push(`Este mes llevás ${$(v.mes_hasta_hoy)}: ${v.mes_hasta_hoy >= b.punto_equilibrio ? '✅ ya lo pasaste, lo que vendas de acá en adelante es ganancia.' : `te faltan ${$(b.punto_equilibrio - v.mes_hasta_hoy)}.`}`);
      return { texto: L.join('\n\n'), ir: 'finance' };
    }
    case 'empujar': {
      const prods = (r.rotacion && r.rotacion.productos) || [];
      const cand = prods.filter(p => p.stock > 0 && p.precio > 0 && p.costo > 0 && (p.estado === 'normal' || p.estado === 'lento' || p.estado === 'nuevo'))
        .map(p => ({ ...p, margen: (p.precio - p.costo) / p.precio * 100 })).filter(p => p.margen >= 40)
        .sort((x, y) => y.margen * y.stock - x.margen * x.stock).slice(0, 5);
      if (!cand.length) return { texto: 'No encontré productos con buen margen y stock para empujar. Revisá que los productos tengan el costo cargado.', ir: 'rotacion' };
      L.push('Estos productos **dejan buen margen y tenés stock**, pero no se venden tan rápido. Ofrecerlos, ponerlos a la vista o sumarlos a una promo te deja más ganancia:');
      cand.forEach(p => L.push(`- **${p.nombre}**: margen ${pct(p.margen)}, ${p.stock} en stock${p.dias_stock ? ', ' + p.dias_stock + ' días de stock' : ''}.`));
      return { texto: L.join('\n'), ir: 'rotacion' };
    }
    case 'liquidar': {
      const prods = ((r.rotacion && r.rotacion.productos) || []).filter(p => p.estado === 'parado' || p.estado === 'lento').sort((x, y) => y.valor_costo - x.valor_costo).slice(0, 5);
      if (!prods.length) return { texto: '🎉 No tenés mercadería parada ni lenta. ¡Muy bien!', ir: 'rotacion' };
      L.push(`Tenés **${$(st.parado + st.lento)}** en mercadería lenta o parada. Los que más plata inmovilizan:`);
      prods.forEach(p => L.push(`- **${p.nombre}**: ${$(p.valor_costo)} a costo${p.descuento_max > 0 ? `, podés liquidarlo hasta **${p.descuento_max}% off** sin perder` : ''}.`));
      L.push('\n💡 Simulá la promo en Toma de decisiones → Promociones antes de lanzarla.');
      return { texto: L.join('\n'), ir: 'rotacion' };
    }
    case 'clientes': {
      L.push(`Tenés ${cl.total} clientes: ${cl.activos_90} compraron en los últimos 90 días y **${cl.para_recuperar} no vuelven hace más de 90 días**.`);
      if (cl.top_para_recuperar.length) {
        L.push('Empezá por los que más gastaron:');
        cl.top_para_recuperar.forEach(c => L.push(`- **${c.nombre}**: gastó ${$(c.gastado)}${c.telefono ? ' · ' + c.telefono : ''}`));
      }
      if (cl.cumple_mes) L.push(`\n🎂 Además, **${cl.cumple_mes}** cumplen años este mes: un saludo con un beneficio los trae de vuelta.`);
      return { texto: L.join('\n'), ir: 'clients' };
    }
    case 'equipo': {
      if (!r.vendedoras.length) return { texto: 'Todavía no hay ventas este mes.', ir: 'productividad' };
      const tot = r.vendedoras.reduce((s, x) => s + x.total, 0);
      L.push('Ventas de este mes por persona:');
      r.vendedoras.forEach(x => L.push(`- **${x.nombre}**: ${$(x.total)} (${Math.round(x.total / Math.max(1, tot) * 100)}%) en ${x.ventas} ventas, ticket ${$(x.total / Math.max(1, x.ventas))}`));
      const t = r.vendedoras.map(x => ({ ...x, tk: x.total / Math.max(1, x.ventas) })).sort((a, z) => z.tk - a.tk);
      if (t.length > 1) L.push(`\n💡 ${t[0].nombre} tiene el ticket más alto. Que comparta cómo ofrece productos extra puede subir el de todo el equipo.`);
      return { texto: L.join('\n'), ir: 'productividad' };
    }
    case 'cuando': {
      const p = r.patrones;
      if (!p.mejor_dia) return { texto: 'Todavía no hay ventas suficientes en los últimos 60 días.', ir: 'dashboard' };
      L.push(`En los últimos 60 días, el día que más vendés es el **${p.mejor_dia}** y el que menos, el **${p.peor_dia}**.`);
      if (p.mejor_hora !== null) L.push(`La hora con más ventas es entre las **${p.mejor_hora} y las ${p.mejor_hora + 1} hs**.`);
      L.push(`💡 Reforzá el equipo en los momentos fuertes, y usá el día más flojo para reponer, hacer controles de stock o lanzar una promo que traiga gente.`);
      return { texto: L.join('\n\n'), ir: 'dashboard' };
    }
    case 'plata': {
      if (!an) return { texto: 'No pude calcularlo todavía.', ir: 'finance' };
      L.push(`De cada $100 que entran este mes:`);
      an.metricas.filter(m => !m.nombre.startsWith('Margen')).forEach(m => L.push(`- **${m.nombre.split(' (')[0]}**: ${pct(m.valor)} ${m.estado === 'bien' ? '✅' : m.estado === 'regular' ? '🟡' : '🔴'}`));
      L.push(`- **Te queda de ganancia**: ${pct(an.margen_neto_pct)}`);
      const peor = an.metricas.filter(m => !m.nombre.startsWith('Margen') && m.estado !== 'bien').sort((x, y) => x.puntaje - y.puntaje)[0];
      if (peor) L.push(`\n💡 Donde más conviene trabajar: **${peor.nombre.split(' (')[0]}**. ${peor.comentario}`);
      return { texto: L.join('\n'), ir: 'finance' };
    }
    default: return { texto: 'No conozco esa pregunta.', ir: null };
  }
}

router.get('/preguntas/:id', async (req, res) => {
  try {
    const r = await resumenNegocio(req.query.local_id);
    res.json(responder(req.params.id, r));
  } catch (e) { console.error(e); res.status(500).json({ error: 'No pude responder: ' + e.message }); }
});

// ---------- Chat libre con IA (usa los numeros del negocio como contexto) ----------
let clienteIA = null;
const obtenerIA = () => { if (!process.env.ANTHROPIC_API_KEY) return null; if (!clienteIA) clienteIA = new Anthropic(); return clienteIA; };
const USOS = new Map();
const permitido = (ip) => {
  const ahora = Date.now();
  const lista = (USOS.get(ip) || []).filter(t => ahora - t < 60 * 60 * 1000);
  if (lista.length >= 20) { USOS.set(ip, lista); return false; }
  lista.push(ahora); USOS.set(ip, lista); return true;
};
router.get('/chat/estado', (req, res) => res.json({ disponible: !!process.env.ANTHROPIC_API_KEY }));

const INSTRUCCIONES = `Sos "Lumiere, tu gerente": el gerente de un comercio minorista que conoce todos sus números. Hablás en español rioplatense (vos), claro, cálido y directo, como un gerente con experiencia en gestión, logística y finanzas de comercios.
Reglas:
- Basate SOLO en los datos del negocio que te paso abajo (JSON). Si algo no está en los datos, decilo con honestidad y explicá en qué sección de Lumiere se puede ver o cargar.
- No inventes números. Cuando des una cifra, que salga de los datos (podés hacer cuentas simples con ellos y mostrar cómo).
- Respondé breve: 2 a 6 frases o una lista corta. Terminá, cuando sirva, con 1 a 3 acciones concretas y la sección de Lumiere donde hacerlas (Rotación, Toma de decisiones, Clientes, Postventa WA, Compras y proveedores, Control de Inventario, Finanzas, Comisiones).
- Si te piden una decisión grande (contratar, subir precios, una promo), sugerí simularla en Toma de decisiones.
- Para temas impositivos o legales puntuales, dá una orientación general y recomendá consultar al contador.
- Solo hablás del negocio. Si preguntan otra cosa, respondé amablemente que solo podés ayudar con el negocio.
- Formato simple: párrafos cortos, listas con guiones y **negrita** para lo importante. Sin tablas ni títulos.`;

router.post('/chat', async (req, res) => {
  const client = obtenerIA();
  if (!client) return res.status(503).json({ error: 'El chat con el gerente todavía no está configurado en este servidor. Mientras tanto, usá las preguntas guiadas.' });
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'x';
  if (!permitido(ip)) return res.status(429).json({ error: 'Hiciste muchas preguntas seguidas. Probá de nuevo en un rato.' });
  const entrada = Array.isArray(req.body.mensajes) ? req.body.mensajes : [];
  const mensajes = entrada
    .filter(m => m && (m.rol === 'usuario' || m.rol === 'asistente') && typeof m.texto === 'string' && m.texto.trim())
    .slice(-10)
    .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto.slice(0, 2000) }));
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== 'user') return res.status(400).json({ error: 'Escribí tu pregunta.' });
  try {
    const r = await resumenNegocio(req.body.local_id);
    // Contexto compacto (sin listas largas de productos)
    const rot = r.rotacion || {};
    const datos = {
      fecha: new Date().toISOString().slice(0, 10), local: r.local, ventas_del_mes: r.ventas,
      salud_del_mes: r.analisis ? { puntaje: r.analisis.puntaje, calificacion: r.analisis.calificacion, ingresos: r.analisis.ingresos_mes, resultado_neto: r.analisis.resultado_neto_mes, margen_neto_pct: r.analisis.margen_neto_pct, metricas: r.analisis.metricas.map(m => ({ nombre: m.nombre, pct: m.valor, estado: m.estado })) } : null,
      promedio_ultimos_meses: r.base && r.base.suficiente ? { ventas_mes: r.base.ventas_mes, margen_bruto_pct: r.base.margen_bruto_pct, comisiones_tarjeta_pct: r.base.comisiones_pct, costos_fijos_mes: r.base.costos_fijos, costos_detalle: r.base.costos_detalle, punto_equilibrio_mes: r.base.punto_equilibrio, ganancia_mes: r.base.ganancia_mes, mejor_mes: r.base.mejor_mes, productos_bajo_margen: r.base.bajo_margen, compras_proveedores: r.base.proveedores_compras } : (r.base && r.base.motivo) || null,
      stock: { ...r.stock, productos_mas_plata: (rot.productos || []).slice(0, 12).map(p => ({ nombre: p.nombre, stock: p.stock, vendidas_90d: p.unidades, dias_stock: p.dias_stock, valor_costo: Math.round(p.valor_costo), estado: p.estado, abc: p.abc, liquidar_hasta_pct: p.descuento_max })) },
      clientes: r.clientes, equipo_mes: r.vendedoras, patrones_de_venta: r.patrones, pendientes: r.operacion,
      mejora_continua: armarMejoras(r).map(x => ({ plazo: x.plazo, titulo: x.titulo, impacto: x.impacto })),
    };
    const negocio = (await q1('SELECT nombre_negocio FROM configuracion_negocio WHERE id = 1'))[0]?.nombre_negocio || '';
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `${negocio ? 'Negocio: ' + negocio + '.\n' : ''}Datos del negocio (JSON):\n${JSON.stringify(datos)}` },
      ],
      messages: mensajes,
    });
    if (response.stop_reason === 'refusal') return res.json({ texto: 'No puedo ayudarte con eso. Preguntame algo sobre tu negocio.' });
    const texto = response.content.filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
    res.json({ texto: texto || 'No pude armar una respuesta. ¿Podés reformular la pregunta?' });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Estoy con muchas consultas. Probá de nuevo en un minuto.' });
    if (error instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'El chat no está bien configurado en este servidor.' });
    console.error('Gerente chat:', error.message);
    res.status(502).json({ error: 'No pude responder ahora. Probá de nuevo o usá las preguntas guiadas.' });
  }
});

module.exports = router;
module.exports.resumenNegocio = resumenNegocio;
module.exports.armarMejoras = armarMejoras;
module.exports.responder = responder;
