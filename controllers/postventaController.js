const pool = require('../config/database');
const { VENTA_VALIDA } = require('../lib/niveles');
const { porNegocio } = require('../lib/contexto');

// Cada WhatsApp guarda con que modelo de mensaje se mando y a que lista pertenecia el cliente,
// para poder ver despues que mensaje trae mas clientes de vuelta
const columnasListas = porNegocio(false);
async function asegurarColumnas() {
  if (columnasListas.get()) return;
  await pool.query('ALTER TABLE mensajes_enviados ADD COLUMN IF NOT EXISTS plantilla TEXT');
  await pool.query('ALTER TABLE mensajes_enviados ADD COLUMN IF NOT EXISTS grupo TEXT');
  columnasListas.set(true);
}
// Una compra cuenta como "volvio por el mensaje" si la hizo dentro de estos dias despues del mensaje
const DIAS_EFECTO = 30;

// Obtener reglas
const getReglas = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reglas_postventa ORDER BY creado_en DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener reglas' });
  }
};

// Crear regla
const createRegla = async (req, res) => {
  try {
    const { nombre, disparador, dias, segmento, mensaje } = req.body;
    const result = await pool.query(
      `INSERT INTO reglas_postventa (nombre, disparador, dias, segmento, mensaje)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, disparador, dias, segmento, mensaje]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear regla' });
  }
};

// Actualizar regla
const updateRegla = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, disparador, dias, segmento, mensaje, activo } = req.body;
    const result = await pool.query(
      `UPDATE reglas_postventa SET nombre=$1, disparador=$2, dias=$3, 
       segmento=$4, mensaje=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [nombre, disparador, dias, segmento, mensaje, activo, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar regla' });
  }
};

// Obtener mensajes enviados
const getMensajes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.nombre AS cliente_nombre, c.telefono, r.nombre AS regla_nombre
      FROM mensajes_enviados m
      JOIN clientes c ON m.cliente_id = c.id
      LEFT JOIN reglas_postventa r ON m.regla_id = r.id
      ORDER BY m.creado_en DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
};

// Ejecutar reglas automaticas
const ejecutarReglas = async (req, res) => {
  try {
    const reglas = await pool.query(
      'SELECT * FROM reglas_postventa WHERE activo = TRUE'
    );

    const mensajesGenerados = [];

    for (const regla of reglas.rows) {
      let clientes = [];

      if (regla.disparador === 'post_compra') {
        // Clientes que compraron hace N dias
        const result = await pool.query(`
          SELECT DISTINCT c.*, 
            p.nombre AS ultimo_producto,
            v.creado_en AS fecha_compra
          FROM clientes c
          JOIN ventas v ON c.id = v.cliente_id
          JOIN venta_items vi ON v.id = vi.venta_id
          JOIN productos p ON vi.producto_id = p.id
          WHERE DATE(v.creado_en) = CURRENT_DATE - INTERVAL '${regla.dias} days'
        `);
        clientes = result.rows;
      } else if (regla.disparador === 'inactivo') {
        // Clientes sin compras en N dias
        const result = await pool.query(`
          SELECT c.* FROM clientes c
          WHERE c.id NOT IN (
            SELECT DISTINCT cliente_id FROM ventas
            WHERE creado_en >= CURRENT_DATE - INTERVAL '${regla.dias} days'
          )
        `);
        clientes = result.rows;
      } else if (regla.disparador === 'cumpleanos') {
        // Clientes que cumplen años hoy
        const result = await pool.query(`
          SELECT * FROM clientes
          WHERE EXTRACT(MONTH FROM fecha_nacimiento) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM fecha_nacimiento) = EXTRACT(DAY FROM CURRENT_DATE)
        `);
        clientes = result.rows;
      }

      // Registrar mensajes (evitando duplicar si esta regla ya le genero un mensaje
      // a este cliente hoy -- por ejemplo si "Ejecutar reglas" se aprieta mas de una vez).
      for (const cliente of clientes) {
        const yaExiste = await pool.query(
          `SELECT 1 FROM mensajes_enviados
           WHERE regla_id = $1 AND cliente_id = $2 AND DATE(creado_en) = CURRENT_DATE
           LIMIT 1`,
          [regla.id, cliente.id]
        );
        if (yaExiste.rows.length > 0) continue;

        const mensaje = regla.mensaje
          .replace('{nombre}', cliente.nombre.split(',')[0])
          .replace('{producto}', cliente.ultimo_producto || 'tu producto')
          .replace('{puntos}', cliente.puntos || 0);

        await pool.query(
          `INSERT INTO mensajes_enviados (regla_id, cliente_id, mensaje, estado)
           VALUES ($1, $2, $3, 'programado')`,
          [regla.id, cliente.id, mensaje]
        );

        mensajesGenerados.push({
          cliente: cliente.nombre,
          telefono: cliente.telefono,
          mensaje
        });
      }
    }

    res.json({
      mensaje: 'Reglas ejecutadas correctamente',
      mensajes_generados: mensajesGenerados.length,
      detalle: mensajesGenerados
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al ejecutar reglas' });
  }
};

// Clientes que compraron hace X dias (default 7) para enviar WhatsApp por clic
const getPendientesWhatsApp = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const result = await pool.query(`
      SELECT DISTINCT ON (c.id) c.id, c.nombre, c.telefono,
        p.nombre AS ultimo_producto,
        v.creado_en AS fecha_compra,
        v.id AS venta_id
      FROM clientes c
      JOIN ventas v ON c.id = v.cliente_id
      JOIN venta_items vi ON v.id = vi.venta_id
      JOIN productos p ON vi.producto_id = p.id
      WHERE DATE(v.creado_en) = CURRENT_DATE - ($1 || ' days')::INTERVAL
        AND c.telefono IS NOT NULL AND c.telefono <> ''
      ORDER BY c.id, v.creado_en DESC
    `, [dias]);

    // Marcar si ya se le envio postventa por esta compra (para no repetir)
    const clientes = [];
    for (const row of result.rows) {
      let yaEnviado = false;
      try {
        const chk = await pool.query(
          `SELECT 1 FROM mensajes_enviados WHERE cliente_id = $1 AND estado = 'enviado_wa'
           AND DATE(creado_en) >= DATE($2) LIMIT 1`,
          [row.id, row.fecha_compra]
        );
        yaEnviado = chk.rows.length > 0;
      } catch (e) {}
      clientes.push({ ...row, ya_enviado: yaEnviado });
    }
    res.json(clientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pendientes: ' + error.message });
  }
};

// Marcar que ya se envio el WhatsApp a un cliente
const marcarEnviadoWhatsApp = async (req, res) => {
  try {
    const { cliente_id, mensaje, plantilla, grupo } = req.body;
    await asegurarColumnas();
    await pool.query(
      `INSERT INTO mensajes_enviados (regla_id, cliente_id, mensaje, estado, plantilla, grupo)
       VALUES (NULL, $1, $2, 'enviado_wa', $3, $4)`,
      [cliente_id, mensaje || 'Postventa WhatsApp', plantilla ? String(plantilla).slice(0, 40) : null, grupo ? String(grupo).slice(0, 40) : null]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al marcar enviado' });
  }
};

// Marcar un mensaje real (generado por una regla) como enviado por WhatsApp
const marcarMensajeEnviado = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE mensajes_enviados SET estado = 'enviado_wa' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al marcar mensaje como enviado' });
  }
};

// Recuperar clientes: los que compraron una sola vez, o los que hace mucho no vuelven, con su
// ultima compra, lo que gastaron y cuando se les escribio por ultima vez. Tambien cuenta cuantos
// de los que recibieron un WhatsApp volvieron a comprar despues (para ver si funciona).
const getRecuperar = async (req, res) => {
  try {
    const grupo = req.query.grupo === 'inactivos' ? 'inactivos' : 'una_compra';
    const dias = Math.min(Math.max(parseInt(req.query.dias) || (grupo === 'inactivos' ? 90 : 30), 1), 3650);
    const VV = VENTA_VALIDA;
    const r = await pool.query(`
      WITH g AS (
        SELECT c.id, c.nombre, c.telefono, COUNT(v.id)::int AS compras, MAX(v.creado_en) AS ultima,
               COALESCE(SUM(v.total), 0) AS gastado
        FROM clientes c JOIN ventas v ON v.cliente_id = c.id
        WHERE ${VV}
        GROUP BY c.id),
      elegidos AS (
        SELECT * FROM g
        WHERE ultima < NOW() - ($1 || ' days')::interval ${grupo === 'una_compra' ? 'AND compras = 1' : ''}),
      u AS (
        SELECT DISTINCT ON (v.cliente_id) v.cliente_id, p.nombre AS producto
        FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id LEFT JOIN productos p ON p.id = vi.producto_id
        WHERE ${VV} AND v.cliente_id IN (SELECT id FROM elegidos)
        ORDER BY v.cliente_id, v.creado_en DESC, vi.id),
      m AS (
        SELECT cliente_id, MAX(creado_en) AS contactado FROM mensajes_enviados
        WHERE estado = 'enviado_wa' AND cliente_id IN (SELECT id FROM elegidos) GROUP BY cliente_id)
      SELECT e.id, e.nombre, e.telefono, e.compras, e.ultima, e.gastado, u.producto, m.contactado,
             EXTRACT(DAY FROM NOW() - e.ultima)::int AS dias
      FROM elegidos e LEFT JOIN u ON u.cliente_id = e.id LEFT JOIN m ON m.cliente_id = e.id
      ORDER BY e.gastado DESC, e.ultima DESC
      LIMIT 1000`, [String(dias)]);

    const t = await pool.query(`
      WITH g AS (SELECT v.cliente_id, COUNT(*) AS compras FROM ventas v WHERE ${VV} AND v.cliente_id IS NOT NULL GROUP BY v.cliente_id)
      SELECT COUNT(*)::int AS con_compras, COUNT(*) FILTER (WHERE compras = 1)::int AS una_compra FROM g`);

    // De los clientes a los que se les escribio en los ultimos 60 dias, cuantos compraron despues
    const e = await pool.query(`
      WITH m AS (SELECT cliente_id, MIN(creado_en) AS desde FROM mensajes_enviados
                 WHERE estado = 'enviado_wa' AND cliente_id IS NOT NULL AND creado_en >= NOW() - INTERVAL '60 days' GROUP BY cliente_id)
      SELECT COUNT(*)::int AS contactados,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM ventas v WHERE v.cliente_id = m.cliente_id AND ${VV} AND v.creado_en > m.desde
               AND v.creado_en <= m.desde + INTERVAL '${DIAS_EFECTO} days'))::int AS volvieron
      FROM m`);

    res.json({ grupo, dias, clientes: r.rows, totales: t.rows[0], efecto: e.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo armar la lista de clientes' });
  }
};

// Resultados de los mensajes: de los clientes a los que se les escribio en el periodo, quienes
// volvieron a comprar dentro de los 30 dias siguientes, cuanto compraron, cuanto tardaron, y
// que modelo de mensaje y que lista funcionan mejor. Se toma el primer mensaje de cada cliente
// en el periodo.
const getResultados = async (req, res) => {
  try {
    await asegurarColumnas();
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 60, 7), 730);
    const VV = VENTA_VALIDA;
    const r = await pool.query(`
      WITH m AS (
        SELECT DISTINCT ON (cliente_id) cliente_id, creado_en AS enviado, plantilla, grupo, regla_id
        FROM mensajes_enviados
        WHERE estado = 'enviado_wa' AND cliente_id IS NOT NULL AND creado_en >= NOW() - ($1 || ' days')::interval
        ORDER BY cliente_id, creado_en)
      SELECT m.cliente_id, m.enviado, m.plantilla, m.grupo, m.regla_id, c.nombre, c.telefono,
             d.volvio_en, COALESCE(d.monto, 0) AS monto, COALESCE(d.compras, 0)::int AS compras,
             (m.enviado + INTERVAL '${DIAS_EFECTO} days' > NOW()) AS en_espera
      FROM m
      LEFT JOIN clientes c ON c.id = m.cliente_id
      LEFT JOIN LATERAL (
        SELECT MIN(v.creado_en) AS volvio_en, SUM(v.total) AS monto, COUNT(*) AS compras
        FROM ventas v
        WHERE v.cliente_id = m.cliente_id AND ${VV}
          AND v.creado_en > m.enviado AND v.creado_en <= m.enviado + INTERVAL '${DIAS_EFECTO} days') d ON TRUE
      ORDER BY d.volvio_en DESC NULLS LAST, m.enviado DESC`, [String(dias)]);

    const filas = r.rows.map(x => ({
      ...x,
      monto: parseFloat(x.monto) || 0,
      volvio: !!x.volvio_en,
      dias_hasta: x.volvio_en ? Math.max(0, Math.round((new Date(x.volvio_en) - new Date(x.enviado)) / 86400000)) : null,
      // Mensajes de antes de guardar el modelo, o los de "Enviar hoy" / reglas
      plantilla: x.plantilla || (x.regla_id ? 'regla' : 'otro'),
      grupo: x.grupo || 'otro',
    }));
    const resumir = (lista) => {
      const volvieron = lista.filter(x => x.volvio);
      const tardanzas = volvieron.map(x => x.dias_hasta);
      return {
        enviados: lista.length,
        volvieron: volvieron.length,
        en_espera: lista.filter(x => !x.volvio && x.en_espera).length,
        ventas: Math.round(volvieron.reduce((a, x) => a + x.monto, 0) * 100) / 100,
        dias_promedio: tardanzas.length ? Math.round(tardanzas.reduce((a, b) => a + b, 0) / tardanzas.length * 10) / 10 : null,
      };
    };
    const agrupar = (campo) => {
      const g = {};
      filas.forEach(x => { (g[x[campo]] = g[x[campo]] || []).push(x); });
      return Object.entries(g).map(([clave, lista]) => ({ clave, ...resumir(lista) })).sort((a, b) => b.enviados - a.enviados);
    };
    res.json({
      dias, dias_efecto: DIAS_EFECTO,
      total: resumir(filas),
      por_plantilla: agrupar('plantilla'),
      por_grupo: agrupar('grupo'),
      volvieron: filas.filter(x => x.volvio).slice(0, 200).map(x => ({ id: x.cliente_id, nombre: x.nombre, enviado: x.enviado, volvio_en: x.volvio_en, dias_hasta: x.dias_hasta, monto: x.monto, compras: x.compras, plantilla: x.plantilla })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron calcular los resultados' });
  }
};

module.exports = { getReglas, createRegla, updateRegla, getMensajes, ejecutarReglas, getPendientesWhatsApp, marcarEnviadoWhatsApp, marcarMensajeEnviado, getRecuperar, getResultados };