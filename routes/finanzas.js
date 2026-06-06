const express = require('express');
const router = express.Router();
const controller = require('../controllers/finanzasController');

router.get('/flujo', controller.getFlujo);
router.post('/egreso', controller.agregarEgreso);
router.get('/equilibrio', controller.getPuntoEquilibrio);
router.get('/resumen', controller.getResumen);
router.get('/flujo-estructurado', controller.getFlujoEstructurado);

module.exports = router;