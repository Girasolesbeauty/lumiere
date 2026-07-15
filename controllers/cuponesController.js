const pool = require('../config/database');

// Obtener todos los cupones
const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM cupones ORDER BY creado_en DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener cupones' });
  }
};

// Validar cupon
const validar = async (req, res) => {
  try {
    const { codigo } = req.params;
    const { monto } = req.query;

    const result = await pool.query(
      'SELECT * FROM cupones WHERE codigo = $1 AND activo = TRUE', [codigo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valido: false, error: 'Cupon no encontrado o inactivo' });
    }

    const cupon = result.rows[0];

    // Verificar vencimiento
    if (cupon.fecha_vencimiento && new Date(cupon.fecha_vencimiento) < new Date()) {
      return res.status(400).json({ valido: false, error: 'Cupon vencido' });
    }

    // Verificar max usos
    if (cupon.max_usos && cupon.usos >= cupon.max_usos) {
      return res.status(400).json({ valido: false, error: 'Cupon agotado' });
    }

    // Calcular descuento
    let descuento = 0;
    if (monto) {
      if (cupon.tipo === '%') {
        descuento = parseFloat(monto) * (cupon.valor / 100);
      } else {
        descuento = cupon.valor;
      }
    }

    res.json({
      valido: true,
      cupon,
      descuento: descuento.toFixed(2)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al validar cupon' });
  }
};

// Crear cupon
const create = async (req, res) => {
  try {
    const {
      codigo, descripcion, tipo, valor, canal, max_usos, fecha_vencimiento,
      condicion_medio_pago, valor_condicional,
      regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo
    } = req.body;
    const result = await pool.query(
      `INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, max_usos, fecha_vencimiento,
         condicion_medio_pago, valor_condicional, regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        codigo.toUpperCase(), descripcion, tipo, valor, canal, max_usos, fecha_vencimiento,
        condicion_medio_pago || null, valor_condicional || null,
        regalo_producto_id || null, regalo_producto_nombre || null, regalo_monto_minimo || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear cupon' });
  }
};

// Actualizar cupon
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, activo,
      condicion_medio_pago, valor_condicional,
      regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo
    } = req.body;
    const result = await pool.query(
      `UPDATE cupones SET descripcion=$1, tipo=$2, valor=$3, canal=$4,
       max_usos=$5, fecha_vencimiento=$6, activo=$7, condicion_medio_pago=$8, valor_condicional=$9,
       regalo_producto_id=$10, regalo_producto_nombre=$11, regalo_monto_minimo=$12
       WHERE id=$13 RETURNING *`,
      [
        descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, activo,
        condicion_medio_pago || null, valor_condicional || null,
        regalo_producto_id || null, regalo_producto_nombre || null, regalo_monto_minimo || null,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar cupon' });
  }
};

// Eliminar cupon
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE cupones SET activo = FALSE WHERE id = $1', [id]);
    res.json({ mensaje: 'Cupon desactivado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar cupon' });
  }
};

module.exports = { getAll, validar, create, update, remove };