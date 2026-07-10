const pool = require('../config/database');

const getAll = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = 'SELECT * FROM clientes';
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` WHERE local_id = $${params.length}`;
    }
    query += ' ORDER BY nombre ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(result.rows[0]);
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
      [nombre, email, cuit_dni, telefono, fecha_nacimiento, local_id || 1]
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
      [nombre, email, cuit_dni, telefono, fecha_nacimiento, id]
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
    let nivel = 'Bronze';
    if (cliente.puntos >= 20000) nivel = 'Black';
    else if (cliente.puntos >= 10000) nivel = 'Platinum';
    else if (cliente.puntos >= 5000) nivel = 'Gold';
    else if (cliente.puntos >= 2000) nivel = 'Silver';
    await pool.query('UPDATE clientes SET nivel = $1 WHERE id = $2', [nivel, id]);
    res.json({ ...cliente, nivel });
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
    let nivel = 'Bronze';
    if (cliente.puntos >= 20000) nivel = 'Black';
    else if (cliente.puntos >= 10000) nivel = 'Platinum';
    else if (cliente.puntos >= 5000) nivel = 'Gold';
    else if (cliente.puntos >= 2000) nivel = 'Silver';
    await client.query('UPDATE clientes SET nivel = $1 WHERE id = $2', [nivel, id]);

    // Registrar la migracion (para historial y control de duplicados)
    await client.query(
      `INSERT INTO migracion_puntos (cliente_id, monto, fecha_compra, puntos, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, montoNum, fecha_compra || null, puntos, usuario_id || null]
    );

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

module.exports = { getAll, getById, create, update, remove, getHistorial, agregarPuntos, resetearPortal, migrarPuntos, getMigracionPuntos };