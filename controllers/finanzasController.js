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

    const ingresosMov = result.rows.filter(r => r.tipo === 'I').reduce((s, r) => s + parseFloat(r.importe), 0);
    const egresos = result.rows.filter(r => r.tipo === 'E').reduce((s, r) => s + parseFloat(r.importe), 0);

    // Sumar facturacion del sistema anterior como ingreso (mes de transicion)
    let factExtQuery = `SELECT COALESCE(SUM(monto), 0) AS total FROM facturacion_externa WHERE mes = $1 AND anio = $2`;
    const factExtParams = [mesActual, anioActual];
    if (localNum !== null) {
      factExtQuery += ` AND local_id = $3`;
      factExtParams.push(localNum);
    }
    const factExtRes = await pool.query(factExtQuery, factExtParams);
    const factExterna = parseFloat(factExtRes.rows[0]?.total || 0);

    const ingresos = ingresosMov + factExterna;

    res.json({
      movimientos: result.rows,
      resumen: { ingresos, egresos, neto: ingresos - egresos, facturacion_anterior: factExterna }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo de caja' });
  }
};

// Flujo estructurado por categorias
const getFlujoEstructurado = async (req, res) => {
  try {
    const { mes, anio, local_id } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const anioActual = anio || new Date().getFullYear();

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
          const nombre = r.categoria_nombre || r.concepto || 'Otros';
          // Si es compartido, dividir entre 2
          const importe = r.local_id === 'compartido' ? parseFloat(r.importe) / 2 : parseFloat(r.importe);
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

    res.json({
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
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo estructurado' });
  }
};

// Agregar egreso mejorado
const agregarEgreso = async (req, res) => {
  try {
    const { concepto, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id } = req.body;

    // Si es compartido, crear dos registros (50% cada local)
    if (local_id === 'compartido') {
      const mitad = parseFloat(importe) / 2;
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, 'compartido')`,
        [concepto, importe, referencia, categoria_id, forma_pago, cuenta_pago_id || null]
      );
    } else {
      await pool.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, categoria_id, forma_pago, cuenta_pago_id, local_id)
         VALUES ($1, 'E', $2, $3, $4, $5, $6, $7)`,
        [concepto, importe, referencia || 'Manual', categoria_id, forma_pago, cuenta_pago_id || null, local_id || 1]
      );
    }

    res.status(201).json({ ok: true, mensaje: 'Egreso registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar egreso: ' + error.message });
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
        AND COALESCE(v.es_preventa, FALSE) = FALSE
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
        AND COALESCE(v.es_preventa, FALSE) = FALSE
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

module.exports = { getFlujo, getFlujoEstructurado, agregarEgreso, getPuntoEquilibrio, getResumen, getComisiones, getCMV, guardarFacturacionExterna, getFacturacionExterna };