const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Un reclamo puede venir de una diferencia al recibir mercaderia en Ingresos (queda
// vinculado a esa factura y a ese item) o cargarse a mano. Las columnas nuevas se crean
// solas si faltan.
const columnasListas = porNegocio(false);
const asegurarColumnas = async () => {
  if (columnasListas.get()) return;
  // En algunas bases la tabla nunca se habia creado (la seccion Reclamos fallaba)
  await pool.query(`CREATE TABLE IF NOT EXISTS reclamos_proveedores (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER, producto_nombre TEXT,
    proveedor_id INTEGER, proveedor_nombre TEXT,
    cantidad INTEGER NOT NULL DEFAULT 1, motivo TEXT NOT NULL,
    local_id INTEGER DEFAULT 1, usuario_id INTEGER, usuario_nombre TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente', resolucion TEXT, resuelto_en TIMESTAMP,
    creado_en TIMESTAMP DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE reclamos_proveedores
    ADD COLUMN IF NOT EXISTS orden_id INTEGER, ADD COLUMN IF NOT EXISTS orden_item_id INTEGER,
    ADD COLUMN IF NOT EXISTS local_recepcion VARCHAR(5), ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'falla',
    ADD COLUMN IF NOT EXISTS numero_factura TEXT`);
  await pool.query(`ALTER TABLE ordenes_ingreso_items
    ADD COLUMN IF NOT EXISTS reclamo_descartado_rg BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS reclamo_descartado_ush BOOLEAN DEFAULT FALSE`);
  columnasListas.set(true);
};

// Listar reclamos, con filtros opcionales
const getReclamos = async (req, res) => {
  try {
    await asegurarColumnas();
    const { proveedor_id, estado, local_id } = req.query;
    let q = 'SELECT * FROM reclamos_proveedores WHERE 1=1';
    const params = [];
    if (proveedor_id) { params.push(proveedor_id); q += ` AND proveedor_id = $${params.length}`; }
    if (estado) { params.push(estado); q += ` AND estado = $${params.length}`; }
    if (local_id) { params.push(local_id); q += ` AND local_id = $${params.length}`; }
    q += ' ORDER BY creado_en DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Crear un reclamo nuevo
const crearReclamo = async (req, res) => {
  try {
    await asegurarColumnas();
    const { producto_id, producto_nombre, proveedor_id, proveedor_nombre, cantidad, motivo, local_id, usuario_id, usuario_nombre,
            orden_id, orden_item_id, local_recepcion, tipo, numero_factura } = req.body;
    if (!cantidad || parseInt(cantidad) <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
    if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
    const r = await pool.query(
      `INSERT INTO reclamos_proveedores
        (producto_id, producto_nombre, proveedor_id, proveedor_nombre, cantidad, motivo, local_id, usuario_id, usuario_nombre,
         orden_id, orden_item_id, local_recepcion, tipo, numero_factura)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [producto_id || null, producto_nombre || null, proveedor_id || null, proveedor_nombre || null,
       parseInt(cantidad), motivo.trim(), local_id || 1, usuario_id || null, usuario_nombre || null,
       orden_id || null, orden_item_id || null, ['rg', 'ush'].includes(local_recepcion) ? local_recepcion : null,
       ['faltante', 'danado', 'distinto', 'falla'].includes(tipo) ? tipo : 'falla', numero_factura || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Actualizar estado / resolucion de un reclamo
const actualizarReclamo = async (req, res) => {
  try {
    await asegurarColumnas();
    const { id } = req.params;
    const { estado, resolucion } = req.body;
    const marcarResuelto = estado === 'resuelto' || estado === 'rechazado';
    const r = await pool.query(
      `UPDATE reclamos_proveedores SET
        estado = COALESCE($1, estado),
        resolucion = COALESCE($2, resolucion),
        resuelto_en = CASE WHEN $3 THEN NOW() ELSE resuelto_en END
       WHERE id = $4 RETURNING *`,
      [estado || null, resolucion || null, marcarResuelto, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Reclamo no encontrado' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Borrar un reclamo (por si se cargo mal)
const borrarReclamo = async (req, res) => {
  try {
    await asegurarColumnas();
    await pool.query('DELETE FROM reclamos_proveedores WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Diferencias al recibir mercaderia (Ingresos) que todavia no se reclamaron ni se descartaron:
// faltantes (llego menos de lo facturado) y productos recibidos con una nota de problema.
const getPendientesRecepcion = async (req, res) => {
  try {
    await asegurarColumnas();
    const r = await pool.query(`
      SELECT oi.id AS orden_item_id, oi.orden_id, oi.producto_id, oi.producto_nombre, oi.nota_inconsistencia,
        oi.cantidad_rg, oi.cantidad_ush, oi.recibido_rg, oi.recibido_ush, oi.revisado_rg, oi.revisado_ush,
        COALESCE(oi.reclamo_descartado_rg, FALSE) AS descartado_rg, COALESCE(oi.reclamo_descartado_ush, FALSE) AS descartado_ush,
        oi.recibido_por_rg, oi.recibido_por_ush, oi.fecha_recepcion_rg, oi.fecha_recepcion_ush, oi.costo_unitario,
        o.numero_factura, to_char(o.fecha_factura, 'YYYY-MM-DD') AS fecha_factura, o.proveedor_id, p.nombre AS proveedor_nombre,
        (SELECT array_agg(DISTINCT rp.local_recepcion) FROM reclamos_proveedores rp WHERE rp.orden_item_id = oi.id) AS locales_reclamados
      FROM ordenes_ingreso_items oi
      JOIN ordenes_ingreso o ON o.id = oi.orden_id
      LEFT JOIN proveedores p ON p.id = o.proveedor_id
      WHERE COALESCE(oi.es_extra, FALSE) = FALSE
        AND ((oi.revisado_rg AND COALESCE(oi.recibido_rg, 0) < COALESCE(oi.cantidad_rg, 0))
          OR (oi.revisado_ush AND COALESCE(oi.recibido_ush, 0) < COALESCE(oi.cantidad_ush, 0))
          OR COALESCE(oi.nota_inconsistencia, '') <> '')
      ORDER BY o.fecha_factura DESC, oi.id`);
    const lista = [];
    for (const it of r.rows) {
      const reclamados = it.locales_reclamados || [];
      let notaUsada = false;
      for (const loc of ['rg', 'ush']) {
        const revisado = it['revisado_' + loc];
        const esperado = parseInt(it['cantidad_' + loc]) || 0;
        const recibido = parseInt(it['recibido_' + loc]) || 0;
        const faltante = revisado ? Math.max(0, esperado - recibido) : 0;
        const conNota = revisado && !!(it.nota_inconsistencia || '').trim() && !notaUsada;
        if (faltante <= 0 && !conNota) continue;
        if (conNota) notaUsada = true;
        if (reclamados.includes(loc) || it['descartado_' + loc]) continue;
        lista.push({
          orden_item_id: it.orden_item_id, orden_id: it.orden_id, producto_id: it.producto_id, producto_nombre: it.producto_nombre,
          proveedor_id: it.proveedor_id, proveedor_nombre: it.proveedor_nombre, numero_factura: it.numero_factura, fecha_factura: it.fecha_factura,
          local: loc, local_id: loc === 'ush' ? 2 : 1, esperado, recibido, faltante, nota: it.nota_inconsistencia,
          recibido_por: it['recibido_por_' + loc], fecha_recepcion: it['fecha_recepcion_' + loc],
          costo_unitario: parseFloat(it.costo_unitario) || 0,
          tipo: faltante > 0 ? 'faltante' : 'danado',
        });
      }
    }
    res.json(lista);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// "No reclamar": saca esa diferencia de la lista de pendientes (queda registrada en Inconsistencias)
const descartarPendiente = async (req, res) => {
  try {
    await asegurarColumnas();
    const { orden_item_id, local } = req.body;
    if (!parseInt(orden_item_id) || !['rg', 'ush'].includes(local)) return res.status(400).json({ error: 'Datos invalidos' });
    await pool.query(`UPDATE ordenes_ingreso_items SET reclamo_descartado_${local} = TRUE WHERE id = $1`, [parseInt(orden_item_id)]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { getPendientesRecepcion, descartarPendiente, getReclamos, crearReclamo, actualizarReclamo, borrarReclamo };