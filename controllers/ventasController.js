const pool = require('../config/database');

// Si una venta del POS se cobro (total o parcialmente) en efectivo, suma ese ingreso
// automaticamente a la Caja (movimientos_caja_efectivo), para no tener que cargarlo a mano.
const acreditarEfectivoEnCaja = async (client, { pagos, medio_pago_id, medio_pago_nombre, monto, local_id, usuario_id, concepto }) => {
  const tramos = (Array.isArray(pagos) && pagos.length > 0)
    ? pagos.map(p => ({ medio_pago_id: p.medio_pago_id || null, medio_pago_nombre: p.medio_pago_nombre || null, importe: parseFloat(p.importe) || 0 }))
    : [{ medio_pago_id: medio_pago_id || null, medio_pago_nombre: medio_pago_nombre || null, importe: parseFloat(monto) || 0 }];

  let totalEfectivo = 0;
  for (const t of tramos) {
    if (t.importe <= 0) continue;
    let esEfectivo = false;
    if (t.medio_pago_id) {
      const mp = await client.query('SELECT tipo, nombre FROM medios_pago WHERE id = $1', [t.medio_pago_id]);
      if (mp.rows.length > 0) esEfectivo = mp.rows[0].tipo === 'efectivo' || /efectivo/i.test(mp.rows[0].nombre || '');
    }
    if (!esEfectivo && t.medio_pago_nombre) esEfectivo = /efectivo/i.test(t.medio_pago_nombre);
    if (esEfectivo) totalEfectivo += t.importe;
  }

  if (totalEfectivo > 0) {
    await client.query(
      `INSERT INTO movimientos_caja_efectivo (tipo, importe, concepto, destino_origen, local_id, usuario_id)
       VALUES ('ingreso', $1, $2, 'venta_presencial', $3, $4)`,
      [totalEfectivo, concepto, local_id || 1, usuario_id || null]
    );
  }
};

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
      usuario_id, inicio_venta, duracion_segundos, monto_gift_card, insumos_usados, pagos, referencia } = req.body;

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.precio_unitario * item.cantidad;
    }

    let descuento_total = descuento || 0;
    let cuponId = null;

    if (cupon_codigo) {
      const cupon = await client.query(
        'SELECT * FROM cupones WHERE codigo = $1 AND activo = TRUE', [cupon_codigo]
      );
      if (cupon.rows.length > 0) {
        const c = cupon.rows[0];
        cuponId = c.id;
        // Si el cupon exige un monto minimo de compra para el descuento, y no se llega,
        // el cupon queda vinculado a la venta (para comision de influencer) pero sin descuento.
        const cumpleMinimo = !c.descuento_monto_minimo || subtotal >= parseFloat(c.descuento_monto_minimo);
        if (cumpleMinimo) {
          // Si el cupon tiene una condicion de medio de pago (ej: "15% en Transferencia"),
          // usamos el valor condicional cuando el medio de pago de la venta la cumple.
          const medioTexto = (medio_pago_nombre || '').toLowerCase();
          const cumpleCondicion = c.condicion_medio_pago && c.valor_condicional !== null
            && medioTexto.includes(String(c.condicion_medio_pago).toLowerCase());
          const valorAplicado = cumpleCondicion ? parseFloat(c.valor_condicional) : parseFloat(c.valor);
          descuento_total = c.tipo === '%' ? subtotal * (valorAplicado / 100) : valorAplicado;
        }
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
         usuario_id, inicio_venta, duracion_segundos, monto_gift_card, preventa_local, referencia, cupon_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [
        numero, cliente_id, tipo_factura, subtotal, descuento_total, total,
        canal || 'presencial', local_id || 1,
        medio_pago_id || null, medio_pago_nombre || null,
        es_preventa === true, nombre_preventa || null,
        es_preventa === true ? 'reservado' : null,
        usuario_id || null, inicio_venta || null, duracion_segundos || null,
        parseFloat(monto_gift_card) || 0,
        es_preventa === true ? (local_id || 1) : null,
        referencia || null,
        cuponId
      ]
    );

    const ventaId = venta.rows[0].id;

    // Pago mixto: si vienen varios pagos, se guardan en venta_pagos.
    if (Array.isArray(pagos) && pagos.length > 0) {
      for (const p of pagos) {
        const imp = parseFloat(p.importe) || 0;
        if (imp <= 0) continue;
        await client.query(
          `INSERT INTO venta_pagos (venta_id, medio_pago_id, medio_pago_nombre, importe, gift_card_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [ventaId, p.medio_pago_id || null, p.medio_pago_nombre || null, imp, p.gift_card_id || null]
        );
      }
    }

    for (const item of items) {
      // Item de ajuste/diferencia (sin producto): se registra pero NO descuenta stock
      if (!item.producto_id) {
        await client.query(
          `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, NULL, $2, $3, $4)`,
          [ventaId, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
        );
        continue;
      }
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
        // Venta normal: descuenta del stock del LOCAL donde se vende, y mantiene "stock" total sincronizado
        const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
        await client.query(
          `UPDATE productos SET ${colStock} = COALESCE(${colStock}, 0) - $1,
             stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1
           WHERE id = $2`,
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
      await acreditarEfectivoEnCaja(client, {
        pagos, medio_pago_id, medio_pago_nombre, monto: ingresoCaja,
        local_id: local_id || 1, usuario_id, concepto: 'Venta ' + numero
      });
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

    const colStockPreventa = esUsh ? 'stock_ush' : 'stock_rg';
    for (const item of items) {
      // Verificar que haya stock real suficiente en el LOCAL de la preventa antes de descontar
      const prodRes = await client.query(`SELECT ${colStockPreventa} AS stock_local, nombre FROM productos WHERE id = $1`, [item.producto_id]);
      const stockActual = prodRes.rows[0]?.stock_local || 0;
      if (stockActual < item.cantidad) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Stock insuficiente para "' + (prodRes.rows[0]?.nombre || 'producto') + '". Disponible: ' + stockActual + ', se necesitan: ' + item.cantidad + '. Puede que la mercaderia aun no haya llegado.'
        });
      }
      // Descuenta del stock real del local (la clienta se lo lleva) y sincroniza el total
      await client.query(
        `UPDATE productos SET ${colStockPreventa} = COALESCE(${colStockPreventa}, 0) - $1,
           stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1
         WHERE id = $2`,
        [item.cantidad, item.producto_id]
      );
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
      await acreditarEfectivoEnCaja(client, {
        pagos: null, medio_pago_id, medio_pago_nombre, monto: ingresoCaja,
        local_id: venta.local_id || 1, usuario_id, concepto: 'Entrega preventa ' + (venta.numero_factura || '')
      });
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

// Registrar una VENTA ONLINE (ya facturada en la tienda online).
// Descuenta stock del local indicado, suma al cierre, NO factura en ARCA.
const crearOnline = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { items, total, medio_pago_id, medio_pago_nombre, local_id, usuario_id, referencia, fecha, cliente_id, pagos, cupon_codigo } = req.body;
    // Si viene fecha, se usa esa (para ventas online de dias anteriores). Si no, ahora.
    // Si viene solo la fecha (YYYY-MM-DD), guardarla al mediodia para que ningun
    // corrimiento de zona horaria la cambie de dia.
    let fechaVenta = null;
    if (fecha) {
      const soloFecha = String(fecha).slice(0, 10);
      fechaVenta = (soloFecha.length === 10 && soloFecha[4] === '-') ? (soloFecha + ' 12:00:00') : fecha;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La venta online no tiene productos' });
    }
    const totalNum = parseFloat(total) || 0;

    let subtotal = 0;
    for (const item of items) subtotal += item.precio_unitario * item.cantidad;

    // Cupon (ej: codigo de influencer) - solo se registra el vinculo, el total ya viene calculado.
    let cuponId = null;
    if (cupon_codigo) {
      const cupon = await client.query('SELECT * FROM cupones WHERE codigo = $1 AND activo = TRUE', [cupon_codigo]);
      if (cupon.rows.length > 0) {
        cuponId = cupon.rows[0].id;
        await client.query('UPDATE cupones SET usos = usos + 1 WHERE codigo = $1', [cupon_codigo]);
      }
    }

    const count = await client.query('SELECT COUNT(*) FROM ventas');
    const numero = 'ON-' + String(parseInt(count.rows[0].count) + 1).padStart(4, '0');

    const venta = await client.query(
      `INSERT INTO ventas
        (numero_factura, cliente_id, tipo_factura, subtotal, descuento, total, canal, local_id,
         medio_pago_id, medio_pago, es_preventa, estado_pago, usuario_id, creado_en, cupon_id)
       VALUES ($1, $9, NULL, $2, 0, $3, 'online', $4, $5, $6, FALSE, 'pagado', $7, COALESCE($8::timestamp, NOW()), $10) RETURNING *`,
      [numero, subtotal, totalNum, local_id || 1, medio_pago_id || null, medio_pago_nombre || null, usuario_id || null, fechaVenta, cliente_id || null, cuponId]
    );
    const ventaId = venta.rows[0].id;

    // Pago mixto: si vienen varios pagos, se guardan en venta_pagos.
    if (Array.isArray(pagos) && pagos.length > 0) {
      for (const p of pagos) {
        const imp = parseFloat(p.importe) || 0;
        if (imp <= 0) continue;
        await client.query(
          `INSERT INTO venta_pagos (venta_id, medio_pago_id, medio_pago_nombre, importe)
           VALUES ($1, $2, $3, $4)`,
          [ventaId, p.medio_pago_id || null, p.medio_pago_nombre || null, imp]
        );
      }
    }

    const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
    for (const item of items) {
      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [ventaId, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );
      // Descuenta del stock del local y sincroniza el total
      await client.query(
        `UPDATE productos SET ${colStock} = COALESCE(${colStock}, 0) - $1,
           stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1
         WHERE id = $2`,
        [item.cantidad, item.producto_id]
      );
    }

    // Suma al cierre de caja como ingreso (identificado como venta online)
    if (totalNum > 0) {
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id, creado_en)
         VALUES ($1, 'I', $2, $3, $4, COALESCE($5::timestamp, NOW()))`,
        ['Venta online ' + numero + (referencia ? ' (' + referencia + ')' : ''), totalNum, numero, local_id || 1, fechaVenta]
      );
    }

    // Si la venta online tiene clienta, sumar puntos (1 cada $100) y recalcular nivel
    if (cliente_id) {
      const pts = Math.floor(totalNum / 100);
      if (pts > 0) {
        const upd = await client.query(
          'UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2 RETURNING puntos',
          [pts, cliente_id]
        );
        if (upd.rows.length > 0) {
          const p = upd.rows[0].puntos;
          let nivel = 'Bronze';
          if (p >= 20000) nivel = 'Black';
          else if (p >= 10000) nivel = 'Platinum';
          else if (p >= 5000) nivel = 'Gold';
          else if (p >= 2000) nivel = 'Silver';
          await client.query('UPDATE clientes SET nivel = $1 WHERE id = $2', [nivel, cliente_id]);
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json(venta.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar venta online: ' + error.message });
  } finally {
    client.release();
  }
};

// Eliminar una venta online (revierte stock y borra el movimiento de caja)
const eliminarOnline = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const ventaRes = await client.query("SELECT * FROM ventas WHERE id = $1 AND canal = 'online'", [id]);
    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta online no encontrada' });
    }
    const venta = ventaRes.rows[0];

    // Revertir stock de cada item al local de la venta
    const colStock = (venta.local_id === 2) ? 'stock_ush' : 'stock_rg';
    const items = await client.query('SELECT producto_id, cantidad FROM venta_items WHERE venta_id = $1', [id]);
    for (const it of items.rows) {
      if (it.producto_id) {
        await client.query(
          `UPDATE productos SET ${colStock} = COALESCE(${colStock},0) + $1,
             stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1
           WHERE id = $2`,
          [it.cantidad, it.producto_id]
        );
      }
    }

    // Borrar movimiento de caja, pagos, items y venta
    await client.query('DELETE FROM movimientos_caja WHERE referencia = $1', [venta.numero_factura]);
    await client.query('DELETE FROM venta_pagos WHERE venta_id = $1', [id]);
    await client.query('DELETE FROM venta_items WHERE venta_id = $1', [id]);
    await client.query('DELETE FROM ventas WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Venta online eliminada y stock revertido' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar venta online: ' + error.message });
  } finally {
    client.release();
  }
};

// Editar una venta online (fecha, local, monto, y opcionalmente los productos).
// Si vienen "items", reemplaza los productos de la venta: repone el stock de lo que
// se llevaba antes y descuenta el stock de lo nuevo (asi funciona un cambio de producto).
const editarOnline = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { total, local_id, fecha, items, usuario_id, usuario_nombre } = req.body;

    const ventaRes = await client.query("SELECT * FROM ventas WHERE id = $1 AND canal = 'online'", [id]);
    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Venta online no encontrada' });
    }
    const ventaActual = ventaRes.rows[0];
    const itemsAntesDeTocar = (await client.query(
      `SELECT vi.producto_id, vi.cantidad, vi.precio_unitario, p.nombre
       FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
       WHERE vi.venta_id = $1`, [id]
    )).rows;

    // Preparar fecha al mediodia si viene solo dia
    let fechaVenta = null;
    if (fecha) {
      const soloFecha = String(fecha).slice(0, 10);
      fechaVenta = (soloFecha.length === 10 && soloFecha[4] === '-') ? (soloFecha + ' 12:00:00') : fecha;
    }

    const nuevoLocal = (local_id !== undefined && local_id !== null) ? (Number(local_id) === 2 ? 2 : 1) : ventaActual.local_id;
    let nuevoTotal = (total !== undefined && total !== null) ? parseFloat(total) : ventaActual.total;

    if (Array.isArray(items) && items.length > 0) {
      const colStockAnterior = (ventaActual.local_id === 2) ? 'stock_ush' : 'stock_rg';
      const colStockNuevo = (nuevoLocal === 2) ? 'stock_ush' : 'stock_rg';

      // Reponer el stock de los productos que se llevaba antes de la edicion
      for (const it of itemsAntesDeTocar) {
        if (it.producto_id) {
          await client.query(
            `UPDATE productos SET ${colStockAnterior} = COALESCE(${colStockAnterior},0) + $1,
               stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1
             WHERE id = $2`,
            [it.cantidad, it.producto_id]
          );
        }
      }
      await client.query('DELETE FROM venta_items WHERE venta_id = $1', [id]);

      // Cargar los productos nuevos y descontar su stock
      let nuevoSubtotal = 0;
      for (const item of items) {
        const cantidad = parseInt(item.cantidad) || 0;
        const precioUnitario = parseFloat(item.precio_unitario) || 0;
        if (cantidad <= 0) continue;
        nuevoSubtotal += precioUnitario * cantidad;
        await client.query(
          `INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, item.producto_id, cantidad, precioUnitario, precioUnitario * cantidad]
        );
        if (item.producto_id) {
          await client.query(
            `UPDATE productos SET ${colStockNuevo} = COALESCE(${colStockNuevo}, 0) - $1,
               stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - $1
             WHERE id = $2`,
            [cantidad, item.producto_id]
          );
        }
      }
      // El total de una venta con productos siempre sale de la suma de los productos
      nuevoTotal = nuevoSubtotal;
    }

    await client.query(
      `UPDATE ventas SET total = $1, subtotal = $1, local_id = $2, creado_en = COALESCE($3::timestamp, creado_en) WHERE id = $4`,
      [nuevoTotal, nuevoLocal, fechaVenta, id]
    );

    // Actualizar el movimiento de caja asociado
    await client.query(
      `UPDATE movimientos_caja SET importe = $1, local_id = $2, creado_en = COALESCE($3::timestamp, creado_en) WHERE referencia = $4`,
      [nuevoTotal, nuevoLocal, fechaVenta, ventaActual.numero_factura]
    );

    // Dejar registro de la modificacion para que el jefe pueda auditar que se cambio y quien lo hizo
    const itemsDespuesDelCambio = (await client.query(
      `SELECT vi.producto_id, vi.cantidad, vi.precio_unitario, p.nombre
       FROM venta_items vi LEFT JOIN productos p ON p.id = vi.producto_id
       WHERE vi.venta_id = $1`, [id]
    )).rows;
    await client.query(
      `INSERT INTO anulaciones (tipo, referencia_id, referencia_codigo, motivo, usuario_id, usuario_nombre, detalle_json)
       VALUES ('venta_online_editada', $1, $2, $3, $4, $5, $6)`,
      [
        id, ventaActual.numero_factura, 'Edicion de venta online',
        usuario_id || null, usuario_nombre || null,
        JSON.stringify({
          items_anteriores: itemsAntesDeTocar,
          items_nuevos: itemsDespuesDelCambio,
          total_anterior: parseFloat(ventaActual.total),
          total_nuevo: nuevoTotal,
          local_anterior: ventaActual.local_id,
          local_nuevo: nuevoLocal
        })
      ]
    );

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Venta online actualizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al editar venta online: ' + error.message });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, update, confirmarEntrega, getResumenHoy, getResumenMes, crearOnline, eliminarOnline, editarOnline };
