const express = require('express');
const router = express.Router();
const controller = require('../controllers/clientesController');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/historial', controller.getHistorial);
router.post('/:id/puntos', controller.agregarPuntos);
router.post('/:id/resetear-portal', controller.resetearPortal);

module.exports = router;