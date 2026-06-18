const pool = require('../config/database');

// Generar codigo unico de canje, ej: PREMIO-A7K2
const generarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cod = '';
  for (let i = 0; i < 4; i++) cod += letras[Math.floor(Math.random() * letras.length)];
  return 'PREMIO-' + cod;
};

// Listar premios. Por defecto solo los activos con stock disponible.
// Si se pasa cliente_id, ademas filtra los de "solo cumpleanos" segun el mes actual del cliente.
const getPremios = async (req, res) => {
  try {
    const { cliente_id, todos } = req.query;
    let query = 'SELECT * FROM premios_fidelizacion WHERE 1=1';
    if (!todos) query += ' AND activo = TRUE';
    query += ' ORDER BY puntos_requeridos ASC';
    const result = await pool.query(query);
    let premios = result.rows.map(p => ({
      ...p,
      disponible: p.stock_total === null ? null : Math.max(p.stock_total - (p.stock_usado || 0), 0)
    }));

    if (!todos) {
      premios = premios.filter(p => p.disponible === null || p.disponible > 0);
      if (cliente_id) {
        const clienteRes = await pool.query('SELECT fecha_nacimiento FROM clientes WHERE id = $1', [cliente_id]);
        const fechaNac = clienteRes.rows[0]?.fecha_nacimiento;
        const mesActual = new Date().getMonth() + 1;
        const esMesCumple = fechaNac && (new Date(fechaNac).getMonth() + 1) === mesActual;
        premios = premios.filter(p => !p.solo_mes_cumpleanos || esMesCumple);
      } else {
        premios = premios.filter(p => !p.solo_mes_cumpleanos);
      }
    }
    res.json(premios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener premios' });
  }
};

// Crear premio nuevo
const createPremio = async (req, res) => {
  try {
    const { nombre, descripcion, puntos_requeridos, imagen_url, stock_total, solo_mes_cumpleanos } = req.body;
    if (!nombre || !puntos_requeridos) {
      return res.status(400).json({ error: 'Nombre y puntos requeridos son obligatorios' });
    }
    const result = await pool.query(
      `INSERT INTO premios_fidelizacion (nombre, descripcion, puntos_requeridos, imagen_url, stock_total, solo_mes_cumpleanos)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, descripcion || null, puntos_requeridos, imagen_url || null, stock_total || null, solo_mes_cumpleanos === true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear premio' });
  }
};

// Editar premio existente
const updatePremio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, puntos_requeridos, imagen_url, stock_total, solo_mes_cumpleanos, activo } = req.body;
    const result = await pool.query(
      `UPDATE premios_fidelizacion SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        puntos_requeridos = COALESCE($3, puntos_requeridos),
        imagen_url = COALESCE($4, imagen_url),
        stock_total = $5,
        solo_mes_cumpleanos = COALESCE($6, solo_mes_cumpleanos),
        activo = COALESCE($7, activo)
       WHERE id = $8 RETURNING *`,
      [nombre, descripcion, puntos_requeridos, imagen_url, stock_total, solo_mes_cumpleanos, activo, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Premio no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al editar premio' });
  }
};

// Desactivar premio (no se borra, para conservar el historial de canjes)
const desactivarPremio = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE premios_fidelizacion SET activo = FALSE WHERE id = $1', [id]);
    res.json({ mensaje: 'Premio desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar premio' });
  }
};

// Canjear puntos: genera un codigo de canje, no entrega nada fisico todavia
const canjear = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { cliente_id, premio_id } = req.body;
    if (!cliente_id || !premio_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Faltan datos del canje' });
    }

    const clienteRes = await client.query('SELECT puntos, fecha_nacimiento FROM clientes WHERE id = $1', [cliente_id]);
    if (clienteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const cliente = clienteRes.rows[0];

    const premioRes = await client.query('SELECT * FROM premios_fidelizacion WHERE id = $1 AND activo = TRUE', [premio_id]);
    if (premioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Premio no disponible' });
    }
    const premio = premioRes.rows[0];

    if (premio.solo_mes_cumpleanos) {
      const mesActual = new Date().getMonth() + 1;
      const esMesCumple = cliente.fecha_nacimiento && (new Date(cliente.fecha_nacimiento).getMonth() + 1) === mesActual;
      if (!esMesCumple) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Este premio es exclusivo del mes de tu cumpleanos' });
      }
    }

    if (premio.stock_total !== null) {
      const disponible = premio.stock_total - (premio.stock_usado || 0);
      if (disponible <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Este premio ya no tiene stock disponible' });
      }
    }

    if (cliente.puntos < premio.puntos_requeridos) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Puntos insuficientes' });
    }

    await client.query('UPDATE clientes SET puntos = puntos - $1 WHERE id = $2', [premio.puntos_requeridos, cliente_id]);
    await client.query('UPDATE premios_fidelizacion SET stock_usado = COALESCE(stock_usado, 0) + 1 WHERE id = $1', [premio_id]);

    let codigo;
    let intentos = 0;
    while (intentos < 10) {
      codigo = generarCodigo();
      const existe = await client.query('SELECT id FROM canjes_premios WHERE codigo = $1', [codigo]);
      if (existe.rows.length === 0) break;
      intentos++;
    }

    const canjeRes = await client.query(
      `INSERT INTO canjes_premios (premio_id, cliente_id, codigo, puntos_usados, estado)
       VALUES ($1, $2, $3, $4, 'pendiente') RETURNING *`,
      [premio_id, cliente_id, codigo, premio.puntos_requeridos]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Canje realizado correctamente', codigo, canje: canjeRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al realizar canje' });
  } finally {
    client.release();
  }
};

// Listar canjes pendientes/usados, para que la vendedora los valide en el local
const getCanjes = async (req, res) => {
  try {
    const { estado } = req.query;
    let query = `
      SELECT cp.*, p.nombre AS premio_nombre, p.imagen_url, c.nombre AS cliente_nombre
      FROM canjes_premios cp
      JOIN premios_fidelizacion p ON cp.premio_id = p.id
      JOIN clientes c ON cp.cliente_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); query += ` AND cp.estado = $${params.length}`; }
    query += ' ORDER BY cp.creado_en DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener canjes' });
  }
};

// Validar un codigo de canje (la vendedora lo confirma en el local)
const validarCanje = async (req, res) => {
  try {
    const { codigo, usuario_nombre } = req.body;
    const result = await pool.query('SELECT * FROM canjes_premios WHERE codigo = $1', [codigo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Codigo no encontrado' });
    }
    const canje = result.rows[0];
    if (canje.estado === 'usado') {
      return res.status(400).json({ error: 'Este codigo ya fue canjeado el ' + new Date(canje.usado_en).toLocaleDateString('es-AR') + (canje.usado_por ? ' por ' + canje.usado_por : '') });
    }
    const actualizado = await pool.query(
      `UPDATE canjes_premios SET estado = 'usado', usado_en = NOW(), usado_por = $1 WHERE codigo = $2 RETURNING *`,
      [usuario_nombre || null, codigo]
    );
    res.json({ mensaje: 'Canje validado correctamente', canje: actualizado.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error al validar el canje' });
  }
};

// Ranking de clientes por puntos
const getRanking = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, email, puntos, nivel, total_compras
      FROM clientes
      ORDER BY puntos DESC
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ranking' });
  }
};

module.exports = { getPremios, createPremio, updatePremio, desactivarPremio, canjear, getCanjes, validarCanje, getRanking };