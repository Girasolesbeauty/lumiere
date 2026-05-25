const pool = require('../config/database');

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
      JOIN reglas_postventa r ON m.regla_id = r.id
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

      // Registrar mensajes
      for (const cliente of clientes) {
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

module.exports = { getReglas, createRegla, updateRegla, getMensajes, ejecutarReglas };