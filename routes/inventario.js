const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventarioController');

router.get('/movimientos', controller.getMovimientos);
router.post('/movimiento', controller.agregarMovimiento);
router.get('/valorizado', controller.getValorizado);

module.exports = router;