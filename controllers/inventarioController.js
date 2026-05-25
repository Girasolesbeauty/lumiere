const pool = require('../config/database');

// Obtener movimientos de inventario
const getMovimientos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vi.*, p.nombre AS producto_nombre, v.numero_factura
      FROM venta_items vi
      JOIN productos p ON vi.producto_id = p.id
      JOIN ventas v ON vi.venta_id = v.id
      ORDER BY v.creado_en DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
};

// Agregar movimiento manual (ingreso o ajuste)
const agregarMovimiento = async (req, res) => {
  try {
    const { producto_id, cantidad, tipo, referencia } = req.body;

    if (tipo === 'ingreso') {
      await pool.query(
        'UPDATE productos SET stock = stock + $1 WHERE id = $2',
        [cantidad, producto_id]
      );
    } else if (tipo === 'ajuste') {
      await pool.query(
        'UPDATE productos SET stock = $1 WHERE id = $2',
        [cantidad, producto_id]
      );
    }

    const producto = await pool.query(
      'SELECT * FROM productos WHERE id = $1', [producto_id]
    );

    res.json({
      mensaje: 'Movimiento registrado correctamente',
      producto: producto.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar movimiento' });
  }
};

// Inventario valorizado
const getValorizado = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, nombre, marca, stock, costo, precio,
        stock * costo AS valor_costo,
        stock * precio AS valor_venta,
        CASE 
          WHEN stock < stock_minimo THEN 'CRITICO'
          WHEN stock < stock_minimo * 1.5 THEN 'BAJO'
          ELSE 'NORMAL'
        END AS estado,
        CEIL(1.2 * lead_time_dias + stock_minimo) AS punto_pedido
      FROM productos
      WHERE activo = TRUE
      ORDER BY valor_costo DESC
    `);

    const totalCosto = result.rows.reduce((s, r) => s + parseFloat(r.valor_costo), 0);
    const totalVenta = result.rows.reduce((s, r) => s + parseFloat(r.valor_venta), 0);

    res.json({
      productos: result.rows,
      resumen: {
        total_valor_costo: totalCosto.toFixed(2),
        total_valor_venta: totalVenta.toFixed(2),
        margen_potencial: (totalVenta - totalCosto).toFixed(2)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener inventario valorizado' });
  }
};

module.exports = { getMovimientos, agregarMovimiento, getValorizado };