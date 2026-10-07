const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const cc = require('../lib/cuentaCorriente');

// Cuenta corriente (fiado): quien debe, cuanto y desde cuando; cobros, limite de credito y
// deudas anteriores. Ver lib/cuentaCorriente.js.

const esJefe = (req) => req.usuario && (req.usuario.rol === 'jefe' || req.usuario.rol === 'admin' || req.usuario.rol === 'administrativo');
const nombreUsuario = async (req) => {
  try { const r = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [req.usuario.id]); return r.rows[0] ? r.rows[0].nombre : null; } catch (e) { return null; }
};

async function medioCC() {
  const r = await pool.query('SELECT * FROM medios_pago WHERE tipo = $1 ORDER BY activo DESC, id LIMIT 1', [cc.TIPO_MEDIO]);
  return r.rows[0] || null;
}

// Si esta activada (existe el medio de pago "Cuenta corriente" y esta activo)
router.get('/estado', async (req, res) => {
  try {
    await cc.asegurar();
    const m = await medioCC();
    res.json({ activa: !!(m && m.activo), medio_pago_id: m ? m.id : null });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer la cuenta corriente' });
  }
});

// Activar: crea (o reactiva) el medio de pago "Cuenta corriente" para elegirlo en el Punto de Venta
router.post('/activar', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede activar la cuenta corriente' });
    await cc.asegurar();
    const m = await medioCC();
    if (m) await pool.query('UPDATE medios_pago SET activo = TRUE WHERE id = $1', [m.id]);
    else await pool.query(`INSERT INTO medios_pago (nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online)
                           VALUES ('Cuenta corriente', $1, 1, FALSE, 1.0, 0, TRUE, FALSE)`, [cc.TIPO_MEDIO]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[cuenta corriente] activar:', e.message);
    res.status(500).json({ error: 'No se pudo activar' });
  }
});

// Clientes con saldo (los que deben, o con saldo a favor), con desde cuando deben
router.get('/', async (req, res) => {
  try {
    await cc.asegurar();
    const r = await pool.query(`
      SELECT c.id, c.nombre, c.telefono, c.cc_limite, s.saldo, s.ultimo_mov,
             (SELECT MAX(creado_en) FROM cc_movimientos m WHERE m.cliente_id = c.id AND m.tipo = 'pago' AND NOT m.anulado) AS ultimo_pago
      FROM clientes c
      JOIN (SELECT cliente_id, ${cc.SALDO_SQL} AS saldo, MAX(creado_en) AS ultimo_mov FROM cc_movimientos GROUP BY cliente_id) s ON s.cliente_id = c.id
      WHERE ABS(s.saldo) >= 0.01 OR c.cc_limite IS NOT NULL
      ORDER BY s.saldo DESC`);
    const ids = r.rows.map(x => x.id);
    const movs = ids.length ? (await pool.query('SELECT cliente_id, tipo, importe, anulado, creado_en FROM cc_movimientos WHERE cliente_id = ANY($1)', [ids])).rows : [];
    const porCliente = {};
    movs.forEach(m => { (porCliente[m.cliente_id] = porCliente[m.cliente_id] || []).push(m); });
    const clientes = r.rows.map(x => {
      const saldo = parseFloat(x.saldo) || 0;
      const desde = saldo > 0 ? cc.deudaDesde(porCliente[x.id] || []) : null;
      return { id: x.id, nombre: x.nombre, telefono: x.telefono, saldo, limite: x.cc_limite === null ? null : parseFloat(x.cc_limite),
        deuda_desde: desde, dias: desde ? Math.floor((Date.now() - new Date(desde).getTime()) / 86400000) : null, ultimo_pago: x.ultimo_pago };
    });
    const cobrado = await pool.query(`SELECT COALESCE(SUM(importe), 0) AS t FROM cc_movimientos WHERE tipo = 'pago' AND NOT anulado AND creado_en >= date_trunc('month', NOW())`);
    const deben = clientes.filter(c => c.saldo > 0);
    res.json({
      clientes,
      resumen: {
        total: Math.round(deben.reduce((a, c) => a + c.saldo, 0) * 100) / 100,
        clientes: deben.length,
        mas_30: deben.filter(c => (c.dias || 0) > 30).length,
        monto_mas_30: Math.round(deben.filter(c => (c.dias || 0) > 30).reduce((a, c) => a + c.saldo, 0) * 100) / 100,
        cobrado_mes: parseFloat(cobrado.rows[0].t) || 0,
      },
    });
  } catch (e) {
    console.error('[cuenta corriente] lista:', e.message);
    res.status(500).json({ error: 'No se pudo cargar la cuenta corriente' });
  }
});

// Cuenta de un cliente: saldo, limite y movimientos
router.get('/cliente/:id', async (req, res) => {
  try {
    await cc.asegurar();
    const c = await pool.query('SELECT id, nombre, telefono, cc_limite FROM clientes WHERE id = $1', [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const movs = await pool.query('SELECT * FROM cc_movimientos WHERE cliente_id = $1 ORDER BY creado_en DESC, id DESC LIMIT 300', [req.params.id]);
    const saldo = await cc.saldoDe(pool, req.params.id);
    const desde = saldo > 0 ? cc.deudaDesde(movs.rows) : null;
    res.json({ ...c.rows[0], limite: c.rows[0].cc_limite === null ? null : parseFloat(c.rows[0].cc_limite), saldo, deuda_desde: desde, movimientos: movs.rows });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo cargar la cuenta del cliente' });
  }
});

// Cobro: baja la deuda. Si es en efectivo, entra a la caja del dia (para que el cierre cuadre)
router.post('/cliente/:id/pago', async (req, res) => {
  const { importe, medio_pago_id, medio_pago_nombre, nota, local_id } = req.body || {};
  const monto = Math.round((parseFloat(importe) || 0) * 100) / 100;
  if (!(monto > 0)) return res.status(400).json({ error: 'Poné el importe que pagó' });
  let client;
  try {
    await cc.asegurar();
    const c = await pool.query('SELECT id, nombre FROM clientes WHERE id = $1', [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const saldo = await cc.saldoDe(pool, req.params.id);
    if (monto > saldo + 0.005) return res.status(400).json({ error: `Debe $${saldo.toLocaleString('es-AR')}: no se puede cobrar más que eso.` });
    let medio = { nombre: medio_pago_nombre || 'Efectivo', tipo: null };
    if (medio_pago_id) {
      const m = await pool.query('SELECT nombre, tipo FROM medios_pago WHERE id = $1', [medio_pago_id]);
      if (m.rows[0]) medio = m.rows[0];
    }
    if (medio.tipo === cc.TIPO_MEDIO) return res.status(400).json({ error: 'Elegí cómo pagó (efectivo, transferencia...)' });
    const esEfectivo = medio.tipo === 'efectivo' || /efectivo/i.test(medio.nombre || '');
    const quien = await nombreUsuario(req);
    client = await pool.connect();
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO cc_movimientos (cliente_id, tipo, importe, medio_pago, nota, local_id, usuario_id, usuario_nombre)
       VALUES ($1, 'pago', $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.id, monto, medio.nombre, (nota || '').trim() || null, local_id || 1, req.usuario.id || null, quien]);
    if (esEfectivo) {
      await client.query(
        `INSERT INTO movimientos_caja_efectivo (tipo, importe, concepto, destino_origen, local_id, usuario_id)
         VALUES ('ingreso', $1, $2, 'cuenta_corriente', $3, $4)`,
        [monto, 'Cobro cuenta corriente - ' + (c.rows[0].nombre || 'cliente'), local_id || 1, req.usuario.id || null]);
    }
    await client.query('COMMIT');
    res.json({ ok: true, movimiento: r.rows[0], saldo: Math.round((saldo - monto) * 100) / 100, a_caja: esEfectivo });
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) {} }
    console.error('[cuenta corriente] pago:', e.message);
    res.status(500).json({ error: 'No se pudo registrar el pago. No se guardó nada.' });
  } finally {
    if (client) client.release();
  }
});

// Limite de credito (vacio = sin limite)
router.put('/cliente/:id/limite', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede cambiar el límite' });
    await cc.asegurar();
    const v = req.body && req.body.limite;
    const limite = v === '' || v === null || v === undefined ? null : Math.max(0, parseFloat(v) || 0);
    await pool.query('UPDATE clientes SET cc_limite = $1 WHERE id = $2', [limite, req.params.id]);
    res.json({ ok: true, limite });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo guardar el límite' });
  }
});

// Ajuste: cargar una deuda anterior (del cuaderno) o corregir. Positivo suma deuda, negativo la baja.
router.post('/cliente/:id/ajuste', async (req, res) => {
  try {
    if (!esJefe(req)) return res.status(403).json({ error: 'Solo el jefe puede hacer ajustes' });
    await cc.asegurar();
    const monto = Math.round((parseFloat(req.body && req.body.importe) || 0) * 100) / 100;
    const nota = String((req.body && req.body.nota) || '').trim();
    if (!monto) return res.status(400).json({ error: 'Poné el importe' });
    if (!nota) return res.status(400).json({ error: 'Escribí el motivo (ej: deuda del cuaderno)' });
    const r = await pool.query(
      `INSERT INTO cc_movimientos (cliente_id, tipo, importe, nota, local_id, usuario_id, usuario_nombre)
       VALUES ($1, 'ajuste', $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, monto, nota, (req.body && req.body.local_id) || 1, req.usuario.id || null, await nombreUsuario(req)]);
    res.json({ ok: true, movimiento: r.rows[0], saldo: await cc.saldoDe(pool, req.params.id) });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo guardar el ajuste' });
  }
});

module.exports = router;
