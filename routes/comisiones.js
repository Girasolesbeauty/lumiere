const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Calcula (y guarda) la comision de un dia para un local, segun las metas diarias.
async function calcularYGuardarDia(local_id, fecha) {
  const fact = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total
     FROM ventas
     WHERE local_id = $1 AND canal = 'presencial'
       AND DATE(creado_en) = $2
       AND (cupon_id IS NULL OR cupon_id NOT IN (
         SELECT cupon_id FROM influencers WHERE cupon_id IS NOT NULL
       ))`,
    [local_id, fecha]
  );
  const total = parseFloat(fact.rows[0].total) || 0;

  const reglas = await pool.query('SELECT * FROM reglas_comision WHERE local_id = $1 ORDER BY id LIMIT 1', [local_id]);
  if (reglas.rows.length === 0) return { facturacion: total, comision: 0, nivel: 0 };
  const r = reglas.rows[0];

  const u1 = parseFloat(r.umbral_1) || 0, c1 = parseFloat(r.comision_1) || 0;
  const u2 = parseFloat(r.umbral_2) || 0, c2 = parseFloat(r.comision_2) || 0;
  const u3 = parseFloat(r.umbral_3) || 0, c3 = parseFloat(r.comision_3) || 0;

  let comision = 0, nivel = 0;
  if (u3 > 0 && total >= u3) { comision = c1 + c2 + c3; nivel = 3; }
  else if (u2 > 0 && total >= u2) { comision = c1 + c2; nivel = 2; }
  else if (u1 > 0 && total >= u1) { comision = c1; nivel = 1; }

  const mes = new Date(fecha).getMonth() + 1;
  const anio = new Date(fecha).getFullYear();

  const existe = await pool.query(
    'SELECT id, pagada FROM comisiones WHERE local_id = $1 AND fecha = $2',
    [local_id, fecha]
  );
  if (existe.rows.length > 0) {
    await pool.query(
      'UPDATE comisiones SET facturacion_mes = $1, comision_ganada = $2, mes = $3, anio = $4 WHERE id = $5',
      [total, comision, mes, anio, existe.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO comisiones (local_id, fecha, mes, anio, facturacion_mes, comision_ganada, pagada)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [local_id, fecha, mes, anio, total, comision]
    );
  }

  return { facturacion: total, comision, nivel, umbral_1: u1, comision_1: c1, umbral_2: u2, comision_2: c2, umbral_3: u3, comision_3: c3 };
}

// Valida (si corresponde) y registra en Finanzas / Caja de efectivo / stock el pago de
// un monto de comisiones, sea cual sea el origen (por dias tildados, o un monto manual).
async function procesarPagoComision(client, { local_id, monto, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto }) {
  const formaValida = ['efectivo', 'transferencia', 'canje'].includes(forma_pago) ? forma_pago : 'efectivo';

  if (formaValida === 'canje') {
    if (!producto_canje_id) return { error: 'Elegi el producto con el que se hace el canje' };
    const prodRes = await client.query('SELECT precio FROM productos WHERE id = $1', [producto_canje_id]);
    if (prodRes.rows.length === 0) return { error: 'Producto de canje no encontrado' };
    const DESCUENTO_EMPLEADA = 0.20;
    const cant = parseInt(cantidad_canje) || 1;
    const costoCanje = parseFloat(prodRes.rows[0].precio || 0) * (1 - DESCUENTO_EMPLEADA) * cant;
    if (costoCanje > monto) {
      return { error: 'Lo seleccionado ($' + monto.toFixed(0) + ') no alcanza para este canje ($' + costoCanje.toFixed(0) + ' con el 20% de descuento de empleada)' };
    }
  }

  if (monto > 0) {
    await client.query(
      `INSERT INTO movimientos_caja (concepto, tipo, importe, local_id)
       VALUES ($1, 'E', $2, $3)`,
      [concepto, monto, local_id]
    );

    if (formaValida === 'efectivo') {
      await client.query(
        `INSERT INTO movimientos_caja_efectivo (concepto, tipo, importe, destino_origen, local_id)
         VALUES ($1, 'egreso', $2, 'Pago de comisiones', $3)`,
        [concepto, monto, local_id]
      );
    }

    if (formaValida === 'canje' && producto_canje_id) {
      const cant = parseInt(cantidad_canje) || 1;
      const localNum = local_id === '2' || local_id === 2 ? 2 : 1;
      const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
      await client.query(
        `UPDATE productos SET ${colStock} = GREATEST(COALESCE(${colStock},0) - $1, 0),
           stock = GREATEST(COALESCE(stock_rg,0) + COALESCE(stock_ush,0) - $1, 0)
         WHERE id = $2`,
        [cant, producto_canje_id]
      );
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, local_id)
         SELECT id, ${colStock} + $1, ${colStock}, -$1, 'Pago de comision en canje', $2 FROM productos WHERE id = $3`,
        [cant, local_id, producto_canje_id]
      );
    }
  }

  return { error: null, forma_pago: formaValida };
}

// GET comision de HOY para un local (calcula y guarda)
router.get('/:local_id', async (req, res) => {
  try {
    const { local_id } = req.params;
    const hoy = new Date().toISOString().slice(0, 10);
    const data = await calcularYGuardarDia(local_id, hoy);
    res.json({ ...data, fecha: hoy });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET historial de comisiones diarias de un local, mas los pagos manuales.
router.get('/:local_id/historial', async (req, res) => {
  try {
    const { local_id } = req.params;
    const { desde, hasta } = req.query;

    // La LISTA que se muestra si se filtra por fecha (mes, dia puntual, etc.)
    let q = 'SELECT * FROM comisiones WHERE local_id = $1 AND fecha IS NOT NULL';
    const params = [local_id];
    if (desde) { params.push(desde); q += ` AND fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND fecha <= $${params.length}`; }
    q += ' ORDER BY fecha DESC';
    const r = await pool.query(q, params);

    let qPagos = 'SELECT * FROM pagos_comision_manual WHERE local_id = $1';
    const paramsPagos = [local_id];
    if (desde) { paramsPagos.push(desde); qPagos += ` AND DATE(creado_en) >= $${paramsPagos.length}`; }
    if (hasta) { paramsPagos.push(hasta); qPagos += ` AND DATE(creado_en) <= $${paramsPagos.length}`; }
    qPagos += ' ORDER BY creado_en DESC';
    const pagosManuales = await pool.query(qPagos, paramsPagos);

    // Los TOTALES (pendiente/pagado/ganado) siempre son el saldo real completo, sin
    // filtrar por fecha -- si no, "pendiente" daria un numero raro al mirar un solo mes.
    const rTodo = await pool.query('SELECT comision_ganada, pagada FROM comisiones WHERE local_id = $1 AND fecha IS NOT NULL', [local_id]);
    const pagosManualesTodo = await pool.query('SELECT monto FROM pagos_comision_manual WHERE local_id = $1', [local_id]);

    const totalGanado = rTodo.rows.reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPagadoPorDia = rTodo.rows.filter(x => x.pagada).reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPagadoManual = pagosManualesTodo.rows.reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const totalPagado = totalPagadoPorDia + totalPagadoManual;
    const totalPendiente = Math.max(totalGanado - totalPagado, 0);

    res.json({
      registros: r.rows, pagos_manuales: pagosManuales.rows,
      total_ganado: totalGanado, total_pagado: totalPagado, total_pendiente: totalPendiente
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar comisiones como pagadas: por ids (varios) o por rango de fechas.
router.put('/:local_id/pagar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id } = req.params;
    const { ids, desde, hasta, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje } = req.body;

    let sel;
    if (Array.isArray(ids) && ids.length > 0) {
      sel = await client.query(
        `SELECT * FROM comisiones WHERE local_id = $1 AND pagada = FALSE AND id = ANY($2::int[])`,
        [local_id, ids]
      );
    } else if (desde && hasta) {
      sel = await client.query(
        `SELECT * FROM comisiones WHERE local_id = $1 AND pagada = FALSE AND fecha >= $2 AND fecha <= $3`,
        [local_id, desde, hasta]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Indica los dias (ids) o un rango de fechas (desde/hasta)' });
    }

    const totalPagado = sel.rows.reduce((s, row) => s + parseFloat(row.comision_ganada || 0), 0);
    const etiquetaForma = forma_pago === 'transferencia' ? 'transferencia' : forma_pago === 'canje' ? 'canje por ' + (producto_canje_nombre || 'producto') : 'efectivo';
    const concepto = 'Pago comisiones vendedora (' + etiquetaForma + ')';

    const resultado = await procesarPagoComision(client, {
      local_id, monto: totalPagado, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto
    });
    if (resultado.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: resultado.error });
    }

    for (const row of sel.rows) {
      await client.query('UPDATE comisiones SET pagada = TRUE, pagada_en = NOW() WHERE id = $1', [row.id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, total_pagado: totalPagado, dias_pagados: sel.rows.length, forma_pago: resultado.forma_pago });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Registrar un pago TOTAL manual (un monto suelto, sin atarlo a dias puntuales) -- para
// cuando ya se le pago a la vendedora una suma redonda y no se fue tildando dia por dia
// a tiempo. Se descuenta directo del monto adeudado.
router.post('/:local_id/pago-manual', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id } = req.params;
    const { monto, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, notas } = req.body;

    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ingresa un monto valido' });
    }

    const etiquetaForma = forma_pago === 'transferencia' ? 'transferencia' : forma_pago === 'canje' ? 'canje por ' + (producto_canje_nombre || 'producto') : 'efectivo';
    const concepto = 'Pago total comisiones vendedora (' + etiquetaForma + ')';

    const resultado = await procesarPagoComision(client, {
      local_id, monto: montoNum, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto
    });
    if (resultado.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: resultado.error });
    }

    const guardado = await client.query(
      `INSERT INTO pagos_comision_manual (local_id, monto, forma_pago, producto_canje_id, producto_canje_nombre, notas)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [local_id, montoNum, resultado.forma_pago, producto_canje_id || null, producto_canje_nombre || null, notas || null]
    );

    await client.query('COMMIT');
    res.status(201).json(guardado.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Calcula y guarda la comision de un dia (por defecto, ayer) para TODOS los locales.
router.post('/cerrar-dia', async (req, res) => {
  try {
    const { fecha } = req.body || {};
    let fechaCalcular = fecha;
    if (!fechaCalcular) {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      fechaCalcular = ayer.toISOString().slice(0, 10);
    }
    const locales = await pool.query('SELECT id FROM locales WHERE activo = TRUE ORDER BY id');
    const resultados = [];
    for (const loc of locales.rows) {
      const data = await calcularYGuardarDia(loc.id, fechaCalcular);
      resultados.push({ local_id: loc.id, ...data });
    }
    res.json({ fecha: fechaCalcular, resultados });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;