const pool = require('../config/database');

function generarCodigoGC() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return 'GIFT-' + c;
}

// Buscar la venta original por numero de comprobante, con sus items (para elegir que se devuelve)
const buscarVentaOrigen = async (req, res) => {
  try {
    const { numero } = req.params;
    const ventaRes = await pool.query('SELECT * FROM ventas WHERE numero_factura = $1', [numero.trim()]);
    if (ventaRes.rows.length === 0) return res.status(404).json({ error: 'No se encontro ninguna venta con ese numero' });
    const venta = ventaRes.rows[0];
    const itemsRes = await pool.query(
      `SELECT vi.*, p.nombre AS producto_nombre
       FROM venta_items vi JOIN productos p ON vi.producto_id = p.id
       WHERE vi.venta_id = $1`,
      [venta.id]
    );
    res.json({ ...venta, items: itemsRes.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Procesar un cambio: devuelve stock del producto viejo, resta stock del nuevo,
// y resuelve la diferencia (cobrar mas, o dejar credito a favor / efectivo de vuelta).
const procesarCambio = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      venta_origen_id, venta_origen_numero,
      producto_devuelto_id, cantidad_devuelta, valor_devuelto_unitario,
      producto_nuevo_id, cantidad_nueva,
      local_id, usuario_id, usuario_nombre,
      resolucion_diferencia, medio_pago, beneficiario_nombre
    } = req.body;

    const localNum = local_id === 2 || local_id === '2' ? 2 : 1;
    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';

    if (!producto_devuelto_id || !cantidad_devuelta || cantidad_devuelta <= 0) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Falta el producto devuelto o la cantidad' });
    }
    if (!producto_nuevo_id || !cantidad_nueva || cantidad_nueva <= 0) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Falta el producto nuevo o la cantidad' });
    }

    const prodNuevoRes = await client.query(`SELECT id, nombre, precio, ${colStock} AS stock_local FROM productos WHERE id = $1`, [producto_nuevo_id]);
    if (prodNuevoRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Producto nuevo no encontrado' }); }
    const prodNuevo = prodNuevoRes.rows[0];

    const prodDevueltoRes = await client.query(`SELECT id, nombre FROM productos WHERE id = $1`, [producto_devuelto_id]);
    if (prodDevueltoRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Producto devuelto no encontrado' }); }
    const prodDevuelto = prodDevueltoRes.rows[0];

    if (parseInt(prodNuevo.stock_local || 0) < parseInt(cantidad_nueva)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay stock suficiente de "' + prodNuevo.nombre + '" en este local' });
    }

    const valorDevuelto = parseFloat(valor_devuelto_unitario || 0) * parseInt(cantidad_devuelta);
    const valorNuevo = parseFloat(prodNuevo.precio || 0) * parseInt(cantidad_nueva);
    const diferencia = valorNuevo - valorDevuelto;

    // Devolver stock del producto viejo
    await client.query(
      `UPDATE productos SET ${colStock} = COALESCE(${colStock},0) + $1,
         stock = CASE WHEN '${colStock}' = 'stock_rg' THEN COALESCE(stock_rg,0) + $1 + COALESCE(stock_ush,0) ELSE COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1 END
       WHERE id = $2`,
      [cantidad_devuelta, producto_devuelto_id]
    );
    // Restar stock del producto nuevo
    await client.query(
      `UPDATE productos SET ${colStock} = COALESCE(${colStock},0) - $1,
         stock = CASE WHEN '${colStock}' = 'stock_rg' THEN COALESCE(stock_rg,0) - $1 + COALESCE(stock_ush,0) ELSE COALESCE(stock_rg,0) + COALESCE(stock_ush,0) - $1 END
       WHERE id = $2`,
      [cantidad_nueva, producto_nuevo_id]
    );

    let giftCardCreada = null;

    if (diferencia > 0) {
      // El producto nuevo cuesta mas: se cobra la diferencia (queda como ingreso de caja,
      // no genera una factura ARCA nueva -- si necesitas que quede facturada la diferencia,
      // consultalo con tu contador sobre el tratamiento fiscal correcto de un cambio).
      if (resolucion_diferencia !== 'cobro' || !medio_pago) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El producto nuevo cuesta mas: hay que cobrar la diferencia y elegir el medio de pago' });
      }
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id, forma_pago)
         VALUES ($1, 'I', $2, $3, $4, $5)`,
        ['Cobro diferencia por cambio (venta #' + (venta_origen_numero || '-') + ')', diferencia, venta_origen_numero || null, localNum, medio_pago]
      );
    } else if (diferencia < 0) {
      const monto = Math.abs(diferencia);
      if (resolucion_diferencia === 'credito') {
        if (!beneficiario_nombre) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Falta el nombre de quien recibe el credito' }); }
        let codigo, intentos = 0;
        while (intentos < 10) {
          codigo = generarCodigoGC();
          const existe = await client.query('SELECT 1 FROM gift_cards WHERE codigo = $1', [codigo]);
          if (existe.rows.length === 0) break;
          intentos++;
        }
        const gcRes = await client.query(
          `INSERT INTO gift_cards (codigo, monto_inicial, saldo, beneficiario_nombre, estado, local_id, emitida_por, venta_origen_id, venta_origen_numero)
           VALUES ($1,$2,$2,$3,'activa',$4,$5,$6,$7) RETURNING *`,
          [codigo, monto, beneficiario_nombre, localNum, usuario_id || null, venta_origen_id || null, venta_origen_numero || null]
        );
        giftCardCreada = gcRes.rows[0];
        await client.query(
          `INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante, usuario_id) VALUES ($1,'emision',$2,$2,$3)`,
          [giftCardCreada.id, monto, usuario_id || null]
        );
        await client.query(
          `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
           VALUES ($1, 'I', 0, $2, $3)`,
          ['Gift Card ' + codigo + ' (credito por cambio, venta #' + (venta_origen_numero || '-') + ')', codigo, localNum]
        );
      } else if (resolucion_diferencia === 'efectivo') {
        await client.query(
          `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
           VALUES ($1, 'E', $2, $3, $4)`,
          ['Devolucion de diferencia en efectivo (venta #' + (venta_origen_numero || '-') + ')', monto, venta_origen_numero || null, localNum]
        );
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El producto nuevo cuesta menos: elegi si la diferencia queda como credito a favor o se devuelve en efectivo' });
      }
    }

    const registroRes = await client.query(
      `INSERT INTO cambios_productos
        (venta_origen_id, venta_origen_numero, producto_devuelto_id, producto_devuelto_nombre, cantidad_devuelta, valor_devuelto,
         producto_nuevo_id, producto_nuevo_nombre, cantidad_nueva, valor_nuevo, diferencia, resolucion_diferencia, medio_pago,
         gift_card_id, local_id, usuario_id, usuario_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        venta_origen_id || null, venta_origen_numero || null, producto_devuelto_id, prodDevuelto.nombre, cantidad_devuelta, valorDevuelto,
        producto_nuevo_id, prodNuevo.nombre, cantidad_nueva, valorNuevo, diferencia,
        diferencia === 0 ? null : resolucion_diferencia, diferencia > 0 ? medio_pago : null,
        giftCardCreada?.id || null, localNum, usuario_id || null, usuario_nombre || null
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ cambio: registroRes.rows[0], gift_card: giftCardCreada });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
};

// Historial de cambios
const getCambios = async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM cambios_productos WHERE 1=1';
    if (local_id) { params.push(local_id); q += ` AND local_id = $${params.length}`; }
    q += ' ORDER BY creado_en DESC LIMIT 100';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { buscarVentaOrigen, procesarCambio, getCambios };