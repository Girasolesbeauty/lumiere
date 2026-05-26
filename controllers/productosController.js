const pool = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = 'SELECT * FROM productos WHERE activo = TRUE';
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND local_id = $${params.length}`;
    }
    query += ' ORDER BY nombre ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

const create = async (req, res) => {
  try {
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id } = req.body;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

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
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE productos SET activo = FALSE WHERE id = $1', [id]);
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

const getAlertas = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT *, 
        CEIL(1.2 * lead_time_dias + stock_minimo) AS punto_pedido,
        CASE WHEN stock <= CEIL(1.2 * lead_time_dias + stock_minimo) 
             THEN true ELSE false END AS necesita_pedido
      FROM productos 
      WHERE activo = TRUE
      AND stock <= CEIL(1.2 * lead_time_dias + stock_minimo)
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND local_id = $${params.length}`;
    }
    query += ' ORDER BY stock ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
};

module.exports = { getAll, getById, create, update, remove, getAlertas };