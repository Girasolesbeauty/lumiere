const pool = require('../config/database');
const { recalcularNivel, recalcularTodos, obtenerUmbrales, asegurarColumna, UMBRALES_POR_DEFECTO } = require('../lib/niveles');

// Lista de clientes con sus numeros de compra (cuantas veces, cuanto, ultima vez). Nunca se manda
// la contrasena del portal: solo si ya se registro.
const getAll = async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let filtro = '';
    if (local_id) { params.push(local_id); filtro = `WHERE c.local_id = $${params.length}`; }
    const result = await pool.query(`
      SELECT c.id, c.nombre, c.email, c.cuit_dni, c.telefono, c.fecha_nacimiento, c.puntos, c.nivel,
             c.total_compras, c.local_id, c.creado_en,
             (c.password_hash IS NOT NULL) AS portal_activo, c.portal_registrado_en,
             COALESCE(s.compras, 0)::int AS compras, COALESCE(s.gastado, 0) AS gastado, s.ultima_compra
      FROM clientes c
      LEFT JOIN (
        SELECT v.cliente_id, COUNT(*) AS compras, SUM(v.total) AS gastado, MAX(v.creado_en) AS ultima_compra
        FROM ventas v
        WHERE COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
          AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada') AND v.total > 0
        GROUP BY v.cliente_id
      ) s ON s.cliente_id = c.id
      ${filtro}
      ORDER BY c.nombre ASC`, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

// Resumen del portal de clientes: cuantas pueden entrar (tienen DNI) y cuantas ya se registraron
const getPortalResumen = async (req, res) => {
  try {
    await pool.query('ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS portal_url TEXT');
    const [tot, ult, cfg] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS clientes,
                         COUNT(*) FILTER (WHERE COALESCE(cuit_dni, '') <> '')::int AS con_dni,
                         COUNT(*) FILTER (WHERE password_hash IS NOT NULL)::int AS registrados,
                         COUNT(*) FILTER (WHERE portal_registrado_en >= date_trunc('month', NOW()))::int AS registrados_mes
                  FROM clientes`),
      pool.query(`SELECT id, nombre, nivel, portal_registrado_en FROM clientes
                  WHERE password_hash IS NOT NULL ORDER BY portal_registrado_en DESC NULLS LAST LIMIT 8`),
      pool.query('SELECT portal_url FROM configuracion_negocio WHERE id = 1'),
    ]);
    res.json({ ...tot.rows[0], ultimos: ult.rows, portal_url: (cfg.rows[0] && cfg.rows[0].portal_url) || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al leer el portal' });
  }
};

// Vista previa: lo mismo que ve esta clienta cuando entra al portal (puntos, nivel, compras, premios)
const getPortalVista = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [cli, compras, premios, canjes] = await Promise.all([
      pool.query('SELECT id, nombre, puntos, nivel, fecha_nacimiento, (password_hash IS NOT NULL) AS portal_activo FROM clientes WHERE id = $1', [id]),
      pool.query(
        `SELECT v.id, v.total, v.creado_en, COALESCE(v.canal, 'presencial') AS canal,
           COALESCE(json_agg(json_build_object('nombre', p.nombre, 'cantidad', vi.cantidad)) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
         FROM ventas v LEFT JOIN venta_items vi ON vi.venta_id = v.id LEFT JOIN productos p ON vi.producto_id = p.id
         WHERE v.cliente_id = $1 AND COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.es_preventa, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
         GROUP BY v.id ORDER BY v.creado_en DESC LIMIT 20`, [id]),
      pool.query('SELECT id, nombre, descripcion, puntos_requeridos, stock_total, stock_usado, solo_mes_cumpleanos, nivel_minimo FROM premios_fidelizacion WHERE activo = TRUE ORDER BY puntos_requeridos ASC').catch(() => ({ rows: [] })),
      pool.query(`SELECT cp.codigo, cp.estado, cp.creado_en, p.nombre AS premio_nombre FROM canjes_premios cp JOIN premios_fidelizacion p ON p.id = cp.premio_id
                  WHERE cp.cliente_id = $1 ORDER BY cp.creado_en DESC LIMIT 10`, [id]).catch(() => ({ rows: [] })),
    ]);
    if (!cli.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const umbrales = await obtenerUmbrales();
    res.json({ cliente: cli.rows[0], compras: compras.rows, premios: premios.rows, canjes: canjes.rows, umbrales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al armar la vista del portal' });
  }
};

// Montos de cada nivel (lo que la clienta tiene que haber comprado en total)
const getNiveles = async (req, res) => {
  try {
    const umbrales = await obtenerUmbrales();
    const r = await pool.query(`SELECT COALESCE(nivel, 'Bronze') AS nivel, COUNT(*)::int AS cantidad FROM clientes GROUP BY 1`);
    const cantidades = {};
    r.rows.forEach(x => { cantidades[x.nivel] = x.cantidad; });
    res.json({ umbrales, por_defecto: UMBRALES_POR_DEFECTO, cantidades });
  } catch (error) {
    res.status(500).json({ error: 'Error al leer los niveles' });
  }
};
const guardarNiveles = async (req, res) => {
  try {
    const u = {};
    for (const k of ['Silver', 'Gold', 'Platinum', 'Black']) {
      const v = parseFloat(req.body[k]);
      if (!(v > 0)) return res.status(400).json({ error: 'Falta el monto de ' + k });
      u[k] = Math.round(v);
    }
    if (!(u.Silver < u.Gold && u.Gold < u.Platinum && u.Platinum < u.Black)) {
      return res.status(400).json({ error: 'Cada nivel tiene que pedir más que el anterior (Silver < Gold < Platinum < Black)' });
    }
    await asegurarColumna(pool);
    await pool.query('UPDATE configuracion_negocio SET niveles_umbrales = $1 WHERE id = 1', [JSON.stringify(u)]);
    const actualizados = await recalcularTodos(pool);
    res.json({ ok: true, umbrales: u, clientes_actualizados: actualizados });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar los niveles: ' + error.message });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    // La contrasena del portal nunca sale del servidor
    const { password_hash, ...cliente } = result.rows[0];
    res.json({ ...cliente, portal_activo: !!password_hash });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cliente' });
  }
};

const create = async (req, res) => {
  try {
    const { nombre, email, cuit_dni, telefono, fecha_nacimiento, local_id } = req.body;
    // Evitar clientes duplicados por DNI/CUIT
    const dniLimpio = (cuit_dni || '').replace(/[^0-9]/g, '');
    if (dniLimpio) {
      const existe = await pool.query(
        "SELECT id, nombre FROM clientes WHERE REGEXP_REPLACE(cuit_dni, '[^0-9]', '', 'g') = $1",
        [dniLimpio]
      );
      if (existe.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un cliente con ese DNI/CUIT: ' + existe.rows[0].nombre });
      }
    }
    const result = await pool.query(
      `INSERT INTO clientes (nombre, email, cuit_dni, telefono, fecha_nacimiento, local_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, email || null, cuit_dni || null, telefono, (fecha_nacimiento && fecha_nacimiento !== '') ? fecha_nacimiento : null, local_id || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, cuit_dni, telefono, fecha_nacimiento } = req.body;
    const result = await pool.query(
      `UPDATE clientes SET nombre=$1, email=$2, cuit_dni=$3, telefono=$4, fecha_nacimiento=$5
       WHERE id=$6 RETURNING *`,
      [nombre, email || null, cuit_dni || null, telefono, (fecha_nacimiento && fecha_nacimiento !== '') ? fecha_nacimiento : null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar cliente' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar cliente' });
  }
};

const getHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT v.*, 
        json_agg(json_build_object(
          'producto', p.nombre,
          'cantidad', vi.cantidad,
          'precio', vi.precio_unitario,
          'subtotal', vi.subtotal
        )) AS items
       FROM ventas v
       JOIN venta_items vi ON v.id = vi.venta_id
       JOIN productos p ON vi.producto_id = p.id
       WHERE v.cliente_id = $1
       GROUP BY v.id
       ORDER BY v.creado_en DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

const agregarPuntos = async (req, res) => {
  try {
    const { id } = req.params;
    const { puntos } = req.body;
    const result = await pool.query(
      'UPDATE clientes SET puntos = puntos + $1 WHERE id = $2 RETURNING *',
      [puntos, id]
    );
    const cliente = result.rows[0];
    // Sumar puntos a mano no cambia lo que compro: el nivel queda como esta
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar puntos' });
  }
};

// Resetea la contrasena del portal: borra el hash para que la clienta se registre de nuevo con su DNI
const resetearPortal = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE clientes SET password_hash = NULL WHERE id = $1', [id]);
    res.json({ ok: true, mensaje: 'Contrasena del portal reseteada. La clienta puede volver a registrarse con su DNI.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al resetear la contrasena del portal' });
  }
};

// Migrar puntos de una compra anterior (no factura, solo suma puntos). 1 punto cada $100.
// Control de duplicados: avisa si ya hay una carga con el mismo monto y fecha para ese cliente.
const migrarPuntos = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { monto, fecha_compra, usuario_id, confirmar_duplicado } = req.body;

    const montoNum = parseFloat(monto) || 0;
    if (montoNum <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
    }

    // Control de duplicado: misma clienta, mismo monto, misma fecha
    if (fecha_compra && !confirmar_duplicado) {
      const dup = await client.query(
        'SELECT id FROM migracion_puntos WHERE cliente_id = $1 AND monto = $2 AND fecha_compra = $3',
        [id, montoNum, fecha_compra]
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          posible_duplicado: true,
          error: 'Ya hay una carga con ese mismo monto y fecha para esta clienta. Puede ser un duplicado.'
        });
      }
    }

    const puntos = Math.floor(montoNum / 100);

    // Sumar puntos al cliente y recalcular nivel
    const upd = await client.query(
      'UPDATE clientes SET puntos = COALESCE(puntos, 0) + $1 WHERE id = $2 RETURNING *',
      [puntos, id]
    );
    if (upd.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const cliente = upd.rows[0];

    // Registrar la migracion (para historial y control de duplicados)
    await client.query(
      `INSERT INTO migracion_puntos (cliente_id, monto, fecha_compra, puntos, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, montoNum, fecha_compra || null, puntos, usuario_id || null]
    );
    // La compra migrada cuenta para el nivel (lo que compro en total)
    const nivel = await recalcularNivel(client, id);

    await client.query('COMMIT');
    res.status(201).json({ ok: true, puntos_sumados: puntos, puntos_totales: cliente.puntos, nivel });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al migrar puntos: ' + error.message });
  } finally {
    client.release();
  }
};

// Historial de migraciones de puntos de una clienta
const getMigracionPuntos = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      'SELECT * FROM migracion_puntos WHERE cliente_id = $1 ORDER BY creado_en DESC',
      [id]
    );
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de migracion' });
  }
};

module.exports = { getNiveles, guardarNiveles, getPortalResumen, getPortalVista, getAll, getById, create, update, remove, getHistorial, agregarPuntos, resetearPortal, migrarPuntos, getMigracionPuntos };