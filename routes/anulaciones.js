const express = require('express');
const router = express.Router();
const pool = require('../config/database');

const validar = (req) => {
  const { motivo, usuario_rol } = req.body;
  if (!motivo || !motivo.trim()) return 'El motivo es obligatorio';
  if (usuario_rol && usuario_rol !== 'jefe' && usuario_rol !== 'administrativo') return 'No tenes permiso para anular';
  return null;
};

const registrarAnulacion = async (client, tipo, refId, refCodigo, motivo, usuarioId, usuarioNombre, detalle) => {
  await client.query(
    `INSERT INTO anulaciones (tipo, referencia_id, referencia_codigo, motivo, usuario_id, usuario_nombre, detalle_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [tipo, refId, refCodigo || null, motivo.trim(), usuarioId || null, usuarioNombre || null, detalle ? JSON.stringify(detalle) : null]
  );
};

// Anular venta del POS - revierte stock, cancela movimiento de caja, libera reserva si era preventa
router.post('/venta/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const err = validar(req); if (err) return res.status(400).json({ error: err });
    await client.query('BEGIN');
    const { motivo, usuario_id, usuario_nombre } = req.body;
    const ventaRes = await client.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    if (ventaRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venta no encontrada' }); }
    const venta = ventaRes.rows[0];
    if (venta.anulada) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Esta venta ya fue anulada' }); }

    const items = await client.query('SELECT * FROM venta_items WHERE venta_id = $1', [venta.id]);
    for (const it of items.rows) {
      if (venta.es_preventa === true && venta.estado_pago === 'reservado') {
        // Liberar reserva por local
        if (venta.preventa_local === 2) {
          await client.query('UPDATE productos SET reservado_ush = GREATEST(COALESCE(reservado_ush,0)-$1,0) WHERE id=$2', [it.cantidad, it.producto_id]);
        } else {
          await client.query('UPDATE productos SET reservado_rg = GREATEST(COALESCE(reservado_rg,0)-$1,0) WHERE id=$2', [it.cantidad, it.producto_id]);
        }
      } else {
        // Devolver stock real
        await client.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [it.cantidad, it.producto_id]);
      }
    }

    // Cancelar movimiento de caja asociado
    await client.query(
      `UPDATE movimientos_caja SET anulado = TRUE, anulado_en = NOW(), anulado_por = $1, motivo_anulacion = $2
       WHERE referencia = $3 AND anulado = FALSE`,
      [usuario_nombre || null, motivo.trim(), venta.numero_factura]
    );

    // Devolver puntos al cliente si tenia
    if (venta.cliente_id && parseFloat(venta.total) > 0) {
      const puntosDevolver = Math.floor(parseFloat(venta.total) / 100);
      await client.query(
        'UPDATE clientes SET puntos = GREATEST(puntos - $1, 0), total_compras = GREATEST(total_compras - $2, 0) WHERE id = $3',
        [puntosDevolver, parseFloat(venta.total), venta.cliente_id]
      );
    }

    // Si uso gift card, devolver el saldo
    const montoGC = parseFloat(venta.monto_gift_card) || 0;
    if (montoGC > 0) {
      const movGC = await client.query(
        `SELECT gift_card_id FROM gift_card_movimientos WHERE venta_id = $1 AND tipo = 'canje' LIMIT 1`,
        [venta.id]
      );
      if (movGC.rows.length > 0) {
        const gcId = movGC.rows[0].gift_card_id;
        await client.query('UPDATE gift_cards SET saldo = saldo + $1, estado = $2 WHERE id = $3',
          [montoGC, 'activa', gcId]);
        await client.query(
          `INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante, venta_id, usuario_id)
           SELECT $1, 'devolucion', $2, saldo, $3, $4 FROM gift_cards WHERE id = $1`,
          [gcId, montoGC, venta.id, usuario_id || null]
        );
      }
    }

    await client.query(
      `UPDATE ventas SET anulada = TRUE, anulada_en = NOW(), anulada_por = $1, motivo_anulacion = $2 WHERE id = $3`,
      [usuario_nombre || null, motivo.trim(), venta.id]
    );

    await registrarAnulacion(client, 'venta', venta.id, venta.numero_factura, motivo, usuario_id, usuario_nombre, { total: venta.total });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al anular venta: ' + error.message });
  } finally { client.release(); }
});

// Anular gift card - revierte ingreso de caja, deja saldo en cero
router.post('/giftcard/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const err = validar(req); if (err) return res.status(400).json({ error: err });
    await client.query('BEGIN');
    const { motivo, usuario_id, usuario_nombre } = req.body;
    const gcRes = await client.query('SELECT * FROM gift_cards WHERE id = $1', [req.params.id]);
    if (gcRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Gift card no encontrada' }); }
    const gc = gcRes.rows[0];
    if (gc.anulada) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ya esta anulada' }); }

    // Solo se puede anular si no se uso o si se quiere forzar el reverso completo
    // Cancelar el movimiento de caja de la emision
    await client.query(
      `UPDATE movimientos_caja SET anulado = TRUE, anulado_en = NOW(), anulado_por = $1, motivo_anulacion = $2
       WHERE referencia = $3 AND tipo = 'I' AND anulado = FALSE`,
      [usuario_nombre || null, motivo.trim(), gc.codigo]
    );

    await client.query(
      `UPDATE gift_cards SET anulada = TRUE, anulada_en = NOW(), anulada_por = $1, motivo_anulacion = $2, saldo = 0, estado = 'cancelada' WHERE id = $3`,
      [usuario_nombre || null, motivo.trim(), gc.id]
    );

    await registrarAnulacion(client, 'giftcard', gc.id, gc.codigo, motivo, usuario_id, usuario_nombre, { monto_inicial: gc.monto_inicial, saldo_al_anular: gc.saldo });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al anular gift card: ' + error.message });
  } finally { client.release(); }
});

// Anular movimiento de caja (ingreso o egreso manual)
router.post('/movimiento/:id', async (req, res) => {
  try {
    const err = validar(req); if (err) return res.status(400).json({ error: err });
    const { motivo, usuario_id, usuario_nombre } = req.body;
    const movRes = await pool.query('SELECT * FROM movimientos_caja WHERE id = $1', [req.params.id]);
    if (movRes.rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    if (movRes.rows[0].anulado) return res.status(400).json({ error: 'Ya esta anulado' });

    await pool.query(
      `UPDATE movimientos_caja SET anulado = TRUE, anulado_en = NOW(), anulado_por = $1, motivo_anulacion = $2 WHERE id = $3`,
      [usuario_nombre || null, motivo.trim(), req.params.id]
    );
    await pool.query(
      `INSERT INTO anulaciones (tipo, referencia_id, referencia_codigo, motivo, usuario_id, usuario_nombre, detalle_json)
       VALUES ('movimiento_caja', $1, $2, $3, $4, $5, $6)`,
      [movRes.rows[0].id, movRes.rows[0].referencia, motivo.trim(), usuario_id || null, usuario_nombre || null, JSON.stringify({ importe: movRes.rows[0].importe, tipo: movRes.rows[0].tipo })]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al anular movimiento' });
  }
});

// Revertir un ajuste de stock (reaplica el delta inverso)
router.post('/ajuste-stock/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const err = validar(req); if (err) return res.status(400).json({ error: err });
    await client.query('BEGIN');
    const { motivo, usuario_id, usuario_nombre } = req.body;
    const ajRes = await client.query('SELECT * FROM ajustes_stock WHERE id = $1', [req.params.id]);
    if (ajRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Ajuste no encontrado' }); }
    const aj = ajRes.rows[0];

    // Aplicar inverso al stock actual
    const stockActual = (await client.query('SELECT stock FROM productos WHERE id = $1', [aj.producto_id])).rows[0]?.stock || 0;
    const nuevoStock = stockActual - aj.diferencia;
    if (nuevoStock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No se puede revertir, dejaria stock negativo' }); }

    await client.query('UPDATE productos SET stock = $1 WHERE id = $2', [nuevoStock, aj.producto_id]);
    await client.query(
      `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [aj.producto_id, stockActual, nuevoStock, -aj.diferencia, 'REVERSION: ' + motivo.trim(), usuario_id || null, usuario_nombre || null, aj.local_id || 1]
    );
    await registrarAnulacion(client, 'ajuste_stock', aj.id, null, motivo, usuario_id, usuario_nombre, { producto_id: aj.producto_id, diferencia_original: aj.diferencia });
    await client.query('COMMIT');
    res.json({ ok: true, nuevo_stock: nuevoStock });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al revertir ajuste: ' + error.message });
  } finally { client.release(); }
});

// Anular orden de ingreso de mercaderia - revierte el stock_transito que cargo
router.post('/orden-ingreso/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const err = validar(req); if (err) return res.status(400).json({ error: err });
    await client.query('BEGIN');
    const { motivo, usuario_id, usuario_nombre } = req.body;
    const ordRes = await client.query('SELECT * FROM ordenes_ingreso WHERE id = $1', [req.params.id]);
    if (ordRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
    const ord = ordRes.rows[0];
    if (ord.estado === 'anulada') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ya esta anulada' }); }
    if (ord.estado === 'recibida' || ord.estado === 'pagada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede anular una orden ya recibida/pagada. Tene que ajustar el stock manualmente.' });
    }

    const items = await client.query('SELECT * FROM ordenes_ingreso_items WHERE orden_id = $1', [ord.id]);
    for (const it of items.rows) {
      if (it.producto_id) {
        await client.query(
          'UPDATE productos SET stock_transito_rg = GREATEST(COALESCE(stock_transito_rg,0) - $1, 0), stock_transito_ush = GREATEST(COALESCE(stock_transito_ush,0) - $2, 0) WHERE id = $3',
          [it.cantidad_rg || 0, it.cantidad_ush || 0, it.producto_id]
        );
      }
    }
    await client.query("UPDATE ordenes_ingreso SET estado = 'anulada' WHERE id = $1", [ord.id]);
    await registrarAnulacion(client, 'orden_ingreso', ord.id, ord.numero_factura, motivo, usuario_id, usuario_nombre, { total: ord.total });
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al anular orden: ' + error.message });
  } finally { client.release(); }
});

// Historial de anulaciones
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM anulaciones ORDER BY creado_en DESC LIMIT 200');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error al obtener anulaciones' }); }
});

module.exports = router;