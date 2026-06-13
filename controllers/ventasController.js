const pool = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { local_id, mes, anio, es_preventa } = req.query;
    let query = `
      SELECT v.*, c.nombre AS cliente_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'producto_id', vi.producto_id,
              'nombre', p.nombre,
              'cantidad', vi.cantidad,
              'precio_unitario', vi.precio_unitario
            )
          ) FILTER (WHERE vi.id IS NOT NULL), '[]'
        ) AS items
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN venta_items vi ON vi.venta_id = v.id
      LEFT JOIN productos p ON vi.producto_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND v.local_id = $${params.length}`;
    }
    if (mes) {
      params.push(parseInt(mes));
      query += ` AND EXTRACT(MONTH FROM v.creado_en) = $${params.length}`;
    }
    if (anio) {
      params.push(parseInt(anio));
      query += ` AND EXTRACT(YEAR FROM v.creado_en) = $${params.length}`;
    }
    if (es_preventa === 'true') {
      query += ` AND v.es_preventa = TRUE`;
    } else if (es_preventa === 'false') {
      query += ` AND COALESCE(v.es_preventa, FALSE) = FALSE`;
    }
    query += ' GROUP BY v.id, c.nombre ORDER BY v.creado_en DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const venta = await pool.query(
      `SELECT v.*, c.nombre AS cliente_nombre
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1`, [id]
    );
    if (venta.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    const items = await pool.query(
      `SELECT vi.*, p.nombre AS producto_nombre
       FROM venta_items vi
       JOIN productos p ON vi.producto_id = p.id
       WHERE vi.venta_id = $1`, [id]
    );
    res.json({ ...venta.rows[0], items: items.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener venta' });
  }
};

const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      cliente_id, tipo_factura, items, descuento, canal, cupon_codigo, local_id,
      medio_pago_id, medio_pago_nombre, total_con_interes, es_preventa, nombre_preventa
    } = req.body;

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.precio_unitario * item.cantidad;
    }

    let descuento_total = descuento || 0;

    if (cupon_codigo) {
      const cupon = await client.query(
        'SELECT * FROM cupones WHERE codigo = $1 AND activo = TRUE', [cupon_codigo]
      );
      if (cupon.rows.length > 0) {
        const c = cupon.rows[0];
        descuento_total = c.tipo === '%' ? subtotal * (c.valor / 100) : c.valor;
        await client.query('UPDATE cupones SET usos = usos + 1 WHERE codigo = $1', [cupon_codigo]);
      }
    }

    // Si el frontend manda el total con interés de cuotas, ese es el total real cobrado
    const total = (total_con_interes !== undefined && total_con_interes !== null)
      ? parseFloat(total_con_interes)
      : subtotal - descuento_total;

    const count = await client.query('SELECT COUNT(*) FROM ventas');
    const numero = 'F-' + String(parseInt(count.rows[0].count) + 1).padStart(4, '0');

    const venta = await client.query(
      `INSERT INTO ventas
        (numero_factura, cliente_id, tipo_factura, subtotal, descuento, total, canal, local_id,
         medio_pago_id, medio_pago, es_preventa, nombre_preventa, estado_pago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        numero, cliente_id, tipo_factura, subtotal, descuento_total, total,
        canal || 'presencial', local_id || 1,
        medio_pago_id || null, medio_pago_nombre || null,
        es_preventa === true, nombre_preventa || null,
        es_preventa === true ? 'reservado' : null
      ]
    );

    const ventaId = venta.rows[0].id;

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

    // Las preventas no generan movimiento de caja hasta que se cobran
    if (es_preventa !== true) {
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
         VALUES ($1, 'I', $2, $3, $4)`,
        ['Venta ' + numero, total, numero, local_id || 1]
      );
    }

    if (cliente_id) {
      const puntos = Math.floor(total / 100);
      await client.query(
        'UPDATE clientes SET puntos = puntos + $1, total_compras = total_compras + $2 WHERE id = $3',
        [puntos, total, cliente_id]
      );
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

const getResumenHoy = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT COUNT(*) AS cantidad_ventas, SUM(total) AS total_vendido, AVG(total) AS ticket_promedio
      FROM ventas WHERE DATE(creado_en) = CURRENT_DATE
    `;
    const params = [];
    if (local_id) { params.push(local_id); query += ` AND local_id = $${params.length}`; }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};

const getResumenMes = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT COUNT(*) AS cantidad_ventas, SUM(total) AS total_vendido
      FROM ventas WHERE DATE_TRUNC('month', creado_en) = DATE_TRUNC('month', CURRENT_DATE)
    `;
    const params = [];
    if (local_id) { params.push(local_id); query += ` AND local_id = $${params.length}`; }
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen del mes' });
  }
};

module.exports = { getAll, getById, create, getResumenHoy, getResumenMes };