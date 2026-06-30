const pool = require('../config/database');

// Agrega campos calculados de disponibilidad real (stock - reservado de preventas) sin tocar el resto.
const conDisponible = (rows, local) => rows.map(p => {
  const esUsh = local === '2' || local === 2 || local === 'ush';
  const reservado = esUsh ? (p.reservado_ush || 0) : (p.reservado_rg || 0);
  const transito = esUsh ? (p.stock_transito_ush || 0) : (p.stock_transito_rg || 0);
  return {
    ...p,
    reservado: reservado,
    disponible: Math.max((p.stock || 0) - reservado, 0),
    transito_local: transito
  };
});

const getAll = async (req, res) => {
  try {
    // "local" es solo para calcular disponible/transito por local (no filtra el catalogo, que es unico).
    const { local } = req.query;
    let query = 'SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre ASC';
    const result = await pool.query(query);
    res.json(conDisponible(result.rows, local));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { local } = req.query;
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(conDisponible(result.rows, local)[0]);
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
    res.status(500).json({ error: error.message });
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
    // Si el producto tiene ventas registradas, no se puede borrar (rompe el historial).
    const ventas = await pool.query('SELECT COUNT(*) FROM venta_items WHERE producto_id = $1', [id]);
    if (parseInt(ventas.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Este producto tiene ventas registradas, no se puede borrar. Si ya no lo usas, podes dejarlo sin stock.' });
    }
    await pool.query('DELETE FROM productos WHERE id = $1', [id]);
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

// Listado de todo el stock en transito (de ordenes de ingreso aun no recibidas), separado por local.
const getTransito = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, marca, codigo_barras,
        COALESCE(stock_transito_rg, 0) AS transito_rg,
        COALESCE(stock_transito_ush, 0) AS transito_ush,
        COALESCE(reservado_rg, 0) AS reservado_rg,
        COALESCE(reservado_ush, 0) AS reservado_ush
       FROM productos
       WHERE activo = TRUE AND (COALESCE(stock_transito_rg, 0) > 0 OR COALESCE(stock_transito_ush, 0) > 0)
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener stock en transito' });
  }
};

// Ajuste manual de stock (queda registrado quien, cuando y por que).
// Acepta modo "exacto" (nuevo valor final) o "diferencia" (+/-).
const ajustarStock = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { modo, valor, motivo, usuario_id, usuario_nombre, local_id } = req.body;

    if (!motivo || !motivo.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El motivo del ajuste es obligatorio' });
    }

    const prodRes = await client.query('SELECT stock FROM productos WHERE id = $1', [id]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const stockAnterior = prodRes.rows[0].stock || 0;

    let stockNuevo;
    if (modo === 'diferencia') {
      stockNuevo = stockAnterior + parseInt(valor);
    } else {
      stockNuevo = parseInt(valor);
    }
    if (isNaN(stockNuevo) || stockNuevo < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El stock resultante no puede ser negativo' });
    }

    await client.query('UPDATE productos SET stock = $1 WHERE id = $2', [stockNuevo, id]);
    await client.query(
      `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, stockAnterior, stockNuevo, stockNuevo - stockAnterior, motivo.trim(), usuario_id || null, usuario_nombre || null, local_id || 1]
    );

    await client.query('COMMIT');
    res.json({ stock_anterior: stockAnterior, stock_nuevo: stockNuevo });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al ajustar stock: ' + error.message });
  } finally {
    client.release();
  }
};

// Historial de ajustes (para auditoria)
const getHistorialAjustes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nombre AS producto_nombre
       FROM ajustes_stock a
       JOIN productos p ON a.producto_id = p.id
       ORDER BY a.creado_en DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de ajustes' });
  }
};

module.exports = { getAll, getById, create, update, remove, getAlertas, getTransito, ajustarStock, getHistorialAjustes };