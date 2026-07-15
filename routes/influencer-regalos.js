const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Genera un codigo unico de canje, ej: REGALO-A7K2
const generarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let cod = '';
  for (let i = 0; i < 4; i++) cod += letras[Math.floor(Math.random() * letras.length)];
  return 'REGALO-' + cod;
};

// Listar regalos (opcionalmente por influencer o por estado)
router.get('/', async (req, res) => {
  try {
    const { influencer_id, estado } = req.query;
    let query = `
      SELECT r.*, i.nombre AS influencer_nombre
      FROM influencer_regalos r
      JOIN influencers i ON i.id = r.influencer_id
      WHERE 1=1
    `;
    const params = [];
    if (influencer_id) { params.push(influencer_id); query += ` AND r.influencer_id = $${params.length}`; }
    if (estado) { params.push(estado); query += ` AND r.estado = $${params.length}`; }
    query += ' ORDER BY r.creado_en DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener regalos: ' + error.message });
  }
});

// Asignar un regalo nuevo a una influencer, por campana
router.post('/', async (req, res) => {
  try {
    const { influencer_id, producto_id, producto_nombre, campana } = req.body;
    if (!influencer_id) return res.status(400).json({ error: 'Falta la influencer' });
    if (!producto_id && !producto_nombre) return res.status(400).json({ error: 'Elegi un producto del catalogo o escribi el nombre del regalo' });

    let nombreFinal = producto_nombre || null;
    if (producto_id) {
      const p = await pool.query('SELECT nombre FROM productos WHERE id = $1', [producto_id]);
      if (p.rows.length > 0) nombreFinal = p.rows[0].nombre;
    }

    let codigo, intentos = 0;
    while (intentos < 10) {
      codigo = generarCodigo();
      const existe = await pool.query('SELECT id FROM influencer_regalos WHERE codigo = $1', [codigo]);
      if (existe.rows.length === 0) break;
      intentos++;
    }

    const result = await pool.query(
      `INSERT INTO influencer_regalos (influencer_id, producto_id, producto_nombre, campana, codigo, estado)
       VALUES ($1, $2, $3, $4, $5, 'pendiente') RETURNING *`,
      [influencer_id, producto_id || null, nombreFinal, campana || null, codigo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al asignar el regalo: ' + error.message });
  }
});

// Cancelar un regalo que todavia no fue retirado (por error de carga)
router.put('/:id/cancelar', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE influencer_regalos SET estado = 'cancelado' WHERE id = $1 AND estado = 'pendiente' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Solo se puede cancelar un regalo que todavia no fue retirado' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar' });
  }
});

// Validar un codigo en el local: lo marca como entregado y descuenta el stock si es un producto del catalogo
router.post('/validar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { codigo, usuario_nombre, local_id } = req.body;
    if (!codigo || !codigo.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta el codigo' });
    }

    const result = await client.query('SELECT * FROM influencer_regalos WHERE codigo = $1', [codigo.trim().toUpperCase()]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Codigo no encontrado' });
    }
    const regalo = result.rows[0];

    if (regalo.estado === 'entregado') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este regalo ya fue entregado el ' + new Date(regalo.entregado_en).toLocaleDateString('es-AR') + (regalo.entregado_por ? ' por ' + regalo.entregado_por : '') });
    }
    if (regalo.estado === 'cancelado') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este regalo fue cancelado' });
    }

    const lid = parseInt(local_id) || 1;
    if (regalo.producto_id) {
      const colStock = lid === 2 ? 'stock_ush' : 'stock_rg';
      await client.query(
        `UPDATE productos SET ${colStock} = COALESCE(${colStock}, 0) - 1,
           stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) - 1
         WHERE id = $1`,
        [regalo.producto_id]
      );
    }

    const actualizado = await client.query(
      `UPDATE influencer_regalos SET estado = 'entregado', entregado_en = NOW(), entregado_por = $1, local_entrega_id = $2 WHERE id = $3 RETURNING *`,
      [usuario_nombre || null, lid, regalo.id]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Regalo entregado correctamente', regalo: actualizado.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al validar: ' + error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
