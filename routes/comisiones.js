const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// ===================== Tipos de comision =====================
// La comision es del LOCAL (equipo). Cada local tiene una regla (tabla reglas_comision):
//   tipo:
//     - metas_monto        premio fijo al superar cada meta de ventas (hasta 3, se suman)
//     - porcentaje         % de lo vendido (opcional: solo si se supera un minimo)
//     - porcentaje_tramos  % segun el tramo alcanzado (ej: 1% hasta $1M, 2% desde $1M)
//     - excedente          % solo sobre lo vendido por encima de una meta
//   periodo: diaria | semanal (lunes a domingo) | mensual
// Aunque el periodo sea semanal o mensual, se sigue guardando una fila por dia: cada dia
// suma lo que la comision del periodo crecio ese dia. Asi el pago por dias sigue igual.
const TIPOS_COMISION = ['metas_monto', 'porcentaje', 'porcentaje_tramos', 'excedente'];
const PERIODOS_COMISION = ['diaria', 'semanal', 'mensual'];

const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

function normalizarRegla(r) {
  if (!r) return null;
  let tramos = r.tramos;
  if (typeof tramos === 'string') { try { tramos = JSON.parse(tramos); } catch (e) { tramos = []; } }
  tramos = (Array.isArray(tramos) ? tramos : [])
    .map(t => ({ desde: num(t.desde), pct: num(t.pct) }))
    .filter(t => t.pct > 0)
    .sort((a, b) => a.desde - b.desde);
  return {
    local_id: r.local_id,
    tipo: TIPOS_COMISION.includes(r.tipo) ? r.tipo : 'metas_monto',
    periodo: PERIODOS_COMISION.includes(r.periodo) ? r.periodo : 'diaria',
    umbral_1: num(r.umbral_1), comision_1: num(r.comision_1),
    umbral_2: num(r.umbral_2), comision_2: num(r.comision_2),
    umbral_3: num(r.umbral_3), comision_3: num(r.comision_3),
    porcentaje: num(r.porcentaje), minimo: num(r.minimo), tramos,
  };
}

// Comision que corresponde a un total vendido en el periodo, segun la regla.
function calcularComision(total, r) {
  if (!r || total <= 0) return { comision: 0, nivel: 0 };
  if (r.tipo === 'porcentaje') {
    if (total < r.minimo) return { comision: 0, nivel: 0 };
    return { comision: total * r.porcentaje / 100, nivel: 1 };
  }
  if (r.tipo === 'porcentaje_tramos') {
    let idx = -1;
    r.tramos.forEach((t, k) => { if (total >= t.desde) idx = k; });
    if (idx < 0) return { comision: 0, nivel: 0 };
    return { comision: total * r.tramos[idx].pct / 100, nivel: idx + 1 };
  }
  if (r.tipo === 'excedente') {
    const exced = total - r.minimo;
    if (exced <= 0) return { comision: 0, nivel: 0 };
    return { comision: exced * r.porcentaje / 100, nivel: 1 };
  }
  // metas_monto (lo de siempre): los premios de cada meta alcanzada se suman
  const { umbral_1: u1, comision_1: c1, umbral_2: u2, comision_2: c2, umbral_3: u3, comision_3: c3 } = r;
  if (u3 > 0 && total >= u3) return { comision: c1 + c2 + c3, nivel: 3 };
  if (u2 > 0 && total >= u2) return { comision: c1 + c2, nivel: 2 };
  if (u1 > 0 && total >= u1) return { comision: c1, nivel: 1 };
  return { comision: 0, nivel: 0 };
}

// Fechas como texto 'YYYY-MM-DD' (se calculan en UTC para no correrse por el huso horario)
const aTexto = (d) => d.toISOString().slice(0, 10);
const deTexto = (f) => { const [y, m, d] = String(f).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
function inicioPeriodo(fecha, periodo) {
  const d = deTexto(fecha);
  if (periodo === 'mensual') return aTexto(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  if (periodo === 'semanal') { d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return aTexto(d); }
  return aTexto(d);
}

// Ventas presenciales del local entre dos fechas (inclusive), sin las de cupones de influencers
async function ventasEntre(local_id, desde, hasta) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total
     FROM ventas
     WHERE local_id = $1 AND canal = 'presencial'
       AND DATE(creado_en) BETWEEN $2 AND $3
       AND (cupon_id IS NULL OR cupon_id NOT IN (
         SELECT cupon_id FROM influencers WHERE cupon_id IS NOT NULL
       ))`,
    [local_id, desde, hasta]
  );
  return parseFloat(r.rows[0].total) || 0;
}

async function leerRegla(local_id) {
  const r = await pool.query('SELECT * FROM reglas_comision WHERE local_id = $1 ORDER BY id LIMIT 1', [local_id]);
  return normalizarRegla(r.rows[0]);
}

// Calcula (y guarda) la comision de un dia para un local, segun la regla del local.
async function calcularYGuardarDia(local_id, fecha) {
  const fechaTxt = String(fecha).slice(0, 10);
  const totalDia = await ventasEntre(local_id, fechaTxt, fechaTxt);
  const regla = await leerRegla(local_id);
  if (!regla) return { facturacion: totalDia, comision: 0, nivel: 0 };

  const inicio = inicioPeriodo(fechaTxt, regla.periodo);
  const totalPeriodo = regla.periodo === 'diaria' ? totalDia : await ventasEntre(local_id, inicio, fechaTxt);
  const totalPrevio = Math.max(totalPeriodo - totalDia, 0);
  const hasta = calcularComision(totalPeriodo, regla);
  const previo = calcularComision(totalPrevio, regla);
  const comision = Math.round((hasta.comision - previo.comision) * 100) / 100;

  const d = deTexto(fechaTxt);
  const mes = d.getUTCMonth() + 1;
  const anio = d.getUTCFullYear();

  const existe = await pool.query(
    'SELECT id, pagada, comision_ganada FROM comisiones WHERE local_id = $1 AND fecha = $2',
    [local_id, fechaTxt]
  );
  let comisionGuardada = comision;
  if (existe.rows.length > 0) {
    // Un dia ya pagado no se recalcula (si se cambio la regla despues, no cambia lo pagado)
    if (existe.rows[0].pagada) {
      comisionGuardada = parseFloat(existe.rows[0].comision_ganada) || 0;
    } else {
      await pool.query(
        'UPDATE comisiones SET facturacion_mes = $1, comision_ganada = $2, mes = $3, anio = $4 WHERE id = $5',
        [totalDia, comision, mes, anio, existe.rows[0].id]
      );
    }
  } else {
    await pool.query(
      `INSERT INTO comisiones (local_id, fecha, mes, anio, facturacion_mes, comision_ganada, pagada)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
      [local_id, fechaTxt, mes, anio, totalDia, comision]
    );
  }

  return {
    ...regla,
    facturacion: totalDia, comision: comisionGuardada, nivel: hasta.nivel,
    inicio_periodo: inicio, facturacion_periodo: totalPeriodo, comision_periodo: Math.round(hasta.comision * 100) / 100,
  };
}

// Valida (si corresponde) y registra en Finanzas / Caja de efectivo / stock el pago de
// un monto de comisiones, sea cual sea el origen (por dias tildados, o un monto manual).
async function procesarPagoComision(client, { local_id, monto, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto }) {
  const formaValida = ['efectivo', 'transferencia', 'canje'].includes(forma_pago) ? forma_pago : 'efectivo';

  if (formaValida === 'canje') {
    if (!producto_canje_id) return { error: 'Elegi el producto con el que se hace el canje' };
    const prodRes = await client.query('SELECT precio FROM productos WHERE id = $1', [producto_canje_id]);
    if (prodRes.rows.length === 0) return { error: 'Producto de canje no encontrado' };
    const DESCUENTO_EMPLEADA = 0.20;
    const cant = parseInt(cantidad_canje) || 1;
    const costoCanje = parseFloat(prodRes.rows[0].precio || 0) * (1 - DESCUENTO_EMPLEADA) * cant;
    if (costoCanje > monto) {
      return { error: 'Lo seleccionado ($' + monto.toFixed(0) + ') no alcanza para este canje ($' + costoCanje.toFixed(0) + ' con el 20% de descuento de empleada)' };
    }
  }

  if (monto > 0) {
    await client.query(
      `INSERT INTO movimientos_caja (concepto, tipo, importe, local_id)
       VALUES ($1, 'E', $2, $3)`,
      [concepto, monto, local_id]
    );

    if (formaValida === 'efectivo') {
      await client.query(
        `INSERT INTO movimientos_caja_efectivo (concepto, tipo, importe, destino_origen, local_id)
         VALUES ($1, 'egreso', $2, 'Pago de comisiones', $3)`,
        [concepto, monto, local_id]
      );
    }

    if (formaValida === 'canje' && producto_canje_id) {
      const cant = parseInt(cantidad_canje) || 1;
      const localNum = local_id === '2' || local_id === 2 ? 2 : 1;
      const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
      await client.query(
        `UPDATE productos SET ${colStock} = GREATEST(COALESCE(${colStock},0) - $1, 0),
           stock = GREATEST(COALESCE(stock_rg,0) + COALESCE(stock_ush,0) - $1, 0)
         WHERE id = $2`,
        [cant, producto_canje_id]
      );
      await client.query(
        `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, local_id)
         SELECT id, ${colStock} + $1, ${colStock}, -$1, 'Pago de comision en canje', $2 FROM productos WHERE id = $3`,
        [cant, local_id, producto_canje_id]
      );
    }
  }

  return { error: null, forma_pago: formaValida };
}

// ===================== Configuracion de comisiones =====================
// Reglas de todos los locales activos (para la pestaña "Configuracion de comisiones")
router.get('/config/reglas', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT l.id AS local_id, l.nombre AS local_nombre, rc.*
         FROM locales l
         LEFT JOIN LATERAL (SELECT * FROM reglas_comision WHERE local_id = l.id ORDER BY id LIMIT 1) rc ON true
        WHERE l.activo = TRUE
        ORDER BY l.id`
    );
    res.json(r.rows.map(x => ({ ...normalizarRegla({ ...x, local_id: x.local_id }), local_nombre: x.local_nombre, configurada: !!x.id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar la regla de un local
router.put('/config/reglas/:local_id', async (req, res) => {
  try {
    const localId = parseInt(req.params.local_id);
    const b = req.body || {};
    const regla = normalizarRegla({ ...b, local_id: localId });
    if (regla.tipo === 'porcentaje' || regla.tipo === 'excedente') {
      if (!(regla.porcentaje > 0) || regla.porcentaje > 100) return res.status(400).json({ error: 'El porcentaje tiene que estar entre 0 y 100' });
    }
    if (regla.tipo === 'excedente' && !(regla.minimo > 0)) return res.status(400).json({ error: 'Falta la meta a partir de la cual se paga el %' });
    if (regla.tipo === 'porcentaje_tramos' && regla.tramos.length === 0) return res.status(400).json({ error: 'Carga al menos un tramo' });
    if (regla.tipo === 'metas_monto' && !(regla.umbral_1 > 0)) return res.status(400).json({ error: 'Carga al menos la primera meta' });

    const valores = [regla.tipo, regla.periodo, regla.umbral_1, regla.comision_1, regla.umbral_2, regla.comision_2,
      regla.umbral_3, regla.comision_3, regla.porcentaje, regla.minimo, JSON.stringify(regla.tramos), localId];
    const upd = await pool.query(
      `UPDATE reglas_comision SET tipo = $1, periodo = $2, umbral_1 = $3, comision_1 = $4, umbral_2 = $5, comision_2 = $6,
         umbral_3 = $7, comision_3 = $8, porcentaje = $9, minimo = $10, tramos = $11::jsonb
       WHERE id = (SELECT id FROM reglas_comision WHERE local_id = $12 ORDER BY id LIMIT 1) RETURNING *`,
      valores
    );
    let fila = upd.rows[0];
    if (!fila) {
      const ins = await pool.query(
        `INSERT INTO reglas_comision (tipo, periodo, umbral_1, comision_1, umbral_2, comision_2, umbral_3, comision_3, porcentaje, minimo, tramos, local_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12) RETURNING *`,
        valores
      );
      fila = ins.rows[0];
    }
    res.json(normalizarRegla(fila));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sugerencia de comision saludable para un local, con sus ventas y su margen reales de los
// ultimos 90 dias (para que no se ponga un numero al azar). Criterio:
//  - % de las ventas: que la comision se lleve alrededor del 6% de la ganancia bruta
//    (margen 50% -> 3% de las ventas). Entre 0,5% y 4%.
//  - % sobre lo que supere la meta: la meta es lo que el local ya vende en promedio, y se paga
//    alrededor del 20% del margen de esas ventas extra (margen 50% -> 10%). Entre 1% y 10%.
//    Solo cuesta si venden mas de lo habitual, y ese extra deja ganancia.
router.get('/config/sugerencia/:local_id', async (req, res) => {
  try {
    const localId = parseInt(req.params.local_id);
    const periodo = PERIODOS_COMISION.includes(req.query.periodo) ? req.query.periodo : 'mensual';
    const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')`;
    const FILTRO = `v.local_id = $1 AND v.canal = 'presencial' AND COALESCE(v.anulada, FALSE) = FALSE
      AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')
      AND (v.cupon_id IS NULL OR v.cupon_id NOT IN (SELECT cupon_id FROM influencers WHERE cupon_id IS NOT NULL))
      AND ${AR('v.creado_en')}::date >= (${AR('NOW()')})::date - 90 AND ${AR('v.creado_en')}::date < (${AR('NOW()')})::date`;
    const [ventas, margen] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(v.total), 0) AS total, MIN(${AR('v.creado_en')})::date AS desde,
                         (${AR('NOW()')})::date - MIN(${AR('v.creado_en')})::date AS dias
                  FROM ventas v WHERE ${FILTRO}`, [localId]),
      pool.query(`SELECT COALESCE(SUM(vi.cantidad * vi.precio_unitario), 0) AS ingresos,
                         COALESCE(SUM(vi.cantidad * COALESCE(p.costo, 0)), 0) AS costos,
                         COALESCE(SUM(CASE WHEN COALESCE(p.costo, 0) > 0 THEN vi.cantidad * vi.precio_unitario ELSE 0 END), 0) AS ingresos_con_costo
                  FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
                  WHERE ${FILTRO}`, [localId]),
    ]);
    const total = num(ventas.rows[0].total);
    const dias = Math.min(90, parseInt(ventas.rows[0].dias) || 0);
    if (total <= 0 || dias < 21) {
      return res.json({ suficiente: false, motivo: 'Todavía hay pocas ventas en este local (hacen falta al menos 3 semanas) para calcular una comisión confiable.' });
    }
    // Margen bruto: solo con los productos que tienen costo cargado (si no, el margen daria 100%)
    const ingCosto = num(margen.rows[0].ingresos_con_costo);
    if (ingCosto <= 0) {
      return res.json({ suficiente: false, motivo: 'Faltan los costos de los productos: sin el costo no se puede saber cuánto se gana en cada venta. Cargalos en Inventario.' });
    }
    const costos = num(margen.rows[0].costos);
    const margenPct = Math.max(0, Math.min(95, (ingCosto - costos) / ingCosto * 100));
    const cobertura = Math.round(ingCosto / Math.max(1, num(margen.rows[0].ingresos)) * 100);

    const medio = (x) => Math.round(x * 2) / 2;
    const entre = (x, a, b) => Math.max(a, Math.min(b, x));
    const ventasMes = total / dias * 30;
    const escala = periodo === 'mensual' ? 1 : periodo === 'semanal' ? 7 / 30 : 1 / 30;
    const redondear = (x) => (x >= 100000 ? Math.round(x / 10000) * 10000 : Math.round(x / 1000) * 1000);

    const pctVentas = entre(medio(margenPct * 0.06), 0.5, 4);
    const pctExcedente = entre(medio(margenPct * 0.2), 1, 10);
    const metaPeriodo = redondear(ventasMes * escala);
    res.json({
      suficiente: true,
      dias, periodo,
      ventas_mes: Math.round(ventasMes),
      margen_pct: Math.round(margenPct * 10) / 10,
      cobertura_costos_pct: cobertura,
      sugerencias: [
        {
          tipo: 'porcentaje', porcentaje: pctVentas, minimo: 0,
          costo_mes: Math.round(ventasMes * pctVentas / 100),
          pct_de_la_ganancia: Math.round(pctVentas / margenPct * 1000) / 10,
        },
        {
          tipo: 'excedente', porcentaje: pctExcedente, minimo: metaPeriodo,
          // Ejemplo: si venden 20% mas que el promedio
          ejemplo_extra_pct: 20,
          ejemplo_comision_mes: Math.round(ventasMes * 0.2 * pctExcedente / 100),
          ejemplo_ganancia_extra_mes: Math.round(ventasMes * 0.2 * (margenPct - pctExcedente) / 100),
        },
      ],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo calcular la sugerencia: ' + e.message });
  }
});

// Simulador: cuanto se cobraria con una regla (sin guardarla) si el local vende X en el periodo
router.post('/config/simular', (req, res) => {
  const regla = normalizarRegla(req.body.regla || {});
  const total = num(req.body.total);
  res.json({ total, ...calcularComision(total, regla) });
});

// GET comision de HOY para un local (calcula y guarda)
router.get('/:local_id', async (req, res) => {
  try {
    const { local_id } = req.params;
    const hoy = new Date().toISOString().slice(0, 10);
    const data = await calcularYGuardarDia(local_id, hoy);
    res.json({ ...data, fecha: hoy });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET historial de comisiones diarias de un local, mas los pagos manuales.
router.get('/:local_id/historial', async (req, res) => {
  try {
    const { local_id } = req.params;
    const { desde, hasta } = req.query;

    // La LISTA que se muestra si se filtra por fecha (mes, dia puntual, etc.)
    let q = 'SELECT * FROM comisiones WHERE local_id = $1 AND fecha IS NOT NULL';
    const params = [local_id];
    if (desde) { params.push(desde); q += ` AND fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND fecha <= $${params.length}`; }
    q += ' ORDER BY fecha DESC';
    const r = await pool.query(q, params);

    let qPagos = 'SELECT * FROM pagos_comision_manual WHERE local_id = $1';
    const paramsPagos = [local_id];
    if (desde) { paramsPagos.push(desde); qPagos += ` AND DATE(creado_en) >= $${paramsPagos.length}`; }
    if (hasta) { paramsPagos.push(hasta); qPagos += ` AND DATE(creado_en) <= $${paramsPagos.length}`; }
    qPagos += ' ORDER BY creado_en DESC';
    const pagosManuales = await pool.query(qPagos, paramsPagos);

    // Los TOTALES (pendiente/pagado/ganado) siempre son el saldo real completo, sin
    // filtrar por fecha -- si no, "pendiente" daria un numero raro al mirar un solo mes.
    const rTodo = await pool.query('SELECT comision_ganada, pagada FROM comisiones WHERE local_id = $1 AND fecha IS NOT NULL', [local_id]);
    const pagosManualesTodo = await pool.query('SELECT monto FROM pagos_comision_manual WHERE local_id = $1', [local_id]);

    const totalGanado = rTodo.rows.reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPagadoPorDia = rTodo.rows.filter(x => x.pagada).reduce((s, x) => s + parseFloat(x.comision_ganada || 0), 0);
    const totalPagadoManual = pagosManualesTodo.rows.reduce((s, x) => s + parseFloat(x.monto || 0), 0);
    const totalPagado = totalPagadoPorDia + totalPagadoManual;
    const totalPendiente = Math.max(totalGanado - totalPagado, 0);

    res.json({
      registros: r.rows, pagos_manuales: pagosManuales.rows,
      total_ganado: totalGanado, total_pagado: totalPagado, total_pendiente: totalPendiente
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Marcar comisiones como pagadas: por ids (varios) o por rango de fechas.
router.put('/:local_id/pagar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id } = req.params;
    const { ids, desde, hasta, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje } = req.body;

    let sel;
    if (Array.isArray(ids) && ids.length > 0) {
      sel = await client.query(
        `SELECT * FROM comisiones WHERE local_id = $1 AND pagada = FALSE AND id = ANY($2::int[])`,
        [local_id, ids]
      );
    } else if (desde && hasta) {
      sel = await client.query(
        `SELECT * FROM comisiones WHERE local_id = $1 AND pagada = FALSE AND fecha >= $2 AND fecha <= $3`,
        [local_id, desde, hasta]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Indica los dias (ids) o un rango de fechas (desde/hasta)' });
    }

    const totalPagado = sel.rows.reduce((s, row) => s + parseFloat(row.comision_ganada || 0), 0);
    const etiquetaForma = forma_pago === 'transferencia' ? 'transferencia' : forma_pago === 'canje' ? 'canje por ' + (producto_canje_nombre || 'producto') : 'efectivo';
    const concepto = 'Pago comisiones vendedora (' + etiquetaForma + ')';

    const resultado = await procesarPagoComision(client, {
      local_id, monto: totalPagado, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto
    });
    if (resultado.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: resultado.error });
    }

    for (const row of sel.rows) {
      await client.query('UPDATE comisiones SET pagada = TRUE, pagada_en = NOW() WHERE id = $1', [row.id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true, total_pagado: totalPagado, dias_pagados: sel.rows.length, forma_pago: resultado.forma_pago });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Registrar un pago TOTAL manual (un monto suelto, sin atarlo a dias puntuales) -- para
// cuando ya se le pago a la vendedora una suma redonda y no se fue tildando dia por dia
// a tiempo. Se descuenta directo del monto adeudado.
router.post('/:local_id/pago-manual', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { local_id } = req.params;
    const { monto, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, notas } = req.body;

    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ingresa un monto valido' });
    }

    const etiquetaForma = forma_pago === 'transferencia' ? 'transferencia' : forma_pago === 'canje' ? 'canje por ' + (producto_canje_nombre || 'producto') : 'efectivo';
    const concepto = 'Pago total comisiones vendedora (' + etiquetaForma + ')';

    const resultado = await procesarPagoComision(client, {
      local_id, monto: montoNum, forma_pago, producto_canje_id, producto_canje_nombre, cantidad_canje, concepto
    });
    if (resultado.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: resultado.error });
    }

    const guardado = await client.query(
      `INSERT INTO pagos_comision_manual (local_id, monto, forma_pago, producto_canje_id, producto_canje_nombre, notas)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [local_id, montoNum, resultado.forma_pago, producto_canje_id || null, producto_canje_nombre || null, notas || null]
    );

    await client.query('COMMIT');
    res.status(201).json(guardado.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Calcula y guarda la comision de un dia (por defecto, ayer) para TODOS los locales.
router.post('/cerrar-dia', async (req, res) => {
  try {
    const { fecha } = req.body || {};
    let fechaCalcular = fecha;
    if (!fechaCalcular) {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      fechaCalcular = ayer.toISOString().slice(0, 10);
    }
    const locales = await pool.query('SELECT id FROM locales WHERE activo = TRUE ORDER BY id');
    const resultados = [];
    for (const loc of locales.rows) {
      const data = await calcularYGuardarDia(loc.id, fechaCalcular);
      resultados.push({ local_id: loc.id, ...data });
    }
    res.json({ fecha: fechaCalcular, resultados });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;