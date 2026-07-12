const express = require('express');
const router = express.Router();
const controller = require('../controllers/ventasController');

router.get('/', controller.getAll);
router.get('/resumen/hoy', controller.getResumenHoy);
router.get('/resumen/mes', controller.getResumenMes);
router.post('/online', controller.crearOnline);
router.delete('/online/:id', controller.eliminarOnline);
router.put('/online/:id', controller.editarOnline);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/confirmar-entrega', controller.confirmarEntrega);

module.exports = router;