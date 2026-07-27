const pool = require('../config/database');

// Convierte "rg"/"ush" (o numeros) al id numerico del local. null si es consolidado/vacio.
function normalizarLocalId(v) {
  if (v === undefined || v === null || v === '' || v === 'consolidado' || v === 'todos') return null;
  if (v === 'rg' || v === 'RG') return 1;
  if (v === 'ush' || v === 'USH') return 2;
  const n = parseInt(v);
  return isNaN(n) ? null : n;
}

// Flujo de caja básico (movimientos)
const getFlujo = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const anioActual = anio || new Date().getFullYear();

    // Unimos las dos tablas de movimientos:
    // - movimientos_caja (vieja): tipo 'I'/'E', categoria_id
    // - movimientos_caja_efectivo (nueva, la que usa la seccion Caja): tipo 'ingreso'/'egreso', destino_origen
    let query = `
      SELECT * FROM (
        SELECT m.id, m.concepto, m.importe, m.creado_en, m.local_id,
               CASE WHEN m.tipo = 'I' THEN 'I' ELSE 'E' END AS tipo,
               cc.nombre as categoria_nombre, cc.tipo as categoria_tipo,
               cp.nombre as cuenta_nombre,
               'caja' AS fuente
        FROM movimientos_caja m
        LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
        LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id

        UNION ALL

        SELECT e.id, e.concepto, e.importe, e.creado_en, e.local_id,
               CASE WHEN e.tipo = 'ingreso' THEN 'I' ELSE 'E' END AS tipo,
               e.destino_origen as categoria_nombre, NULL as categoria_tipo,
               NULL as cuenta_nombre,
               'efectivo' AS fuente
        FROM movimientos_caja_efectivo e
        WHERE e.anulado = FALSE OR e.anulado IS NULL
      ) mov
      WHERE EXTRACT(MONTH FROM mov.creado_en) = $1
      AND EXTRACT(YEAR FROM mov.creado_en) = $2
    `;
    const params = [mesActual, anioActual];

    const localNum = normalizarLocalId(local_id);
    if (localNum !== null) {
      query += ` AND (mov.local_id = $3 OR mov.local_id IS NULL)`;
      params.push(localNum);
    }

    query += ' ORDER BY mov.creado_en DESC';

    const result = await pool.query(query, params);

    // Si estamos viendo un local especifico (no consolidado), los movimientos compartidos
    // (local_id NULL, ej: facturas de proveedores que siempre se reparten 50/50) cuentan por la mitad.
    // En Consolidado se cuentan enteros (una sola vez).
    const importeEfectivo = (r) => (localNum !== null && r.local_id === null) ? parseFloat(r.importe) / 2 : parseFloat(r.importe);

    // Ingresos: se calculan igual que en el Dashboard y en "Flujo de Efectivo" --
    // ventas reales (POS + online) + facturacion del sistema anterior. Los "ingresos"
    // manuales que se puedan cargar a mano en este formulario NO se suman aca para no
    // duplicar ni mostrar un numero distinto al del resto del sistema.
    let ventasQuery = `SELECT COALESCE(SUM(total), 0) AS total FROM ventas WHERE EXTRACT(MONTH FROM creado_en) = $1 AND EXTRACT(YEAR FROM creado_en) = $2`;
    const ventasParams = [mesActual, anioActual];
    if (localNum !== null) { ventasQuery += ` AND local_id = $3`; ventasParams.push(localNum); }
    const ventasRes = await pool.query(ventasQuery, ventasParams);
    const totalVentas = parseFloat(ventasRes.rows[0]?.total || 0);

    const egresos = result.rows.filter(r => r.tipo === 'E').reduce((s, r) => s + importeEfectivo(r), 0);
    const movimientosAjustados = result.rows.map(r => ({ ...r, importe: importeEfectivo(r) }));

    // Sumar facturacion del sistema anterior como ingreso (mes de transicion)
    let factExtQuery = `SELECT COALESCE(SUM(monto), 0) AS total FROM facturacion_externa WHERE mes = $1 AND anio = $2`;
    const factExtParams = [mesActual, anioActual];
    if (localNum !== null) {
      factExtQuery += ` AND local_id = $3`;
      factExtParams.push(localNum);
    }
    const factExtRes = await pool.query(factExtQuery, factExtParams);
    const factExterna = parseFloat(factExtRes.rows[0]?.total || 0);

    const ingresos = totalVentas + factExterna;

    res.json({
      movimientos: movimientosAjustados,
      resumen: { ingresos, egresos, neto: ingresos - egresos, facturacion_anterior: factExterna }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo de caja' });
  }
};

// Flujo estructurado por categorias
// Traduce los valores internos de destino_origen (de la Caja diaria) a etiquetas legibles.
const ETIQUETAS_DESTINO_ORIGEN = {
  gasto_operativo: 'Gasto operativo',
  pago_proveedor: 'Pago a proveedor',
  otro: 'Otro'
};
const etiquetaDestinoOrigen = (valor) => ETIQUETAS_DESTINO_ORIGEN[valor] || valor || 'Otros';

// Logica compartida: calcula el flujo estructurado (ingresos por canal + egresos por tipo)
// para un mes/anio/local puntual. La usan tanto getFlujoEstructurado (la pantalla de
// Flujo de Efectivo) como getAnalisisFinanciero (el analizador nuevo), para no duplicar
// las mismas consultas dos veces.
async function calcularFlujoEstructurado(mesActual, anioActual, local_id) {
    // Ingresos por ventas
    let ventasQuery = `
      SELECT SUM(total) as total, canal
      FROM ventas
      WHERE EXTRACT(MONTH FROM creado_en) = $1
      AND EXTRACT(YEAR FROM creado_en) = $2
    `;
    const ventasParams = [mesActual, anioActual];
    const localNumV = normalizarLocalId(local_id);
    if (localNumV !== null) {
      ventasQuery += ` AND local_id = $3`;
      ventasParams.push(localNumV);
    }
    ventasQuery += ' GROUP BY canal';
    const ventasRes = await pool.query(ventasQuery, ventasParams);

    // Egresos por categoria
    let egresosQuery = `
      SELECT * FROM (
        SELECT 
          m.importe, m.concepto, m.local_id,
          cc.nombre as categoria_nombre, cc.tipo as categoria_tipo, cc.subtipo,
          cp.nombre as cuenta_nombre, m.forma_pago, m.creado_en, m.tipo
        FROM movimientos_caja m
        LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
        LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
        WHERE m.tipo = 'E'

        UNION ALL

        SELECT
          e.importe, e.concepto, e.local_id,
          e.destino_origen as categoria_nombre, 'variable' as categoria_tipo, NULL as subtipo,
          NULL as cuenta_nombre, 'efectivo' as forma_pago, e.creado_en, 'E' as tipo
        FROM movimientos_caja_efectivo e
        WHERE e.tipo = 'egreso' AND (e.anulado = FALSE OR e.anulado IS NULL)
      ) m
      WHERE EXTRACT(MONTH FROM m.creado_en) = $1
      AND EXTRACT(YEAR FROM m.creado_en) = $2
    `;
    const egresosParams = [mesActual, anioActual];
    const localNumEg = normalizarLocalId(local_id);
    if (localNumEg !== null) {
      egresosQuery += ` AND (m.local_id = $3 OR m.local_id IS NULL)`;
      egresosParams.push(localNumEg);
    }

    const egresosRes = await pool.query(egresosQuery, egresosParams);

    // Agrupar egresos por tipo de categoria
    const agrupar = (tipo) => {
      return egresosRes.rows
        .filter(r => r.categoria_tipo === tipo)
        .reduce((acc, r) => {
          // Traduce valores internos de la Caja diaria (ej: 'gasto_operativo') a etiquetas legibles.
          // Para categorias reales (ej: 'Sueldo Cintia') no hace nada, ya que no estan en el mapa.
          const nombre = etiquetaDestinoOrigen(r.categoria_nombre || r.concepto);
          // Si es compartido (local_id NULL), dividir entre 2
          const importe = r.local_id === null ? parseFloat(r.importe) / 2 : parseFloat(r.importe);
          if (!acc[nombre]) acc[nombre] = 0;
          acc[nombre] += importe;
          return acc;
        }, {});
    };

    const variables = agrupar('variable');
    const fijos = agrupar('fijo');
    const admin = agrupar('administrativo');
    const sueldos = agrupar('sueldo');

    // Separar impuestos de fijos (931 ARCA)
    const impuestos = {};
    const fijosSinImpuestos = {};
    Object.entries(fijos).forEach(([k, v]) => {
      if (k.includes('ARCA') || k.includes('931') || k.includes('impuesto')) {
        impuestos[k] = v;
      } else {
        fijosSinImpuestos[k] = v;
      }
    });

    // Sumar facturacion del sistema anterior como un ingreso mas
    let factExtQuery = `SELECT COALESCE(SUM(monto), 0) AS total FROM facturacion_externa WHERE mes = $1 AND anio = $2`;
    const factExtParams = [mesActual, anioActual];
    const localNumFE = normalizarLocalId(local_id);
    if (localNumFE !== null) {
      factExtQuery += ` AND local_id = $3`;
      factExtParams.push(localNumFE);
    }
    const factExtRes = await pool.query(factExtQuery, factExtParams);
    const factExterna = parseFloat(factExtRes.rows[0]?.total || 0);

    const totalIngresos = ventasRes.rows.reduce((s, r) => s + parseFloat(r.total || 0), 0) + factExterna;
    const totalVariables = Object.values(variables).reduce((s, v) => s + v, 0);
    const totalFijos = Object.values(fijosSinImpuestos).reduce((s, v) => s + v, 0);
    const totalAdmin = Object.values(admin).reduce((s, v) => s + v, 0);
    const totalSueldos = Object.values(sueldos).reduce((s, v) => s + v, 0);
    const totalImpuestos = Object.values(impuestos).reduce((s, v) => s + v, 0);
    const totalEgresos = totalVariables + totalFijos + totalAdmin + totalSueldos + totalImpuestos;

    return {
      mes: mesActual,
      anio: anioActual,
      local_id: local_id || 'consolidado',
      ingresos: {
        detalle: ventasRes.rows.reduce((acc, r) => {
          acc[r.canal || 'presencial'] = parseFloat(r.total || 0);
          return acc;
        }, {}),
        total: totalIngresos
      },
      variables: { detalle: variables, total: totalVariables },
      fijos: { detalle: fijosSinImpuestos, total: totalFijos },
      admin: { detalle: admin, total: totalAdmin },
      sueldos: { detalle: sueldos, total: totalSueldos },
      impuestos: { detalle: impuestos, total: totalImpuestos },
      total_egresos: totalEgresos,
      resultado_neto: totalIngresos - totalEgresos
    };
}

const getFlujoEstructurado = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const anioActual = anio || new Date().getFullYear();
    const datos = await calcularFlujoEstructurado(mesActual, anioActual, local_id);
    res.json(datos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo estructurado' });
  }
};

// Agregar egreso mejorado
const agregarEgreso = async (req, res) => {
  try {
    const { concepto, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id } = req.body;

    // Si es compartido, se guarda con local_id NULL (asi se identifica como "de ambos locales" y se reparte 50/50 al mostrarlo)
    if (local_id === 'compartido') {
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, NULL, $7)`,
        [concepto, importe, referencia, categoria_id, forma_pago, cuenta_pago_id || null, usuario_id || null]
      );
    } else {
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id, usuario_id)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, $7, $8)`,
        [concepto, importe, referencia || 'Manual', categoria_id, forma_pago, cuenta_pago_id || null, local_id || 1, usuario_id || null]
      );
    }

    res.status(201).json({ ok: true, mensaje: 'Egreso registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar egreso: ' + error.message });
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

// Punto de equilibrio
const getPuntoEquilibrio = async (req, res) => {
  try {
    const costosFijos = await pool.query(`
      SELECT SUM(importe) AS total_egresos
      FROM movimientos_caja
      WHERE tipo = 'E'
      AND DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const margen = await pool.query(`
      SELECT AVG((precio - costo) / precio * 100) AS margen_promedio
      FROM productos
      WHERE activo = TRUE AND costo > 0
    `);

    const totalEgresos = parseFloat(costosFijos.rows[0].total_egresos) || 0;
    const margenPromedio = parseFloat(margen.rows[0].margen_promedio) / 100 || 0.48;
    const puntoEquilibrio = margenPromedio > 0 ? totalEgresos / margenPromedio : 0;

    const ventas = await pool.query(`
      SELECT SUM(total) AS total_ventas
      FROM ventas
      WHERE DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const totalVentas = parseFloat(ventas.rows[0].total_ventas) || 0;
    const margenSeguridad = totalVentas > 0
      ? ((totalVentas - puntoEquilibrio) / puntoEquilibrio * 100).toFixed(1)
      : 0;

    res.json({
      costos_fijos: totalEgresos,
      margen_promedio: (margenPromedio * 100).toFixed(1),
      punto_equilibrio: puntoEquilibrio.toFixed(2),
      ventas_actuales: totalVentas,
      margen_seguridad: margenSeguridad + '%',
      superado: totalVentas >= puntoEquilibrio
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular punto de equilibrio' });
  }
};

// Resumen general
const getResumen = async (req, res) => {
  try {
    const ventas = await pool.query(`
      SELECT SUM(total) AS total
      FROM ventas
      WHERE DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const egresos = await pool.query(`
      SELECT SUM(importe) AS total
      FROM movimientos_caja
      WHERE tipo = 'E'
      AND DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    const totalVentas = parseFloat(ventas.rows[0].total) || 0;
    const totalEgresos = parseFloat(egresos.rows[0].total) || 0;

    res.json({
      ingresos: totalVentas,
      egresos: totalEgresos,
      neto: totalVentas - totalEgresos
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

// Comisiones por medio de pago + IIBB (4% sobre todo lo que no es efectivo).
// Toma las ventas del mes (presenciales y online), calcula la comision de cada una
// segun el % guardado en su medio de pago, y devuelve el detalle + el resultado neto.
const getComisiones = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = mes || (new Date().getMonth() + 1);
    const anioActual = anio || new Date().getFullYear();
    const localNum = normalizarLocalId(local_id);

    // Ventas del periodo con la comision de su medio de pago
    let q = `
      SELECT v.total, v.medio_pago, v.canal,
             COALESCE(mp.comision, 0) AS comision_pct,
             COALESCE(mp.tipo, '') AS medio_tipo
      FROM ventas v
      LEFT JOIN medios_pago mp ON (mp.id = v.medio_pago_id OR mp.nombre = v.medio_pago)
      WHERE EXTRACT(MONTH FROM v.creado_en) = $1
        AND EXTRACT(YEAR FROM v.creado_en) = $2
        AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')
    `;
    const params = [mesActual, anioActual];
    if (localNum !== null) { q += ` AND v.local_id = $3`; params.push(localNum); }

    const result = await pool.query(q, params);

    const IIBB_PCT = 4; // 4% sobre ventas no-efectivo
    let totalVentas = 0;
    let totalComisiones = 0;
    let baseIIBB = 0; // ventas que no son efectivo
    const porMedio = {}; // detalle agrupado por medio de pago

    for (const r of result.rows) {
      const total = parseFloat(r.total) || 0;
      const pct = parseFloat(r.comision_pct) || 0;
      const nombre = r.medio_pago || 'Sin especificar';
      const esEfectivo = (r.medio_tipo === 'efectivo') || /efectivo/i.test(nombre);

      const comision = total * (pct / 100);
      totalVentas += total;
      totalComisiones += comision;
      if (!esEfectivo) baseIIBB += total;

      if (!porMedio[nombre]) porMedio[nombre] = { medio: nombre, ventas: 0, monto: 0, comision_pct: pct, comision: 0 };
      porMedio[nombre].ventas += 1;
      porMedio[nombre].monto += total;
      porMedio[nombre].comision += comision;
    }

    const iibb = baseIIBB * (IIBB_PCT / 100);
    const resultadoNeto = totalVentas - totalComisiones - iibb;

    res.json({
      mes: mesActual,
      anio: anioActual,
      total_ventas: totalVentas,
      total_comisiones: totalComisiones,
      base_iibb: baseIIBB,
      iibb_pct: IIBB_PCT,
      iibb: iibb,
      resultado_neto: resultadoNeto,
      detalle: Object.values(porMedio).sort((a, b) => b.monto - a.monto)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular comisiones: ' + error.message });
  }
};

// Costo de Mercaderia Vendida (CMV) del mes: suma el costo de cada producto vendido.
const getCMV = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = mes || (new Date().getMonth() + 1);
    const anioActual = anio || new Date().getFullYear();
    const localNum = normalizarLocalId(local_id);

    let q = `
      SELECT COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS cmv,
             COALESCE(SUM(vi.cantidad * vi.precio_unitario), 0) AS ventas
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      WHERE EXTRACT(MONTH FROM v.creado_en) = $1
        AND EXTRACT(YEAR FROM v.creado_en) = $2
        AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')
    `;
    const params = [mesActual, anioActual];
    if (localNum !== null) { q += ` AND v.local_id = $3`; params.push(localNum); }

    const r = await pool.query(q, params);
    const cmv = parseFloat(r.rows[0].cmv) || 0;
    const ventas = parseFloat(r.rows[0].ventas) || 0;
    res.json({
      cmv,
      ventas,
      margen_bruto: ventas - cmv,
      margen_pct: ventas > 0 ? ((ventas - cmv) / ventas * 100) : 0
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

// Listado detallado de movimientos (movimientos_caja), con busqueda y filtro de fechas,
// para la pantalla de "ver todo" -- separado del resumen mensual de getFlujo.
const getMovimientosDetalle = async (req, res) => {
  try {
    const { desde, hasta, busqueda, tipo, local_id } = req.query;
    let query = `
      SELECT m.id, m.concepto, m.importe, m.tipo, m.creado_en, m.local_id, m.forma_pago,
             m.categoria_id, cc.nombre AS categoria_nombre,
             m.cuenta_pago_id, cp.nombre AS cuenta_nombre
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { params.push(desde); query += ` AND m.creado_en >= $${params.length}`; }
    if (hasta) { params.push(hasta); query += ` AND m.creado_en < $${params.length}`; }
    if (tipo === 'I' || tipo === 'E') { params.push(tipo); query += ` AND m.tipo = $${params.length}`; }
    const localNum = normalizarLocalId(local_id);
    if (localNum !== null) { params.push(localNum); query += ` AND m.local_id = $${params.length}`; }
    if (busqueda && busqueda.trim()) {
      params.push('%' + busqueda.trim() + '%');
      query += ` AND (m.concepto ILIKE $${params.length} OR cc.nombre ILIKE $${params.length})`;
    }
    query += ' ORDER BY m.creado_en DESC LIMIT 500';
    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el detalle de movimientos: ' + error.message });
  }
};

// Editar un movimiento manual (categoria, cuenta, forma de pago, importe, concepto)
const updateMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const { concepto, importe, categoria_id, forma_pago, cuenta_pago_id, local_id } = req.body;
    const r = await pool.query(
      `UPDATE movimientos_caja
       SET concepto = COALESCE($1, concepto), importe = COALESCE($2, importe),
           categoria_id = COALESCE($3, categoria_id), forma_pago = COALESCE($4, forma_pago),
           cuenta_pago_id = $5, local_id = COALESCE($6, local_id)
       WHERE id = $7 RETURNING *`,
      [concepto, importe, categoria_id, forma_pago, cuenta_pago_id || null, local_id, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar el movimiento: ' + error.message });
  }
};

// Eliminar un movimiento manual
const deleteMovimiento = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM movimientos_caja WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
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

const getAnalisisFinanciero = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = parseInt(mes) || new Date().getMonth() + 1;
    const anioActual = parseInt(anio) || new Date().getFullYear();
    const mesAnteriorNum = mesActual === 1 ? 12 : mesActual - 1;
    const anioMesAnterior = mesActual === 1 ? anioActual - 1 : anioActual;

    const actual = await calcularFlujoEstructurado(mesActual, anioActual, local_id);
    const anterior = await calcularFlujoEstructurado(mesAnteriorNum, anioMesAnterior, local_id);

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

    let calificacion, color;
    if (puntajeFinal >= 85) { calificacion = 'Excelente'; color = '#2d7a4f'; }
    else if (puntajeFinal >= 70) { calificacion = 'Buena'; color = '#5a9c3f'; }
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
        variacion_ingresos_pct: variacionIngresos !== null ? parseFloat(variacionIngresos.toFixed(1)) : null,
        tendencia: ingresosAnterior === 0 ? 'sin_datos' : (margenNetoPct >= margenNetoPctAnterior ? 'mejora' : 'empeora')
      },
      metricas
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el analisis financiero: ' + error.message });
  }
};

module.exports = { getFlujo, getFlujoEstructurado, agregarEgreso, getMiUltimoEgreso, getPuntoEquilibrio, getResumen, getComisiones, getCMV, guardarFacturacionExterna, getFacturacionExterna, getMovimientosDetalle, updateMovimiento, deleteMovimiento, getAnalisisFinanciero };