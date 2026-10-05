const express = require('express');
const router = express.Router();
const controller = require('../controllers/controlesInventarioController');

router.get('/config', controller.getConfig);
router.put('/config', controller.guardarConfig);
router.get('/informe/faltantes', controller.informeFaltantes);
router.get('/informe/diagnostico', controller.diagnosticoStock);
router.get('/informe/producto/:id', controller.historiaProducto);
router.get('/', controller.getControles);
router.post('/', controller.crearControl);
router.get('/:id', controller.getControl);
router.put('/:id/contar/:itemId', controller.contarItem);
router.put('/:id/explicar', controller.explicarVarios);
router.put('/:id/explicar/:itemId', controller.explicarItem);
router.post('/:id/finalizar', controller.finalizarControl);
router.delete('/:id', controller.cancelarControl);

module.exports = router;