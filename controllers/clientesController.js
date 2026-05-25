const pool = require('../config/database');

// Obtener todos los clientes
const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clientes ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

// Obtener cliente por ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM clientes WHERE id = $1', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
};

// Crear cliente
const create = async (req, res) => {
  try {
    const { nombre, email, cuit_dni, telefono, fecha_nacimiento } = req.body;
    const result = await pool.query(
      `INSERT INTO clientes (nombre, email, cuit_dni, telefono, fecha_nacimiento)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, email, cuit_dni, telefono, fecha_nacimiento]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
};

// Actualizar cliente
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, cuit_dni, telefono, fecha_nacimiento } = req.body;
    const result = await pool.query(
      `UPDATE clientes SET nombre=$1, email=$2, cuit_dni=$3, telefono=$4, fecha_nacimiento=$5
       WHERE id=$6 RETURNING *`,
      [nombre, email, cuit_dni, telefono, fecha_nacimiento, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
};

// Eliminar cliente
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
};

// Historial de compras del cliente
const getHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT v.*, 
        json_agg(json_build_object(
          'producto', p.nombre,
          'cantidad', vi.cantidad,
          'precio', vi.precio_unitario,
          'subtotal', vi.subtotal
        )) AS items
       FROM ventas v
       JOIN venta_items vi ON v.id = vi.venta_id
       JOIN productos p ON vi.producto_id = p.id
       WHERE v.cliente_id = $1
       GROUP BY v.id
       ORDER BY v.creado_en DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// Agregar puntos al cliente y actualizar nivel
const agregarPuntos = async (req, res) => {
  try {
    const { id } = req.params;
    const { puntos } = req.body;

    const result = await pool.query(
      'UPDATE clientes SET puntos = puntos + $1 WHERE id = $2 RETURNING *',
      [puntos, id]
    );

    const cliente = result.rows[0];
    let nivel = 'Bronze';
    if (cliente.puntos >= 2000) nivel = 'Platinum';
    else if (cliente.puntos >= 1000) nivel = 'Gold';
    else if (cliente.puntos >= 500) nivel = 'Silver';

    await pool.query(
      'UPDATE clientes SET nivel = $1 WHERE id = $2',
      [nivel, id]
    );

    res.json({ ...cliente, nivel });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar puntos' });
  }
};

module.exports = { getAll, getById, create, update, remove, getHistorial, agregarPuntos };