// 💡 Ideas y mejoras (mejora continua del negocio): cualquiera del equipo anota un problema que se repite,
// un comentario de una clienta o una idea. Cada cosa pasa por Nuevas → En marcha (con responsable y fecha) → Hechas
// (con qué se hizo y si funcionó). Las demás chicas pueden sumar "a mí también me pasa" para saber qué pesa más.
const express = require('express');
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

const router = express.Router();
const TIPOS = ['idea', 'problema', 'clienta'];
const AREAS = ['atencion', 'local', 'tienda', 'stock', 'caja', 'redes', 'equipo', 'otro'];
const PRIORIDADES = ['urgente', 'importante', 'cuando'];
const ESTADOS = ['nueva', 'en_marcha', 'hecha', 'descartada'];
const FUNCIONO = ['si', 'masomenos', 'no'];

const listo = porNegocio(false);
async function asegurar() {
  if (listo.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS mejoras (
    id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, detalle TEXT, tipo TEXT NOT NULL DEFAULT 'idea', area TEXT NOT NULL DEFAULT 'otro',
    local_id INT, prioridad TEXT NOT NULL DEFAULT 'importante', estado TEXT NOT NULL DEFAULT 'nueva',
    responsable TEXT, fecha_limite DATE, resultado TEXT, funciono TEXT, votos INT[] NOT NULL DEFAULT '{}',
    creado_por TEXT, creado_por_id INT, creado_en TIMESTAMP NOT NULL DEFAULT NOW(), actualizado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    empezado_en TIMESTAMP, resuelto_en TIMESTAMP)`);
  listo.set(true);
}
const esJefe = (u) => u && (u.rol === 'jefe' || Number(u.rol_id) === 1);
async function nombreDe(req) {
  const u = req.usuario || {};
  try { const r = (await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id])).rows[0]; if (r && r.nombre) return r.nombre; } catch (e) {}
  return String((req.body && req.body.usuario_nombre) || u.email || '').slice(0, 60) || null;
}
const txt = (x, max) => String(x || '').trim().slice(0, max) || null;
const fecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || '')) ? x : null;
const fila = (m, uid) => ({ ...m, votos: (m.votos || []).length, vote: (m.votos || []).includes(Number(uid)) });

router.get('/', async (req, res) => {
  try {
    await asegurar();
    // Lo descartado y lo hecho hace más de 6 meses ya no se muestra
    const r = await pool.query(`SELECT * FROM mejoras WHERE NOT (estado IN ('hecha', 'descartada') AND COALESCE(resuelto_en, actualizado_en) < NOW() - INTERVAL '180 days')
      ORDER BY creado_en DESC LIMIT 400`);
    const uid = req.usuario && req.usuario.id;
    const lista = r.rows.map(m => fila(m, uid));
    const hoy = new Date().toISOString().slice(0, 10);
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const hechas = lista.filter(m => m.estado === 'hecha');
    const dias = hechas.filter(m => m.resuelto_en).map(m => (new Date(m.resuelto_en) - new Date(m.creado_en)) / 864e5);
    res.json({
      lista,
      resumen: {
        nuevas: lista.filter(m => m.estado === 'nueva').length,
        en_marcha: lista.filter(m => m.estado === 'en_marcha').length,
        vencidas: lista.filter(m => m.estado === 'en_marcha' && m.fecha_limite && new Date(m.fecha_limite).toISOString().slice(0, 10) < hoy).length,
        hechas_mes: hechas.filter(m => m.resuelto_en && new Date(m.resuelto_en) >= mes).length,
        dias_promedio: dias.length ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : null,
        funcionaron: hechas.filter(m => m.funciono === 'si').length,
      },
      responsables: [...new Set(lista.map(m => m.responsable).filter(Boolean))].slice(0, 30),
      puede_borrar: esJefe(req.usuario),
    });
  } catch (e) { console.error('[mejoras]', e.message); res.status(500).json({ error: 'No se pudieron cargar las ideas y mejoras' }); }
});

router.post('/', async (req, res) => {
  try {
    await asegurar();
    const b = req.body || {};
    const titulo = txt(b.titulo, 160);
    if (!titulo) return res.status(400).json({ error: 'Escribí qué pasa o cuál es la idea' });
    const r = await pool.query(`INSERT INTO mejoras (titulo, detalle, tipo, area, local_id, prioridad, creado_por, creado_por_id, votos)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [titulo, txt(b.detalle, 1500), TIPOS.includes(b.tipo) ? b.tipo : 'idea', AREAS.includes(b.area) ? b.area : 'otro',
       [1, 2].includes(Number(b.local_id)) ? Number(b.local_id) : null, PRIORIDADES.includes(b.prioridad) ? b.prioridad : 'importante',
       await nombreDe(req), (req.usuario && req.usuario.id) || null, req.usuario && req.usuario.id ? [req.usuario.id] : []]);
    res.json(fila(r.rows[0], req.usuario && req.usuario.id));
  } catch (e) { console.error('[mejoras]', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});

// Editar los datos o moverla de estado (al empezar se anota cuándo; al terminar, qué se hizo y si funcionó)
router.put('/:id', async (req, res) => {
  try {
    await asegurar();
    const id = parseInt(req.params.id);
    const m = (await pool.query('SELECT * FROM mejoras WHERE id = $1', [id])).rows[0];
    if (!m) return res.status(404).json({ error: 'No existe' });
    const b = req.body || {}, has = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const n = { ...m };
    if (has('titulo')) { n.titulo = txt(b.titulo, 160); if (!n.titulo) return res.status(400).json({ error: 'El título no puede quedar vacío' }); }
    if (has('detalle')) n.detalle = txt(b.detalle, 1500);
    if (has('tipo') && TIPOS.includes(b.tipo)) n.tipo = b.tipo;
    if (has('area') && AREAS.includes(b.area)) n.area = b.area;
    if (has('local_id')) n.local_id = [1, 2].includes(Number(b.local_id)) ? Number(b.local_id) : null;
    if (has('prioridad') && PRIORIDADES.includes(b.prioridad)) n.prioridad = b.prioridad;
    if (has('responsable')) n.responsable = txt(b.responsable, 60);
    if (has('fecha_limite')) n.fecha_limite = fecha(b.fecha_limite);
    if (has('resultado')) n.resultado = txt(b.resultado, 1500);
    if (has('funciono')) n.funciono = FUNCIONO.includes(b.funciono) ? b.funciono : null;
    if (has('estado') && ESTADOS.includes(b.estado) && b.estado !== m.estado) {
      n.estado = b.estado;
      if (b.estado === 'en_marcha' && !m.empezado_en) n.empezado_en = new Date();
      if (b.estado === 'hecha' || b.estado === 'descartada') n.resuelto_en = new Date();
      if (b.estado === 'nueva' || b.estado === 'en_marcha') { n.resuelto_en = null; if (b.estado === 'nueva') n.empezado_en = null; }
    }
    const r = await pool.query(`UPDATE mejoras SET titulo=$1, detalle=$2, tipo=$3, area=$4, local_id=$5, prioridad=$6, responsable=$7, fecha_limite=$8,
      resultado=$9, funciono=$10, estado=$11, empezado_en=$12, resuelto_en=$13, actualizado_en=NOW() WHERE id=$14 RETURNING *`,
      [n.titulo, n.detalle, n.tipo, n.area, n.local_id, n.prioridad, n.responsable, n.fecha_limite, n.resultado, n.funciono, n.estado, n.empezado_en, n.resuelto_en, id]);
    res.json(fila(r.rows[0], req.usuario && req.usuario.id));
  } catch (e) { console.error('[mejoras]', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
});

// "A mí también me pasa": suma o saca el voto de quien lo toca
router.post('/:id/voto', async (req, res) => {
  try {
    await asegurar();
    const uid = req.usuario && req.usuario.id;
    if (!uid) return res.status(400).json({ error: 'Sin usuario' });
    const r = await pool.query(`UPDATE mejoras SET votos = CASE WHEN $2 = ANY(votos) THEN array_remove(votos, $2) ELSE array_append(votos, $2) END
      WHERE id = $1 RETURNING *`, [parseInt(req.params.id), uid]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No existe' });
    res.json(fila(r.rows[0], uid));
  } catch (e) { res.status(500).json({ error: 'No se pudo guardar' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await asegurar();
    if (!esJefe(req.usuario)) return res.status(403).json({ error: 'Solo el dueño o la dueña del negocio puede borrar. Podés descartarla.' });
    await pool.query('DELETE FROM mejoras WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'No se pudo borrar' }); }
});

module.exports = router;
