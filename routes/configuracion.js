const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Plantilla del mensaje de "Buscar precio" (texto que se manda al cliente). La columna se crea
// sola la primera vez, para no depender de correr una migracion en cada base.
let columnaMensajeLista = false;
const asegurarColumnaMensaje = async () => {
  if (columnaMensajeLista) return;
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS mensaje_precio TEXT');
  columnaMensajeLista = true;
};

// Leer la configuracion general (nombre del negocio, logo)
router.get('/', async (req, res) => {
  try {
    try { await asegurarColumnaMensaje(); } catch (e) {}
    const r = await pool.query('SELECT * FROM configuracion_negocio WHERE id = 1');
    if (!r.rows.length) return res.json({ nombre_negocio: 'Mi Negocio', logo_url: null });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Guardar la configuracion general
router.put('/', async (req, res) => {
  try {
    const { nombre_negocio, logo_url, modo_ticket, retos_activo, retos_meta_mensual, retos_premio_monto } = req.body;
    // Desafios de venta: se guardan solo si vinieron en el pedido.
    const retosActivo = typeof retos_activo === 'boolean' ? retos_activo : null;
    const retosMeta = parseInt(retos_meta_mensual) > 0 ? parseInt(retos_meta_mensual) : null;
    const retosMonto = parseFloat(retos_premio_monto) >= 0 ? parseFloat(retos_premio_monto) : null;
    // modo_ticket: que pasa al terminar una venta en el POS -- "imprimir" (ticket en la
    // impresora, lo de siempre), "enviar" (link por WhatsApp) o "preguntar" (la vendedora elige).
    const modoValido = ['imprimir', 'enviar', 'preguntar'].includes(modo_ticket) ? modo_ticket : null;
    // El logo solo se toca si vino en el pedido (antes, guardar otra cosa -- por ejemplo
    // los datos fiscales -- mandaba logo_url vacio y borraba el logo sin querer).
    const tocaLogo = Object.prototype.hasOwnProperty.call(req.body, 'logo_url');
    // Mensaje de Buscar precio: solo se toca si vino; vacio = volver al mensaje original.
    const tocaMensaje = Object.prototype.hasOwnProperty.call(req.body, 'mensaje_precio');
    if (tocaMensaje) {
      await asegurarColumnaMensaje();
      const txt = String(req.body.mensaje_precio || '').slice(0, 2000).trim();
      await pool.query('UPDATE configuracion_negocio SET mensaje_precio = $1 WHERE id = 1', [txt || null]);
    }
    // Reparto por defecto de los gastos compartidos: % que le toca al local 1
    if (Object.prototype.hasOwnProperty.call(req.body, 'reparto_local1_pct')) {
      const pct = parseFloat(req.body.reparto_local1_pct);
      if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'El reparto tiene que estar entre 0 y 100' });
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS reparto_local1_pct NUMERIC(5,2) DEFAULT 50');
      await pool.query('UPDATE configuracion_negocio SET reparto_local1_pct = $1 WHERE id = 1', [pct]);
    }
    // % de Ingresos Brutos estimado en Finanzas (0 = no se calcula)
    if (Object.prototype.hasOwnProperty.call(req.body, 'iibb_pct')) {
      const pct = parseFloat(req.body.iibb_pct);
      if (isNaN(pct) || pct < 0 || pct > 30) return res.status(400).json({ error: 'El % de IIBB tiene que estar entre 0 y 30' });
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS iibb_pct NUMERIC(5,2) DEFAULT 4');
      await pool.query('UPDATE configuracion_negocio SET iibb_pct = $1 WHERE id = 1', [pct]);
    }
    const r = await pool.query(
      `UPDATE configuracion_negocio SET nombre_negocio = COALESCE($1, nombre_negocio),
         logo_url = CASE WHEN $4 THEN $2 ELSE logo_url END,
         modo_ticket = COALESCE($3, modo_ticket),
         retos_activo = COALESCE($5, retos_activo),
         retos_meta_mensual = COALESCE($6, retos_meta_mensual),
         retos_premio_monto = COALESCE($7, retos_premio_monto)
       WHERE id = 1 RETURNING *`,
      [nombre_negocio, logo_url || null, modoValido, tocaLogo, retosActivo, retosMeta, retosMonto]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;