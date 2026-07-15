const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Calcula (y guarda) la comision de un dia para un local, segun las metas diarias.
async function calcularYGuardarDia(local_id, fecha) {
  // Facturacion presencial del dia. Las ventas con cupon de una influencer NO suman
  // a la comision de las vendedoras (esa venta ya genera comision para la influencer).
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

  // Regla del local
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

  // Guardar/actualizar el registro del dia (sin tocar el estado 'pagada')
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

// GET comision de HOY para un local (calcula y guarda)
router.get('/:local_id', async (req, res) => {
  try {
    const { local_id } = req.params;
    const hoy = new Date().toISOString().slice(0, 10);
    const data = await calcularYGuardarDia(local_id, hoy);
    res.json({ ...data, fecha: hoy });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET historial de comisiones diarias de un local (opcional: rango de fechas)
router.get('/:local_id/historial', async (req, res) => {
  try {
    const { local_id } = req.params;
    const { desde, hasta } = req.query;
    let q = 'SELECT * FROM comisiones WHERE local_id = $1 AND fecha IS NOT NULL';
    const params = [local_id];
    if (desde) { params.push(desde); q += ` AND fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND fecha <= $${params.length}`; }
    q += ' ORDER BY fecha DESC';
    const r = await pool.query(q, params);
    const totalGanado = r.rows.reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPagado = r.rows.filter(x => x.pagada).reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPendiente = totalGanado - totalPagado;
    res.json({ registros: r.rows, total_ganado: totalGanado, total_pagado: totalPagado, total_pendiente: totalPendiente });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar comisiones como pagadas: por ids (varios) o por rango de fechas.
// Al marcar pagada, se registra un egreso en el flujo de efectivo.
router.put('/:local_id/pagar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id } = req.params;
    const { ids, desde, hasta } = req.body;

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

    let totalPagado = 0;
    for (const row of sel.rows) {
      totalPagado += parseFloat(row.comision_ganada || 0);
      await client.query('UPDATE comisiones SET pagada = TRUE, pagada_en = NOW() WHERE id = $1', [row.id]);
    }

    // Registrar el pago como egreso en el flujo (movimientos_caja)
    if (totalPagado > 0) {
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, local_id)
         VALUES ($1, 'E', $2, $3)`,
        ['Pago comisiones vendedora', totalPagado, local_id]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, total_pagado: totalPagado, dias_pagados: sel.rows.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;