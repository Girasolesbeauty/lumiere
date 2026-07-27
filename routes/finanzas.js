const express = require('express');
const router = express.Router();
const controller = require('../controllers/finanzasController');

router.get('/flujo', controller.getFlujo);
router.post('/egreso', controller.agregarEgreso);
router.get('/mi-ultimo-egreso', controller.getMiUltimoEgreso);
router.get('/equilibrio', controller.getPuntoEquilibrio);
router.get('/resumen', controller.getResumen);
router.get('/flujo-estructurado', controller.getFlujoEstructurado);
router.get('/comisiones', controller.getComisiones);
router.get('/cmv', controller.getCMV);
router.post('/facturacion-externa', controller.guardarFacturacionExterna);
router.get('/facturacion-externa', controller.getFacturacionExterna);
router.get('/movimientos-detalle', controller.getMovimientosDetalle);
router.put('/movimientos/:id', controller.updateMovimiento);
router.delete('/movimientos/:id', controller.deleteMovimiento);
router.get('/analisis', controller.getAnalisisFinanciero);

module.exports = router;