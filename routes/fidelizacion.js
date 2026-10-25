const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const controller = require('../controllers/fidelizacionController');
router.get('/premios', controller.getPremios);
router.post('/premios', controller.createPremio);
// Foto de un premio: llega ya achicada desde Lumiere y se guarda en la base. Se ve con un link publico
// (portal de clientas y "Mi cuenta" de la tienda) que lleva el negocio, asi cada negocio ve las suyas.
const TIPOS_FOTO = ['image/webp', 'image/jpeg', 'image/png'];
router.post('/premios/imagen', express.raw({ type: TIPOS_FOTO, limit: '1mb' }), async (req, res) => {
  try {
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!TIPOS_FOTO.includes(tipo) || !Buffer.isBuffer(req.body) || req.body.length < 100) return res.status(400).json({ error: 'La foto tiene que ser JPG, PNG o WEBP' });
    await pool.query('CREATE TABLE IF NOT EXISTS premios_imagenes (id SERIAL PRIMARY KEY, mime TEXT NOT NULL, datos BYTEA NOT NULL, creado_en TIMESTAMP DEFAULT NOW())');
    const r = await pool.query('INSERT INTO premios_imagenes (mime, datos) VALUES ($1, $2) RETURNING id', [tipo, req.body]);
    res.json({ ruta: '/portal/premio-imagen/' + ((req.negocio && req.negocio.id) || 1) + '/' + r.rows[0].id });
  } catch (e) { console.error('[premios] imagen:', e.message); res.status(500).json({ error: 'No se pudo subir la foto' }); }
});
router.put('/premios/:id', controller.updatePremio);
router.delete('/premios/:id', controller.desactivarPremio);
router.post('/canjear', controller.canjear);
router.get('/buscar-por-dni', controller.buscarClientePorDni);
router.post('/canjear-en-local', controller.canjearEnLocal);
router.get('/canjes', controller.getCanjes);
router.post('/validar-canje', controller.validarCanje);
router.get('/ranking', controller.getRanking);
module.exports = router;