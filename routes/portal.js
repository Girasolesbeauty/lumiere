const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Middleware: valida el token del portal de clientas (separado del de empleadas)
const verificarTokenCliente = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  try {
    const token = auth.replace('Bearer ', '');
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    if (datos.tipo !== 'cliente') return res.status(401).json({ error: 'Token invalido' });
    req.clienteId = datos.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido o vencido' });
  }
};

// Registro: la clienta ya debe existir en la base (por DNI), solo crea su acceso al portal
router.post('/registro', async (req, res) => {
  try {
    const { dni, email, password } = req.body;
    if (!dni || !password) {
      return res.status(400).json({ error: 'DNI y contrasena son obligatorios' });
    }
    const result = await pool.query('SELECT * FROM clientes WHERE cuit_dni = $1', [dni]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No encontramos una clienta con ese DNI. Si comprastes en el local, pedile a la vendedora que verifique tu DNI cargado en el sistema.' });
    }
    const cliente = result.rows[0];
    if (cliente.password_hash) {
      return res.status(400).json({ error: 'Esta clienta ya tiene una cuenta creada. Intenta iniciar sesion.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE clientes SET password_hash = $1, portal_email = $2, portal_registrado_en = NOW() WHERE id = $3',
      [hashedPassword, email || null, cliente.id]
    );
    const token = jwt.sign({ id: cliente.id, tipo: 'cliente' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, puntos: cliente.puntos, nivel: cliente.nivel }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la cuenta' });
  }
});

// Login de clientas
router.post('/login', async (req, res) => {
  try {
    const { dni, password } = req.body;
    const result = await pool.query('SELECT * FROM clientes WHERE cuit_dni = $1', [dni]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'DNI o contrasena incorrectos' });
    }
    const cliente = result.rows[0];
    if (!cliente.password_hash) {
      return res.status(401).json({ error: 'Esta clienta todavia no creo su cuenta. Registrate primero.' });
    }
    const passwordValido = await bcrypt.compare(password, cliente.password_hash);
    if (!passwordValido) {
      return res.status(401).json({ error: 'DNI o contrasena incorrectos' });
    }
    const token = jwt.sign({ id: cliente.id, tipo: 'cliente' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, puntos: cliente.puntos, nivel: cliente.nivel, email: cliente.portal_email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

// Datos del cliente logueado: puntos, nivel, historial de compras
router.get('/mis-datos', verificarTokenCliente, async (req, res) => {
  try {
    const clienteRes = await pool.query('SELECT id, nombre, email, telefono, puntos, nivel, total_compras, creado_en FROM clientes WHERE id = $1', [req.clienteId]);
    if (clienteRes.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });

    const comprasRes = await pool.query(
      `SELECT v.id, v.numero_factura, v.total, v.creado_en,
        COALESCE(json_agg(json_build_object('nombre', p.nombre, 'cantidad', vi.cantidad)) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       LEFT JOIN productos p ON vi.producto_id = p.id
       WHERE v.cliente_id = $1 AND COALESCE(v.es_preventa, FALSE) = FALSE
       GROUP BY v.id
       ORDER BY v.creado_en DESC
       LIMIT 50`,
      [req.clienteId]
    );

    res.json({ ...clienteRes.rows[0], compras: comprasRes.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

module.exports = router;