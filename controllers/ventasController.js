const pool = require('../config/database');

// Obtener todas las ventas
const getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, c.nombre AS cliente_nombre
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ORDER BY v.creado_en DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

// Obtener venta por ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await pool.query(
      `SELECT v.*, c.nombre AS cliente_nombre
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1`, [id]
    );
    if (venta.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const items = await pool.query(
      `SELECT vi.*, p.nombre AS producto_nombre
       FROM venta_items vi
       JOIN productos p ON vi.producto_id = p.id
       WHERE vi.venta_id = $1`, [id]
    );
    res.json({ ...venta.rows[0], items: items.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

// Crear venta
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { cliente_id, tipo_factura, items, descuento, canal, cupon_codigo } = req.body;

    // Calcular totales
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.precio_unitario * item.cantidad;
    }

    let descuento_total = descuento || 0;

    // Aplicar cupon si hay
    if (cupon_codigo) {
      const cupon = await client.query(
        'SELECT * FROM cupones WHERE codigo = $1 AND activo = TRUE', [cupon_codigo]
      );
      if (cupon.rows.length > 0) {
        const c = cupon.rows[0];
        if (c.tipo === '%') {
          descuento_total = subtotal * (c.valor / 100);
        } else {
          descuento_total = c.valor;
        }
        await client.query(
          'UPDATE cupones SET usos = usos + 1 WHERE codigo = $1', [cupon_codigo]
        );
      }
    }

    const total = subtotal - descuento_total;

    // Generar numero de factura
    const count = await client.query('SELECT COUNT(*) FROM ventas');
    const numero = 'F-' + String(parseInt(count.rows[0].count) + 1).padStart(4, '0');

    // Crear venta
    const venta = await client.query(
      `INSERT INTO ventas (numero_factura, cliente_id, tipo_factura, subtotal, descuento, total, canal)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [numero, cliente_id, tipo_factura, subtotal, descuento_total, total, canal || 'presencial']
    );

    const ventaId = venta.rows[0].id;

    // Crear items y descontar stock
    for (const item of items) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );
      await client.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2',
        [item.cantidad, item.producto_id]
      );
    }

    // Registrar en caja
    await client.query(
      `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia)
       VALUES ($1, 'I', $2, $3)`,
      ['Venta ' + numero, total, numero]
    );

    // Sumar puntos al cliente (1 punto cada $100)
    if (cliente_id) {
      const puntos = Math.floor(total / 100);
      await client.query(
        'UPDATE clientes SET puntos = puntos + $1, total_compras = total_compras + $2 WHERE id = $3',
        [puntos, total, cliente_id]
      );

      // Actualizar nivel
      const clienteResult = await client.query('SELECT puntos FROM clientes WHERE id = $1', [cliente_id]);
      const totalPuntos = clienteResult.rows[0].puntos;
      let nivel = 'Bronze';
      if (totalPuntos >= 2000) nivel = 'Platinum';
      else if (totalPuntos >= 1000) nivel = 'Gold';
      else if (totalPuntos >= 500) nivel = 'Silver';
      await client.query('UPDATE clientes SET nivel = $1 WHERE id = $2', [nivel, cliente_id]);
    }

    await client.query('COMMIT');
    res.status(201).json(venta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al crear venta' });
  } finally {
    client.release();
  }
};

// Resumen de hoy
const getResumenHoy = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) AS cantidad_ventas,
        SUM(total) AS total_vendido,
        AVG(total) AS ticket_promedio
      FROM ventas
      WHERE DATE(creado_en) = CURRENT_DATE
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

// Resumen del mes
const getResumenMes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) AS cantidad_ventas,
        SUM(total) AS total_vendido,
        AVG(total) AS ticket_promedio,
        DATE_TRUNC('day', creado_en) AS dia,
        SUM(total) OVER (PARTITION BY DATE_TRUNC('day', creado_en)) AS total_dia
      FROM ventas
      WHERE DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY creado_en
      ORDER BY creado_en DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen del mes' });
  }
};

module.exports = { getAll, getById, create, getResumenHoy, getResumenMes };