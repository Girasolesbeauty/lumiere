const pool = require('../config/database');

// Obtener todos los productos
const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// Obtener producto por ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM productos WHERE id = $1', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// Crear producto
const create = async (req, res) => {
  try {
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras } = req.body;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// Actualizar producto
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras } = req.body;
    const result = await pool.query(
      `UPDATE productos SET nombre=$1, marca=$2, precio=$3, costo=$4, stock=$5, 
       stock_minimo=$6, lead_time_dias=$7, categoria=$8, codigo_barras=$9
       WHERE id=$10 RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Eliminar producto (soft delete)
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE productos SET activo = FALSE WHERE id = $1', [id]);
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

// Alertas de stock bajo - punto de pedido
const getAlertas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *, 
        CEIL(1.2 * lead_time_dias + stock_minimo) AS punto_pedido,
        CASE WHEN stock <= CEIL(1.2 * lead_time_dias + stock_minimo) 
             THEN true ELSE false END AS necesita_pedido
      FROM productos 
      WHERE activo = TRUE
      AND stock <= CEIL(1.2 * lead_time_dias + stock_minimo)
      ORDER BY stock ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
};

module.exports = { getAll, getById, create, update, remove, getAlertas };