const express = require('express');
const router = express.Router();
const controller = require('../controllers/postventaController');

router.get('/reglas', controller.getReglas);
router.post('/reglas', controller.createRegla);
router.put('/reglas/:id', controller.updateRegla);
router.get('/mensajes', controller.getMensajes);
router.post('/ejecutar', controller.ejecutarReglas);

module.exports = router;