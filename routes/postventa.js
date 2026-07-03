const express = require('express');
const router = express.Router();
const controller = require('../controllers/postventaController');

router.get('/reglas', controller.getReglas);
router.post('/reglas', controller.createRegla);
router.put('/reglas/:id', controller.updateRegla);
router.get('/mensajes', controller.getMensajes);
router.post('/ejecutar', controller.ejecutarReglas);
router.get('/pendientes-whatsapp', controller.getPendientesWhatsApp);
router.post('/marcar-enviado', controller.marcarEnviadoWhatsApp);

module.exports = router;