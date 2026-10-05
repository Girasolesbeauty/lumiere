const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');
// Obtener movimientos de caja por local
router.get('/', async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT m.*, cp.nombre as cuenta_destino_nombre
      FROM movimientos_caja_efectivo m
      LEFT JOIN cuentas_pago cp ON m.cuenta_destino_id = cp.id
      WHERE 1=1
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND m.local_id = $${params.length}`;
    }
    query += ' ORDER BY m.creado_en DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movimientos de caja' });
  }
});
// Obtener saldo actual de caja
router.get('/saldo', async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT 
        SUM(CASE WHEN tipo IN ('ingreso', 'I') THEN importe ELSE -importe END) as saldo
      FROM movimientos_caja_efectivo
      WHERE (anulado IS NULL OR anulado = FALSE)
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND local_id = $${params.length}`;
    }
    const result = await pool.query(query, params);
    res.json({ saldo: parseFloat(result.rows[0].saldo) || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener saldo' });
  }
});
// Registrar movimiento de caja
router.post('/', async (req, res) => {
  try {
    const { tipo, importe, concepto, destino_origen, cuenta_destino_id, local_id, usuario_id } = req.body;
    const result = await pool.query(
      `INSERT INTO movimientos_caja_efectivo 
       (tipo, importe, concepto, destino_origen, cuenta_destino_id, local_id, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tipo, importe, concepto, destino_origen, cuenta_destino_id || null, local_id || 1, usuario_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar movimiento: ' + error.message });
  }
});

// ===== Cierre de caja =====
// Todo se calcula en el servidor y por dia de Argentina: las fechas se guardan sin zona
// horaria (en la zona de la base), asi que se convierten a hora argentina antes de
// comparar el dia -- si no, lo vendido despues de las 21 hs aparecia en el dia siguiente.
const DIA_AR = (col) => `((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
const HORA_AR = (col) => `to_char((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI')`;

const tablaCierresLista = porNegocio(false);
const asegurarTablaCierres = async () => {
  if (tablaCierresLista.get()) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cierres_caja (
      id SERIAL PRIMARY KEY,
      local_id INTEGER NOT NULL DEFAULT 1,
      fecha DATE NOT NULL,
      fondo_inicial NUMERIC(12,2) DEFAULT 0,
      efectivo_esperado NUMERIC(12,2) DEFAULT 0,
      efectivo_contado NUMERIC(12,2) DEFAULT 0,
      diferencia NUMERIC(12,2) DEFAULT 0,
      billetes JSONB,
      total_dia NUMERIC(12,2) DEFAULT 0,
      cantidad_ventas INTEGER DEFAULT 0,
      observaciones TEXT,
      usuario_id INTEGER,
      usuario_nombre TEXT,
      creado_en TIMESTAMP DEFAULT now(),
      actualizado_en TIMESTAMP DEFAULT now(),
      UNIQUE (local_id, fecha)
    )`);
  tablaCierresLista.set(true);
};

const hayVentaPagos = porNegocio(null);
const tieneVentaPagos = async () => {
  if (hayVentaPagos.get() === null) {
    const r = await pool.query(`SELECT to_regclass('venta_pagos') AS t`);
    hayVentaPagos.set(!!r.rows[0].t);
  }
  return hayVentaPagos.get();
};

const esFechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
const num = (x) => parseFloat(x) || 0;

const calcularCierre = async (localId, fecha) => {
  const conPagos = await tieneVentaPagos();
  const [ventasR, mediosR, movsR, gcR] = await Promise.all([
    pool.query(`
      SELECT v.id, v.numero_factura, v.total, COALESCE(v.monto_gift_card, 0) AS monto_gift_card,
        v.medio_pago, v.medio_pago_id, COALESCE(v.anulada, FALSE) AS anulada, v.motivo_anulacion,
        v.estado_facturacion, v.canal, v.cae, c.nombre AS cliente_nombre, u.nombre AS vendedora_nombre,
        ${HORA_AR('v.creado_en')} AS hora,
        ${conPagos ? `COALESCE((SELECT json_agg(json_build_object('medio_pago_id', vp.medio_pago_id, 'nombre', vp.medio_pago_nombre, 'importe', vp.importe))
          FROM venta_pagos vp WHERE vp.venta_id = v.id), '[]')` : `'[]'::json`} AS pagos
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = v.usuario_id
      WHERE v.local_id = $1 AND ${DIA_AR('v.creado_en')} = $2::date
        AND COALESCE(v.es_preventa, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
      ORDER BY v.creado_en DESC`, [localId, fecha]),
    pool.query(`SELECT id, nombre, tipo FROM medios_pago`),
    pool.query(`
      SELECT id, tipo, importe, concepto, destino_origen, ${HORA_AR('creado_en')} AS hora
      FROM movimientos_caja_efectivo
      WHERE local_id = $1 AND ${DIA_AR('creado_en')} = $2::date AND COALESCE(anulado, FALSE) = FALSE
      ORDER BY creado_en`, [localId, fecha]),
    // Gift cards vendidas ese dia (plata nueva: no cuenta migraciones ni creditos por devolucion,
    // que se registran con importe 0 o no se registran)
    pool.query(`
      SELECT id, concepto, importe, forma_pago, ${HORA_AR('creado_en')} AS hora
      FROM movimientos_caja
      WHERE local_id = $1 AND ${DIA_AR('creado_en')} = $2::date AND COALESCE(anulado, FALSE) = FALSE
        AND tipo = 'I' AND concepto LIKE 'Gift Card%' AND importe > 0
      ORDER BY creado_en`, [localId, fecha]),
  ]);

  const mediosPorId = {};
  mediosR.rows.forEach(m => { mediosPorId[m.id] = m; });
  const esEfectivo = (id, nombre) => {
    const m = id ? mediosPorId[id] : null;
    if (m && (m.tipo === 'efectivo' || /efectivo/i.test(m.nombre || ''))) return true;
    return /efectivo/i.test(nombre || '');
  };

  // Desglose por medio: una venta con pago dividido reparte su importe entre sus medios
  // (antes se sumaba el total entero a una fila "Efectivo + Debito" y contaba todo como efectivo).
  const medios = {};
  const sumar = (nombre, importe, efectivo, esVenta) => {
    const k = (nombre || 'Sin especificar').trim();
    if (!medios[k]) medios[k] = { nombre: k, cantidad: 0, total: 0, efectivo: false };
    medios[k].cantidad += esVenta ? 1 : 0;
    medios[k].total += importe;
    medios[k].efectivo = medios[k].efectivo || efectivo;
  };
  let totalVentas = 0, cantidad = 0, anuladas = 0, montoAnulado = 0, ventasEfectivo = 0, pendientesArca = 0, pagadoGiftCard = 0;
  for (const v of ventasR.rows) {
    const neto = num(v.total) - num(v.monto_gift_card);
    if (v.anulada) { anuladas++; montoAnulado += num(v.total); continue; }
    cantidad++;
    totalVentas += neto;
    pagadoGiftCard += num(v.monto_gift_card);
    // Mismo criterio que el aviso de facturas pendientes del POS
    if (v.canal === 'presencial' && !v.cae && num(v.monto_gift_card) < num(v.total) && v.estado_facturacion !== 'no_aplica') { pendientesArca++; v.pendiente_arca = true; }
    const pagos = Array.isArray(v.pagos) ? v.pagos.filter(p => num(p.importe) > 0 && !/gift/i.test(p.nombre || '')) : [];
    if (pagos.length > 0) {
      pagos.forEach(p => {
        const ef = esEfectivo(p.medio_pago_id, p.nombre);
        sumar(p.nombre, num(p.importe), ef, true);
        if (ef) ventasEfectivo += num(p.importe);
      });
    } else if (neto > 0) {
      const ef = esEfectivo(v.medio_pago_id, v.medio_pago);
      sumar(v.medio_pago || 'Efectivo', neto, ef, true);
      if (ef) ventasEfectivo += neto;
    }
  }

  let totalGiftCards = 0, gcEfectivo = 0;
  gcR.rows.forEach(g => {
    totalGiftCards += num(g.importe);
    if (esEfectivo(null, g.forma_pago)) gcEfectivo += num(g.importe);
  });

  // Las ventas en efectivo generan solas un ingreso "Venta ..." en la caja: ya estan contadas
  // en ventasEfectivo, asi que no se vuelven a sumar como ingresos.
  const esIngreso = (t) => ['ingreso', 'I'].includes(String(t || '').trim());
  const ingresos = movsR.rows.filter(m => esIngreso(m.tipo) && !String(m.concepto || '').startsWith('Venta ')).reduce((s, m) => s + num(m.importe), 0);
  const egresos = movsR.rows.filter(m => !esIngreso(m.tipo)).reduce((s, m) => s + num(m.importe), 0);

  const efectivoDelDia = ventasEfectivo + gcEfectivo + ingresos - egresos;
  return {
    fecha,
    ventas: ventasR.rows,
    medios: Object.values(medios).sort((a, b) => b.total - a.total),
    gift_cards: gcR.rows,
    movimientos: movsR.rows,
    resumen: {
      total_dia: totalVentas + totalGiftCards,
      total_ventas: totalVentas,
      cantidad_ventas: cantidad,
      ticket_promedio: cantidad > 0 ? totalVentas / cantidad : 0,
      anuladas, monto_anulado: montoAnulado,
      pagado_gift_card: pagadoGiftCard,
      total_gift_cards: totalGiftCards, cantidad_gift_cards: gcR.rows.length,
      ventas_efectivo: ventasEfectivo, gift_cards_efectivo: gcEfectivo,
      ingresos, egresos,
      efectivo_del_dia: efectivoDelDia,
      pendientes_arca: pendientesArca,
    },
  };
};

// Resumen del dia + arqueo guardado (si ya se cerro)
router.get('/cierre', async (req, res) => {
  try {
    const localId = parseInt(req.query.local_id) || 1;
    const fecha = req.query.fecha;
    if (!esFechaValida(fecha)) return res.status(400).json({ error: 'Fecha invalida' });
    await asegurarTablaCierres();
    const datos = await calcularCierre(localId, fecha);
    const guardado = await pool.query('SELECT * FROM cierres_caja WHERE local_id = $1 AND fecha = $2::date', [localId, fecha]);
    // Fondo de cambio sugerido: el que se dejo en el ultimo cierre anterior de este local
    const anterior = await pool.query(
      'SELECT fondo_inicial FROM cierres_caja WHERE local_id = $1 AND fecha < $2::date ORDER BY fecha DESC LIMIT 1', [localId, fecha]);
    res.json({ ...datos, cierre: guardado.rows[0] || null, fondo_sugerido: anterior.rows[0] ? num(anterior.rows[0].fondo_inicial) : 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular el cierre: ' + error.message });
  }
});

// Guardar (o corregir) el arqueo del dia. El esperado se recalcula aca, no se confia en el que manda la pantalla.
router.post('/cierre', async (req, res) => {
  try {
    const { fecha, fondo_inicial, efectivo_contado, billetes, observaciones, usuario_id, usuario_nombre } = req.body;
    const localId = parseInt(req.body.local_id) || 1;
    if (!esFechaValida(fecha)) return res.status(400).json({ error: 'Fecha invalida' });
    if (efectivo_contado === '' || efectivo_contado === null || efectivo_contado === undefined || isNaN(parseFloat(efectivo_contado))) {
      return res.status(400).json({ error: 'Falta el efectivo contado' });
    }
    await asegurarTablaCierres();
    const datos = await calcularCierre(localId, fecha);
    const fondo = num(fondo_inicial);
    const esperado = fondo + datos.resumen.efectivo_del_dia;
    const contado = num(efectivo_contado);
    const r = await pool.query(`
      INSERT INTO cierres_caja (local_id, fecha, fondo_inicial, efectivo_esperado, efectivo_contado, diferencia, billetes,
        total_dia, cantidad_ventas, observaciones, usuario_id, usuario_nombre)
      VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (local_id, fecha) DO UPDATE SET
        fondo_inicial = EXCLUDED.fondo_inicial, efectivo_esperado = EXCLUDED.efectivo_esperado,
        efectivo_contado = EXCLUDED.efectivo_contado, diferencia = EXCLUDED.diferencia, billetes = EXCLUDED.billetes,
        total_dia = EXCLUDED.total_dia, cantidad_ventas = EXCLUDED.cantidad_ventas, observaciones = EXCLUDED.observaciones,
        usuario_id = EXCLUDED.usuario_id, usuario_nombre = EXCLUDED.usuario_nombre, actualizado_en = now()
      RETURNING *`,
      [localId, fecha, fondo, esperado, contado, contado - esperado, billetes ? JSON.stringify(billetes) : null,
       datos.resumen.total_dia, datos.resumen.cantidad_ventas, (observaciones || '').trim() || null, usuario_id || null, usuario_nombre || null]);
    res.json(r.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el cierre: ' + error.message });
  }
});

// Historial de cierres (arqueos) de un local
router.get('/cierres', async (req, res) => {
  try {
    const localId = parseInt(req.query.local_id) || 1;
    const limite = Math.min(parseInt(req.query.limit) || 60, 365);
    await asegurarTablaCierres();
    const r = await pool.query(
      `SELECT *, to_char(fecha, 'YYYY-MM-DD') AS fecha_txt FROM cierres_caja WHERE local_id = $1 ORDER BY fecha DESC LIMIT $2`, [localId, limite]);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los cierres' });
  }
});

module.exports = router;