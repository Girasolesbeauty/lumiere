const express = require('express');
const router = express.Router();
const controller = require('../controllers/tareasController');

router.get('/analisis', controller.getAnalisis);
router.get('/', controller.getTareas);
router.post('/', controller.crearTarea);
router.put('/:id', controller.actualizarTarea);
router.delete('/:id', controller.borrarTarea);

module.exports = router;