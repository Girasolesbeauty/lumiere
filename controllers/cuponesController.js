const pool = require('../config/database');
const cuponesLib = require('../lib/cupones');

// Obtener todos los cupones
const getAll = async (req, res) => {
  try {
    // Los personales (los gano una clienta) traen el nombre de la duena; el DNI y el WhatsApp no viajan
    const ok = await cuponesLib.asegurar();
    const result = await pool.query(ok
      ? `SELECT cu.*, cl.nombre AS duena_nombre, (cu.cliente_id IS NOT NULL OR cu.dueno_dni IS NOT NULL OR cu.dueno_tel IS NOT NULL) AS personal,
           (SELECT COUNT(*)::int FROM cupon_usos u LEFT JOIN ventas v ON v.id = u.venta_id WHERE u.cupon_id = cu.id AND NOT u.anulado AND NOT COALESCE(v.anulada, FALSE)) AS clientas_usaron
         FROM cupones cu LEFT JOIN clientes cl ON cl.id = cu.cliente_id ORDER BY cu.creado_en DESC`
      : 'SELECT * FROM cupones ORDER BY creado_en DESC');
    result.rows.forEach(r => { delete r.dueno_dni; delete r.dueno_tel; });
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
    await cuponesLib.asegurar();
    // Personal o "uno por clienta": se revisa con la clienta elegida en la caja
    const deOtra = await cuponesLib.revisarClienta(pool, cupon, { cliente_id: parseInt(req.query.cliente_id) || null }, 'caja');
    if (deOtra) return res.status(400).json({ valido: false, error: deOtra });
    delete cupon.dueno_dni; delete cupon.dueno_tel;

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
      regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo,
      descuento_monto_minimo, uno_por_clienta
    } = req.body;
    await cuponesLib.asegurar();
    const result = await pool.query(
      `INSERT INTO cupones (codigo, descripcion, tipo, valor, canal, max_usos, fecha_vencimiento,
         condicion_medio_pago, valor_condicional, regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo,
         descuento_monto_minimo, uno_por_clienta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        codigo.toUpperCase(), descripcion, tipo, valor, canal, max_usos, fecha_vencimiento,
        condicion_medio_pago || null, valor_condicional || null,
        regalo_producto_id || null, regalo_producto_nombre || null, regalo_monto_minimo || null,
        descuento_monto_minimo || null, !!uno_por_clienta
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') return res.status(400).json({ error: 'Ya hay un cupón con ese código. Elegí otro.' });
    res.status(500).json({ error: 'Error al crear cupon: ' + error.message });
  }
};

// Actualizar cupon
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, activo,
      condicion_medio_pago, valor_condicional,
      regalo_producto_id, regalo_producto_nombre, regalo_monto_minimo,
      descuento_monto_minimo, uno_por_clienta
    } = req.body;
    await cuponesLib.asegurar();
    const result = await pool.query(
      `UPDATE cupones SET descripcion=$1, tipo=$2, valor=$3, canal=$4,
       max_usos=$5, fecha_vencimiento=$6, activo=$7, condicion_medio_pago=$8, valor_condicional=$9,
       regalo_producto_id=$10, regalo_producto_nombre=$11, regalo_monto_minimo=$12,
       descuento_monto_minimo=$13, uno_por_clienta = COALESCE($15, uno_por_clienta)
       WHERE id=$14 RETURNING *`,
      [
        descripcion, tipo, valor, canal, max_usos, fecha_vencimiento, activo,
        condicion_medio_pago || null, valor_condicional || null,
        regalo_producto_id || null, regalo_producto_nombre || null, regalo_monto_minimo || null,
        descuento_monto_minimo || null,
        id, typeof uno_por_clienta === 'boolean' ? uno_por_clienta : null
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') return res.status(400).json({ error: 'Ya hay un cupón con ese código. Elegí otro.' });
    res.status(500).json({ error: 'Error al actualizar cupon: ' + error.message });
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