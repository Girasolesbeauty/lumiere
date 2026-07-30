const express = require('express');
const router = express.Router();
const controller = require('../controllers/cambiosController');

router.get('/venta/:numero', controller.buscarVentaOrigen);
router.post('/', controller.procesarCambio);
router.get('/', controller.getCambios);

module.exports = router;