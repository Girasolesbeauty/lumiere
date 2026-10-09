const express = require('express');
const router = express.Router();
const modulos = require('../lib/modulos');

// Modulos del negocio (los lee la pantalla al entrar para armar el menu).
// El dueño los puede prender o apagar desde Configuracion del negocio.
router.get('/', async (req, res) => {
  try { res.json(await modulos.leer()); }
  catch (e) { res.status(500).json({ error: 'No se pudieron leer los módulos' }); }
});
router.put('/', async (req, res) => {
  try {
    if (!req.usuario || !['jefe', 'admin'].includes(req.usuario.rol)) return res.status(403).json({ error: 'Solo el dueño puede cambiar los módulos' });
    const b = req.body || {};
    const cambios = {};
    ['gastronomia', 'consultorio', 'imprimir_comanda'].forEach(k => { if (b[k] !== undefined) cambios[k] = !!b[k]; });
    res.json(await modulos.guardar(cambios));
  } catch (e) { res.status(500).json({ error: 'No se pudieron guardar los módulos' }); }
});
module.exports = router;
