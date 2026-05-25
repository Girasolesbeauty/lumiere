const express = require('express');
const router = express.Router();
const controller = require('../controllers/cuponesController');

router.get('/', controller.getAll);
router.get('/:codigo/validar', controller.validar);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;