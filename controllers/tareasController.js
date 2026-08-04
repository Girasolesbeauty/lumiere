const pool = require('../config/database');

// Listar tareas. Si viene asignado_a, filtra solo las de ese usuario (asi cada vendedora
// ve unicamente lo suyo). Si no viene (jefe viendo "todas"), devuelve todo.
const getTareas = async (req, res) => {
  try {
    const { asignado_a, estado, realizadas } = req.query;
    let q = 'SELECT * FROM tareas WHERE 1=1';
    const params = [];
    if (asignado_a) { params.push(asignado_a); q += ` AND asignado_a = $${params.length}`; }
    if (estado) { params.push(estado); q += ` AND estado = $${params.length}`; }
    if (realizadas === 'true') q += ` AND estado = 'finalizada'`;
    else if (realizadas === 'false') q += ` AND estado != 'finalizada'`;
    q += ' ORDER BY CASE urgencia WHEN \'urgente\' THEN 0 WHEN \'alta\' THEN 1 WHEN \'media\' THEN 2 ELSE 3 END, creado_en DESC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Crear una tarea nueva (el jefe la asigna a una vendedora)
const crearTarea = async (req, res) => {
  try {
    const { titulo, descripcion, urgencia, asignado_a, asignado_nombre, creado_por, creado_por_nombre, local_id } = req.body;
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El titulo es obligatorio' });
    if (!asignado_a) return res.status(400).json({ error: 'Elegi a quien se le asigna la tarea' });
    const urgenciasValidas = ['baja', 'media', 'alta', 'urgente'];
    const urg = urgenciasValidas.includes(urgencia) ? urgencia : 'media';
    const r = await pool.query(
      `INSERT INTO tareas (titulo, descripcion, urgencia, estado, asignado_a, asignado_nombre, creado_por, creado_por_nombre, local_id)
       VALUES ($1,$2,$3,'pendiente',$4,$5,$6,$7,$8) RETURNING *`,
      [titulo.trim(), descripcion || null, urg, asignado_a, asignado_nombre || null, creado_por || null, creado_por_nombre || null, local_id || 1]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Cambiar estado (pendiente -> en_curso -> finalizada), o editar datos
const actualizarTarea = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, urgencia, estado, asignado_a, asignado_nombre } = req.body;

    const actual = await pool.query('SELECT * FROM tareas WHERE id = $1', [id]);
    if (actual.rows.length === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    const t = actual.rows[0];

    let iniciada_en = t.iniciada_en;
    let finalizada_en = t.finalizada_en;
    if (estado === 'en_curso' && !iniciada_en) iniciada_en = new Date();
    if (estado === 'finalizada' && !finalizada_en) finalizada_en = new Date();
    if (estado && estado !== 'finalizada') finalizada_en = null;

    const r = await pool.query(
      `UPDATE tareas SET
        titulo = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        urgencia = COALESCE($3, urgencia),
        estado = COALESCE($4, estado),
        asignado_a = COALESCE($5, asignado_a),
        asignado_nombre = COALESCE($6, asignado_nombre),
        iniciada_en = $7,
        finalizada_en = $8
       WHERE id = $9 RETURNING *`,
      [titulo, descripcion, urgencia, estado, asignado_a, asignado_nombre, iniciada_en, finalizada_en, id]
    );
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const borrarTarea = async (req, res) => {
  try {
    await pool.query('DELETE FROM tareas WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Analisis de rapidez de resolucion, por usuario (solo tareas finalizadas)
const getAnalisis = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT asignado_nombre,
             COUNT(*) AS total_finalizadas,
             ROUND(AVG(EXTRACT(EPOCH FROM (finalizada_en - creado_en)) / 3600)::numeric, 1) AS horas_promedio,
             ROUND(MIN(EXTRACT(EPOCH FROM (finalizada_en - creado_en)) / 3600)::numeric, 1) AS horas_mas_rapida,
             ROUND(MAX(EXTRACT(EPOCH FROM (finalizada_en - creado_en)) / 3600)::numeric, 1) AS horas_mas_lenta
      FROM tareas
      WHERE estado = 'finalizada' AND finalizada_en IS NOT NULL
      GROUP BY asignado_nombre
      ORDER BY horas_promedio ASC
    `);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { getTareas, crearTarea, actualizarTarea, borrarTarea, getAnalisis };