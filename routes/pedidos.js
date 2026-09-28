const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Crear un pedido (clienta espera un producto). Puede ser de una clienta ya registrada
// (cliente_id) o de alguien sin registrar en el sistema -- en ese caso, nombre y celular
// son obligatorios (no se puede anotar un pedido sin poder contactar a la clienta despues).
router.post('/', async (req, res) => {
  try {
    const { cliente_id, producto_id, producto_texto, nombre_manual, telefono_manual, local_id } = req.body;

    if (!cliente_id && !(nombre_manual && nombre_manual.trim() && telefono_manual && telefono_manual.trim())) {
      return res.status(400).json({ error: 'Elegí un cliente registrado, o cargá su nombre y celular' });
    }
    if (!producto_id && !(producto_texto && producto_texto.trim())) {
      return res.status(400).json({ error: 'Elegi un producto o escribi una sugerencia' });
    }
    // Evitar duplicados: si esa clienta ya esta esperando ese mismo producto, no se anota de nuevo
    // (pasaba al apretar varias veces el boton: quedaban 14 pedidos iguales).
    const dup = await pool.query(
      `SELECT id FROM pedidos_clientas
        WHERE estado = 'esperando'
          AND ( ($1::int IS NOT NULL AND cliente_id = $1)
             OR ($1::int IS NULL AND cliente_id IS NULL AND LOWER(TRIM(nombre_manual)) = LOWER(TRIM($4)) AND REGEXP_REPLACE(COALESCE(telefono_manual,''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE($5,''), '[^0-9]', '', 'g')) )
          AND ( ($2::int IS NOT NULL AND producto_id = $2)
             OR ($2::int IS NULL AND producto_id IS NULL AND LOWER(TRIM(producto_texto)) = LOWER(TRIM($3))) )
        LIMIT 1`,
      [cliente_id || null, producto_id || null, producto_texto || '', nombre_manual || '', telefono_manual || '']
    );
    if (dup.rows.length) return res.status(409).json({ error: 'Ese cliente ya está anotado esperando ese producto' });

    const r = await pool.query(
      `INSERT INTO pedidos_clientas (cliente_id, producto_id, producto_texto, nombre_manual, telefono_manual, local_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [cliente_id || null, producto_id || null, producto_texto ? producto_texto.trim() : null,
       cliente_id ? null : nombre_manual.trim(), cliente_id ? null : telefono_manual.trim(), local_id || 1]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar pedidos (por defecto los que estan esperando), con datos de clienta y producto + stock actual
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    let q = `
      SELECT p.*, COALESCE(c.nombre, p.nombre_manual) AS cliente_nombre,
             COALESCE(c.telefono, p.telefono_manual) AS telefono,
             c.cuit_dni, (p.cliente_id IS NULL) AS clienta_sin_registrar,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre,
             (p.producto_id IS NULL) AS es_sugerencia,
             CASE WHEN p.local_id = 2 THEN 'Ushuaia' ELSE 'Rio Grande' END AS local_nombre,
             CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END AS stock_total
      FROM pedidos_clientas p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN productos pr ON pr.id = p.producto_id`;
    const params = [];
    if (estado) { params.push(estado); q += ` WHERE p.estado = $1`; }
    q += ' ORDER BY p.creado_en DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pedidos con stock disponible (producto paso de 0 a tener stock) y todavia no avisados
router.get('/con-stock', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, COALESCE(c.nombre, p.nombre_manual) AS cliente_nombre,
             COALESCE(c.telefono, p.telefono_manual) AS telefono,
             c.cuit_dni,
             pr.nombre AS producto_nombre,
             CASE WHEN p.local_id = 2 THEN 'Ushuaia' ELSE 'Rio Grande' END AS local_nombre,
             CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END AS stock_total
      FROM pedidos_clientas p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      JOIN productos pr ON pr.id = p.producto_id
      WHERE p.estado = 'esperando'
        AND p.avisado = FALSE
        AND p.producto_id IS NOT NULL
        AND (CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END) > 0
      ORDER BY p.creado_en DESC`);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar como avisado (cuando se le manda el WhatsApp)
router.post('/:id/avisar', async (req, res) => {
  try {
    const { id } = req.params;
    const { mensaje, usuario_nombre } = req.body || {};
    // Se guarda el texto enviado (si vino) para verlo despues en "Avisados"
    try {
      await pool.query(
        `UPDATE pedidos_clientas SET avisado = TRUE, avisado_en = NOW(), estado = 'avisado',
           mensaje_enviado = COALESCE($2, mensaje_enviado), avisado_por = COALESCE($3, avisado_por) WHERE id = $1`,
        [id, mensaje || null, usuario_nombre || null]
      );
    } catch (e2) {
      // Si todavia no corrio la migracion (sin columnas nuevas), se marca igual como antes
      await pool.query(`UPDATE pedidos_clientas SET avisado = TRUE, avisado_en = NOW(), estado = 'avisado' WHERE id = $1`, [id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Compra detectada automaticamente: una venta (no anulada) a esa misma clienta registrada
// que incluya ese producto, desde 1 hora antes del aviso hasta 30 dias despues.
const SQL_COMPRA = `(SELECT MIN(v.creado_en) FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
    WHERE p.cliente_id IS NOT NULL AND v.cliente_id = p.cliente_id AND vi.producto_id = p.producto_id
      AND COALESCE(v.anulada, false) = false
      AND v.creado_en BETWEEN p.avisado_en - interval '1 hour' AND p.avisado_en + interval '30 days')`;
const SQL_MONTO = `(SELECT SUM(vi.subtotal) FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
    WHERE p.cliente_id IS NOT NULL AND v.cliente_id = p.cliente_id AND vi.producto_id = p.producto_id
      AND COALESCE(v.anulada, false) = false
      AND v.creado_en BETWEEN p.avisado_en - interval '1 hour' AND p.avisado_en + interval '30 days')`;

// Estadisticas: cuantas ventas se recuperaron gracias a los avisos de "ya hay stock"
router.get('/estadisticas', async (req, res) => {
  try {
    const { desde, hasta, local_id } = req.query;
    const params = [];
    const condLocal = local_id ? (params.push(parseInt(local_id)), ` AND p.local_id = $${params.length}`) : '';
    const pDesde = desde ? (params.push(desde), `$${params.length}`) : null;
    const pHasta = hasta ? (params.push(hasta), `$${params.length}`) : null;
    const rango = (col) => (pDesde ? ` AND DATE(${col}) >= ${pDesde}` : '') + (pHasta ? ` AND DATE(${col}) <= ${pHasta}` : '');

    // Avisos del periodo con compra detectada (automatica o marcada a mano)
    const av = await pool.query(`
      SELECT p.id, p.producto_id, p.cliente_id, p.creado_en, p.avisado_en, p.estado, p.concretado_en,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre, COALESCE(pr.precio, 0) AS precio,
             ${SQL_COMPRA} AS compra_auto, ${SQL_MONTO} AS monto_auto
        FROM pedidos_clientas p LEFT JOIN productos pr ON pr.id = p.producto_id
       WHERE p.avisado = TRUE ${condLocal} ${rango('p.avisado_en')}`, params);
    const avisos = av.rows.map(r => {
      const compraEn = r.compra_auto || (r.estado === 'concretado' ? (r.concretado_en || r.avisado_en) : null);
      const monto = r.monto_auto ? parseFloat(r.monto_auto) : (compraEn ? parseFloat(r.precio) : 0);
      return { ...r, compro: !!compraEn, compra_en: compraEn, automatica: !!r.compra_auto, monto };
    });
    const compraron = avisos.filter(a => a.compro);
    const prom = (arr) => arr.length ? arr.reduce((s2, x) => s2 + x, 0) / arr.length : null;
    const dias = (a, b) => (new Date(b) - new Date(a)) / 86400000;

    // Pedidos anotados en el periodo (demanda) y los que siguen esperando
    const an = await pool.query(`
      SELECT p.id, p.producto_id, p.estado, (p.producto_id IS NULL) AS es_sugerencia,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre
        FROM pedidos_clientas p LEFT JOIN productos pr ON pr.id = p.producto_id
       WHERE 1=1 ${condLocal} ${rango('p.creado_en')}`, params);

    // Serie de los ultimos 6 meses (siempre, sin importar el filtro de fechas)
    const paramsSerie = local_id ? [parseInt(local_id)] : [];
    const serie = await pool.query(`
      SELECT to_char(date_trunc('month', p.avisado_en), 'YYYY-MM') AS mes,
             COUNT(*)::int AS avisados,
             COUNT(*) FILTER (WHERE p.estado = 'concretado' OR ${SQL_COMPRA} IS NOT NULL)::int AS compraron
        FROM pedidos_clientas p
       WHERE p.avisado = TRUE AND p.avisado_en >= date_trunc('month', NOW()) - interval '5 months'
         ${local_id ? 'AND p.local_id = $1' : ''}
       GROUP BY 1 ORDER BY 1`, paramsSerie);

    const agrupar = (lista, extra) => Object.values(lista.reduce((acc, x) => {
      const k = (x.producto_nombre || '').toLowerCase();
      if (!acc[k]) acc[k] = { producto: x.producto_nombre, cantidad: 0, monto: 0 };
      acc[k].cantidad += 1;
      if (extra) acc[k].monto += x.monto || 0;
      return acc;
    }, {})).sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto).slice(0, 10);

    res.json({
      avisados: avisos.length,
      compraron: compraron.length,
      compraron_auto: compraron.filter(a => a.automatica).length,
      monto_recuperado: compraron.reduce((s2, a) => s2 + a.monto, 0),
      conversion: avisos.length ? compraron.length / avisos.length : 0,
      dias_espera_promedio: prom(avisos.filter(a => a.creado_en && a.avisado_en).map(a => dias(a.creado_en, a.avisado_en))),
      dias_compra_promedio: prom(compraron.filter(a => a.compra_en).map(a => Math.max(dias(a.avisado_en, a.compra_en), 0))),
      anotados: an.rows.length,
      siguen_esperando: an.rows.filter(r => r.estado === 'esperando').length,
      sugerencias: an.rows.filter(r => r.es_sugerencia).length,
      top_pedidos: agrupar(an.rows.filter(r => !r.es_sugerencia)),
      top_sugerencias: agrupar(an.rows.filter(r => r.es_sugerencia)),
      top_recuperados: agrupar(compraron, true),
      serie_mensual: serie.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Historial de avisos enviados, filtrado por fecha (del aviso), local y busqueda
router.get('/avisados', async (req, res) => {
  try {
    const { desde, hasta, local_id, q } = req.query;
    const params = [];
    const cond = [`p.avisado = TRUE`];
    if (desde) { params.push(desde); cond.push(`DATE(p.avisado_en) >= $${params.length}`); }
    if (hasta) { params.push(hasta); cond.push(`DATE(p.avisado_en) <= $${params.length}`); }
    if (local_id) { params.push(parseInt(local_id)); cond.push(`p.local_id = $${params.length}`); }
    if (q && String(q).trim()) {
      params.push('%' + String(q).trim() + '%');
      cond.push(`(COALESCE(c.nombre, p.nombre_manual) ILIKE $${params.length} OR COALESCE(pr.nombre, p.producto_texto) ILIKE $${params.length}
                   OR COALESCE(c.telefono, p.telefono_manual) ILIKE $${params.length} OR c.cuit_dni ILIKE $${params.length})`);
    }
    const r = await pool.query(`
      SELECT p.*, COALESCE(c.nombre, p.nombre_manual) AS cliente_nombre,
             COALESCE(c.telefono, p.telefono_manual) AS telefono, c.cuit_dni,
             COALESCE(pr.nombre, p.producto_texto) AS producto_nombre, pr.precio AS producto_precio,
             CASE WHEN p.local_id = 2 THEN COALESCE(pr.stock_ush, 0) ELSE COALESCE(pr.stock_rg, 0) END AS stock_total,
             ${SQL_COMPRA} AS compra_detectada_en
      FROM pedidos_clientas p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN productos pr ON pr.id = p.producto_id
      WHERE ${cond.join(' AND ')}
      ORDER BY p.avisado_en DESC
      LIMIT 500`, params);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// La clienta vino y compro el producto avisado
router.post('/:id/concretar', async (req, res) => {
  try {
    await pool.query(`UPDATE pedidos_clientas SET estado = 'concretado', concretado_en = NOW() WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Volver a poner el pedido en la lista de espera (ej: se aviso pero no lo retiro y se agoto)
router.post('/:id/reactivar', async (req, res) => {
  try {
    await pool.query(`UPDATE pedidos_clientas SET estado = 'esperando', avisado = FALSE, concretado_en = NULL WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Borrar / cancelar un pedido
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM pedidos_clientas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;