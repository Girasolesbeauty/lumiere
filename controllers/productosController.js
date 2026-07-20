const pool = require('../config/database');

// Agrega campos calculados de disponibilidad real (stock - reservado de preventas) sin tocar el resto.
const conDisponible = (rows, local) => rows.map(p => {
  const esUsh = local === '2' || local === 2 || local === 'ush';
  const reservado = esUsh ? (p.reservado_ush || 0) : (p.reservado_rg || 0);
  const transito = esUsh ? (p.stock_transito_ush || 0) : (p.stock_transito_rg || 0);
  const stockRG = p.stock_rg != null ? p.stock_rg : (p.stock || 0);
  const stockUSH = p.stock_ush != null ? p.stock_ush : 0;
  // "stock del local actual" (para la vista Mi local)
  const stockLocal = esUsh ? stockUSH : stockRG;
  return {
    ...p,
    stock_rg: stockRG,
    stock_ush: stockUSH,
    stock_consolidado: stockRG + stockUSH,
    stock_local: stockLocal,
    reservado: reservado,
    // "disponible" ahora se calcula sobre el stock del local actual
    disponible: Math.max(stockLocal - reservado, 0),
    transito_local: transito
  };
});

const getAll = async (req, res) => {
  try {
    const { local } = req.query;
    let result;
    try {
      // Intenta traer el nombre del proveedor (para el buscador). Si la columna no existe, cae al SELECT simple.
      result = await pool.query(`SELECT p.*, pr.nombre AS proveedor_nombre
                                 FROM productos p
                                 LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
                                 WHERE p.activo = TRUE ORDER BY p.nombre ASC`);
    } catch (e) {
      result = await pool.query('SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre ASC');
    }
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
    // El stock inicial se carga en el local donde se creo el producto (stock_rg o stock_ush),
    // no solo en el campo "stock" agregado -- si no, cualquier operacion que mire el stock de
    // un local puntual (vender, ajustar, alertas) lo ve en 0 aunque el total muestre el numero real.
    const stockInicial = parseInt(stock) || 0;
    const esUsh = local_id === 2 || local_id === '2';
    const stockRg = esUsh ? 0 : stockInicial;
    const stockUsh = esUsh ? stockInicial : 0;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [nombre, marca, precio, costo, stockInicial, stockRg, stockUsh, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo } = req.body;
    const result = await pool.query(
      `UPDATE productos SET nombre=$1, marca=$2, precio=$3, costo=$4, stock=$5, 
       stock_minimo=$6, lead_time_dias=$7, categoria=$8, codigo_barras=$9,
       activo=COALESCE($10, activo)
       WHERE id=$11 RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Si tiene ventas reales, NO se borra (protege el historial de ventas)
    const ventas = await client.query('SELECT COUNT(*) FROM venta_items WHERE producto_id = $1', [id]);
    if (parseInt(ventas.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este producto tiene ventas registradas, no se puede borrar. Si no lo usas mas, editalo y desactivalo.' });
    }

    // Borrar primero los vinculos que no son ventas (ajustes de stock, items de kit)
    await client.query('DELETE FROM ajustes_stock WHERE producto_id = $1', [id]);
    // kit_items puede no existir en algunos entornos; se intenta y se ignora si falla
    try { await client.query('DELETE FROM kit_items WHERE producto_id = $1', [id]); } catch (e) {}

    const del = await client.query('DELETE FROM productos WHERE id = $1', [id]);
    await client.query('COMMIT');

    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontro el producto para borrar.' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'No se pudo borrar: ' + error.message });
  } finally {
    client.release();
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

    const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
    const prodRes = await client.query(`SELECT ${colStock} AS stock_local FROM productos WHERE id = $1`, [id]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const stockAnterior = prodRes.rows[0].stock_local || 0;

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

    // Ajusta el stock del local elegido y sincroniza el total
    await client.query(
      `UPDATE productos SET ${colStock} = $1,
         stock = CASE WHEN '${colStock}' = 'stock_rg' THEN $1 + COALESCE(stock_ush, 0) ELSE COALESCE(stock_rg, 0) + $1 END
       WHERE id = $2`,
      [stockNuevo, id]
    );
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