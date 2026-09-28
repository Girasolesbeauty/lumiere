const express = require('express');
const router = express.Router();
const controller = require('../controllers/reclamosProveedoresController');

router.get('/', controller.getReclamos);
router.get('/pendientes-recepcion', controller.getPendientesRecepcion);
router.post('/descartar-pendiente', controller.descartarPendiente);
router.post('/', controller.crearReclamo);
router.put('/:id', controller.actualizarReclamo);
router.delete('/:id', controller.borrarReclamo);

module.exports = router;