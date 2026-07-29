const express = require('express');
const router = express.Router();
const controller = require('../controllers/controlesInventarioController');

router.get('/config', controller.getConfig);
router.put('/config', controller.guardarConfig);
router.get('/', controller.getControles);
router.post('/', controller.crearControl);
router.get('/:id', controller.getControl);
router.put('/:id/contar/:itemId', controller.contarItem);
router.post('/:id/finalizar', controller.finalizarControl);
router.delete('/:id', controller.cancelarControl);

module.exports = router;