const pool = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { local_id, mes, anio, es_preventa } = req.query;
    let query = `
      SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS vendedora_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'producto_id', vi.producto_id,
              'nombre', p.nombre,
              'cantidad', vi.cantidad,
              'precio_unitario', vi.precio_unitario,
              'categoria', p.categoria,
              'marca', p.marca,
              'costo', p.costo
            )
          ) FILTER (WHERE vi.id IS NOT NULL), '[]'
        ) AS items
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.usuario_id = u.id
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
    query += ' GROUP BY v.id, c.nombre, u.nombre ORDER BY v.creado_en DESC';
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
      medio_pago_id, medio_pago_nombre, total_con_interes, es_preventa, nombre_preventa,
      usuario_id, inicio_venta, duracion_segundos, monto_gift_card, insumos_usados
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
         medio_pago_id, medio_pago, es_preventa, nombre_preventa, estado_pago,
         usuario_id, inicio_venta, duracion_segundos, monto_gift_card, preventa_local)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [
        numero, cliente_id, tipo_factura, subtotal, descuento_total, total,
        canal || 'presencial', local_id || 1,
        medio_pago_id || null, medio_pago_nombre || null,
        es_preventa === true, nombre_preventa || null,
        es_preventa === true ? 'reservado' : null,
        usuario_id || null, inicio_venta || null, duracion_segundos || null,
        parseFloat(monto_gift_card) || 0,
        es_preventa === true ? (local_id || 1) : null
      ]
    );

    const ventaId = venta.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );
      if (es_preventa === true) {
        // Preventa: RESERVA sobre el transito del local (no toca stock real ni transito, suma a reservado)
        if (local_id === 2) {
          await client.query(
            'UPDATE productos SET reservado_ush = COALESCE(reservado_ush, 0) + $1 WHERE id = $2',
            [item.cantidad, item.producto_id]
          );
        } else {
          await client.query(
            'UPDATE productos SET reservado_rg = COALESCE(reservado_rg, 0) + $1 WHERE id = $2',
            [item.cantidad, item.producto_id]
          );
        }
      } else {
        // Venta normal: descuenta del stock del deposito
        await client.query(
          'UPDATE productos SET stock = stock - $1 WHERE id = $2',
          [item.cantidad, item.producto_id]
        );
      }
    }

    // Descuento de insumos elegidos en el POS (bolsa, ticket, muestra, etc).
    // Solo en ventas reales, no en preventas. Permite stock negativo a proposito.
    if (es_preventa !== true && Array.isArray(insumos_usados) && insumos_usados.length > 0) {
      const colInsumo = local_id === 2 ? 'stock_ush' : 'stock_rg';
      for (const insumoId of insumos_usados) {
        const idNum = parseInt(insumoId);
        if (!idNum) continue;
        await client.query(
          `UPDATE insumos SET ${colInsumo} = ${colInsumo} - 1 WHERE id = $1`,
          [idNum]
        );
      }
    }

    // Las preventas no generan movimiento de caja hasta que se cobran.
    // La parte pagada con gift card NO se cuenta (esa plata ya entró al emitir la gift card).
    const montoGC = parseFloat(monto_gift_card) || 0;
    const ingresoCaja = total - montoGC;
    if (es_preventa !== true && ingresoCaja > 0) {
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
         VALUES ($1, 'I', $2, $3, $4)`,
        ['Venta ' + numero, ingresoCaja, numero, local_id || 1]
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

// Actualizar campos sueltos de una venta (ej: cancelar una preventa)
const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { estado } = req.body;

    const ventaRes = await client.query('SELECT * FROM ventas WHERE id = $1', [id]);
    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const venta = ventaRes.rows[0];

    // Si se cancela una preventa que tenia reserva activa, liberar lo reservado
    if (estado === 'cancelada' && venta.es_preventa === true && venta.estado_pago === 'reservado') {
      const items = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [id]);
      for (const item of items.rows) {
        if (venta.preventa_local === 2) {
          await client.query(
            'UPDATE productos SET reservado_ush = GREATEST(COALESCE(reservado_ush, 0) - $1, 0) WHERE id = $2',
            [item.cantidad, item.producto_id]
          );
        } else {
          await client.query(
            'UPDATE productos SET reservado_rg = GREATEST(COALESCE(reservado_rg, 0) - $1, 0) WHERE id = $2',
            [item.cantidad, item.producto_id]
          );
        }
      }
    }

    await client.query('UPDATE ventas SET estado_pago = $1 WHERE id = $2', [estado, id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar venta' });
  } finally {
    client.release();
  }
};

// Confirmar entrega de una preventa: la clienta vino a retirar.
// Descuenta del STOCK REAL (ya llego al local) y libera la reserva correspondiente.
// No crea una venta nueva: la preventa pasa a ser la venta confirmada.
const confirmarEntrega = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { medio_pago_id, medio_pago_nombre, total_con_interes, usuario_id } = req.body;

    const ventaRes = await client.query('SELECT * FROM ventas WHERE id = $1', [id]);
    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Preventa no encontrada' });
    }
    const venta = ventaRes.rows[0];

    if (venta.es_preventa !== true) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta venta no es una preventa' });
    }
    if (venta.estado_pago === 'confirmada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta preventa ya fue confirmada' });
    }

    const itemsRes = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [id]);
    const items = itemsRes.rows;
    const esUsh = venta.preventa_local === 2;

    for (const item of items) {
      // Verificar que haya stock real suficiente antes de descontar
      const prodRes = await client.query('SELECT stock, nombre FROM productos WHERE id = $1', [item.producto_id]);
      const stockActual = prodRes.rows[0]?.stock || 0;
      if (stockActual < item.cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Stock insuficiente para "' + (prodRes.rows[0]?.nombre || 'producto') + '". Disponible: ' + stockActual + ', se necesitan: ' + item.cantidad + '. Puede que la mercaderia aun no haya llegado.'
        });
      }
      // Descuenta del stock real (la clienta se lo lleva)
      await client.query('UPDATE productos SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.producto_id]);
      // Libera la reserva (ya no esta "comprometido", ya se entrego)
      if (esUsh) {
        await client.query(
          'UPDATE productos SET reservado_ush = GREATEST(COALESCE(reservado_ush, 0) - $1, 0) WHERE id = $2',
          [item.cantidad, item.producto_id]
        );
      } else {
        await client.query(
          'UPDATE productos SET reservado_rg = GREATEST(COALESCE(reservado_rg, 0) - $1, 0) WHERE id = $2',
          [item.cantidad, item.producto_id]
        );
      }
    }

    // Si se eligio un medio de pago distinto (o no se habia definido), actualizarlo
    const totalFinal = (total_con_interes !== undefined && total_con_interes !== null)
      ? parseFloat(total_con_interes)
      : parseFloat(venta.total);

    await client.query(
      `UPDATE ventas SET
        estado_pago = 'confirmada',
        medio_pago_id = COALESCE($1, medio_pago_id),
        medio_pago = COALESCE($2, medio_pago),
        total = $3
       WHERE id = $4`,
      [medio_pago_id || null, medio_pago_nombre || null, totalFinal, id]
    );

    // Ahora si genera el movimiento de caja, porque recien ahora se cobra
    const montoGC = parseFloat(venta.monto_gift_card) || 0;
    const ingresoCaja = totalFinal - montoGC;
    if (ingresoCaja > 0) {
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
         VALUES ($1, 'I', $2, $3, $4)`,
        ['Entrega preventa ' + (venta.numero_factura || ''), ingresoCaja, venta.numero_factura, venta.local_id || 1]
      );
    }

    await client.query('COMMIT');
    const actualizada = await pool.query('SELECT * FROM ventas WHERE id = $1', [id]);
    res.json(actualizada.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al confirmar entrega: ' + error.message });
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

module.exports = { getAll, getById, create, update, confirmarEntrega, getResumenHoy, getResumenMes };