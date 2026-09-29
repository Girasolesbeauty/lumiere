const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Datos de apoyo para el Punto de Venta: sugerencias de venta cruzada y la
// ficha de la clienta. Todo se calcula con las ventas ya registradas
// (sin anuladas ni preventas), no hace falta cargar nada a mano.

// "Suelen llevar tambien": productos que aparecen en las mismas ventas que los del carrito
// (ultimos 180 dias). Se excluyen los que ya estan en el carrito.
router.get('/sugerencias', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').map(x => parseInt(x)).filter(Boolean);
    if (!ids.length) return res.json([]);
    const limite = Math.min(parseInt(req.query.limite) || 4, 12);
    const r = await pool.query(
      `SELECT otro.producto_id, COUNT(DISTINCT otro.venta_id)::int AS veces
         FROM venta_items base
         JOIN venta_items otro ON otro.venta_id = base.venta_id AND otro.producto_id <> base.producto_id
         JOIN ventas v ON v.id = base.venta_id
         JOIN productos p ON p.id = otro.producto_id
        WHERE base.producto_id = ANY($1::int[])
          AND otro.producto_id <> ALL($1::int[])
          AND v.creado_en >= NOW() - interval '180 days'
          AND COALESCE(v.anulada, false) = false
          AND COALESCE(p.activo, true) = true
        GROUP BY otro.producto_id
        HAVING COUNT(DISTINCT otro.venta_id) >= 2
        ORDER BY veces DESC
        LIMIT $2`,
      [ids, limite]
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ficha rapida de la clienta para la ventana emergente del POS: lo justo para ayudar
// a la vendedora a vender mas (que suele comprar, que ya se le puede estar terminando,
// saldo a favor, cumpleanos cerca, pedidos pendientes).
router.get('/cliente/:id/resumen', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Cliente invalido' });

    const [cli, stats, frecuentes, giftCards, pendientes] = await Promise.all([
      pool.query(`SELECT id, nombre, telefono, fecha_nacimiento, puntos, nivel FROM clientes WHERE id = $1`, [id]),
      pool.query(
        `SELECT COUNT(*)::int AS compras, COALESCE(SUM(total), 0) AS total_gastado,
                MAX(creado_en) AS ultima_compra
           FROM ventas
          WHERE cliente_id = $1 AND COALESCE(anulada, false) = false AND COALESCE(es_preventa, false) = false
            AND COALESCE(canal, '') <> 'prueba' AND total > 0`,
        [id]
      ),
      // Productos que mas compro, con cuantos dias pasaron desde la ultima vez
      pool.query(
        `SELECT vi.producto_id, p.nombre, SUM(vi.cantidad)::int AS cantidad,
                COUNT(DISTINCT v.id)::int AS veces,
                MAX(v.creado_en) AS ultima_vez,
                EXTRACT(DAY FROM NOW() - MAX(v.creado_en))::int AS dias_desde
           FROM venta_items vi
           JOIN ventas v ON v.id = vi.venta_id
           JOIN productos p ON p.id = vi.producto_id
          WHERE v.cliente_id = $1 AND COALESCE(v.anulada, false) = false AND COALESCE(v.canal, '') <> 'prueba'
          GROUP BY vi.producto_id, p.nombre
          ORDER BY veces DESC, cantidad DESC
          LIMIT 5`,
        [id]
      ),
      pool.query(
        `SELECT codigo, saldo FROM gift_cards
          WHERE cliente_id = $1 AND COALESCE(anulada, false) = false AND saldo > 0`,
        [id]
      ),
      pool.query(
        `SELECT id, total, monto_sena, creado_en, nombre_preventa FROM ventas
          WHERE cliente_id = $1 AND es_preventa = true AND COALESCE(anulada, false) = false
            AND COALESCE(estado_pago, '') NOT IN ('cancelada', 'confirmada')`,
        [id]
      ),
    ]);

    if (!cli.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const c = cli.rows[0];

    // Dias que faltan para el cumpleanos (null si no hay fecha cargada)
    let diasCumple = null;
    if (c.fecha_nacimiento) {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const fn = new Date(c.fecha_nacimiento);
      let prox = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate());
      if (prox < hoy) prox = new Date(hoy.getFullYear() + 1, fn.getMonth(), fn.getDate());
      diasCumple = Math.round((prox - hoy) / 86400000);
    }

    const s = stats.rows[0];
    res.json({
      cliente: c,
      compras: s.compras,
      total_gastado: parseFloat(s.total_gastado),
      ticket_promedio: s.compras > 0 ? parseFloat(s.total_gastado) / s.compras : 0,
      ultima_compra: s.ultima_compra,
      dias_cumple: diasCumple,
      productos_frecuentes: frecuentes.rows,
      gift_cards: giftCards.rows,
      pendientes: pendientes.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
