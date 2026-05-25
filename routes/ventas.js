const express = require('express');
const router = express.Router();
const controller = require('../controllers/ventasController');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.get('/resumen/hoy', controller.getResumenHoy);
router.get('/resumen/mes', controller.getResumenMes);

module.exports = router;