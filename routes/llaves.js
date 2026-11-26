// Llaves de solo lectura del negocio (crear, ver, desactivar y ver su registro de uso). Solo el dueño.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const llaves = require('../lib/llaves');
const esDueno = (req) => { const u = req.usuario || {}; return !u.solo_lectura && (u.rol === 'jefe' || Number(u.rol_id) === 1); };
const quien = async (req) => { const u = req.usuario || {}; try { return (await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [u.id])).rows[0]?.nombre || u.email || null; } catch (e) { return u.email || null; } };
const negId = (req) => (req.negocio ? req.negocio.id : 1);
router.get('/', async (req, res) => {
  if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño puede ver las llaves' });
  try { res.json(await llaves.listar(negId(req))); } catch (e) { console.error('[llaves]', e.message); res.status(500).json({ error: 'No se pudieron cargar las llaves' }); }
});
router.post('/', async (req, res) => {
  if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño puede crear llaves' });
  try { res.json(await llaves.crear(negId(req), (req.body || {}).nombre, await quien(req))); } catch (e) { console.error('[llaves]', e.message); res.status(500).json({ error: 'No se pudo crear la llave' }); }
});
router.post('/:id/desactivar', async (req, res) => {
  if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño puede desactivar llaves' });
  try { res.json({ ok: await llaves.desactivar(negId(req), parseInt(req.params.id), await quien(req)) }); } catch (e) { res.status(500).json({ error: 'No se pudo desactivar' }); }
});
router.get('/:id/usos', async (req, res) => {
  if (!esDueno(req)) return res.status(403).json({ error: 'Solo el dueño' });
  try { res.json(await llaves.usos(negId(req), parseInt(req.params.id))); } catch (e) { res.status(500).json({ error: 'No se pudo cargar el registro' }); }
});
module.exports = router;
