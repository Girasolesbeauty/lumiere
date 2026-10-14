// Misiones con puntos extra (las arma la tienda en Lumiere > Tienda online > Ofertas y combos).
// Cada mision tiene un periodo (desde/hasta), una meta y los puntos que da. El avance se calcula con lo que la
// clienta hizo en ese periodo; cuando la cumple, los puntos se acreditan una sola vez (al entrar a su cuenta).
const pool = require('../config/database');
const { VENTA_VALIDA } = require('./niveles');

const TIPOS = {
  resenas: 'Dejar reseñas',
  compras: 'Hacer compras',
  monto: 'Comprar por un monto',
  coreano: 'Comprar productos coreanos',
  categoria: 'Comprar de una categoría',
  online: 'Comprar en la tienda online',
  invitar: 'Invitar amigas que compren',
};

const fecha = (x) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || '')); return m ? m[0] : null; };
function misionesDe(c) {
  const l = Array.isArray(c && c.misiones) ? c.misiones : [];
  return l.slice(0, 20).map((x, i) => ({
    id: String(x.id || ('m' + Date.now().toString(36) + i)).replace(/[^a-z0-9]/gi, '').slice(0, 20) || 'm' + i,
    titulo: String(x.titulo || '').trim().slice(0, 80) || 'Misión',
    tipo: TIPOS[x.tipo] ? x.tipo : 'compras',
    meta: Math.max(1, Math.min(100000000, Math.round(Number(x.meta) || 1))),
    puntos: Math.max(0, Math.min(100000, Math.round(Number(x.puntos) || 0))),
    categoria: String(x.categoria || '').trim().slice(0, 80),
    desde: fecha(x.desde), hasta: fecha(x.hasta),
    activo: x.activo !== false,
  })).filter(x => x.desde && x.hasta && x.hasta >= x.desde);
}

// Fechas de Argentina: las ventas se guardan sin zona horaria (como en comprobantes)
const AR = (col) => `(((${col}) AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`;
async function avance(db, m, clienteId) {
  const p = [clienteId, m.desde, m.hasta];
  const q = async (sql, extra = []) => { const r = await db.query(sql, [...p, ...extra]).catch(() => ({ rows: [{ n: 0 }] })); return Number(r.rows[0] && r.rows[0].n) || 0; };
  const ventas = `FROM ventas v WHERE v.cliente_id = $1 AND ${VENTA_VALIDA} AND ${AR('v.creado_en')} BETWEEN $2::date AND $3::date`;
  switch (m.tipo) {
    case 'resenas': return q(`SELECT COUNT(*) AS n FROM tienda_resenas WHERE cliente_id = $1 AND estado = 'aprobada' AND ${AR('creado_en')} BETWEEN $2::date AND $3::date`);
    case 'compras': return q(`SELECT COUNT(*) AS n ${ventas}`);
    case 'monto': return q(`SELECT COALESCE(SUM(v.total), 0) AS n ${ventas}`);
    case 'online': return q(`SELECT COUNT(*) AS n FROM tienda_pedidos WHERE cliente_id = $1 AND estado = 'entregado' AND COALESCE(tipo, '') <> 'giftcard' AND ${AR('creado_en')} BETWEEN $2::date AND $3::date`);
    case 'invitar': return q(`SELECT COUNT(*) AS n FROM tienda_referidos WHERE referente_id = $1 AND ${AR('creado_en')} BETWEEN $2::date AND $3::date`);
    case 'coreano': return q(`SELECT COALESCE(SUM(vi.cantidad), 0) AS n FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos pr ON pr.id = vi.producto_id
      JOIN proveedores pv ON pv.id = pr.proveedor_id WHERE v.cliente_id = $1 AND ${VENTA_VALIDA} AND ${AR('v.creado_en')} BETWEEN $2::date AND $3::date AND pv.nombre ~* '(^|[^a-z])bek([^a-z]|$)'`);
    case 'categoria': return q(`SELECT COALESCE(SUM(vi.cantidad), 0) AS n FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos pr ON pr.id = vi.producto_id
      WHERE v.cliente_id = $1 AND ${VENTA_VALIDA} AND ${AR('v.creado_en')} BETWEEN $2::date AND $3::date AND LOWER(COALESCE(pr.categoria, '')) = LOWER($4)`, [m.categoria]);
    default: return 0;
  }
}

let tablaLista = false;
async function asegurar() {
  if (tablaLista) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS tienda_misiones_logradas (mision_id TEXT NOT NULL, cliente_id INT NOT NULL, puntos INT NOT NULL DEFAULT 0,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(), PRIMARY KEY (mision_id, cliente_id))`);
  tablaLista = true;
}

// Misiones vigentes (o recien terminadas) de una clienta, con su avance; acredita las que cumplio
async function misionesDeCliente(c, clienteId) {
  await asegurar();
  const hoy = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // dia de Argentina
  const vigentes = misionesDe(c).filter(m => m.activo && m.desde <= hoy && m.hasta >= hoy);
  if (!vigentes.length) return [];
  const ya = new Set((await pool.query('SELECT mision_id FROM tienda_misiones_logradas WHERE cliente_id = $1', [clienteId])).rows.map(r => r.mision_id));
  const res = [];
  for (const m of vigentes) {
    const n = await avance(pool, m, clienteId);
    let lograda = ya.has(m.id), recien = false;
    if (!lograda && n >= m.meta) {
      const r = await pool.query('INSERT INTO tienda_misiones_logradas (mision_id, cliente_id, puntos) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING mision_id', [m.id, clienteId, m.puntos]);
      if (r.rows.length && m.puntos > 0) await pool.query('UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2', [m.puntos, clienteId]);
      lograda = true; recien = r.rows.length > 0;
    }
    res.push({ id: m.id, titulo: m.titulo, tipo: m.tipo, meta: m.meta, puntos: m.puntos, hasta: m.hasta, n: Math.min(n, m.meta), lograda, recien });
  }
  return res;
}

module.exports = { TIPOS, misionesDe, misionesDeCliente, avance };
