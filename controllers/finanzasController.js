const pool = require('../config/database');

// Flujo de caja
const getFlujo = async (req, res) => {
  try {
    const { mes, anio } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const anioActual = anio || new Date().getFullYear();

    const result = await pool.query(`
      SELECT 
        concepto, tipo, importe, referencia, creado_en
      FROM movimientos_caja
      WHERE EXTRACT(MONTH FROM creado_en) = $1
      AND EXTRACT(YEAR FROM creado_en) = $2
      ORDER BY creado_en DESC
    `, [mesActual, anioActual]);

    const ingresos = result.rows
      .filter(r => r.tipo === 'I')
      .reduce((s, r) => s + parseFloat(r.importe), 0);

    const egresos = result.rows
      .filter(r => r.tipo === 'E')
      .reduce((s, r) => s + parseFloat(r.importe), 0);

    res.json({
      movimientos: result.rows,
      resumen: {
        ingresos,
        egresos,
        neto: ingresos - egresos
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener flujo de caja' });
  }
};

// Agregar egreso
const agregarEgreso = async (req, res) => {
  try {
    const { concepto, importe, referencia } = req.body;
    const result = await pool.query(
      `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia)
       VALUES ($1, 'E', $2, $3) RETURNING *`,
      [concepto, importe, referencia]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar egreso' });
  }
};

// Punto de equilibrio
const getPuntoEquilibrio = async (req, res) => {
  try {
    // Costos fijos del mes actual
    const costosFijos = await pool.query(`
      SELECT SUM(importe) AS total_egresos
      FROM movimientos_caja
      WHERE tipo = 'E'
      AND DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Margen promedio de productos
    const margen = await pool.query(`
      SELECT AVG((precio - costo) / precio * 100) AS margen_promedio
      FROM productos
      WHERE activo = TRUE AND costo > 0
    `);

    const totalEgresos = parseFloat(costosFijos.rows[0].total_egresos) || 0;
    const margenPromedio = parseFloat(margen.rows[0].margen_promedio) / 100 || 0.48;
    const puntoEquilibrio = margenPromedio > 0 ? totalEgresos / margenPromedio : 0;

    // Ventas actuales del mes
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

module.exports = { getFlujo, agregarEgreso, getPuntoEquilibrio, getResumen };