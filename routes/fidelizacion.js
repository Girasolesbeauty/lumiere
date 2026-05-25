const express = require('express');
const router = express.Router();
const controller = require('../controllers/fidelizacionController');

router.get('/premios', controller.getPremios);
router.post('/premios', controller.createPremio);
router.post('/canjear', controller.canjear);
router.get('/ranking', controller.getRanking);

module.exports = router;