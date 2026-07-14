const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const PCT_POR_NIVEL = { inicial: 2, medio: 3, alto: 4, top: 5 };

// Listar influencers con lo vendido, comision generada, pagado y pendiente
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.codigo AS cupon_codigo, c.valor AS cupon_valor, c.tipo AS cupon_tipo, c.activo AS cupon_activo,
        COALESCE(v.total_vendido, 0) AS total_vendido,
        COALESCE(v.cant_ventas, 0) AS cant_ventas,
        ROUND(COALESCE(v.total_vendido, 0) * i.comision_pct / 100, 2) AS comision_generada,
        COALESCE(p.total_pagado, 0) AS total_pagado,
        ROUND(COALESCE(v.total_vendido, 0) * i.comision_pct / 100, 2) - COALESCE(p.total_pagado, 0) AS pendiente
      FROM influencers i
      LEFT JOIN cupones c ON c.id = i.cupon_id
      LEFT JOIN (
        SELECT cupon_id, SUM(total) AS total_vendido, COUNT(*) AS cant_ventas
        FROM ventas
        WHERE cupon_id IS NOT NULL
        GROUP BY cupon_id
      ) v ON v.cupon_id = i.cupon_id
      LEFT JOIN (
        SELECT influencer_id, SUM(monto) AS total_pagado
        FROM influencer_pagos
        GROUP BY influencer_id
      ) p ON p.influencer_id = i.id
      ORDER BY i.creado_en DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener influencers: ' + error.message });
  }
});

// Crear influencer. Puede vincular un cupon existente (cupon_id) o crear uno nuevo (crear_cupon: {codigo, tipo, valor, canal}).
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { nombre, instagram, telefono, nivel, comision_pct, cupon_id, crear_cupon } = req.body;

    if (!nombre || !nombre.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const nivelFinal = PCT_POR_NIVEL[nivel] !== undefined ? nivel : 'inicial';
    const pctFinal = (comision_pct !== undefined && comision_pct !== null && comision_pct !== '')
      ? parseFloat(comision_pct)
      : PCT_POR_NIVEL[nivelFinal];

    let cuponIdFinal = cupon_id || null;

    if (!cuponIdFinal && crear_cupon && crear_cupon.codigo) {
      const nuevoCupon = await client.query(
        `INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, usos, activo)
         VALUES ($1, $2, $3, $4, 'Influencer', 0, TRUE) RETURNING *`,
        [crear_cupon.codigo.toUpperCase(), 'Cupon de ' + nombre.trim(), crear_cupon.tipo || '%', crear_cupon.valor || 0]
      );
      cuponIdFinal = nuevoCupon.rows[0].id;
    }

    const result = await client.query(
      `INSERT INTO influencers (nombre, instagram, telefono, nivel, comision_pct, cupon_id, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [nombre.trim(), instagram || null, telefono || null, nivelFinal, pctFinal, cuponIdFinal]
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al crear influencer: ' + error.message });
  } finally {
    client.release();
  }
});

// Editar influencer (nombre, contacto, nivel, comision, activo, o cambiar de cupon)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, instagram, telefono, nivel, comision_pct, cupon_id, activo } = req.body;

    const actual = await pool.query('SELECT * FROM influencers WHERE id = $1', [id]);
    if (actual.rows.length === 0) return res.status(404).json({ error: 'Influencer no encontrada' });
    const a = actual.rows[0];

    const nivelFinal = nivel !== undefined ? nivel : a.nivel;
    const pctFinal = (comision_pct !== undefined && comision_pct !== null && comision_pct !== '')
      ? parseFloat(comision_pct)
      : (nivel !== undefined && PCT_POR_NIVEL[nivel] !== undefined ? PCT_POR_NIVEL[nivel] : a.comision_pct);

    const result = await pool.query(
      `UPDATE influencers SET
        nombre = $1, instagram = $2, telefono = $3, nivel = $4, comision_pct = $5,
        cupon_id = $6, activo = $7
       WHERE id = $8 RETURNING *`,
      [
        nombre !== undefined ? nombre.trim() : a.nombre,
        instagram !== undefined ? instagram : a.instagram,
        telefono !== undefined ? telefono : a.telefono,
        nivelFinal, pctFinal,
        cupon_id !== undefined ? cupon_id : a.cupon_id,
        activo !== undefined ? activo : a.activo,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar influencer: ' + error.message });
  }
});

// Registrar un pago manual a la influencer (vos transferis afuera y lo marcas aca)
router.post('/:id/pagos', async (req, res) => {
  try {
    const { id } = req.params;
    const { monto, fecha, notas } = req.body;
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'Monto invalido' });
    }
    const result = await pool.query(
      `INSERT INTO influencer_pagos (influencer_id, monto, fecha, notas)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4) RETURNING *`,
      [id, montoNum, fecha || null, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar pago: ' + error.message });
  }
});

// Historial de pagos de una influencer
router.get('/:id/pagos', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM influencer_pagos WHERE influencer_id = $1 ORDER BY fecha DESC, id DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

module.exports = router;
