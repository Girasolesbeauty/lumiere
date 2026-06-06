const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE activo = TRUE ORDER BY nombre');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas } = req.body;
    const result = await pool.query(
      `INSERT INTO proveedores (nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago || 30, forma_pago || 'transferencia', banco, cbu, alias, titular_cuenta, cuit_banco, categoria || 'mercaderia', notas]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo } = req.body;
    const result = await pool.query(
      `UPDATE proveedores SET nombre=$1, cuit=$2, email=$3, telefono=$4, whatsapp=$5, dias_pago=$6, forma_pago=$7, banco=$8, cbu=$9, alias=$10, titular_cuenta=$11, cuit_banco=$12, categoria=$13, notas=$14, activo=$15 WHERE id=$16 RETURNING *`,
      [nombre, cuit, email, telefono, whatsapp, dias_pago, forma_pago, banco, cbu, alias, titular_cuenta, cuit_banco, categoria, notas, activo !== undefined ? activo : true, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

module.exports = router;