const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientesController');

router.get('/', controller.getAll);
router.get('/config/niveles', controller.getNiveles);
router.put('/config/niveles', controller.guardarNiveles);
router.get('/portal/resumen', controller.getPortalResumen);
router.get('/:id/portal-vista', controller.getPortalVista);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/historial', controller.getHistorial);
router.post('/:id/puntos', controller.agregarPuntos);
router.post('/:id/resetear-portal', controller.resetearPortal);
router.post('/:id/migrar-puntos', controller.migrarPuntos);
router.get('/:id/migrar-puntos', controller.getMigracionPuntos);

module.exports = router;