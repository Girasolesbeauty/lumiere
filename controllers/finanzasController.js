const pool = require('../config/database');
const { IMPORTE_VI } = require('../lib/importeReal');
const { esVentaWeb } = require('../lib/tiendaWeb');
const { porNegocio } = require('../lib/contexto');

// Convierte "rg"/"ush" (o numeros) al id numerico del local. null si es consolidado/vacio.
function normalizarLocalId(v) {
  if (v === undefined || v === null || v === '' || v === 'consolidado' || v === 'todos') return null;
  if (v === 'rg' || v === 'RG') return 1;
  if (v === 'ush' || v === 'USH') return 2;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// Las fechas se guardan sin zona horaria (en la de la base). Se pasan a hora argentina
// antes de ver a que dia/mes pertenecen: si no, lo vendido despues de las 21 hs del
// ultimo dia del mes caia en el mes siguiente.
const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
const EN_MES = (col, iMes, iAnio) => `EXTRACT(MONTH FROM ${AR(col)}) = $${iMes} AND EXTRACT(YEAR FROM ${AR(col)}) = $${iAnio}`;
// Periodo de los calculos: un mes ({mes, anio}) o un rango de dias argentinos ({desde, hasta}, ambos incluidos).
// Los dos primeros parametros de la consulta son siempre (mes, anio) o (desde, hasta).
const EN_PERIODO = (col, i1, i2, rango) => (rango ? `${AR(col)}::date BETWEEN $${i1}::date AND $${i2}::date` : EN_MES(col, i1, i2));
const paramsPeriodo = (mes, anio, rango) => (rango ? [rango.desde, rango.hasta] : [mes, anio]);
// Una venta cuenta si no esta anulada, no es de prueba y (si es preventa) ya se cobro.
const VENTA_VALIDA = (a = 'v') => `COALESCE(${a}.anulada, FALSE) = FALSE
  AND (COALESCE(${a}.es_preventa, FALSE) = FALSE OR ${a}.estado_pago = 'confirmada')
  AND COALESCE(${a}.canal, '') <> 'prueba'`;
const NO_ANULADO = (a) => `COALESCE(${a}.anulado, FALSE) = FALSE`;

const num = (x) => parseFloat(x) || 0;
const mesAnio = (q) => ({
  mes: parseInt(q.mes) || (new Date().getMonth() + 1),
  anio: parseInt(q.anio) || new Date().getFullYear(),
});

const hayVentaPagos = porNegocio(null);
const tieneVentaPagos = async () => {
  if (hayVentaPagos.get() === null) {
    const r = await pool.query(`SELECT to_regclass('venta_pagos') AS t`);
    hayVentaPagos.set(!!r.rows[0].t);
  }
  return hayVentaPagos.get();
};

// % de Ingresos Brutos que se estima sobre lo cobrado sin efectivo. Configurable por negocio
// (antes estaba fijo en 4%). La columna se crea sola si falta.
const columnaIibbLista = porNegocio(false);
const obtenerIibbPct = async () => {
  try {
    if (!columnaIibbLista.get()) {
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS iibb_pct NUMERIC(5,2) DEFAULT 4');
      columnaIibbLista.set(true);
    }
    const r = await pool.query('SELECT iibb_pct FROM configuracion_negocio WHERE id = 1');
    const v = r.rows[0] ? r.rows[0].iibb_pct : null;
    return v === null || v === undefined ? 4 : num(v);
  } catch (e) { return 4; }
};

// Gastos compartidos entre los dos locales: cada uno guarda que % le toca al local 1
// (el resto es del local 2). Los viejos, sin % guardado, usan el reparto por defecto del
// negocio (configurable; 50 si nunca se cambio). Las columnas se crean solas si faltan.
const columnasRepartoListas = porNegocio(false);
const asegurarReparto = async () => {
  if (columnasRepartoListas.get()) return;
  await pool.query('ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS pct_local1 NUMERIC(5,2)');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS reparto_local1_pct NUMERIC(5,2) DEFAULT 50');
  columnasRepartoListas.set(true);
};
const obtenerRepartoDefault = async () => {
  try {
    await asegurarReparto();
    const r = await pool.query('SELECT reparto_local1_pct FROM configuracion_negocio WHERE id = 1');
    const v = r.rows[0] ? r.rows[0].reparto_local1_pct : null;
    return v === null || v === undefined ? 50 : num(v);
  } catch (e) { return 50; }
};
const pctValido = (v) => { const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 100 ? n : null; };
// Parte de un gasto compartido que le corresponde a un local
const parteDelLocal = (importe, pctLocal1, localNum) => (localNum === 1 ? importe * pctLocal1 / 100 : importe * (100 - pctLocal1) / 100);
const pctDeFila = (row, porDefecto) => (row.pct_local1 !== null && row.pct_local1 !== undefined ? num(row.pct_local1) : porDefecto);

// Comisiones de los medios de pago sobre lo cobrado en el mes. Una venta con pago
// dividido reparte su importe entre sus medios; la parte pagada con gift card no se
// comisiona (ya se comisiono al venderse la gift card, que tambien se cuenta aca).
async function calcularComisionesMedios(mes, anio, localNum, rango = null) {
  const conPagos = await tieneVentaPagos();
  const params = paramsPeriodo(mes, anio, rango);
  let filtroLocalV = '', filtroLocalM = '';
  if (localNum !== null) { params.push(localNum); filtroLocalV = ` AND v.local_id = $3`; filtroLocalM = ` AND m.local_id = $3`; }

  const q = `
    WITH ventas_mes AS (
      SELECT v.* FROM ventas v
      WHERE ${VENTA_VALIDA('v')} AND ${EN_PERIODO('v.creado_en', 1, 2, rango)} ${filtroLocalV}
    ),
    tramos AS (
      ${conPagos ? `
      SELECT vp.medio_pago_id, vp.medio_pago_nombre AS nombre, vp.importe, FALSE AS es_gc
      FROM venta_pagos vp JOIN ventas_mes v ON v.id = vp.venta_id
      WHERE vp.importe > 0 AND vp.gift_card_id IS NULL AND COALESCE(vp.medio_pago_nombre, '') !~* 'gift'
      UNION ALL` : ''}
      SELECT v.medio_pago_id, v.medio_pago AS nombre, v.total - COALESCE(v.monto_gift_card, 0) AS importe, FALSE AS es_gc
      FROM ventas_mes v
      WHERE v.total - COALESCE(v.monto_gift_card, 0) > 0
        ${conPagos ? 'AND NOT EXISTS (SELECT 1 FROM venta_pagos vp WHERE vp.venta_id = v.id)' : ''}
      UNION ALL
      SELECT NULL, m.forma_pago, m.importe, TRUE
      FROM movimientos_caja m
      WHERE m.tipo = 'I' AND m.concepto ILIKE 'Gift Card%' AND m.importe > 0 AND ${NO_ANULADO('m')}
        AND ${EN_PERIODO('m.creado_en', 1, 2, rango)} ${filtroLocalM}
    )
    SELECT t.nombre, t.importe, t.es_gc, mp.nombre AS mp_nombre, COALESCE(mp.comision, 0) AS comision_pct, COALESCE(mp.tipo, '') AS mp_tipo
    FROM tramos t
    LEFT JOIN LATERAL (
      SELECT * FROM medios_pago x
      WHERE x.id = t.medio_pago_id OR (t.medio_pago_id IS NULL AND x.nombre = t.nombre)
      ORDER BY (x.id = t.medio_pago_id) DESC NULLS LAST LIMIT 1
    ) mp ON TRUE`;
  const r = await pool.query(q, params);

  const porMedio = {};
  let totalVentas = 0, totalComisiones = 0, baseIibb = 0;
  for (const row of r.rows) {
    const importe = num(row.importe);
    if (importe <= 0) continue;
    const base = row.mp_nombre || row.nombre || 'Sin especificar';
    const nombre = row.es_gc ? base + ' (venta de gift card)' : base;
    const pct = num(row.comision_pct);
    const efectivo = row.mp_tipo === 'efectivo' || /efectivo/i.test(base);
    const comision = importe * pct / 100;
    totalVentas += importe;
    totalComisiones += comision;
    if (!efectivo) baseIibb += importe;
    if (!porMedio[nombre]) porMedio[nombre] = { medio: nombre, ventas: 0, monto: 0, comision_pct: pct, comision: 0, efectivo };
    porMedio[nombre].ventas += 1;
    porMedio[nombre].monto += importe;
    porMedio[nombre].comision += comision;
  }
  return {
    detalle: Object.values(porMedio).sort((a, b) => b.monto - a.monto),
    total_ventas: totalVentas, total_comisiones: totalComisiones, base_iibb: baseIibb,
  };
}

// Traduce los valores internos de destino_origen (de la Caja diaria) a etiquetas legibles.
const ETIQUETAS_DESTINO_ORIGEN = {
  gasto_operativo: 'Gasto operativo',
  pago_proveedor: 'Pago a proveedor',
  otro: 'Otro'
};
const etiquetaDestinoOrigen = (valor) => ETIQUETAS_DESTINO_ORIGEN[valor] || valor || 'Otros';
const CANALES = { presencial: 'Ventas en el local', online: 'Ventas online', tienda_web: 'Ventas de la tienda web' };

// Egresos del mes, de las dos tablas de movimientos, sin anulados y sin contar dos veces
// el pago de comisiones en efectivo (que se guarda en las dos tablas a la vez).
// Los egresos sin categoria se clasifican por su concepto para que no queden afuera
// del resultado (antes, el Flujo de Efectivo los ignoraba y Movimientos si los sumaba).
async function obtenerEgresos(mes, anio, localNum, rango = null) {
  const porDefecto = await obtenerRepartoDefault();
  const params = paramsPeriodo(mes, anio, rango);
  let filtro = '';
  if (localNum !== null) { params.push(localNum); filtro = ` AND (x.local_id = $3 OR x.local_id IS NULL)`; }
  const r = await pool.query(`
    SELECT * FROM (
      SELECT m.importe, m.concepto, m.local_id, m.creado_en, m.pct_local1,
        COALESCE(cc.tipo, CASE WHEN m.concepto ILIKE '%comisi%' THEN 'sueldo' ELSE 'variable' END) AS categoria_tipo,
        COALESCE(cc.nombre, CASE
          WHEN m.concepto ILIKE '%comisi%' THEN 'Comisiones de vendedores'
          WHEN m.concepto ILIKE 'Devolucion%' THEN 'Devoluciones de dinero'
          ELSE 'Sin categoría' END) AS categoria_nombre
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      WHERE m.tipo = 'E' AND ${NO_ANULADO('m')}
      UNION ALL
      SELECT e.importe, e.concepto, e.local_id, e.creado_en, NULL::numeric,
        CASE WHEN CONCAT(e.concepto, ' ', e.destino_origen) ~* '(sueldo|aguinaldo)' THEN 'sueldo' ELSE 'variable' END,
        CASE WHEN CONCAT(e.concepto, ' ', e.destino_origen) ~* '(sueldo|aguinaldo)' THEN 'Sueldos' ELSE e.destino_origen END
      FROM movimientos_caja_efectivo e
      WHERE e.tipo IN ('egreso', 'E') AND ${NO_ANULADO('e')}
        AND COALESCE(e.destino_origen, '') <> 'Pago de comisiones'
    ) x
    WHERE ${EN_PERIODO('x.creado_en', 1, 2, rango)} ${filtro}`, params);
  // Viendo un local, lo compartido (local_id NULL) cuenta solo su parte; en consolidado, entero.
  return r.rows.map(row => ({
    ...row,
    importe: localNum !== null && row.local_id === null ? parteDelLocal(num(row.importe), pctDeFila(row, porDefecto), localNum) : num(row.importe),
  }));
}

// Logica compartida: ingresos por canal + egresos por tipo + comisiones de medios de pago.
// La usan Movimientos, Flujo de Efectivo, Analisis, Equilibrio y el Dashboard, asi todos
// muestran el mismo numero.
async function calcularFlujoEstructurado(mesActual, anioActual, local_id, rango = null) {
  const localNum = normalizarLocalId(local_id);
  const params = paramsPeriodo(mesActual, anioActual, rango);
  if (localNum !== null) params.push(localNum);

  // Los pedidos de la tienda web se cobran en la caja: se muestran en su propio renglon (el total no cambia)
  const canalSql = `CASE WHEN ${await esVentaWeb('v')} THEN 'tienda_web' ELSE COALESCE(v.canal, 'presencial') END`;
  const [ventasRes, cambiosRes, factExtRes, egresos, comisionesMedios] = await Promise.all([
    pool.query(`
      SELECT ${canalSql} AS canal, SUM(v.total) AS total, COUNT(*) AS cantidad
      FROM ventas v
      WHERE ${VENTA_VALIDA('v')} AND ${EN_PERIODO('v.creado_en', 1, 2, rango)} ${localNum !== null ? 'AND v.local_id = $3' : ''}
      GROUP BY 1`, params),
    // Diferencias cobradas en cambios de producto: plata que entra y no es una venta nueva
    pool.query(`
      SELECT COALESCE(SUM(m.importe), 0) AS total FROM movimientos_caja m
      WHERE m.tipo = 'I' AND m.concepto ILIKE 'Cobro diferencia%' AND ${NO_ANULADO('m')}
        AND ${EN_PERIODO('m.creado_en', 1, 2, rango)} ${localNum !== null ? 'AND m.local_id = $3' : ''}`, params),
    // La facturacion del sistema anterior es por mes: en un rango cuenta solo si el mes entero queda adentro
    pool.query(`SELECT COALESCE(SUM(monto), 0) AS total FROM facturacion_externa WHERE ${rango
      ? `make_date(anio, mes, 1) >= $1::date AND (make_date(anio, mes, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date <= $2::date`
      : 'mes = $1 AND anio = $2'} ${localNum !== null ? 'AND local_id = $3' : ''}`, params),
    obtenerEgresos(mesActual, anioActual, localNum, rango),
    calcularComisionesMedios(mesActual, anioActual, localNum, rango),
  ]);

  const ingresosDetalle = {};
  let cantidadVentas = 0;
  ventasRes.rows.forEach(r => {
    ingresosDetalle[CANALES[r.canal] || ('Ventas ' + r.canal)] = num(r.total);
    cantidadVentas += parseInt(r.cantidad) || 0;
  });
  const cobrosCambios = num(cambiosRes.rows[0].total);
  if (cobrosCambios > 0) ingresosDetalle['Diferencias cobradas en cambios'] = cobrosCambios;
  const factExterna = num(factExtRes.rows[0].total);
  if (factExterna > 0) ingresosDetalle['Facturación sistema anterior'] = factExterna;
  const totalVentas = ventasRes.rows.reduce((s, r) => s + num(r.total), 0);

  const agrupar = (tipo) => egresos.filter(r => r.categoria_tipo === tipo).reduce((acc, r) => {
    const nombre = etiquetaDestinoOrigen(r.categoria_nombre || r.concepto);
    acc[nombre] = (acc[nombre] || 0) + r.importe;
    return acc;
  }, {});
  const variables = agrupar('variable');
  const fijos = agrupar('fijo');
  const admin = agrupar('administrativo');
  const sueldos = agrupar('sueldo');
  // Otros tipos de categoria que pueda crear el negocio van a "fijos" para no perderlos
  egresos.filter(r => !['variable', 'fijo', 'administrativo', 'sueldo'].includes(r.categoria_tipo)).forEach(r => {
    const nombre = etiquetaDestinoOrigen(r.categoria_nombre || r.concepto);
    fijos[nombre] = (fijos[nombre] || 0) + r.importe;
  });

  // Impuestos (ej: 931 ARCA) se muestran aparte de los fijos
  const impuestos = {};
  const fijosSinImpuestos = {};
  Object.entries(fijos).forEach(([k, v]) => {
    if (/ARCA|931|impuesto|IIBB|ingresos brutos|municipal/i.test(k)) impuestos[k] = v;
    else fijosSinImpuestos[k] = v;
  });

  const comisiones = {};
  comisionesMedios.detalle.forEach(d => { if (d.comision > 0) comisiones[d.medio] = d.comision; });

  const suma = (o) => Object.values(o).reduce((s, v) => s + v, 0);
  const totalIngresos = totalVentas + cobrosCambios + factExterna;
  const totalVariables = suma(variables);
  const totalFijos = suma(fijosSinImpuestos);
  const totalAdmin = suma(admin);
  const totalSueldos = suma(sueldos);
  const totalImpuestos = suma(impuestos);
  const totalComisiones = suma(comisiones);
  const totalEgresos = totalVariables + totalFijos + totalAdmin + totalSueldos + totalImpuestos + totalComisiones;

  return {
    mes: mesActual,
    anio: anioActual,
    local_id: local_id || 'consolidado',
    cantidad_ventas: cantidadVentas,
    total_ventas: totalVentas,
    ingresos: { detalle: ingresosDetalle, total: totalIngresos },
    variables: { detalle: variables, total: totalVariables },
    fijos: { detalle: fijosSinImpuestos, total: totalFijos },
    admin: { detalle: admin, total: totalAdmin },
    sueldos: { detalle: sueldos, total: totalSueldos },
    impuestos: { detalle: impuestos, total: totalImpuestos },
    comisiones_medios_pago: { detalle: comisiones, total: totalComisiones },
    sin_categoria: egresos.filter(r => r.categoria_nombre === 'Sin categoría').length,
    total_egresos: totalEgresos,
    resultado_neto: totalIngresos - totalEgresos
  };
}

// Movimientos del mes + resumen (el resumen es el mismo del Flujo de Efectivo)
const getFlujo = async (req, res) => {
  try {
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const params = [mes, anio];
    if (localNum !== null) params.push(localNum);
    const porDefecto = await obtenerRepartoDefault();
    const [movs, est] = await Promise.all([
      pool.query(`
        SELECT * FROM (
          SELECT m.id, m.concepto, m.importe, m.creado_en, m.local_id, m.pct_local1,
                 CASE WHEN m.tipo = 'I' THEN 'I' ELSE 'E' END AS tipo,
                 cc.nombre AS categoria_nombre, cc.tipo AS categoria_tipo, cp.nombre AS cuenta_nombre, m.forma_pago,
                 'caja' AS fuente
          FROM movimientos_caja m
          LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
          LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
          WHERE ${NO_ANULADO('m')}
          UNION ALL
          SELECT e.id, e.concepto, e.importe, e.creado_en, e.local_id, NULL::numeric,
                 CASE WHEN e.tipo IN ('ingreso', 'I') THEN 'I' ELSE 'E' END AS tipo,
                 e.destino_origen, NULL, NULL, 'efectivo', 'efectivo' AS fuente
          FROM movimientos_caja_efectivo e
          WHERE ${NO_ANULADO('e')}
        ) mov
        WHERE ${EN_MES('mov.creado_en', 1, 2)} ${localNum !== null ? 'AND (mov.local_id = $3 OR mov.local_id IS NULL)' : ''}
        ORDER BY mov.creado_en DESC`, params),
      calcularFlujoEstructurado(mes, anio, req.query.local_id),
    ]);
    const movimientos = movs.rows.map(r => ({ ...r, importe: localNum !== null && r.local_id === null ? parteDelLocal(num(r.importe), pctDeFila(r, porDefecto), localNum) : num(r.importe) }));
    res.json({
      movimientos,
      resumen: {
        ingresos: est.ingresos.total, egresos: est.total_egresos, neto: est.resultado_neto,
        facturacion_anterior: est.ingresos.detalle['Facturación sistema anterior'] || 0,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo de caja' });
  }
};

const getFlujoEstructurado = async (req, res) => {
  try {
    const { mes, anio } = mesAnio(req.query);
    res.json(await calcularFlujoEstructurado(mes, anio, req.query.local_id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo estructurado' });
  }
};

// Agregar egreso mejorado
const agregarEgreso = async (req, res) => {
  try {
    const { concepto, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id, fecha, pct_local1 } = req.body;
    // Si viene una fecha del formulario, se usa esa para creado_en -- asi un gasto que
    // en realidad se pago el 29/7 pero se carga hoy queda contabilizado en julio, no en
    // el mes en que se tipeo. Si no viene fecha, se usa el momento actual (NOW()).
    if (!(parseFloat(importe) > 0)) return res.status(400).json({ error: 'Poné un importe mayor a 0' });
    if (!concepto || !String(concepto).trim()) return res.status(400).json({ error: 'Falta el concepto' });
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha invalida' });
    const fechaCarga = fecha ? new Date(fecha + 'T12:00:00') : new Date();
    await asegurarCargadoEn();

    // Si es compartido, se guarda con local_id NULL y el % que le toca al local 1 (el resto
    // es del local 2). Si no vino un %, se usa el reparto por defecto del negocio.
    if (local_id === 'compartido') {
      const pct = pctValido(pct_local1);
      const pctFinal = pct !== null ? pct : await obtenerRepartoDefault();
      await asegurarReparto();
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id, creado_en, pct_local1, cargado_en)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, NULL, $7, $8, $9, NOW())`,
        [concepto, importe, referencia, categoria_id || null, forma_pago || null, cuenta_pago_id || null, usuario_id || null, fechaCarga, pctFinal]
      );
    } else {
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id, creado_en, cargado_en)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [concepto, importe, referencia || 'Manual', categoria_id || null, forma_pago || null, cuenta_pago_id || null, local_id || 1, usuario_id || null, fechaCarga]
      );
    }

    res.status(201).json({ ok: true, mensaje: 'Egreso registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar egreso: ' + error.message });
  }
};

// Momento en que se cargó cada egreso. creado_en es la fecha del gasto (puede ser de otro día),
// así que para "lo que cargué hoy" hace falta guardar aparte cuándo se tipeó. Los egresos viejos
// quedan sin dato (NULL) y para ellos se usa la fecha del gasto.
const cargadoEnListo = porNegocio(false);
const asegurarCargadoEn = async () => {
  if (cargadoEnListo.get()) return;
  await pool.query('ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS cargado_en TIMESTAMP');
  cargadoEnListo.set(true);
};

// Jefe/dueño (rol "jefe" o rol_id 1, igual que en el resto del sistema), admin o administrativo ven los
// gastos de todos. Se lee el usuario de la base porque la sesión solo trae el nombre del rol.
const ROLES_VEN_TODO = ['jefe', 'admin', 'administrativo'];
const puedeVerGastosDeTodos = async (u) => {
  if (!u || !u.id) return false;
  if (ROLES_VEN_TODO.includes(u.rol)) return true;
  try {
    const r = await pool.query('SELECT rol, rol_id FROM usuarios WHERE id = $1', [u.id]);
    const f = r.rows[0];
    return !!f && (ROLES_VEN_TODO.includes(f.rol) || Number(f.rol_id) === 1);
  } catch (e) { return false; }
};

// Gastos cargados: lista de egresos con filtros para revisar día por día lo que cargó cada uno.
// Quien no es jefe/admin solo ve los suyos. Junta los egresos de Finanzas y los de la Caja de efectivo.
const getGastosCargados = async (req, res) => {
  try {
    await asegurarCargadoEn();
    const yo = req.usuario || {};
    const verTodos = await puedeVerGastosDeTodos(yo);
    const q = req.query;
    let usuarioId = q.usuario_id === undefined || q.usuario_id === '' ? null : q.usuario_id;
    if (!verTodos) usuarioId = yo.id;
    if (usuarioId !== null && usuarioId !== 'sin') usuarioId = parseInt(usuarioId, 10) || null;
    const fechaValida = (f) => (f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null);
    const desde = fechaValida(q.desde), hasta = fechaValida(q.hasta);
    const porCarga = q.fecha_por === 'carga';
    const numero = (v) => (v !== undefined && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
    const montoMin = numero(q.monto_min), montoMax = numero(q.monto_max);
    const texto = String(q.texto || '').trim();
    const categoriaId = q.categoria_id === 'sin' ? 'sin' : (parseInt(q.categoria_id, 10) || null);
    const formaPago = String(q.forma_pago || '').trim();
    const localNum = normalizarLocalId(q.local_id);
    const conCaja = q.incluir_caja !== '0';

    // Finanzas (movimientos_caja): solo egresos cargados a mano (no los automáticos de ventas/comisiones)
    const p1 = [];
    const fechaGasto1 = AR('m.creado_en');
    const fechaCarga1 = `COALESCE(${AR('m.cargado_en')}, ${AR('m.creado_en')})`;
    const col1 = porCarga ? fechaCarga1 : fechaGasto1;
    let w1 = `${NO_ANULADO('m')} AND m.tipo = 'E' AND NOT (COALESCE(m.concepto, '') ~* '^(Venta |Gift Card|Seña|Cobro diferencia|Devolucion de diferencia|Pago (total )?comisiones)')`;
    if (usuarioId === 'sin') w1 += ' AND m.usuario_id IS NULL';
    else if (usuarioId !== null) { p1.push(usuarioId); w1 += ` AND m.usuario_id = $${p1.length}`; }
    if (desde) { p1.push(desde); w1 += ` AND ${col1}::date >= $${p1.length}::date`; }
    if (hasta) { p1.push(hasta); w1 += ` AND ${col1}::date <= $${p1.length}::date`; }
    if (montoMin !== null) { p1.push(montoMin); w1 += ` AND m.importe >= $${p1.length}`; }
    if (montoMax !== null) { p1.push(montoMax); w1 += ` AND m.importe <= $${p1.length}`; }
    if (categoriaId === 'sin') w1 += ' AND m.categoria_id IS NULL';
    else if (categoriaId) { p1.push(categoriaId); w1 += ` AND m.categoria_id = $${p1.length}`; }
    if (formaPago) { p1.push(formaPago); w1 += ` AND LOWER(COALESCE(m.forma_pago, '')) = LOWER($${p1.length})`; }
    if (localNum !== null) { p1.push(localNum); w1 += ` AND (m.local_id = $${p1.length} OR m.local_id IS NULL)`; }
    if (texto) {
      p1.push('%' + texto + '%');
      w1 += ` AND (m.concepto ILIKE $${p1.length} OR COALESCE(m.referencia, '') ILIKE $${p1.length} OR COALESCE(cc.nombre, '') ILIKE $${p1.length} OR COALESCE(cp.nombre, '') ILIKE $${p1.length})`;
    }
    const sql1 = `
      SELECT m.id::text AS id, 'finanzas' AS fuente, m.concepto, m.importe, m.local_id, m.forma_pago, m.referencia,
             cc.nombre AS categoria_nombre, cp.nombre AS cuenta_nombre, m.usuario_id, u.nombre AS usuario_nombre,
             to_char(${fechaGasto1}, 'YYYY-MM-DD') AS fecha_gasto,
             to_char(${fechaCarga1}, 'YYYY-MM-DD') AS fecha_carga,
             to_char(${fechaCarga1}, 'HH24:MI') AS hora_carga,
             (m.cargado_en IS NOT NULL) AS carga_exacta
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
      LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE ${w1}
      ORDER BY ${col1} DESC LIMIT 2000`;

    // Caja de efectivo: egresos (ahí la fecha del gasto y la de carga son la misma)
    let sql2 = null; const p2 = [];
    const formaOk = !formaPago || formaPago.toLowerCase() === 'efectivo';
    if (conCaja && !categoriaId && formaOk) {
      const f2 = AR('e.creado_en');
      let w2 = `${NO_ANULADO('e')} AND e.tipo IN ('egreso', 'E') AND COALESCE(e.destino_origen, '') <> 'Pago de comisiones'`;
      if (usuarioId === 'sin') w2 += ' AND e.usuario_id IS NULL';
      else if (usuarioId !== null) { p2.push(usuarioId); w2 += ` AND e.usuario_id = $${p2.length}`; }
      if (desde) { p2.push(desde); w2 += ` AND ${f2}::date >= $${p2.length}::date`; }
      if (hasta) { p2.push(hasta); w2 += ` AND ${f2}::date <= $${p2.length}::date`; }
      if (montoMin !== null) { p2.push(montoMin); w2 += ` AND e.importe >= $${p2.length}`; }
      if (montoMax !== null) { p2.push(montoMax); w2 += ` AND e.importe <= $${p2.length}`; }
      if (localNum !== null) { p2.push(localNum); w2 += ` AND e.local_id = $${p2.length}`; }
      if (texto) { p2.push('%' + texto + '%'); w2 += ` AND (COALESCE(e.concepto, '') ILIKE $${p2.length} OR COALESCE(e.destino_origen, '') ILIKE $${p2.length})`; }
      sql2 = `
        SELECT 'ef-' || e.id AS id, 'caja' AS fuente, e.concepto, e.importe, e.local_id, 'efectivo' AS forma_pago, NULL AS referencia,
               e.destino_origen AS categoria_nombre, NULL AS cuenta_nombre, e.usuario_id, u.nombre AS usuario_nombre,
               to_char(${f2}, 'YYYY-MM-DD') AS fecha_gasto, to_char(${f2}, 'YYYY-MM-DD') AS fecha_carga,
               to_char(${f2}, 'HH24:MI') AS hora_carga, TRUE AS carga_exacta
        FROM movimientos_caja_efectivo e
        LEFT JOIN usuarios u ON u.id = e.usuario_id
        WHERE ${w2}
        ORDER BY e.creado_en DESC LIMIT 2000`;
    }
    const [r1, r2, us] = await Promise.all([
      pool.query(sql1, p1),
      sql2 ? pool.query(sql2, p2).catch((e) => { console.error('[gastos-cargados] caja:', e.message); return { rows: [] }; }) : Promise.resolve({ rows: [] }),
      verTodos ? pool.query('SELECT id, nombre FROM usuarios ORDER BY nombre') : Promise.resolve({ rows: [] }),
    ]);
    const gastos = r1.rows.concat(r2.rows).map(g => ({ ...g, importe: num(g.importe) }));
    res.json({ gastos, ver_todos: verTodos, usuarios: us.rows, yo: yo.id || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los gastos cargados' });
  }
};

// Ultimo egreso registrado por un usuario (para que sepa donde dejo la carga de datos)
const getMiUltimoEgreso = async (req, res) => {
  try {
    const { usuario_id } = req.query;
    if (!usuario_id) return res.status(400).json({ error: 'Falta usuario_id' });
    const result = await pool.query(
      `SELECT concepto, importe, creado_en
       FROM movimientos_caja
       WHERE usuario_id = $1 AND tipo = 'E'
       ORDER BY creado_en DESC
       LIMIT 1`,
      [usuario_id]
    );
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el ultimo egreso' });
  }
};

// Costos fijos para el punto de equilibrio. En un mes cerrado se usan los que se cargaron.
// En el mes en curso, a principio de mes todavia no se cargaron (alquiler, sueldos...), y el
// punto de equilibrio daba casi cero ("ya llegaste"). Por eso, en el mes en curso cada rubro
// usa el promedio de los ultimos 3 meses con gastos, o lo cargado si ya es mas.
const RUBROS_FIJOS = [['fijos', 'Costos fijos'], ['admin', 'Gastos administrativos'], ['sueldos', 'Sueldos'], ['impuestos', 'Impuestos']];
async function costosFijosParaEquilibrio(est, mes, anio, local_id, esMesActual, anteriores) {
  const detalle = {};
  const registrado = {};
  RUBROS_FIJOS.forEach(([k, nombre]) => { registrado[nombre] = (est[k] && est[k].total) || 0; });
  // Mes cerrado, o mes en curso ya avanzado (desde el día 20 los gastos del mes ya están casi todos cargados):
  // se usa lo cargado. Antes, el día 31 seguía tomando el promedio de los 3 meses anteriores si era más alto.
  const diaHoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).getDate();
  if (!esMesActual || diaHoy >= 20) {
    const total = Object.values(registrado).reduce((a, b) => a + b, 0);
    return { total, detalle: registrado, registrado: total, estimado: false, estimados: [] };
  }
  // Los 3 meses anteriores (se pueden pasar ya calculados)
  let prev = anteriores;
  if (!prev) {
    prev = await Promise.all([1, 2, 3].map(i => {
      const d = new Date(anio, mes - 1 - i, 1);
      return calcularFlujoEstructurado(d.getMonth() + 1, d.getFullYear(), local_id);
    }));
  }
  const conGastos = prev.filter(e => e && RUBROS_FIJOS.some(([k]) => ((e[k] && e[k].total) || 0) > 0));
  let estimado = false; const estimados = [];
  RUBROS_FIJOS.forEach(([k, nombre]) => {
    const prom = conGastos.length ? conGastos.reduce((a, e) => a + ((e[k] && e[k].total) || 0), 0) / conGastos.length : 0;
    if (prom > registrado[nombre]) { estimado = true; estimados.push(nombre); }
    detalle[nombre] = Math.max(registrado[nombre], prom);
  });
  const total = Object.values(detalle).reduce((a, b) => a + b, 0);
  return { total, detalle, registrado: Object.values(registrado).reduce((a, b) => a + b, 0), registrado_detalle: registrado, estimado, estimados, meses_promedio: conGastos.length };
}

// Punto de equilibrio del mes elegido (antes siempre miraba el mes actual y todos los locales).
// Costos que no dependen de cuanto se vende (fijos, administrativos, sueldos, impuestos)
// divididos por el margen de contribucion (margen bruto de lo vendido menos lo que se
// llevan los medios de pago).
const getPuntoEquilibrio = async (req, res) => {
  try {
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const est = await calcularFlujoEstructurado(mes, anio, req.query.local_id);

    const params = [mes, anio];
    if (localNum !== null) params.push(localNum);
    let margen = await pool.query(`
      SELECT COALESCE(SUM(${IMPORTE_VI}), 0) AS ingresos,
             COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS costos
      FROM venta_items vi JOIN ventas v ON vi.venta_id = v.id JOIN productos p ON vi.producto_id = p.id
      WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)} ${localNum !== null ? 'AND v.local_id = $3' : ''}`, params);
    let base = 'mes';
    if (num(margen.rows[0].ingresos) <= 0) {
      // Sin ventas ese mes: se usa el margen de los ultimos 60 dias
      margen = await pool.query(`
        SELECT COALESCE(SUM(${IMPORTE_VI}), 0) AS ingresos,
               COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS costos
        FROM venta_items vi JOIN ventas v ON vi.venta_id = v.id JOIN productos p ON vi.producto_id = p.id
        WHERE ${VENTA_VALIDA('v')} AND v.creado_en >= NOW() - INTERVAL '60 days' ${localNum !== null ? 'AND v.local_id = $1' : ''}`,
        localNum !== null ? [localNum] : []);
      base = '60dias';
    }
    const ingItems = num(margen.rows[0].ingresos);
    const costoItems = num(margen.rows[0].costos);
    const margenBruto = ingItems > 0 ? (ingItems - costoItems) / ingItems : 0;
    const pctComisiones = est.total_ventas > 0 ? est.comisiones_medios_pago.total / est.total_ventas : 0;
    const margenContribucion = Math.max(0, margenBruto - pctComisiones);

    // Proyeccion a fin de mes (solo para el mes en curso), al ritmo de venta actual
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const diasMes = new Date(anio, mes, 0).getDate();
    const esMesActual = ahoraAR.getFullYear() === anio && ahoraAR.getMonth() + 1 === mes;

    const cf = await costosFijosParaEquilibrio(est, mes, anio, req.query.local_id, esMesActual);
    const costosFijos = cf.total;
    const puntoEquilibrio = margenContribucion > 0 ? costosFijos / margenContribucion : 0;
    const ventas = est.ingresos.total;
    const diasTranscurridos = esMesActual ? ahoraAR.getDate() : diasMes;
    const proyeccion = esMesActual && diasTranscurridos > 0 ? ventas / diasTranscurridos * diasMes : ventas;

    res.json({
      mes, anio,
      costos_fijos: costosFijos,
      costos_fijos_detalle: cf.detalle,
      costos_estimados: cf.estimado,
      costos_estimados_rubros: cf.estimados || [],
      costos_registrados_detalle: cf.registrado_detalle || null,
      costos_registrados: cf.registrado !== undefined ? cf.registrado : costosFijos,
      margen_bruto_pct: +(margenBruto * 100).toFixed(1),
      comisiones_pct: +(pctComisiones * 100).toFixed(1),
      margen_promedio: +(margenContribucion * 100).toFixed(1),
      margen_base: base,
      punto_equilibrio: puntoEquilibrio,
      ventas_actuales: ventas,
      superado: puntoEquilibrio > 0 && ventas >= puntoEquilibrio,
      margen_seguridad: puntoEquilibrio > 0 ? +(((ventas - puntoEquilibrio) / puntoEquilibrio) * 100).toFixed(1) : null,
      es_mes_actual: esMesActual,
      dias_mes: diasMes, dias_transcurridos: diasTranscurridos,
      proyeccion_fin_mes: proyeccion,
      venta_diaria_necesaria: esMesActual && puntoEquilibrio > ventas && diasMes > diasTranscurridos
        ? (puntoEquilibrio - ventas) / (diasMes - diasTranscurridos) : 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular punto de equilibrio' });
  }
};

// Resumen general (mes actual)
const getResumen = async (req, res) => {
  try {
    const { mes, anio } = mesAnio({});
    const est = await calcularFlujoEstructurado(mes, anio, null);
    res.json({ ingresos: est.ingresos.total, egresos: est.total_egresos, neto: est.resultado_neto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

// Comisiones por medio de pago + IIBB estimado (sobre lo que no es efectivo).
const getComisiones = async (req, res) => {
  try {
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const [c, iibbPct] = await Promise.all([calcularComisionesMedios(mes, anio, localNum), obtenerIibbPct()]);
    const iibb = c.base_iibb * (iibbPct / 100);
    res.json({
      mes, anio,
      total_ventas: c.total_ventas,
      total_comisiones: c.total_comisiones,
      base_iibb: c.base_iibb,
      iibb_pct: iibbPct,
      iibb,
      resultado_neto: c.total_ventas - c.total_comisiones - iibb,
      detalle: c.detalle
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular comisiones: ' + error.message });
  }
};

// Costo de Mercaderia Vendida (CMV) del mes: suma el costo de cada producto vendido.
const getCMV = async (req, res) => {
  try {
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const params = [mes, anio];
    if (localNum !== null) params.push(localNum);
    const r = await pool.query(`
      SELECT COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS cmv,
             COALESCE(SUM(${IMPORTE_VI}), 0) AS ventas,
             COUNT(*) FILTER (WHERE COALESCE(p.costo, 0) <= 0) AS sin_costo
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)} ${localNum !== null ? 'AND v.local_id = $3' : ''}`, params);
    const cmv = num(r.rows[0].cmv);
    const ventas = num(r.rows[0].ventas);
    res.json({
      cmv, ventas,
      margen_bruto: ventas - cmv,
      margen_pct: ventas > 0 ? ((ventas - cmv) / ventas * 100) : 0,
      items_sin_costo: parseInt(r.rows[0].sin_costo) || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular CMV: ' + error.message });
  }
};

// Guardar/actualizar facturacion del sistema anterior (por local y mes).
const guardarFacturacionExterna = async (req, res) => {
  try {
    const { monto, local_id, mes, anio, descripcion } = req.body;
    const mesN = parseInt(mes) || (new Date().getMonth() + 1);
    const anioN = parseInt(anio) || new Date().getFullYear();
    const localN = parseInt(local_id) || 1;
    // Si ya existe uno para ese local+mes+anio, lo reemplaza (para no duplicar)
    await pool.query(
      'DELETE FROM facturacion_externa WHERE local_id = $1 AND mes = $2 AND anio = $3',
      [localN, mesN, anioN]
    );
    await pool.query(
      `INSERT INTO facturacion_externa (monto, local_id, mes, anio, descripcion)
       VALUES ($1, $2, $3, $4, $5)`,
      [parseFloat(monto) || 0, localN, mesN, anioN, descripcion || 'Sistema anterior']
    );
    res.status(201).json({ ok: true, mensaje: 'Facturacion del sistema anterior guardada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar: ' + error.message });
  }
};

// Leer facturacion externa (por mes/anio, opcional local)
const getFacturacionExterna = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesN = parseInt(mes) || (new Date().getMonth() + 1);
    const anioN = parseInt(anio) || new Date().getFullYear();
    const localNum = normalizarLocalId(local_id);
    let q = 'SELECT * FROM facturacion_externa WHERE mes = $1 AND anio = $2';
    const params = [mesN, anioN];
    if (localNum !== null) { q += ' AND local_id = $3'; params.push(localNum); }
    q += ' ORDER BY local_id';
    const r = await pool.query(q, params);
    const total = r.rows.reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    res.json({ registros: r.rows, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al leer facturacion externa: ' + error.message });
  }
};

// Movimientos cargados (movimientos_caja) con busqueda y filtros, para ver/editar/borrar.
// Las fechas "desde"/"hasta" son dias argentinos e incluyen el dia "hasta" completo
// (antes se cortaba a las 00:00 y el ultimo dia quedaba afuera).
const getMovimientosDetalle = async (req, res) => {
  try {
    const { desde, hasta, busqueda, tipo, local_id } = req.query;
    const porDefecto = await obtenerRepartoDefault();
    let query = `
      SELECT m.id, m.concepto, m.importe, m.tipo, m.creado_en, m.local_id, m.forma_pago, m.referencia, m.pct_local1,
             m.categoria_id, cc.nombre AS categoria_nombre, cc.tipo AS categoria_tipo,
             m.cuenta_pago_id, cp.nombre AS cuenta_nombre,
             to_char(${AR('m.creado_en')}, 'YYYY-MM-DD') AS fecha,
             (m.concepto ~* '^(Venta |Gift Card|Seña|Cobro diferencia|Devolucion de diferencia|Pago (total )?comisiones)') AS automatico
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
      WHERE ${NO_ANULADO('m')}
    `;
    const params = [];
    if (desde) { params.push(desde); query += ` AND ${AR('m.creado_en')}::date >= $${params.length}::date`; }
    if (hasta) { params.push(hasta); query += ` AND ${AR('m.creado_en')}::date <= $${params.length}::date`; }
    if (tipo === 'I' || tipo === 'E') { params.push(tipo); query += ` AND m.tipo = $${params.length}`; }
    if (local_id === 'compartido') query += ' AND m.local_id IS NULL';
    else {
      const localNum = normalizarLocalId(local_id);
      if (localNum !== null) { params.push(localNum); query += ` AND (m.local_id = $${params.length} OR m.local_id IS NULL)`; }
    }
    if (req.query.sin_categoria === '1') query += ` AND m.categoria_id IS NULL AND m.tipo = 'E'`;
    if (busqueda && busqueda.trim()) {
      params.push('%' + busqueda.trim() + '%');
      query += ` AND (m.concepto ILIKE $${params.length} OR cc.nombre ILIKE $${params.length})`;
    }
    query += ' ORDER BY m.creado_en DESC LIMIT 500';
    // Los egresos pagados desde la Caja de efectivo tambien suman en Finanzas (obtenerEgresos): se listan aca
    // para que el total de Movimientos de lo mismo que la tarjeta de Egresos. Son de solo lectura: se corrigen
    // o anulan desde la Caja. El pago de comisiones no va porque ya figura en movimientos_caja.
    const conEfectivo = tipo !== 'I' && req.query.sin_categoria !== '1' && local_id !== 'compartido';
    let qEf = null;
    if (conEfectivo) {
      const pe = [];
      let sq = `
        SELECT 'ef-' || e.id AS id, e.concepto, e.importe, 'E' AS tipo, e.creado_en, e.local_id, 'efectivo' AS forma_pago,
               NULL AS referencia, NULL::numeric AS pct_local1, NULL::int AS categoria_id,
               CASE WHEN CONCAT(e.concepto, ' ', e.destino_origen) ~* '(sueldo|aguinaldo)' THEN 'Sueldos' ELSE e.destino_origen END AS categoria_nombre,
               CASE WHEN CONCAT(e.concepto, ' ', e.destino_origen) ~* '(sueldo|aguinaldo)' THEN 'sueldo' ELSE 'variable' END AS categoria_tipo,
               NULL::int AS cuenta_pago_id, 'Caja de efectivo' AS cuenta_nombre,
               to_char(${AR('e.creado_en')}, 'YYYY-MM-DD') AS fecha, FALSE AS automatico, 'efectivo' AS origen
        FROM movimientos_caja_efectivo e
        WHERE e.tipo IN ('egreso', 'E') AND ${NO_ANULADO('e')} AND COALESCE(e.destino_origen, '') <> 'Pago de comisiones'`;
      if (desde) { pe.push(desde); sq += ` AND ${AR('e.creado_en')}::date >= $${pe.length}::date`; }
      if (hasta) { pe.push(hasta); sq += ` AND ${AR('e.creado_en')}::date <= $${pe.length}::date`; }
      const localNum = normalizarLocalId(local_id);
      if (localNum !== null) { pe.push(localNum); sq += ` AND (e.local_id = $${pe.length} OR e.local_id IS NULL)`; }
      if (busqueda && busqueda.trim()) { pe.push('%' + busqueda.trim() + '%'); sq += ` AND (e.concepto ILIKE $${pe.length} OR e.destino_origen ILIKE $${pe.length})`; }
      sq += ' ORDER BY e.creado_en DESC LIMIT 500';
      qEf = pool.query(sq, pe);
    }
    const [r, ef] = await Promise.all([pool.query(query, params), qEf]);
    const filas = r.rows.map(row => (row.local_id === null ? { ...row, pct_local1: pctDeFila(row, porDefecto) } : row));
    if (ef) filas.push(...ef.rows.map(row => ({ ...row, categoria_nombre: etiquetaDestinoOrigen(row.categoria_nombre) })));
    filas.sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
    res.json(filas.slice(0, 500));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el detalle de movimientos: ' + error.message });
  }
};

// % sugerido para un gasto compartido: el ultimo que se uso en esa misma categoria
// (ej: si el alquiler siempre se reparte 70/30, lo propone solo), o el del negocio.
const getRepartoSugerido = async (req, res) => {
  try {
    const porDefecto = await obtenerRepartoDefault();
    const cat = parseInt(req.query.categoria_id);
    if (cat) {
      const r = await pool.query(
        `SELECT pct_local1 FROM movimientos_caja WHERE categoria_id = $1 AND local_id IS NULL AND pct_local1 IS NOT NULL
         ORDER BY creado_en DESC LIMIT 1`, [cat]);
      if (r.rows[0]) return res.json({ pct_local1: num(r.rows[0].pct_local1), origen: 'categoria', por_defecto: porDefecto });
    }
    res.json({ pct_local1: porDefecto, origen: 'negocio', por_defecto: porDefecto });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el reparto: ' + error.message });
  }
};

// Editar un movimiento manual (categoria, cuenta, forma de pago, importe, concepto)
const updateMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const { concepto, importe, categoria_id, forma_pago, cuenta_pago_id, local_id, fecha, pct_local1 } = req.body;
    if (importe !== undefined && importe !== null && !(parseFloat(importe) > 0)) return res.status(400).json({ error: 'El importe tiene que ser mayor a 0' });
    // local_id se maneja aparte de COALESCE: "compartido" tiene que poder guardar NULL de
    // verdad (50/50 entre los dos locales), y COALESCE nunca deja pisar un valor con NULL.
    const localIdFinal = local_id === 'compartido' ? null : (local_id || null);
    const fechaFinal = fecha ? new Date(fecha + 'T12:00:00') : null;
    // La categoria se puede quitar (null) solo si vino en el pedido
    const tocaCategoria = Object.prototype.hasOwnProperty.call(req.body, 'categoria_id');
    // % del local 1 solo para los compartidos (si no vino, se deja el que tenia)
    await asegurarReparto();
    const pct = localIdFinal === null ? pctValido(pct_local1) : null;
    const r = await pool.query(
      `UPDATE movimientos_caja
       SET concepto = COALESCE($1, concepto), importe = COALESCE($2, importe),
           categoria_id = CASE WHEN $9 THEN $3 ELSE categoria_id END, forma_pago = COALESCE($4, forma_pago),
           cuenta_pago_id = $5, local_id = $6, creado_en = COALESCE($7, creado_en),
           pct_local1 = CASE WHEN $6::int IS NOT NULL THEN NULL ELSE COALESCE($10, pct_local1) END
       WHERE id = $8 RETURNING *`,
      [concepto, importe, categoria_id || null, forma_pago, cuenta_pago_id || null, localIdFinal, fechaFinal, id, tocaCategoria, pct]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar el movimiento: ' + error.message });
  }
};

// Cambiar la categoria de varios egresos manuales a la vez (ej: pasar todos los "Luz" de "Sueldo Sabrina" a "Servicios").
// Solo toca egresos cargados a mano: ni los automaticos ni los anulados.
const recategorizarMovimientos = async (req, res) => {
  try {
    const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(x => parseInt(x)).filter(x => x > 0))];
    if (!ids.length) return res.status(400).json({ error: 'Elegí al menos un movimiento' });
    if (ids.length > 500) return res.status(400).json({ error: 'Son demasiados movimientos de una vez (máximo 500)' });
    const cat = req.body.categoria_id === null || req.body.categoria_id === '' ? null : parseInt(req.body.categoria_id);
    if (cat !== null) {
      if (!(cat > 0)) return res.status(400).json({ error: 'Categoría inválida' });
      const c = await pool.query('SELECT id FROM categorias_costo WHERE id = $1', [cat]);
      if (!c.rows.length) return res.status(400).json({ error: 'Esa categoría no existe' });
    }
    const r = await pool.query(
      `UPDATE movimientos_caja m SET categoria_id = $2
       WHERE m.id = ANY($1::int[]) AND m.tipo = 'E' AND ${NO_ANULADO('m')}
         AND COALESCE(m.concepto, '') !~* '^(Venta |Gift Card|Seña|Cobro diferencia|Devolucion de diferencia|Pago (total )?comisiones)'
       RETURNING m.id`, [ids, cat]);
    res.json({ ok: true, actualizados: r.rowCount, omitidos: ids.length - r.rowCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar la categoría: ' + error.message });
  }
};

// Eliminar un movimiento manual. Los que genera el sistema solo (ventas, gift cards,
// señas, cambios, pagos de comisiones) no se borran desde aca: se anulan desde su origen.
const deleteMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const r0 = await pool.query('SELECT concepto FROM movimientos_caja WHERE id = $1', [id]);
    if (r0.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    if (/^(Venta |Gift Card|Seña|Cobro diferencia|Devolucion de diferencia|Pago (total )?comisiones)/i.test(r0.rows[0].concepto || '')) {
      return res.status(400).json({ error: 'Este movimiento lo generó el sistema: anulalo desde su origen (venta, gift card, cambio o comisión).' });
    }
    await pool.query('DELETE FROM movimientos_caja WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el movimiento: ' + error.message });
  }
};

// --- Analizador financiero: calificacion + comparacion mes a mes + benchmarks generales de retail ---

// Convierte un porcentaje a un puntaje 0-100 segun 3 umbrales (bueno / regular / alto),
// para metricas donde "menor es mejor" (costos como % de ingresos).
function puntajeMenorEsMejor(pct, bueno, regular, alto) {
  if (pct <= bueno) return 100;
  if (pct <= regular) return 70;
  if (pct <= alto) return 40;
  return 15;
}

// Puntaje de salud (0-100) de un mes a partir de su estado de resultados y el del mes anterior.
// Lo usan el Analisis y las Medallas, para que las dos cuentas sean siempre la misma.
function calcularPuntajeSalud(actual, anterior) {
  const ingresos = actual.ingresos.total;
  const margenNetoPct = ingresos > 0 ? (actual.resultado_neto / ingresos) * 100 : 0;
  const variablesPct = ingresos > 0 ? (actual.variables.total / ingresos) * 100 : 0;
  const fijosPct = ingresos > 0 ? (actual.fijos.total / ingresos) * 100 : 0;
  const adminPct = ingresos > 0 ? (actual.admin.total / ingresos) * 100 : 0;
  const sueldosPct = ingresos > 0 ? (actual.sueldos.total / ingresos) * 100 : 0;

  // Comparacion contra el mes anterior (contra vos mismo)
  const ingresosAnterior = anterior.ingresos.total;
  const margenNetoPctAnterior = ingresosAnterior > 0 ? (anterior.resultado_neto / ingresosAnterior) * 100 : 0;
  const variacionIngresos = ingresosAnterior > 0 ? ((ingresos - ingresosAnterior) / ingresosAnterior) * 100 : null;

  // Puntaje de margen neto (mayor es mejor)
  let puntajeMargen;
  if (margenNetoPct >= 15) puntajeMargen = 100;
  else if (margenNetoPct >= 8) puntajeMargen = 75;
  else if (margenNetoPct >= 0) puntajeMargen = 50;
  else puntajeMargen = 15;

  // Puntajes de estructura de costos (contra parametros generales de retail)
  const puntajeVariables = puntajeMenorEsMejor(variablesPct, 60, 70, 80);
  const puntajeFijos = puntajeMenorEsMejor(fijosPct, 15, 25, 35);
  const puntajeAdmin = puntajeMenorEsMejor(adminPct, 10, 15, 22);
  const puntajeSueldos = puntajeMenorEsMejor(sueldosPct, 30, 40, 50);

  let puntajeBase = (puntajeMargen + puntajeVariables + puntajeFijos + puntajeAdmin + puntajeSueldos) / 5;

  // Ajuste por tendencia contra vos mismo: si el margen neto mejoro respecto al mes
  // anterior, suma; si empeoro, resta (acotado para no sacar el puntaje de 0-100).
  let ajusteTendencia = 0;
  if (ingresosAnterior > 0) {
    const deltaMargen = margenNetoPct - margenNetoPctAnterior;
    ajusteTendencia = Math.max(-10, Math.min(10, deltaMargen));
  }
  const puntajeFinal = Math.round(Math.max(0, Math.min(100, puntajeBase + ajusteTendencia)));
  return {
    puntajeFinal, ingresos, ingresosAnterior, margenNetoPct, margenNetoPctAnterior, variacionIngresos,
    variablesPct, fijosPct, adminPct, sueldosPct,
    puntajeMargen, puntajeVariables, puntajeFijos, puntajeAdmin, puntajeSueldos,
  };
}

const getAnalisisFinanciero = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = parseInt(mes) || new Date().getMonth() + 1;
    const anioActual = parseInt(anio) || new Date().getFullYear();
    const mesAnteriorNum = mesActual === 1 ? 12 : mesActual - 1;
    const anioMesAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

    const actual = await calcularFlujoEstructurado(mesActual, anioActual, local_id);
    const anterior = await calcularFlujoEstructurado(mesAnteriorNum, anioMesAnterior, local_id);
    const {
      puntajeFinal, ingresos, ingresosAnterior, margenNetoPct, margenNetoPctAnterior, variacionIngresos,
      variablesPct, fijosPct, adminPct, sueldosPct,
      puntajeMargen, puntajeVariables, puntajeFijos, puntajeAdmin, puntajeSueldos,
    } = calcularPuntajeSalud(actual, anterior);

    // Mes en curso: la variación de ingresos se compara contra los mismos días del mes anterior (como el Dashboard),
    // no contra el mes anterior completo (si no, a principio de mes siempre da muy negativo)
    let variacionMostrar = variacionIngresos, hastaDia = null;
    try {
      const h = (await pool.query(`SELECT EXTRACT(DAY FROM ${AR('NOW()')})::int AS d, EXTRACT(MONTH FROM ${AR('NOW()')})::int AS m, EXTRACT(YEAR FROM ${AR('NOW()')})::int AS a`)).rows[0];
      if (h.m === mesActual && h.a === anioActual) {
        const loc = normalizarLocalId(local_id);
        const suma = async (m, a) => num((await pool.query(`SELECT COALESCE(SUM(v.total), 0) AS t FROM ventas v
          WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)} AND EXTRACT(DAY FROM ${AR('v.creado_en')}) <= $3${loc !== null ? ' AND v.local_id = $4' : ''}`,
          loc !== null ? [m, a, h.d, loc] : [m, a, h.d])).rows[0].t);
        const [ya, antes] = [await suma(mesActual, anioActual), await suma(mesAnteriorNum, anioMesAnterior)];
        variacionMostrar = antes > 0 ? ((ya - antes) / antes) * 100 : null;
        hastaDia = h.d;
      }
    } catch (e) { console.error('[analisis] mismos dias:', e.message); }

    let calificacion, color;
    if (puntajeFinal >= 85) { calificacion = 'Excelente'; color = '#2d7a4f'; }
    else if (puntajeFinal >= 70) { calificacion = 'Buena'; color = '#3F7A2A'; }
    else if (puntajeFinal >= 50) { calificacion = 'Regular'; color = '#c9a84c'; }
    else if (puntajeFinal >= 30) { calificacion = 'Preocupante'; color = '#e07b39'; }
    else { calificacion = 'Critica'; color = '#c0392b'; }

    // Metricas individuales con su estado, para mostrar en tarjetas
    const metrica = (nombre, valorPct, puntaje, comentarioBueno, comentarioMalo) => ({
      nombre, valor: parseFloat(valorPct.toFixed(1)), puntaje,
      estado: puntaje >= 70 ? 'bien' : puntaje >= 40 ? 'regular' : 'mal',
      comentario: puntaje >= 70 ? comentarioBueno : comentarioMalo
    });

    const metricas = [
      metrica('Margen neto', margenNetoPct, puntajeMargen,
        'Buen margen neto sobre lo que factura.',
        'El margen neto esta bajo (o negativo) -- lo que factura casi no alcanza a cubrir los costos.'),
      metrica('Costos variables (mercaderia, comisiones, envios)', variablesPct, puntajeVariables,
        'Los costos variables estan en un rango sano frente a la facturacion.',
        'Los costos variables se llevan una porcion muy grande de la facturacion. Revisar precios de compra o markup.'),
      metrica('Costos fijos (alquiler, servicios, seguros)', fijosPct, puntajeFijos,
        'Los costos fijos son livianos frente a la facturacion.',
        'Los costos fijos pesan mucho frente a la facturacion actual.'),
      metrica('Gastos administrativos y marketing', adminPct, puntajeAdmin,
        'Los gastos administrativos estan controlados.',
        'Los gastos administrativos/marketing son altos en relacion a lo que factura.'),
      metrica('Sueldos', sueldosPct, puntajeSueldos,
        'La carga de sueldos esta en un rango razonable.',
        'Los sueldos se llevan una porcion muy grande de la facturacion.')
    ];

    res.json({
      mes: mesActual,
      anio: anioActual,
      local_id: local_id || 'consolidado',
      puntaje: puntajeFinal,
      calificacion,
      color,
      ingresos_mes: ingresos,
      resultado_neto_mes: actual.resultado_neto,
      margen_neto_pct: parseFloat(margenNetoPct.toFixed(1)),
      comparacion_mes_anterior: {
        mes: mesAnteriorNum,
        anio: anioMesAnterior,
        ingresos: ingresosAnterior,
        margen_neto_pct: parseFloat(margenNetoPctAnterior.toFixed(1)),
        variacion_ingresos_pct: variacionMostrar !== null ? parseFloat(variacionMostrar.toFixed(1)) : null,
        hasta_dia: hastaDia, // si no es null: comparado contra los primeros hasta_dia días del mes anterior
        tendencia: ingresosAnterior === 0 ? 'sin_datos' : (margenNetoPct >= margenNetoPctAnterior ? 'mejora' : 'empeora')
      },
      metricas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el analisis financiero: ' + error.message });
  }
};

// ---------------- Medallas de salud del negocio ----------------
// Se calculan con los meses reales (hasta 24 hacia atras). Las de salud usan solo meses ya
// cerrados, y solo cuentan los meses con ingresos Y gastos cargados: si no se cargan gastos,
// el margen daria 100% y se ganarian sin esfuerzo.
const MEDALLAS = [
  { id: 'equilibrio', icono: '⚖️', nombre: 'En equilibrio', como: 'Un mes con ventas por encima del punto de equilibrio' },
  { id: 'antes20', icono: '⏱️', nombre: 'Antes del 20', como: 'Pasar el punto de equilibrio antes del día 20 del mes' },
  { id: 'buena', icono: '💚', nombre: 'Buena salud', como: 'Cerrar un mes con salud Buena (70 puntos o más)' },
  { id: 'excelente', icono: '🌟', nombre: 'Excelencia', como: 'Cerrar un mes con salud Excelente (85 puntos o más)' },
  { id: 'racha3', icono: '🔥', nombre: 'Racha de 3', como: '3 meses seguidos con salud Buena o mejor' },
  { id: 'mejora', icono: '📈', nombre: 'Mejora continua', como: 'Que el puntaje de salud suba 3 meses seguidos' },
  { id: 'margen', icono: '💰', nombre: 'Margen sano', como: 'Cerrar un mes con margen neto del 15% o más' },
  { id: 'fijos', icono: '🏠', nombre: 'Costos a raya', como: 'Cerrar un mes con costos fijos del 15% o menos de las ventas' },
  { id: 'record', icono: '🏆', nombre: 'Mes récord', como: 'Vender más que en cualquier mes anterior (con al menos 3 meses de historia)' },
  { id: 'anio', icono: '💎', nombre: 'Año sin pérdidas', como: '12 meses seguidos con resultado positivo' },
];

const getMedallas = async (req, res) => {
  try {
    const localNum = normalizarLocalId(req.query.local_id);
    const filtroLocal = (i) => (localNum !== null ? `AND v.local_id = $${i}` : '');
    const pLocal = localNum !== null ? [localNum] : [];

    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const mesHoy = ahoraAR.getMonth() + 1, anioHoy = ahoraAR.getFullYear();
    const clave = (m, a) => a * 12 + (m - 1);
    const deClave = (k) => ({ mes: (k % 12) + 1, anio: Math.floor(k / 12) });

    const primera = await pool.query(`SELECT MIN(${AR('v.creado_en')}) AS f FROM ventas v WHERE ${VENTA_VALIDA('v')} ${filtroLocal(1)}`, pLocal);
    const vacias = MEDALLAS.map(m => ({ ...m, ganada: false, primera: null, veces: 0, progreso: null }));
    if (!primera.rows[0].f) return res.json({ medallas: vacias, ganadas: 0, total: MEDALLAS.length, meses_analizados: 0 });

    const f0 = new Date(primera.rows[0].f);
    const kHoy = clave(mesHoy, anioHoy);
    const kDesde = Math.max(clave(f0.getMonth() + 1, f0.getFullYear()), kHoy - 23);

    // Estado de resultados de cada mes (y el anterior al primero, para el puntaje de salud)
    const claves = [];
    for (let k = kDesde - 1; k <= kHoy; k++) claves.push(k);
    const estados = {};
    for (let i = 0; i < claves.length; i += 6) {
      const lote = claves.slice(i, i + 6);
      const res6 = await Promise.all(lote.map(k => { const { mes, anio } = deClave(k); return calcularFlujoEstructurado(mes, anio, req.query.local_id); }));
      lote.forEach((k, j) => { estados[k] = res6[j]; });
    }

    // Margen bruto por mes (para el punto de equilibrio) y ventas por dia (para "Antes del 20")
    const desdeFecha = `${deClave(kDesde).anio}-${String(deClave(kDesde).mes).padStart(2, '0')}-01`;
    const [margenes, diarias] = await Promise.all([
      pool.query(`
        SELECT EXTRACT(YEAR FROM ${AR('v.creado_en')})::int AS anio, EXTRACT(MONTH FROM ${AR('v.creado_en')})::int AS mes,
               COALESCE(SUM(${IMPORTE_VI}), 0) AS ingresos,
               COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS costos
        FROM venta_items vi JOIN ventas v ON vi.venta_id = v.id JOIN productos p ON vi.producto_id = p.id
        WHERE ${VENTA_VALIDA('v')} AND (${AR('v.creado_en')})::date >= $1::date ${filtroLocal(2)}
        GROUP BY 1, 2`, [desdeFecha, ...pLocal]),
      pool.query(`
        SELECT (${AR('v.creado_en')})::date AS dia, SUM(v.total) AS total
        FROM ventas v
        WHERE ${VENTA_VALIDA('v')} AND (${AR('v.creado_en')})::date >= $1::date ${filtroLocal(2)}
        GROUP BY 1 ORDER BY 1`, [desdeFecha, ...pLocal]),
    ]);
    const margenDe = {};
    margenes.rows.forEach(r => { margenDe[clave(r.mes, r.anio)] = r; });
    const ventasPorDia = {};
    diarias.rows.forEach(r => {
      const d = new Date(r.dia);
      const k = clave(d.getUTCMonth() + 1, d.getUTCFullYear());
      (ventasPorDia[k] = ventasPorDia[k] || []).push({ dia: d.getUTCDate(), total: num(r.total) });
    });

    // Datos de cada mes
    const meses = [];
    for (let k = kDesde; k <= kHoy; k++) {
      const est = estados[k];
      const ingresos = est.ingresos.total;
      const valido = ingresos > 0 && est.total_egresos > 0;
      const cerrado = k < kHoy;
      const salud = calcularPuntajeSalud(est, estados[k - 1]);

      const mg = margenDe[k];
      const ingItems = mg ? num(mg.ingresos) : 0;
      const margenBruto = ingItems > 0 ? (ingItems - num(mg.costos)) / ingItems : 0;
      const pctComisiones = est.total_ventas > 0 ? est.comisiones_medios_pago.total / est.total_ventas : 0;
      const margenContribucion = Math.max(0, margenBruto - pctComisiones);
      const costosFijos = (await costosFijosParaEquilibrio(est, deClave(k).mes, deClave(k).anio, req.query.local_id, !cerrado,
        [estados[k - 1], estados[k - 2], estados[k - 3]].every(Boolean) ? [estados[k - 1], estados[k - 2], estados[k - 3]] : undefined)).total;
      const pe = costosFijos > 0 && margenContribucion > 0 ? costosFijos / margenContribucion : 0;

      let diaEquilibrio = null;
      if (pe > 0) {
        let acumulado = 0;
        for (const d of (ventasPorDia[k] || [])) { acumulado += d.total; if (acumulado >= pe) { diaEquilibrio = d.dia; break; } }
      }
      meses.push({ k, ...deClave(k), ingresos, valido, cerrado, puntaje: salud.puntajeFinal, margenNetoPct: salud.margenNetoPct, fijosPct: salud.fijosPct, fijos: est.fijos.total, resultado: est.resultado_neto, pe, diaEquilibrio });
    }

    // Reglas: por cada mes, si se cumple la medalla ese mes
    const saludOk = (m) => m.cerrado && m.valido;
    const cumple = {
      equilibrio: (m) => m.valido && m.pe > 0 && m.ingresos >= m.pe,
      antes20: (m) => m.valido && m.diaEquilibrio !== null && m.diaEquilibrio <= 20,
      buena: (m) => saludOk(m) && m.puntaje >= 70,
      excelente: (m) => saludOk(m) && m.puntaje >= 85,
      margen: (m) => saludOk(m) && m.margenNetoPct >= 15,
      fijos: (m) => saludOk(m) && m.fijos > 0 && m.fijosPct <= 15,
    };
    // Rachas: cuenta meses seguidos que cumplen la condicion (un mes que no cumple la corta)
    const racha = (cond, largo) => {
      let actual = 0, veces = 0, primera = null;
      meses.forEach(m => {
        if (!m.cerrado) return;
        actual = cond(m) ? actual + 1 : 0;
        if (actual > 0 && actual % largo === 0) { veces++; if (!primera) primera = { mes: m.mes, anio: m.anio }; }
      });
      return { veces, primera, progreso: { actual: actual % largo, meta: largo } };
    };

    const resultado = MEDALLAS.map(med => {
      let veces = 0, primera = null, progreso = null;
      if (cumple[med.id]) {
        meses.forEach(m => { if (cumple[med.id](m)) { veces++; if (!primera) primera = { mes: m.mes, anio: m.anio }; } });
      } else if (med.id === 'racha3') {
        ({ veces, primera, progreso } = racha(m => saludOk(m) && m.puntaje >= 70, 3));
      } else if (med.id === 'anio') {
        ({ veces, primera, progreso } = racha(m => saludOk(m) && m.resultado > 0, 12));
      } else if (med.id === 'mejora') {
        // 3 subidas seguidas del puntaje entre meses cerrados validos
        let subidas = 0;
        meses.forEach((m, i) => {
          const prev = meses[i - 1];
          if (!saludOk(m)) { subidas = 0; return; }
          subidas = prev && saludOk(prev) && m.puntaje > prev.puntaje ? subidas + 1 : 0;
          if (subidas > 0 && subidas % 3 === 0) { veces++; if (!primera) primera = { mes: m.mes, anio: m.anio }; }
        });
        progreso = { actual: subidas % 3, meta: 3 };
      } else if (med.id === 'record') {
        let maximo = 0, conVentas = 0;
        meses.forEach(m => {
          if (conVentas >= 3 && m.ingresos > maximo) { veces++; if (!primera) primera = { mes: m.mes, anio: m.anio }; }
          if (m.ingresos > 0) conVentas++;
          maximo = Math.max(maximo, m.ingresos);
        });
      }
      return { ...med, ganada: veces > 0, primera, veces, progreso };
    });

    res.json({ medallas: resultado, ganadas: resultado.filter(m => m.ganada).length, total: MEDALLAS.length, meses_analizados: meses.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular las medallas: ' + error.message });
  }
};

// ---------------- Toma de decisiones ----------------
// Base para las simulaciones: promedio de los ultimos 3 meses cerrados con ventas. Las cuentas de
// cada situacion se hacen en pantalla (son instantaneas mientras se escribe) con estos numeros:
//   ganancia estimada = ventas x margen de contribucion - costos fijos
//   margen de contribucion = margen bruto de la mercaderia - comisiones de los medios de pago
const getBaseDecisiones = async (req, res) => {
  try {
    const localNum = normalizarLocalId(req.query.local_id);
    const ahoraAR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const clave = (m, a) => a * 12 + (m - 1);
    const deClave = (k) => ({ mes: (k % 12) + 1, anio: Math.floor(k / 12) });
    const kHoy = clave(ahoraAR.getMonth() + 1, ahoraAR.getFullYear());

    // Ultimos 3 meses cerrados
    const claves = [kHoy - 1, kHoy - 2, kHoy - 3];
    const estados = await Promise.all(claves.map(k => { const { mes, anio } = deClave(k); return calcularFlujoEstructurado(mes, anio, req.query.local_id); }));
    const usados = estados.map((e, i) => ({ e, k: claves[i] })).filter(x => x.e.ingresos.total > 0);
    if (!usados.length) {
      return res.json({ suficiente: false, motivo: 'Todavía no hay un mes completo con ventas para usar de base. Las simulaciones van a estar disponibles cuando cierre el primer mes.' });
    }
    const n = usados.length;
    const prom = (f) => usados.reduce((s, x) => s + f(x.e), 0) / n;
    const ventasMes = prom(e => e.ingresos.total);
    const totalVentasPos = usados.reduce((s, x) => s + x.e.total_ventas, 0);
    const comisionesPct = totalVentasPos > 0 ? usados.reduce((s, x) => s + x.e.comisiones_medios_pago.total, 0) / totalVentasPos : 0;
    const costos = {
      fijos: prom(e => e.fijos.total),
      administrativos: prom(e => e.admin.total),
      sueldos: prom(e => e.sueldos.total),
      impuestos: prom(e => e.impuestos.total),
    };
    const costosFijos = costos.fijos + costos.administrativos + costos.sueldos + costos.impuestos;

    // Margen bruto de la mercaderia en esos meses (solo productos con costo cargado)
    const kMin = Math.min(...usados.map(x => x.k)), kMax = Math.max(...usados.map(x => x.k));
    const desde = `${deClave(kMin).anio}-${String(deClave(kMin).mes).padStart(2, '0')}-01`;
    const hastaD = deClave(kMax + 1);
    const hasta = `${hastaD.anio}-${String(hastaD.mes).padStart(2, '0')}-01`;
    const pLocal = localNum !== null ? [localNum] : [];
    const [mg, historia] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(${IMPORTE_VI}), 0) AS ingresos,
               COALESCE(SUM(CASE WHEN COALESCE(p.costo, 0) > 0 THEN ${IMPORTE_VI} ELSE 0 END), 0) AS ingresos_con_costo,
               COALESCE(SUM(CASE WHEN COALESCE(p.costo, 0) > 0 THEN vi.cantidad * p.costo ELSE 0 END), 0) AS costos
        FROM venta_items vi JOIN ventas v ON vi.venta_id = v.id JOIN productos p ON vi.producto_id = p.id
        WHERE ${VENTA_VALIDA('v')} AND (${AR('v.creado_en')})::date >= $1::date AND (${AR('v.creado_en')})::date < $2::date
          ${localNum !== null ? 'AND v.local_id = $3' : ''}`, [desde, hasta, ...pLocal]),
      // Ventas de cada mes del ultimo año (para "tu mejor mes")
      pool.query(`
        SELECT EXTRACT(YEAR FROM ${AR('v.creado_en')})::int AS anio, EXTRACT(MONTH FROM ${AR('v.creado_en')})::int AS mes, SUM(v.total) AS total
        FROM ventas v
        WHERE ${VENTA_VALIDA('v')} AND v.creado_en >= NOW() - INTERVAL '13 months' ${localNum !== null ? 'AND v.local_id = $1' : ''}
        GROUP BY 1, 2`, pLocal),
    ]);
    // Mercaderia parada: productos activos con stock y costo, sin ninguna venta en 90 dias
    const colStock = localNum === 1 ? 'COALESCE(p.stock_rg, p.stock, 0)' : localNum === 2 ? 'COALESCE(p.stock_ush, 0)' : 'COALESCE(p.stock, 0)';
    let parado = { productos: 0, valor_costo: 0, valor_venta: 0, top: [] };
    try {
      const pr = await pool.query(`
        SELECT p.nombre, ${colStock} AS stock, p.costo, p.precio
        FROM productos p
        WHERE p.activo = TRUE AND ${colStock} > 0 AND COALESCE(p.costo, 0) > 0
          AND NOT EXISTS (
            SELECT 1 FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
            WHERE vi.producto_id = p.id AND ${VENTA_VALIDA('v')} AND v.creado_en >= NOW() - INTERVAL '90 days'
              ${localNum !== null ? 'AND v.local_id = $1' : ''})
        ORDER BY ${colStock} * p.costo DESC`, pLocal);
      pr.rows.forEach(r => { parado.productos++; parado.valor_costo += num(r.stock) * num(r.costo); parado.valor_venta += num(r.stock) * num(r.precio); });
      parado.top = pr.rows.slice(0, 5).map(r => ({ nombre: r.nombre, stock: num(r.stock), valor_costo: num(r.stock) * num(r.costo) }));
    } catch (e) { console.error('stock parado:', e.message); }

    // ---- Datos para "Bajar costos" ----
    // Cada costo fijo por categoria (promedio por mes)
    const porCategoria = {};
    usados.forEach(({ e }) => {
      [['fijos', 'Costos fijos'], ['admin', 'Administrativos y marketing'], ['sueldos', 'Sueldos'], ['impuestos', 'Impuestos']].forEach(([g, grupo]) => {
        Object.entries(e[g].detalle || {}).forEach(([nombre, monto]) => {
          const k = g + '|' + nombre;
          if (!porCategoria[k]) porCategoria[k] = { grupo, nombre, monto: 0 };
          porCategoria[k].monto += num(monto) / n;
        });
      });
    });
    const costosCategorias = Object.values(porCategoria).filter(c => c.monto > 0).sort((a, b) => b.monto - a.monto);
    // Comisiones de cada medio de pago (promedio por mes)
    const medios = {};
    await Promise.all(usados.map(async ({ k }) => {
      const { mes, anio } = deClave(k);
      const cm = await calcularComisionesMedios(mes, anio, localNum);
      cm.detalle.forEach(d => {
        if (!medios[d.medio]) medios[d.medio] = { medio: d.medio, monto: 0, comision: 0, comision_pct: d.comision_pct, efectivo: d.efectivo };
        medios[d.medio].monto += d.monto / n;
        medios[d.medio].comision += d.comision / n;
      });
    }));
    const comisionesMedios = Object.values(medios).filter(m => m.comision > 0).sort((a, b) => b.comision - a.comision);
    // Proveedores a los que mas se les compra (ultimos 90 dias)
    let proveedoresCompras = [];
    try {
      const pc = await pool.query(`
        SELECT pr.nombre, SUM(o.total) AS total, COUNT(*) AS ordenes
        FROM ordenes_ingreso o JOIN proveedores pr ON pr.id = o.proveedor_id
        WHERE COALESCE(o.fecha_factura, o.creado_en::date) >= CURRENT_DATE - 90
        GROUP BY pr.nombre ORDER BY SUM(o.total) DESC LIMIT 5`);
      proveedoresCompras = pc.rows.map(r => ({ nombre: r.nombre, total_90: num(r.total), por_mes: num(r.total) / 3, ordenes: parseInt(r.ordenes) || 0 }));
    } catch (e) { console.error('compras por proveedor:', e.message); }
    // Productos que venden bien pero dejan poco margen (ultimos 90 dias)
    let bajoMargen = [];
    try {
      const bm = await pool.query(`
        SELECT p.nombre, pr.nombre AS proveedor, SUM(${IMPORTE_VI}) AS ventas, SUM(vi.cantidad * p.costo) AS costos
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
        LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
        WHERE ${VENTA_VALIDA('v')} AND COALESCE(p.costo, 0) > 0 AND v.creado_en >= NOW() - INTERVAL '90 days'
          ${localNum !== null ? 'AND v.local_id = $1' : ''}
        GROUP BY p.nombre, pr.nombre
        HAVING SUM(${IMPORTE_VI}) > 0
           AND (SUM(${IMPORTE_VI}) - SUM(vi.cantidad * p.costo)) / SUM(${IMPORTE_VI}) < 0.35
        ORDER BY SUM(${IMPORTE_VI}) DESC LIMIT 5`, pLocal);
      bajoMargen = bm.rows.map(r => ({ nombre: r.nombre, proveedor: r.proveedor, ventas_mes: num(r.ventas) / 3, margen_pct: (num(r.ventas) - num(r.costos)) / num(r.ventas) * 100, costo_mes: num(r.costos) / 3 }));
    } catch (e) { console.error('bajo margen:', e.message); }

    const ingCosto = num(mg.rows[0].ingresos_con_costo);
    const margenBruto = ingCosto > 0 ? (ingCosto - num(mg.rows[0].costos)) / ingCosto : null;
    const cobertura = num(mg.rows[0].ingresos) > 0 ? ingCosto / num(mg.rows[0].ingresos) : 0;
    let mejor = null;
    historia.rows.forEach(r => {
      if (clave(r.mes, r.anio) >= kHoy) return; // solo meses cerrados
      if (!mejor || num(r.total) > mejor.ventas) mejor = { mes: r.mes, anio: r.anio, ventas: num(r.total) };
    });

    if (margenBruto === null) {
      return res.json({ suficiente: false, motivo: 'Faltan los costos de los productos: sin el costo no se puede saber cuánto se gana en cada venta. Cargalos en Inventario.' });
    }
    const margenContribucion = Math.max(0, margenBruto - comisionesPct);
    res.json({
      suficiente: true,
      meses: usados.map(x => deClave(x.k)).sort((a, b) => clave(a.mes, a.anio) - clave(b.mes, b.anio)),
      ventas_mes: ventasMes,
      margen_bruto_pct: margenBruto * 100,
      comisiones_pct: comisionesPct * 100,
      margen_contribucion_pct: margenContribucion * 100,
      cobertura_costos_pct: Math.round(cobertura * 100),
      costos_fijos: costosFijos,
      costos_detalle: costos,
      sin_gastos: costosFijos <= 0,
      ganancia_mes: ventasMes * margenContribucion - costosFijos,
      punto_equilibrio: margenContribucion > 0 ? costosFijos / margenContribucion : null,
      mejor_mes: mejor,
      cantidad_ventas_mes: prom(e => e.cantidad_ventas),
      stock_parado: parado,
      costos_categorias: costosCategorias,
      comisiones_medios: comisionesMedios,
      proveedores_compras: proveedoresCompras,
      bajo_margen: bajoMargen,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al preparar la toma de decisiones: ' + error.message });
  }
};

// Compara dos rangos de fechas cualquiera (dias argentinos, sin anuladas ni pruebas).
const getComparativaMeses = async (req, res) => {
  try {
    const { local_id, desde1, hasta1, desde2, hasta2 } = req.query;
    if (!desde1 || !hasta1 || !desde2 || !hasta2) {
      return res.status(400).json({ error: 'Elegi las fechas de los dos periodos a comparar' });
    }
    const localNum = normalizarLocalId(local_id);

    const fecha = /^\d{4}-\d{2}-\d{2}$/;
    if (![desde1, hasta1, desde2, hasta2].every(f => fecha.test(f))) return res.status(400).json({ error: 'Fechas inválidas' });

    // Cada periodo con la misma cuenta que el Estado de resultados (ventas, egresos por grupo, comisiones de medios y neto)
    const GRUPOS = [['variables', 'Mercadería y gastos variables'], ['fijos', 'Gastos fijos'], ['sueldos', 'Sueldos y comisiones'],
      ['admin', 'Administrativos y marketing'], ['impuestos', 'Impuestos'], ['comisiones_medios_pago', 'Comisiones de tarjetas y apps']];
    const consultarPeriodo = async (desde, hasta) => {
      const est = await calcularFlujoEstructurado(null, null, local_id, { desde, hasta });
      const total = est.total_ventas, cantidad = est.cantidad_ventas;
      const dias = Math.max(1, Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000) + 1);
      return {
        total, cantidad, ticket_promedio: cantidad > 0 ? total / cantidad : 0, dias, promedio_diario: total / dias,
        ingresos: est.ingresos.total, egresos: est.total_egresos, neto: est.resultado_neto,
        grupos: Object.fromEntries(GRUPOS.map(([k]) => [k, est[k].total])),
        detalle: Object.fromEntries(GRUPOS.map(([k]) => [k, est[k].detalle])),
      };
    };

    const [periodo1, periodo2] = await Promise.all([consultarPeriodo(desde1, hasta1), consultarPeriodo(desde2, hasta2)]);
    const variacion = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    // En que gastos cambio mas de un periodo al otro (por rubro, los 6 que mas se movieron)
    const rubros = {};
    GRUPOS.forEach(([k, nombre]) => {
      [[periodo1, 'a'], [periodo2, 'b']].forEach(([per, lado]) => Object.entries(per.detalle[k] || {}).forEach(([n, v]) => {
        const x = rubros[k + '|' + n] || (rubros[k + '|' + n] = { grupo: nombre, nombre: n, a: 0, b: 0 });
        x[lado] += v;
      }));
    });
    const cambios = Object.values(rubros).map(x => ({ ...x, dif: x.a - x.b })).filter(x => Math.abs(x.dif) >= 1)
      .sort((x, y) => Math.abs(y.dif) - Math.abs(x.dif)).slice(0, 6);
    delete periodo1.detalle; delete periodo2.detalle;

    res.json({
      periodo_1: { desde: desde1, hasta: hasta1, ...periodo1 },
      periodo_2: { desde: desde2, hasta: hasta2, ...periodo2 },
      variacion_pct: variacion(periodo1.total, periodo2.total),
      variacion_cantidad_pct: variacion(periodo1.cantidad, periodo2.cantidad),
      variacion_ticket_pct: variacion(periodo1.ticket_promedio, periodo2.ticket_promedio),
      variacion_egresos_pct: variacion(periodo1.egresos, periodo2.egresos),
      grupos: GRUPOS.map(([k, nombre]) => ({ k, nombre, a: periodo1.grupos[k], b: periodo2.grupos[k], variacion_pct: variacion(periodo1.grupos[k], periodo2.grupos[k]) }))
        .filter(g => g.a > 0 || g.b > 0),
      cambios,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al comparar periodos: ' + error.message });
  }
};


// ===================== Informe del mes (para descargar) =====================
// Todo lo del mes en un solo pedido, comparado con el mes anterior: facturación, ingresos y egresos (con su %),
// sueldos y comisiones, vendedoras, ticket promedio, locales, canales, medios de pago, productos, marcas y clientes.
// Si el mes está en curso, la facturación también se compara con los mismos días del mes anterior.
// Sueldos del mes por persona: los mismos egresos que suman "Sueldos y comisiones" (así la lista da el mismo total),
// juntando los pagos de cada una aunque se hayan cargado distinto ("Sueldo Vero", "Adelanto sueldo vero", "Aguinaldo Vero")
const PALABRAS_SUELDO = /(^|\s)(sueldos?|aguinaldos?|sac|adelantos?|anticipos?|pagos?|liquidaci[oó]n|vacaciones|quincena|1ra|2da|1er|2do|primera|segunda|mitad|parte|saldo|resto|horas?|extras?|cuota|de|del|la|el|a|y|mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|\d+)(?=\s|$)/gi;
function sueldosPorPersona(egresos) {
  const m = new Map();
  (egresos || []).filter(r => r.categoria_tipo === 'sueldo').forEach(r => {
    const comision = /comisi/i.test(r.concepto || '') || /comisi/i.test(r.categoria_nombre || '');
    // Si la categoría es de una persona ("Sueldo Sabrina", "Sueldo Enrique"), todo lo cargado ahí es de esa persona
    // (aunque el concepto diga "Telepase" o "Kiosco"); si la categoría es la general ("Sueldos"), se usa el concepto
    const cat = String(r.categoria_nombre || '').trim(), catPersona = cat && !/^(sueldos?|sueldos? y cargas.*|sueldos? empleados?|personal|sin categor[ií]a)$/i.test(cat);
    let quien = comision ? 'Comisiones de vendedores' : String(catPersona ? cat : r.concepto || '').replace(/[\/.:,()-]/g, ' ').replace(/\s+/g, ' ');
    if (!comision) { let antes; do { antes = quien; quien = quien.replace(PALABRAS_SUELDO, ' ').replace(/\s+/g, ' '); } while (quien !== antes); quien = quien.trim(); }
    if (!quien) quien = 'Sueldos sin nombre';
    const k = quien.toLowerCase();
    const x = m.get(k) || { quien: comision ? quien : quien.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase()), total: 0, pagos: 0 };
    x.total += num(r.importe); x.pagos += 1; m.set(k, x);
  });
  return [...m.values()].map(x => ({ ...x, total: Math.round(x.total * 100) / 100 })).sort((a, b) => b.total - a.total);
}

const getInformeMes = async (req, res) => {
  try {
    if (!['jefe', 'admin', 'administrativo'].includes(req.usuario && req.usuario.rol)) return res.status(403).json({ error: 'Solo el dueño o encargado' });
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const mesAnt = mes === 1 ? 12 : mes - 1, anioAnt = mes === 1 ? anio - 1 : anio;
    const hoyAR = (await pool.query(`SELECT EXTRACT(DAY FROM ${AR('NOW()')})::int AS d, EXTRACT(MONTH FROM ${AR('NOW()')})::int AS m, EXTRACT(YEAR FROM ${AR('NOW()')})::int AS a`)).rows[0];
    const enCurso = hoyAR.m === mes && hoyAR.a === anio;
    const diasMes = new Date(anio, mes, 0).getDate();
    const L = (alias, i) => localNum !== null ? ` AND ${alias}.local_id = $${i}` : '';
    const P = (extra = []) => localNum !== null ? [...extra, localNum] : extra;
    const q = async (sql, params) => { try { return (await pool.query(sql, params)).rows; } catch (e) { console.error('[informe mes]', e.message); return []; } };
    const VV = VENTA_VALIDA('v');

    const [egresosMes, est, estAnt, dias, diasAnt, locales, vendedoras, vendAnt, topProd, topMarcas, medios, clientas, comisionesEq, web, cmvR, mismosDias] = await Promise.all([
      obtenerEgresos(mes, anio, localNum),
      calcularFlujoEstructurado(mes, anio, req.query.local_id),
      calcularFlujoEstructurado(mesAnt, anioAnt, req.query.local_id),
      q(`SELECT EXTRACT(DAY FROM ${AR('v.creado_en')})::int AS d, SUM(v.total) AS total, COUNT(*) AS cant FROM ventas v
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY 1 ORDER BY 1`, P([mes, anio])),
      q(`SELECT EXTRACT(DAY FROM ${AR('v.creado_en')})::int AS d, SUM(v.total) AS total FROM ventas v
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY 1 ORDER BY 1`, P([mesAnt, anioAnt])),
      q(`SELECT l.id, l.nombre,
           COALESCE(SUM(v.total) FILTER (WHERE ${EN_MES('v.creado_en', 1, 2)}), 0) AS total, COUNT(v.id) FILTER (WHERE ${EN_MES('v.creado_en', 1, 2)}) AS cant,
           COALESCE(SUM(v.total) FILTER (WHERE ${EN_MES('v.creado_en', 3, 4)}), 0) AS total_ant
         FROM locales l LEFT JOIN ventas v ON v.local_id = l.id AND ${VV}
         WHERE COALESCE(l.activo, TRUE)${localNum !== null ? ' AND l.id = $5' : ''} GROUP BY l.id, l.nombre ORDER BY l.id`, P([mes, anio, mesAnt, anioAnt])),
      q(`SELECT u.id, u.nombre, COUNT(*) AS cant, SUM(v.total) AS total FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY u.id, u.nombre ORDER BY 4 DESC LIMIT 8`, P([mes, anio])),
      q(`SELECT u.id, SUM(v.total) AS total, COUNT(*) AS cant FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY u.id`, P([mesAnt, anioAnt])),
      q(`SELECT p.id, p.nombre, p.marca, SUM(vi.cantidad)::int AS unidades, COALESCE(SUM(${IMPORTE_VI}), 0) AS total
         FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY p.id ORDER BY 4 DESC, 5 DESC LIMIT 5`, P([mes, anio])),
      q(`SELECT COALESCE(NULLIF(TRIM(p.marca), ''), 'Sin marca') AS marca, COALESCE(SUM(${IMPORTE_VI}), 0) AS total, SUM(vi.cantidad)::int AS unidades
         FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)} GROUP BY 1 ORDER BY 2 DESC LIMIT 5`, P([mes, anio])),
      calcularComisionesMedios(mes, anio, localNum).catch(() => ({ detalle: [] })),
      q(`SELECT
           (SELECT COUNT(*) FROM clientes c WHERE ${EN_MES('c.creado_en', 1, 2)}) AS nuevas,
           (SELECT COUNT(*) FROM clientes c WHERE ${EN_MES('c.creado_en', 3, 4)}) AS nuevas_ant,
           (SELECT COUNT(DISTINCT v.cliente_id) FROM ventas v WHERE ${VV} AND v.cliente_id IS NOT NULL AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 5)}) AS compraron,
           (SELECT COUNT(DISTINCT v.cliente_id) FROM ventas v WHERE ${VV} AND v.cliente_id IS NOT NULL AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 5)}
              AND EXISTS (SELECT 1 FROM ventas v2 WHERE v2.cliente_id = v.cliente_id AND COALESCE(v2.anulada, FALSE) = FALSE AND v2.creado_en < date_trunc('month', make_date($2::int, $1::int, 1)))) AS volvieron`,
        P([mes, anio, mesAnt, anioAnt])),
      // Comisiones que ganó el equipo de cada local en el mes
      q(`SELECT l.id, l.nombre, COALESCE(SUM(c.comision_ganada), 0) AS ganada, COALESCE(SUM(c.comision_ganada) FILTER (WHERE c.pagada), 0) AS pagada
         FROM locales l JOIN comisiones c ON c.local_id = l.id
         WHERE EXTRACT(MONTH FROM c.fecha) = $1 AND EXTRACT(YEAR FROM c.fecha) = $2${localNum !== null ? ' AND l.id = $3' : ''}
         GROUP BY l.id, l.nombre HAVING SUM(c.comision_ganada) > 0 ORDER BY l.id`, P([mes, anio])),
      q(`SELECT COUNT(*) FILTER (WHERE ${EN_MES('t.creado_en', 1, 2)}) AS cant, COALESCE(SUM(t.total) FILTER (WHERE ${EN_MES('t.creado_en', 1, 2)}), 0) AS total,
           COUNT(*) FILTER (WHERE ${EN_MES('t.creado_en', 3, 4)}) AS cant_ant
         FROM tienda_pedidos t WHERE t.estado NOT IN ('cancelado', 'pendiente_pago')${L('t', 5)}`, P([mes, anio, mesAnt, anioAnt])),
      q(`SELECT COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS cmv, COALESCE(SUM(${IMPORTE_VI}), 0) AS ventas
         FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)}${L('v', 3)}`, P([mes, anio])),
      // Mes en curso: lo vendido el mes anterior hasta el mismo día
      enCurso ? q(`SELECT COALESCE(SUM(v.total), 0) AS total, COUNT(*) AS cant FROM ventas v
         WHERE ${VV} AND ${EN_MES('v.creado_en', 1, 2)} AND EXTRACT(DAY FROM ${AR('v.creado_en')}) <= $3${L('v', 4)}`, P([mesAnt, anioAnt, hoyAR.d])) : Promise.resolve(null),
    ]);

    const ventas = est.total_ventas, ventasAnt = estAnt.total_ventas, cant = est.cantidad_ventas, cantAnt = estAnt.cantidad_ventas;
    const GRUPOS = [['variables', 'Mercadería y gastos variables'], ['fijos', 'Gastos fijos'], ['sueldos', 'Sueldos y comisiones'], ['admin', 'Administrativos y marketing'], ['impuestos', 'Impuestos'], ['comisiones_medios_pago', 'Comisiones de tarjetas y apps']];
    const egresos = GRUPOS.map(([k, nombre]) => ({ k, nombre, total: est[k].total, total_ant: estAnt[k].total, detalle: Object.entries(est[k].detalle).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v).slice(0, 4) })).filter(g => g.total > 0 || g.total_ant > 0);
    const porDia = Array.from({ length: diasMes }, (_, i) => { const r = dias.find(x => x.d === i + 1), a = diasAnt.find(x => x.d === i + 1); return { d: i + 1, total: num(r && r.total), ant: num(a && a.total) }; });
    const mejorDia = porDia.reduce((m, x) => (x.total > (m ? m.total : 0) ? x : m), null);
    const vAnt = Object.fromEntries(vendAnt.map(x => [x.id, { total: num(x.total), cant: num(x.cant) }]));
    const c = clientas[0] || {}, w = web[0] || {}, cm = cmvR[0] || {};
    res.json({
      mes, anio, mes_ant: mesAnt, anio_ant: anioAnt, en_curso: enCurso, dia_hoy: enCurso ? hoyAR.d : null, dias_mes: diasMes,
      local_id: localNum,
      ventas: { total: ventas, total_ant: ventasAnt, cant, cant_ant: cantAnt, ticket: cant ? ventas / cant : 0, ticket_ant: cantAnt ? ventasAnt / cantAnt : 0,
        mismos_dias_ant: mismosDias && mismosDias[0] ? { total: num(mismosDias[0].total), cant: num(mismosDias[0].cant) } : null },
      ingresos: est.ingresos.total, ingresos_ant: estAnt.ingresos.total, ingresos_detalle: est.ingresos.detalle,
      egresos_total: est.total_egresos, egresos_total_ant: estAnt.total_egresos, egresos,
      neto: est.resultado_neto, neto_ant: estAnt.resultado_neto, sin_categoria: est.sin_categoria,
      por_dia: porDia, mejor_dia: mejorDia && mejorDia.total > 0 ? mejorDia : null,
      locales: locales.map(l => ({ id: l.id, nombre: l.nombre, total: num(l.total), total_ant: num(l.total_ant), cant: num(l.cant) })),
      vendedoras: vendedoras.map(v => ({ nombre: v.nombre, total: num(v.total), cant: num(v.cant), ticket: num(v.cant) ? num(v.total) / num(v.cant) : 0, total_ant: (vAnt[v.id] || {}).total || 0 })),
      sueldos: sueldosPorPersona(egresosMes),
      sueldos_total: est.sueldos.total,
      comisiones_equipo: comisionesEq.map(r => ({ local: r.nombre, ganada: num(r.ganada), pagada: num(r.pagada) })),
      top_productos: topProd.map(r => ({ nombre: r.nombre, marca: r.marca, unidades: num(r.unidades), total: num(r.total) })),
      top_marcas: topMarcas.map(r => ({ marca: r.marca, total: num(r.total), unidades: num(r.unidades) })),
      medios: (medios.detalle || []).map(d => ({ medio: d.medio, monto: d.monto, ventas: d.ventas })).slice(0, 6),
      clientas: { nuevas: num(c.nuevas), nuevas_ant: num(c.nuevas_ant), compraron: num(c.compraron), volvieron: num(c.volvieron) },
      web: { cant: num(w.cant), total: num(w.total), cant_ant: num(w.cant_ant) },
      margen: num(cm.ventas) > 0 ? { pct: (num(cm.ventas) - num(cm.cmv)) / num(cm.ventas) * 100, ganancia_bruta: num(cm.ventas) - num(cm.cmv) } : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo armar el informe: ' + error.message });
  }
};


// 📥 Todo el mes en un Excel: resumen (ventas, costo de lo vendido, gastos y resultado), lo que explica la
// diferencia entre la ganancia y la plata en las cuentas (mercaderia comprada y pagada, efectivo, medios de pago)
// y el detalle de ventas, gastos, compras, pagos a proveedores y caja. Solo dueño o quien ve el flujo.
const getExportarMes = async (req, res) => {
  try {
    const u = req.usuario || {};
    const esJefe = u.rol === 'jefe' || Number(u.rol_id) === 1;
    if (!esJefe && !(await pool.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'finanzas.flujo'`, [u.id]).catch(() => ({ rows: [] }))).rows.length)
      return res.status(403).json({ error: 'No tenés permiso para descargar las finanzas' });
    const XLSX = require('xlsx');
    const { mes, anio } = mesAnio(req.query);
    const localNum = normalizarLocalId(req.query.local_id);
    const pL = localNum !== null ? [mes, anio, localNum] : [mes, anio];
    const fL = (a) => (localNum !== null ? ` AND ${a}.local_id = $3` : '');
    const fLn = (a) => (localNum !== null ? ` AND (${a}.local_id = $3 OR ${a}.local_id IS NULL)` : '');
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const nomLocal = localNum === null ? 'Todos los locales' : ((await pool.query('SELECT nombre FROM locales WHERE id = $1', [localNum]).catch(() => ({ rows: [] }))).rows[0] || {}).nombre || 'Local ' + localNum;
    const fecha = (d) => d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const dia = (d) => d ? new Date(d).toISOString().slice(0, 10).split('-').reverse().join('/') : '';
    const redondo = (x) => Math.round(num(x) * 100) / 100;
    const safe = (p) => p.catch((e) => { console.error('[exportar-mes]', e.message); return { rows: [] }; });

    const [est, medios, cmvR, ventasDia, ventas, compras, pagosProv, efectivo, cierres] = await Promise.all([
      calcularFlujoEstructurado(mes, anio, localNum),
      calcularComisionesMedios(mes, anio, localNum),
      safe(pool.query(`SELECT COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS cmv, COUNT(*) FILTER (WHERE COALESCE(p.costo, 0) <= 0) AS sin_costo
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
        WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)}${fL('v')}`, pL)),
      safe(pool.query(`SELECT ${AR('v.creado_en')}::date AS dia, COUNT(*) AS cantidad, SUM(v.total) AS total
        FROM ventas v WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)}${fL('v')} GROUP BY 1 ORDER BY 1`, pL)),
      safe(pool.query(`SELECT v.id, v.creado_en, v.local_id, v.canal, v.medio_pago, v.total, v.descuento, c.nombre AS cliente
        FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE ${VENTA_VALIDA('v')} AND ${EN_MES('v.creado_en', 1, 2)}${fL('v')} ORDER BY v.creado_en`, pL)),
      safe(pool.query(`SELECT o.* FROM ordenes_ingreso o WHERE ${EN_MES('o.creado_en', 1, 2)} ORDER BY o.creado_en`, [mes, anio])),
      safe(pool.query(`SELECT o.*, cp.nombre AS cuenta FROM ordenes_ingreso o LEFT JOIN cuentas_pago cp ON cp.id = o.cuenta_pago_id
        WHERE o.fecha_pago IS NOT NULL AND EXTRACT(MONTH FROM o.fecha_pago) = $1 AND EXTRACT(YEAR FROM o.fecha_pago) = $2 ORDER BY o.fecha_pago`, [mes, anio])),
      safe(pool.query(`SELECT e.* FROM movimientos_caja_efectivo e WHERE ${NO_ANULADO('e')} AND ${EN_MES('e.creado_en', 1, 2)}${fLn('e')} ORDER BY e.creado_en`, pL)),
      safe(pool.query(`SELECT k.* FROM cierres_caja k WHERE EXTRACT(MONTH FROM k.fecha) = $1 AND EXTRACT(YEAR FROM k.fecha) = $2${fL('k')} ORDER BY k.fecha, k.local_id`, pL)),
    ]);
    const egresos = await obtenerEgresos(mes, anio, localNum);
    const locales = {};
    (await safe(pool.query('SELECT id, nombre FROM locales'))).rows.forEach(l => { locales[l.id] = l.nombre; });
    const nl = (id) => (id ? locales[id] || 'Local ' + id : 'Compartido');

    const cmv = num((cmvR.rows[0] || {}).cmv), sinCosto = parseInt((cmvR.rows[0] || {}).sin_costo) || 0;
    const ventasTot = est.ingresos.total;
    const comprado = compras.rows.reduce((s, o) => s + num(o.total), 0);
    const pagado = pagosProv.rows.reduce((s, o) => s + num(o.total), 0);
    const pagadoEnCaja = egresos.filter(e => /proveedor|mercader/i.test((e.categoria_nombre || '') + ' ' + (e.concepto || ''))).reduce((s, e) => s + num(e.importe), 0);
    const efIn = efectivo.rows.filter(e => ['ingreso', 'I'].includes(e.tipo)).reduce((s, e) => s + num(e.importe), 0);
    const efOut = efectivo.rows.filter(e => ['egreso', 'E'].includes(e.tipo)).reduce((s, e) => s + num(e.importe), 0);
    const ventasEf = medios.detalle.filter(m => m.efectivo).reduce((s, m) => s + m.monto, 0);

    // Hoja 1: Resumen
    const R = [];
    const fila = (a, b, c) => R.push([a, b === undefined ? '' : (typeof b === 'number' ? redondo(b) : b), c || '']);
    fila('Resumen de ' + MESES[mes - 1] + ' ' + anio + ' · ' + nomLocal); fila('Descargado el ' + fecha(new Date())); fila('');
    fila('INGRESOS');
    Object.entries(est.ingresos.detalle || {}).forEach(([k, v]) => fila('  ' + (CANALES[k] || k), typeof v === 'object' ? num(v.total) : num(v)));
    fila('Total ingresos', ventasTot); fila('');
    fila('Costo de la mercadería vendida (CMV)', cmv, sinCosto ? sinCosto + ' renglones vendidos con productos sin costo cargado: el costo real es mayor' : 'Según el costo cargado en cada producto');
    fila('Margen bruto (ventas − CMV)', ventasTot - cmv); fila('');
    fila('GASTOS (cargados en Caja / Finanzas)');
    [['Variables', est.variables], ['Fijos', est.fijos], ['Administrativos', est.admin], ['Sueldos', est.sueldos], ['Impuestos', est.impuestos], ['Comisiones de medios de pago', est.comisiones_medios_pago]].forEach(([t, g]) => {
      if (!g || !g.total) return;
      fila('  ' + t, g.total);
      Object.entries(g.detalle || {}).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => fila('      ' + k, v));
    });
    fila('Total gastos', est.total_egresos); fila('');
    fila('RESULTADO (ingresos − gastos)', est.resultado_neto, 'Es lo que Lumiere muestra como resultado del mes');
    fila('Ganancia restando el costo de lo vendido', ventasTot - cmv - (est.total_egresos - pagadoEnCaja), 'Ventas − costo de la mercadería vendida − gastos (sin contar dos veces lo pagado a proveedores en Caja)');
    fila('');
    fila('¿POR QUÉ LA PLATA EN LAS CUENTAS NO ES IGUAL AL RESULTADO?');
    fila('  Mercadería comprada en el mes (ingresos de mercadería)', comprado, compras.rows.length + ' facturas/órdenes: es stock, no es gasto, pero sale plata');
    fila('  Pagado a proveedores en el mes (órdenes marcadas como pagadas)', pagado, 'Puede incluir compras de meses anteriores');
    fila('  Pagos a proveedores cargados como gasto en Caja', pagadoEnCaja, 'Si es mayor a 0, ya está restado en el resultado');
    fila('  Ventas cobradas en efectivo', ventasEf, 'Queda en las cajas hasta que se deposita');
    fila('  Movimientos de efectivo del mes: entradas / salidas', efIn + ' / ' + efOut);
    fila('  Ventas con tarjeta, Mercado Pago, GoCuotas, etc.', ventasTot - ventasEf, 'Se acreditan días o semanas después; mirá "por acreditar"');
    fila('');
    fila('No están en Lumiere (revisalos aparte): retiros personales, pagos hechos directo desde el banco sin cargarlos, tarjeta de crédito del negocio, préstamos y la plata que había al empezar el mes.');

    const hojas = [
      ['Resumen', [['Concepto', 'Importe', 'Nota'], ...R]],
      ['Medios de pago', [['Medio de pago', 'Cantidad', 'Monto', 'Comisión %', 'Comisión $', 'Efectivo'], ...medios.detalle.map(m => [m.medio, m.ventas, redondo(m.monto), m.comision_pct, redondo(m.comision), m.efectivo ? 'Sí' : 'No']),
        ['Total', '', redondo(medios.total_ventas), '', redondo(medios.total_comisiones), '']]],
      ['Ventas por día', [['Día', 'Ventas', 'Total'], ...ventasDia.rows.map(r => [dia(r.dia), parseInt(r.cantidad), redondo(r.total)])]],
      ['Ventas', [['N°', 'Fecha', 'Local', 'Canal', 'Medio de pago', 'Cliente', 'Descuento', 'Total'], ...ventas.rows.map(v => [v.id, fecha(v.creado_en), nl(v.local_id), v.canal || '', v.medio_pago || '', v.cliente || '', redondo(v.descuento), redondo(v.total)])]],
      ['Gastos', [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Local', 'Importe'], ...egresos.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).map(e => [fecha(e.creado_en), e.concepto || '', e.categoria_nombre || '', e.categoria_tipo || '', nl(e.local_id), redondo(e.importe)])]],
      ['Compras de mercadería', [['Fecha de carga', 'Proveedor', 'N° factura', 'Fecha factura', 'Vence', 'Total', 'Estado', 'Forma de pago', 'Fecha de pago', 'Notas'], ...compras.rows.map(o => [fecha(o.creado_en), o.proveedor_nombre || '', o.numero_factura || '', dia(o.fecha_factura), dia(o.fecha_vencimiento), redondo(o.total), o.estado || '', o.forma_pago || '', dia(o.fecha_pago), o.notas || ''])]],
      ['Pagos a proveedores', [['Fecha de pago', 'Proveedor', 'N° factura', 'Total', 'Forma de pago', 'Cuenta', 'Cargada el'], ...pagosProv.rows.map(o => [dia(o.fecha_pago), o.proveedor_nombre || '', o.numero_factura || '', redondo(o.total), o.forma_pago || '', o.cuenta || '', fecha(o.creado_en)])]],
      ['Caja efectivo', [['Fecha', 'Tipo', 'Concepto', 'Destino / origen', 'Local', 'Importe'], ...efectivo.rows.map(e => [fecha(e.creado_en), ['ingreso', 'I'].includes(e.tipo) ? 'Entrada' : 'Salida', e.concepto || '', etiquetaDestinoOrigen(e.destino_origen), nl(e.local_id), redondo(e.importe)])]],
      ['Cierres de caja', [['Día', 'Local', 'Fondo inicial', 'Efectivo esperado', 'Efectivo contado', 'Diferencia', 'Vendido en el día', 'Ventas', 'Quién', 'Observaciones'], ...cierres.rows.map(k => [dia(k.fecha), nl(k.local_id), redondo(k.fondo_inicial), redondo(k.efectivo_esperado), redondo(k.efectivo_contado), redondo(k.diferencia), redondo(k.total_dia), k.cantidad_ventas || 0, k.usuario_nombre || '', k.observaciones || ''])]],
    ];
    const wb = XLSX.utils.book_new();
    hojas.forEach(([nombre, filas]) => {
      const ws = XLSX.utils.aoa_to_sheet(filas);
      ws['!cols'] = filas[0].map((_, i) => ({ wch: Math.min(60, Math.max(10, ...filas.slice(0, 300).map(f => String(f[i] === undefined ? '' : f[i]).length + 2))) }));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const archivo = 'finanzas-' + anio + '-' + String(mes).padStart(2, '0') + (localNum ? '-local' + localNum : '') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + archivo + '"');
    res.send(buf);
  } catch (e) { console.error('[exportar-mes]', e); res.status(500).json({ error: 'No se pudo armar el Excel: ' + e.message }); }
};

// ===== Reparto semanal (asignación de ingresos por porcentajes, método "Profit First") =====
// Cada semana (domingo a sábado) lo que entró (ventas menos lo que cobran los medios de pago) se separa en partes:
// mercadería, costos, impuestos/colchón y ganancia. Al separar la plata se marca la semana como hecha (queda la foto).
const REPARTO_DEFECTO = [
  { k: 'mercaderia', nombre: 'Mercadería (proveedores)', pct: 50, donde: '' },
  { k: 'costos', nombre: 'Costos fijos y variables', pct: 30, donde: '' },
  { k: 'impuestos', nombre: 'Impuestos y colchón', pct: 8, donde: '' },
  { k: 'ganancia', nombre: 'Ganancia', pct: 12, donde: '' },
];
const repartoListo = require('../lib/contexto').porNegocio(false);
async function asegurarRepartoSemanal() {
  if (repartoListo.get()) return;
  await pool.query('CREATE TABLE IF NOT EXISTS reparto_config (id INT PRIMARY KEY, partes JSONB NOT NULL)');
  await pool.query(`CREATE TABLE IF NOT EXISTS reparto_semanas (inicio DATE PRIMARY KEY, hecho_en TIMESTAMP NOT NULL DEFAULT NOW(),
    base NUMERIC NOT NULL DEFAULT 0, detalle JSONB, usuario TEXT)`);
  repartoListo.set(true);
}
const limpiarPartes = (l) => (Array.isArray(l) ? l : []).slice(0, 8).map((x, i) => ({
  k: String((x && x.k) || 'p' + i).replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'p' + i,
  nombre: String((x && x.nombre) || '').trim().slice(0, 50) || 'Parte ' + (i + 1),
  pct: Math.round(Math.min(100, Math.max(0, parseFloat(x && x.pct) || 0)) * 10) / 10,
  donde: String((x && x.donde) || '').trim().slice(0, 60),
}));
async function partesReparto() {
  const r = (await pool.query('SELECT partes FROM reparto_config WHERE id = 1')).rows[0];
  const l = r ? limpiarPartes(r.partes) : [];
  return l.length ? l : REPARTO_DEFECTO;
}
const getReparto = async (req, res) => {
  try {
    await asegurarRepartoSemanal();
    const partes = await partesReparto();
    const semanas = Math.min(26, Math.max(1, parseInt(req.query.semanas) || 8));
    // Semanas de domingo a sábado (hora de Argentina): la actual y las anteriores
    const hoy = (await pool.query(`SELECT (${AR('NOW()')})::date::text AS d, EXTRACT(DOW FROM ${AR('NOW()')})::int AS dow`)).rows[0];
    const d0 = new Date(hoy.d + 'T12:00:00Z'); d0.setUTCDate(d0.getUTCDate() - hoy.dow);
    const iso = (d) => d.toISOString().slice(0, 10);
    const hechas = new Map((await pool.query(`SELECT inicio::text AS inicio, hecho_en, base, detalle, usuario FROM reparto_semanas`)).rows.map(x => [x.inicio, x]));
    const lista = [];
    for (let i = 0; i < semanas; i++) {
      const a = new Date(d0); a.setUTCDate(a.getUTCDate() - 7 * i); const b = new Date(a); b.setUTCDate(b.getUTCDate() + 6);
      const desde = iso(a), hasta = iso(b);
      const c = await calcularComisionesMedios(null, null, null, { desde, hasta: hasta < hoy.d ? hasta : hoy.d });
      const ventas = Math.round(num(c.total_ventas)), comisiones = Math.round(num(c.total_comisiones)), base = Math.max(0, ventas - comisiones);
      const h = hechas.get(desde);
      const usa = h && Array.isArray(h.detalle) ? h.detalle : partes.map(pt => ({ ...pt, monto: Math.round(base * pt.pct / 100) }));
      lista.push({ desde, hasta, en_curso: hasta >= hoy.d, ventas, comisiones, base: h ? Math.round(num(h.base)) : base, base_hoy: base,
        partes: usa, hecho: !!h, hecho_en: h ? h.hecho_en : null, usuario: h ? h.usuario : null });
    }
    // Lo separado para cada parte este mes y en total (solo semanas marcadas como hechas)
    const mesIni = hoy.d.slice(0, 8) + '01';
    const acum = {};
    for (const h of hechas.values()) (h.detalle || []).forEach(pt => { const a = acum[pt.k] = acum[pt.k] || { k: pt.k, nombre: pt.nombre, mes: 0, total: 0 }; a.total += num(pt.monto); if (h.inicio >= mesIni) a.mes += num(pt.monto); });
    res.json({ partes, semanas: lista, acumulado: Object.values(acum), hoy: hoy.d });
  } catch (e) { console.error('[reparto]', e.message); res.status(500).json({ error: 'No se pudo calcular el reparto: ' + e.message }); }
};
const putRepartoConfig = async (req, res) => {
  try {
    await asegurarRepartoSemanal();
    const partes = limpiarPartes(req.body && req.body.partes);
    if (!partes.length) return res.status(400).json({ error: 'Poné al menos una parte' });
    const suma = Math.round(partes.reduce((t, x) => t + x.pct, 0) * 10) / 10;
    if (suma !== 100) return res.status(400).json({ error: 'Los porcentajes tienen que sumar 100% (ahora suman ' + suma + '%)' });
    await pool.query(`INSERT INTO reparto_config (id, partes) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET partes = EXCLUDED.partes`, [JSON.stringify(partes)]);
    res.json({ partes });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
};
// Marcar (o desmarcar) una semana como separada: guarda la foto de cuánto fue a cada parte
const postRepartoSemana = async (req, res) => {
  try {
    await asegurarRepartoSemanal();
    const b = req.body || {}, inicio = String(b.inicio || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return res.status(400).json({ error: 'Falta la semana' });
    if (b.hecho === false) { await pool.query('DELETE FROM reparto_semanas WHERE inicio = $1', [inicio]); return res.json({ ok: true }); }
    const base = Math.max(0, Math.round(parseFloat(b.base) || 0));
    const partes = limpiarPartes(b.partes).map((pt, i) => ({ ...pt, monto: Math.max(0, Math.round(parseFloat(((b.partes || [])[i] || {}).monto) || 0)) }));
    const u = req.usuario || {};
    let quien = null; try { quien = (await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id])).rows[0]?.nombre || null; } catch (e) {}
    await pool.query(`INSERT INTO reparto_semanas (inicio, base, detalle, usuario) VALUES ($1, $2, $3, $4)
      ON CONFLICT (inicio) DO UPDATE SET base = EXCLUDED.base, detalle = EXCLUDED.detalle, usuario = EXCLUDED.usuario, hecho_en = NOW()`, [inicio, base, JSON.stringify(partes), quien]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
};

module.exports = { getReparto, putRepartoConfig, postRepartoSemana, getExportarMes, getInformeMes, getBaseDecisiones, getMedallas, getRepartoSugerido, getFlujo, getFlujoEstructurado, agregarEgreso, getMiUltimoEgreso, getGastosCargados, getPuntoEquilibrio, getResumen, getComisiones, getCMV, guardarFacturacionExterna, getFacturacionExterna, getMovimientosDetalle, updateMovimiento, recategorizarMovimientos, deleteMovimiento, getAnalisisFinanciero, getComparativaMeses };
