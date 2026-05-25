const pool = require('../config/database');

// Obtener premios disponibles
const getPremios = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener premios' });
  }
};

// Crear premio
const createPremio = async (req, res) => {
  try {
    const { nombre, marca, puntos_requeridos, stock } = req.body;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, categoria)
       VALUES ($1, $2, 0, 0, $3, 'premio') RETURNING *`,
      [nombre, marca, stock]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear premio' });
  }
};

// Canjear puntos
const canjear = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { cliente_id, producto_id, puntos_requeridos } = req.body;

    // Verificar puntos del cliente
    const clienteResult = await client.query(
      'SELECT puntos FROM clientes WHERE id = $1', [cliente_id]
    );

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const puntosCliente = clienteResult.rows[0].puntos;

    if (puntosCliente < puntos_requeridos) {
      return res.status(400).json({ error: 'Puntos insuficientes' });
    }

    // Descontar puntos
    await client.query(
      'UPDATE clientes SET puntos = puntos - $1 WHERE id = $2',
      [puntos_requeridos, cliente_id]
    );

    // Descontar stock del premio
    await client.query(
      'UPDATE productos SET stock = stock - 1 WHERE id = $1',
      [producto_id]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Canje realizado correctamente', puntos_utilizados: puntos_requeridos });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al realizar canje' });
  } finally {
    client.release();
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

module.exports = { getPremios, createPremio, canjear, getRanking };