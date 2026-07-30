const pool = require('../config/database');

// Listar reclamos, con filtros opcionales
const getReclamos = async (req, res) => {
  try {
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
    const { producto_id, producto_nombre, proveedor_id, proveedor_nombre, cantidad, motivo, local_id, usuario_id, usuario_nombre } = req.body;
    if (!cantidad || parseInt(cantidad) <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
    if (!motivo || !motivo.trim()) return res.status(400).json({ error: 'El motivo es obligatorio' });
    const r = await pool.query(
      `INSERT INTO reclamos_proveedores
        (producto_id, producto_nombre, proveedor_id, proveedor_nombre, cantidad, motivo, local_id, usuario_id, usuario_nombre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [producto_id || null, producto_nombre || null, proveedor_id || null, proveedor_nombre || null,
       parseInt(cantidad), motivo.trim(), local_id || 1, usuario_id || null, usuario_nombre || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Actualizar estado / resolucion de un reclamo
const actualizarReclamo = async (req, res) => {
  try {
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
    await pool.query('DELETE FROM reclamos_proveedores WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { getReclamos, crearReclamo, actualizarReclamo, borrarReclamo };