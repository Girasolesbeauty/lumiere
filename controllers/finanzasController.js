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

    let query = `
      SELECT m.*, cc.nombre as categoria_nombre, cc.tipo as categoria_tipo,
             cp.nombre as cuenta_nombre
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
      WHERE EXTRACT(MONTH FROM m.creado_en) = $1
      AND EXTRACT(YEAR FROM m.creado_en) = $2
    `;
    const params = [mesActual, anioActual];

    const localNum = normalizarLocalId(local_id);
    if (localNum !== null) {
      query += ` AND (m.local_id = $3 OR m.local_id IS NULL)`;
      params.push(localNum);
    }

    query += ' ORDER BY m.creado_en DESC';

    const result = await pool.query(query, params);

    const ingresos = result.rows.filter(r => r.tipo === 'I').reduce((s, r) => s + parseFloat(r.importe), 0);
    const egresos = result.rows.filter(r => r.tipo === 'E').reduce((s, r) => s + parseFloat(r.importe), 0);

    res.json({
      movimientos: result.rows,
      resumen: { ingresos, egresos, neto: ingresos - egresos }
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
      SELECT 
        m.importe, m.concepto, m.local_id,
        cc.nombre as categoria_nombre, cc.tipo as categoria_tipo, cc.subtipo,
        cp.nombre as cuenta_nombre, m.forma_pago
      FROM movimientos_caja m
      LEFT JOIN categorias_costo cc ON m.categoria_id = cc.id
      LEFT JOIN cuentas_pago cp ON m.cuenta_pago_id = cp.id
      WHERE m.tipo = 'E'
      AND EXTRACT(MONTH FROM m.creado_en) = $1
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

    const totalIngresos = ventasRes.rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
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

module.exports = { getFlujo, getFlujoEstructurado, agregarEgreso, getPuntoEquilibrio, getResumen };