const pool = require('../config/database');

function generarCodigoGC() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return 'GIFT-' + c;
}

// Numero de comprobante tal como sale impreso en el ticket (ej: 0005-00006262)
const comprobanteImpreso = (v) => (v.nro_comprobante ? String(v.punto_venta || 5).padStart(4, '0') + '-' + String(v.nro_comprobante).padStart(8, '0') : null);

// Cuanto ya se devolvio de cada producto de una venta (para no devolver dos veces lo mismo).
// Los cambios viejos (sin detalle) cuentan con sus columnas de un solo producto.
async function yaDevueltoPorProducto(db, ventaId) {
  const r = await db.query(
    `SELECT (d->>'producto_id')::int AS producto_id, SUM((d->>'cantidad')::int)::int AS cantidad
       FROM cambios_productos c,
            jsonb_array_elements(COALESCE(c.detalle->'devueltos',
              jsonb_build_array(jsonb_build_object('producto_id', c.producto_devuelto_id, 'cantidad', c.cantidad_devuelta)))) d
      WHERE c.venta_origen_id = $1
      GROUP BY 1`,
    [ventaId]
  );
  const out = {};
  r.rows.forEach(x => { out[x.producto_id] = x.cantidad; });
  return out;
}

// Venta con sus productos y cuanto se puede devolver todavia de cada uno
async function ventaConItems(db, venta) {
  const itemsRes = await db.query(
    `SELECT vi.producto_id, vi.variante_valor, SUM(vi.cantidad)::int AS cantidad,
            (SUM(vi.subtotal) / NULLIF(SUM(vi.cantidad), 0)) AS precio_unitario,
            p.nombre AS producto_nombre, p.marca
       FROM venta_items vi JOIN productos p ON vi.producto_id = p.id
      WHERE vi.venta_id = $1
      GROUP BY vi.producto_id, vi.variante_valor, p.nombre, p.marca`,
    [venta.id]
  );
  const devuelto = await yaDevueltoPorProducto(db, venta.id);
  const items = itemsRes.rows.map(it => {
    const ya = devuelto[it.producto_id] || 0;
    return { ...it, precio_unitario: parseFloat(it.precio_unitario || 0), ya_devuelto: ya, disponible_para_devolver: Math.max(it.cantidad - ya, 0) };
  });
  const cli = venta.cliente_id ? (await db.query('SELECT id, nombre, cuit_dni, telefono FROM clientes WHERE id = $1', [venta.cliente_id])).rows[0] : null;
  return { ...venta, comprobante: comprobanteImpreso(venta), cliente: cli || null, items };
}

// Buscar compras por lo que tenga la clienta: numero del ticket (0005-00006262), numero
// interno (F-1723 / ON-0105), solo el numero de comprobante, DNI o nombre.
const buscarVentas = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const params = [];
    const conds = [];
    const soloDigitos = q.replace(/[^0-9]/g, '');
    const pvNro = q.match(/^(\d{1,5})\s*-\s*(\d{1,8})$/);

    if (pvNro) {
      params.push(parseInt(pvNro[1]), parseInt(pvNro[2]));
      conds.push(`(v.punto_venta = $${params.length - 1} AND v.nro_comprobante = $${params.length})`);
    }
    if (/^[a-z]{1,3}\s*-?\s*\d+$/i.test(q)) {
      const norm = q.toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]+)(\d)/, '$1-$2');
      params.push(norm);
      conds.push(`UPPER(v.numero_factura) = $${params.length}`);
    }
    if (/^\d+$/.test(q)) {
      params.push(parseInt(q));
      conds.push(`v.nro_comprobante = $${params.length}`);
      params.push('%-' + String(parseInt(q)).padStart(4, '0'));
      conds.push(`v.numero_factura LIKE $${params.length}`);
    }
    if (soloDigitos.length >= 7 && soloDigitos.length <= 11) {
      params.push(soloDigitos);
      conds.push(`regexp_replace(COALESCE(c.cuit_dni, ''), '[^0-9]', '', 'g') = $${params.length}`);
    }
    if (/[a-záéíóúñ]{3,}/i.test(q) && !/^[a-z]{1,3}\s*-?\s*\d+$/i.test(q)) {
      params.push('%' + q + '%');
      conds.push(`c.nombre ILIKE $${params.length}`);
    }
    if (!conds.length) return res.json([]);

    const r = await pool.query(
      `SELECT v.id, v.numero_factura, v.nro_comprobante, v.punto_venta, v.tipo_factura, v.total, v.creado_en,
              v.canal, v.local_id, v.medio_pago, c.nombre AS cliente_nombre,
              (SELECT COUNT(*) FROM venta_items vi WHERE vi.venta_id = v.id)::int AS cant_items
         FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
        WHERE (${conds.join(' OR ')})
          AND COALESCE(v.anulada, false) = false
          AND COALESCE(v.es_preventa, false) = false
          AND v.creado_en >= NOW() - interval '400 days'
        ORDER BY v.creado_en DESC
        LIMIT 20`,
      params
    );
    res.json(r.rows.map(v => ({ ...v, comprobante: comprobanteImpreso(v) })));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Una venta puntual con sus productos (para elegir que se devuelve)
const getVentaParaCambio = async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Venta no encontrada' });
    if (r.rows[0].anulada) return res.status(400).json({ error: 'Esa venta esta anulada' });
    res.json(await ventaConItems(pool, r.rows[0]));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// (Compatibilidad) Buscar la venta original por numero exacto
const buscarVentaOrigen = async (req, res) => {
  try {
    const { numero } = req.params;
    const ventaRes = await pool.query('SELECT * FROM ventas WHERE numero_factura = $1', [numero.trim()]);
    if (ventaRes.rows.length === 0) return res.status(404).json({ error: 'No se encontro ninguna venta con ese numero' });
    res.json(await ventaConItems(pool, ventaRes.rows[0]));
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Procesar un cambio o devolucion:
//  - devueltos: [{ producto_id, cantidad, valor_unitario, reingresa_stock }]
//  - nuevos:    [{ producto_id, cantidad }]   (vacio = devolucion pura)
// Devuelve stock de lo que vuelve (salvo fallados), descuenta lo nuevo y resuelve la
// diferencia: cobrar, credito a favor (gift card) o devolver en efectivo.
const procesarCambio = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body || {};
    const {
      venta_origen_id, venta_origen_numero, local_id, usuario_id, usuario_nombre, usuario_rol,
      resolucion_diferencia, medio_pago, beneficiario_nombre, motivo, cliente_id
    } = b;

    // Formato viejo (un producto por uno) -> formato nuevo
    let devueltos = Array.isArray(b.devueltos) ? b.devueltos : [];
    let nuevos = Array.isArray(b.nuevos) ? b.nuevos : [];
    if (!devueltos.length && b.producto_devuelto_id) devueltos = [{ producto_id: b.producto_devuelto_id, cantidad: b.cantidad_devuelta, valor_unitario: b.valor_devuelto_unitario, reingresa_stock: true }];
    if (!nuevos.length && b.producto_nuevo_id) nuevos = [{ producto_id: b.producto_nuevo_id, cantidad: b.cantidad_nueva }];
    devueltos = devueltos.map(d => ({ producto_id: parseInt(d.producto_id), cantidad: parseInt(d.cantidad) || 0, valor_unitario: parseFloat(d.valor_unitario) || 0, reingresa_stock: d.reingresa_stock !== false })).filter(d => d.producto_id && d.cantidad > 0);
    nuevos = nuevos.map(n => ({ producto_id: parseInt(n.producto_id), cantidad: parseInt(n.cantidad) || 0 })).filter(n => n.producto_id && n.cantidad > 0);

    const fallar = async (codigo, error) => { await client.query('ROLLBACK'); return res.status(codigo).json({ error }); };
    if (!devueltos.length) return fallar(400, 'Elegi al menos un producto que devuelve');

    const localNum = local_id === 2 || local_id === '2' ? 2 : 1;
    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';

    // Con comprobante: el valor de lo devuelto sale de la venta original y no se puede
    // devolver mas de lo que se compro (descontando cambios anteriores).
    // Sin comprobante: solo jefa/admin, al precio actual.
    let ventaOrigen = null;
    if (venta_origen_id) {
      const vr = await client.query('SELECT * FROM ventas WHERE id = $1', [venta_origen_id]);
      if (!vr.rows.length) return fallar(404, 'Venta original no encontrada');
      ventaOrigen = await ventaConItems(client, vr.rows[0]);
      for (const d of devueltos) {
        const it = ventaOrigen.items.find(x => x.producto_id === d.producto_id);
        if (!it) return fallar(400, 'Uno de los productos no esta en esa venta');
        if (d.cantidad > it.disponible_para_devolver) return fallar(400, 'De "' + it.producto_nombre + '" se pueden devolver como maximo ' + it.disponible_para_devolver);
        d.valor_unitario = it.precio_unitario;
        d.nombre = it.producto_nombre;
      }
    } else {
      if (!['jefe', 'admin'].includes(usuario_rol)) return fallar(403, 'Un cambio sin comprobante lo tiene que hacer una encargada');
      for (const d of devueltos) {
        const pr = await client.query('SELECT nombre, precio FROM productos WHERE id = $1', [d.producto_id]);
        if (!pr.rows.length) return fallar(404, 'Producto devuelto no encontrado');
        d.valor_unitario = parseFloat(pr.rows[0].precio || 0);
        d.nombre = pr.rows[0].nombre;
      }
    }

    for (const n of nuevos) {
      const pr = await client.query(`SELECT nombre, precio, ${colStock} AS stock_local FROM productos WHERE id = $1`, [n.producto_id]);
      if (!pr.rows.length) return fallar(404, 'Producto nuevo no encontrado');
      const pedidoTotal = nuevos.filter(x => x.producto_id === n.producto_id).reduce((s, x) => s + x.cantidad, 0);
      // Si el mismo producto vuelve y se entrega (ej: cambio por otro igual), el que vuelve suma al stock
      const vuelve = devueltos.filter(x => x.producto_id === n.producto_id && x.reingresa_stock).reduce((s, x) => s + x.cantidad, 0);
      if ((parseInt(pr.rows[0].stock_local) || 0) + vuelve < pedidoTotal) return fallar(400, 'No hay stock suficiente de "' + pr.rows[0].nombre + '" en este local');
      n.nombre = pr.rows[0].nombre;
      n.valor_unitario = parseFloat(pr.rows[0].precio || 0);
    }

    const valorDevuelto = devueltos.reduce((s, d) => s + d.valor_unitario * d.cantidad, 0);
    const valorNuevo = nuevos.reduce((s, n) => s + n.valor_unitario * n.cantidad, 0);
    const diferencia = Math.round((valorNuevo - valorDevuelto) * 100) / 100;
    const ref = venta_origen_numero || ventaOrigen?.numero_factura || 'sin comprobante';

    // Stock
    for (const d of devueltos) {
      if (!d.reingresa_stock) continue;
      await client.query(
        `UPDATE productos SET ${colStock} = COALESCE(${colStock},0) + $1,
           stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) + $1
         WHERE id = $2`,
        [d.cantidad, d.producto_id]
      );
    }
    for (const n of nuevos) {
      await client.query(
        `UPDATE productos SET ${colStock} = COALESCE(${colStock},0) - $1,
           stock = COALESCE(stock_rg,0) + COALESCE(stock_ush,0) - $1
         WHERE id = $2`,
        [n.cantidad, n.producto_id]
      );
    }

    // Diferencia
    let giftCardCreada = null;
    const clienteFinal = cliente_id || ventaOrigen?.cliente_id || null;
    if (diferencia > 0) {
      // Se cobra la diferencia como ingreso de caja (no genera una factura ARCA nueva).
      if (resolucion_diferencia !== 'cobro' || !medio_pago) return fallar(400, 'Lo nuevo cuesta mas: elegi el medio de pago para cobrar la diferencia');
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id, forma_pago)
         VALUES ($1, 'I', $2, $3, $4, $5)`,
        ['Cobro diferencia por cambio (venta ' + ref + ')', diferencia, ref, localNum, medio_pago]
      );
    } else if (diferencia < 0) {
      const monto = Math.abs(diferencia);
      if (resolucion_diferencia === 'credito') {
        if (!beneficiario_nombre) return fallar(400, 'Falta el nombre de quien recibe el credito');
        let codigo, intentos = 0;
        while (intentos < 10) {
          codigo = generarCodigoGC();
          const existe = await client.query('SELECT 1 FROM gift_cards WHERE codigo = $1', [codigo]);
          if (existe.rows.length === 0) break;
          intentos++;
        }
        const gcRes = await client.query(
          `INSERT INTO gift_cards (codigo, monto_inicial, saldo, beneficiario_nombre, estado, local_id, emitida_por, venta_origen_id, venta_origen_numero, cliente_id)
           VALUES ($1,$2,$2,$3,'activa',$4,$5,$6,$7,$8) RETURNING *`,
          [codigo, monto, beneficiario_nombre, localNum, usuario_id || null, ventaOrigen?.id || null, ref, clienteFinal]
        );
        giftCardCreada = gcRes.rows[0];
        await client.query(
          `INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante, usuario_id) VALUES ($1,'emision',$2,$2,$3)`,
          [giftCardCreada.id, monto, usuario_id || null]
        );
        await client.query(
          `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
           VALUES ($1, 'I', 0, $2, $3)`,
          ['Gift Card ' + codigo + ' (credito por cambio, venta ' + ref + ')', codigo, localNum]
        );
      } else if (resolucion_diferencia === 'efectivo') {
        await client.query(
          `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
           VALUES ($1, 'E', $2, $3, $4)`,
          ['Devolucion de diferencia en efectivo (venta ' + ref + ')', monto, ref, localNum]
        );
      } else {
        return fallar(400, 'Queda plata a favor de la clienta: elegi credito (gift card) o devolver en efectivo');
      }
    }

    const tipo = nuevos.length ? 'cambio' : 'devolucion';
    const d0 = devueltos[0], n0 = nuevos[0];
    const registroRes = await client.query(
      `INSERT INTO cambios_productos
        (venta_origen_id, venta_origen_numero, producto_devuelto_id, producto_devuelto_nombre, cantidad_devuelta, valor_devuelto,
         producto_nuevo_id, producto_nuevo_nombre, cantidad_nueva, valor_nuevo, diferencia, resolucion_diferencia, medio_pago,
         gift_card_id, local_id, usuario_id, usuario_nombre, detalle, motivo, tipo, cliente_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21) RETURNING *`,
      [
        ventaOrigen?.id || null, ref, d0.producto_id,
        devueltos.map(d => d.cantidad + 'x ' + d.nombre).join(', ').slice(0, 200),
        devueltos.reduce((s, d) => s + d.cantidad, 0), valorDevuelto,
        n0 ? n0.producto_id : null, n0 ? nuevos.map(n => n.cantidad + 'x ' + n.nombre).join(', ').slice(0, 200) : null,
        nuevos.reduce((s, n) => s + n.cantidad, 0), valorNuevo, diferencia,
        diferencia === 0 ? null : resolucion_diferencia, diferencia > 0 ? medio_pago : null,
        giftCardCreada?.id || null, localNum, usuario_id || null, usuario_nombre || null,
        JSON.stringify({ devueltos, nuevos }), motivo || null, tipo, clienteFinal
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ cambio: registroRes.rows[0], gift_card: giftCardCreada, devueltos, nuevos });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
};

// Historial de cambios y devoluciones
const getCambios = async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = `SELECT c.*, gc.codigo AS gift_card_codigo, cl.nombre AS cliente_nombre
               FROM cambios_productos c
               LEFT JOIN gift_cards gc ON gc.id = c.gift_card_id
               LEFT JOIN clientes cl ON cl.id = c.cliente_id
              WHERE 1=1`;
    if (local_id) { params.push(local_id); q += ` AND c.local_id = $${params.length}`; }
    q += ' ORDER BY c.creado_en DESC LIMIT 100';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { buscarVentaOrigen, buscarVentas, getVentaParaCambio, procesarCambio, getCambios };
