const express = require('express');
const router = express.Router();
const textos = require('../legal/textos');

// Terminos y Condiciones y Politica de Privacidad vigentes (publico: se leen antes de aceptar)
router.get('/', (req, res) => {
  res.json({ version: textos.VERSION, vigencia: textos.VIGENCIA, terminos: textos.terminos, privacidad: textos.privacidad });
});

module.exports = router;
