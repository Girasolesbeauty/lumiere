const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

const TEMAS_PORTAL = ['girasoles', 'claro', 'oscuro', 'salvia'];

// Plantilla del mensaje de "Buscar precio" (texto que se manda al cliente). La columna se crea
// sola la primera vez, para no depender de correr una migracion en cada base.
const columnaMensajeLista = porNegocio(false);
const asegurarColumnaMensaje = async () => {
  if (columnaMensajeLista.get()) return;
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS mensaje_precio TEXT');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS comisiones_activo BOOLEAN DEFAULT TRUE');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS stock_minimo_auto BOOLEAN DEFAULT TRUE');
  await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS stock_minimo_auto_ultimo DATE');
  columnaMensajeLista.set(true);
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
    // Si el negocio usa comisiones para vendedores (cada dueno decide)
    if (typeof req.body.comisiones_activo === 'boolean') {
      await asegurarColumnaMensaje();
      await pool.query('UPDATE configuracion_negocio SET comisiones_activo = $1 WHERE id = 1', [req.body.comisiones_activo]);
    }
    // Link del portal de clientes (para compartirlo por WhatsApp desde el sistema)
    if (Object.prototype.hasOwnProperty.call(req.body, 'portal_url')) {
      const url = String(req.body.portal_url || '').trim().slice(0, 300);
      if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'El link del portal tiene que empezar con https://' });
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS portal_url TEXT');
      await pool.query('UPDATE configuracion_negocio SET portal_url = $1 WHERE id = 1', [url || null]);
    }
    // Diseno del portal de clientes (estilo, fondo, mensaje de bienvenida, que se muestra)
    if (req.body.portal_diseno && typeof req.body.portal_diseno === 'object') {
      const d = req.body.portal_diseno;
      const limpio = {
        tema: TEMAS_PORTAL.includes(d.tema) ? d.tema : 'girasoles',
        fondo: ['estilo', 'color', 'propio'].includes(d.fondo) ? d.fondo : 'estilo',
        bienvenida: String(d.bienvenida || '').slice(0, 160).trim(),
        mostrar_cumple: d.mostrar_cumple !== false,
        mostrar_niveles: d.mostrar_niveles !== false,
      };
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS portal_diseno JSONB');
      const prev = await pool.query('SELECT portal_diseno FROM configuracion_negocio WHERE id = 1');
      limpio.fondo_v = (prev.rows[0] && prev.rows[0].portal_diseno && prev.rows[0].portal_diseno.fondo_v) || null;
      await pool.query('UPDATE configuracion_negocio SET portal_diseno = $1 WHERE id = 1', [JSON.stringify(limpio)]);
    }
    // Rotacion: cuantos dias se deja "en evaluacion" a un producto nuevo antes de marcarlo lento o parado
    if (Object.prototype.hasOwnProperty.call(req.body, 'rotacion_dias_evaluacion')) {
      const d = parseInt(req.body.rotacion_dias_evaluacion);
      if (isNaN(d) || d < 0 || d > 365) return res.status(400).json({ error: 'Los días tienen que estar entre 0 y 365' });
      await pool.query(`ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS rotacion_dias_evaluacion INTEGER DEFAULT ${45}`);
      await pool.query('UPDATE configuracion_negocio SET rotacion_dias_evaluacion = $1 WHERE id = 1', [d]);
    }
    // Moneda: la principal (como se muestran todos los montos) y una segunda opcional (por ej. dolares)
    // con su cotizacion, para ver el equivalente en el Punto de Venta y cobrar en efectivo en esa moneda.
    if (req.body.moneda && typeof req.body.moneda === 'object') {
      const m = req.body.moneda;
      const COD = /^[A-Z]{3}$/;
      if (!COD.test(String(m.codigo || ''))) return res.status(400).json({ error: 'Elegí la moneda principal' });
      const limpia = { codigo: m.codigo, segunda: null };
      if (m.segunda && COD.test(String(m.segunda.codigo || '')) && m.segunda.codigo !== m.codigo) {
        const cot = parseFloat(m.segunda.cotizacion);
        if (!(cot > 0)) return res.status(400).json({ error: 'La cotización de la segunda moneda tiene que ser mayor a 0' });
        limpia.segunda = { codigo: m.segunda.codigo, cotizacion: cot, mostrar_pos: m.segunda.mostrar_pos !== false, cobrar_efectivo: m.segunda.cobrar_efectivo === true, actualizada: new Date().toISOString() };
      }
      await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS moneda JSONB');
      await pool.query('UPDATE configuracion_negocio SET moneda = $1 WHERE id = 1', [JSON.stringify(limpia)]);
    }
    // Recalculo automatico del stock minimo cada noche (cada dueno decide)
    if (typeof req.body.stock_minimo_auto === 'boolean') {
      await asegurarColumnaMensaje();
      await pool.query('UPDATE configuracion_negocio SET stock_minimo_auto = $1 WHERE id = 1', [req.body.stock_minimo_auto]);
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

// Imagen de fondo propia del portal de clientes. Llega ya achicada desde el navegador
// (webp/jpeg, pocos cientos de KB) y se guarda en la base: asi no depende de otro servicio.
const TIPOS_FONDO = ['image/webp', 'image/jpeg', 'image/png'];
router.put('/portal-fondo', express.raw({ type: TIPOS_FONDO, limit: '2mb' }), async (req, res) => {
  try {
    const tipo = String(req.headers['content-type'] || '').split(';')[0].trim();
    if (!TIPOS_FONDO.includes(tipo) || !Buffer.isBuffer(req.body) || req.body.length < 100) {
      return res.status(400).json({ error: 'La imagen tiene que ser JPG, PNG o WEBP' });
    }
    await pool.query('CREATE TABLE IF NOT EXISTS portal_fondo (id INT PRIMARY KEY, mime TEXT NOT NULL, datos BYTEA NOT NULL, actualizado TIMESTAMPTZ DEFAULT NOW())');
    await pool.query(`INSERT INTO portal_fondo (id, mime, datos, actualizado) VALUES (1, $1, $2, NOW())
      ON CONFLICT (id) DO UPDATE SET mime = EXCLUDED.mime, datos = EXCLUDED.datos, actualizado = NOW()`, [tipo, req.body]);
    // La version cambia con cada imagen nueva, para que los celulares no se queden con la vieja
    const v = Date.now();
    await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS portal_diseno JSONB');
    await pool.query(`UPDATE configuracion_negocio SET portal_diseno = COALESCE(portal_diseno, '{}'::jsonb) || jsonb_build_object('fondo_v', $1::bigint, 'fondo', 'propio') WHERE id = 1`, [v]);
    res.json({ ok: true, fondo_v: v });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/portal-fondo', async (req, res) => {
  try {
    await pool.query('DELETE FROM portal_fondo WHERE id = 1').catch(() => {});
    await pool.query(`UPDATE configuracion_negocio SET portal_diseno = COALESCE(portal_diseno, '{}'::jsonb) || '{"fondo_v": null, "fondo": "estilo"}'::jsonb WHERE id = 1`).catch(() => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;