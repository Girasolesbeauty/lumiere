const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Descuento en el local por pagar con este medio (ej. 10% con transferencia o débito). En el Punto de Venta va solo
// sobre los productos sin otra oferta y no se suma a un cupón ni a un descuento a mano.
const columnaLista = porNegocio(false);
router.use(async (req, res, next) => {
  if (!columnaLista.get()) {
    try { await pool.query('ALTER TABLE medios_pago ADD COLUMN IF NOT EXISTS descuento_pct NUMERIC(5,2) NOT NULL DEFAULT 0'); columnaLista.set(true); } catch (e) {}
  }
  next();
});
const pctDescuento = (x) => { if (x === undefined || x === null || x === '') return null; const n = parseFloat(x); return Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : null; };

router.get('/', async (req, res) => {
  try {
    const { todos } = req.query;
    let query = 'SELECT * FROM medios_pago';
    if (!todos) query += ' WHERE activo = TRUE';
    query += ' ORDER BY tipo, cuotas, con_interes';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener medios de pago' });
  }
});

// Crear un medio de pago nuevo
router.post('/', async (req, res) => {
  try {
    const { nombre, tipo, cuotas, con_interes, coeficiente, comision, disponible_online, descuento_pct } = req.body;
    if (!nombre || !tipo) return res.status(400).json({ error: 'Nombre y tipo son obligatorios' });
    const result = await pool.query(
      `INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online, descuento_pct)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8) RETURNING *`,
      [nombre, tipo, cuotas || 1, con_interes === true, coeficiente || 1.0, comision || 0, disponible_online !== false, pctDescuento(descuento_pct) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear medio de pago' });
  }
});

// Editar un medio de pago (nombre, tipo, cuotas, comision, etc. -- ya no solo coeficiente/activo)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online, descuento_pct } = req.body;
    const result = await pool.query(
      `UPDATE medios_pago SET
        nombre = COALESCE($1, nombre),
        tipo = COALESCE($2, tipo),
        cuotas = COALESCE($3, cuotas),
        con_interes = COALESCE($4, con_interes),
        coeficiente = COALESCE($5, coeficiente),
        comision = COALESCE($6, comision),
        activo = COALESCE($7, activo),
        disponible_online = COALESCE($8, disponible_online),
        descuento_pct = COALESCE($10, descuento_pct)
       WHERE id=$9 RETURNING *`,
      [nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online, id, pctDescuento(descuento_pct)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medio de pago no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar medio de pago' });
  }
});

// Desactivar (no se borra, para no romper el historial de ventas que ya lo usaron)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('UPDATE medios_pago SET activo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true, mensaje: 'Medio de pago desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar medio de pago' });
  }
});

module.exports = router;