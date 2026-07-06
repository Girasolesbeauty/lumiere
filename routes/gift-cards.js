const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Genera un código único tipo GIFT-A7K2
function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return 'GIFT-' + c;
}

// Listar gift cards (opcional filtro por estado y local)
router.get('/', async (req, res) => {
  try {
    const { local_id, estado } = req.query;
    let query = `
      SELECT gc.*, c.nombre AS cliente_nombre
      FROM gift_cards gc
      LEFT JOIN clientes c ON gc.cliente_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (local_id) { params.push(local_id); query += ` AND gc.local_id = $${params.length}`; }
    if (estado) { params.push(estado); query += ` AND gc.estado = $${params.length}`; }
    query += ' ORDER BY gc.creado_en DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener gift cards' });
  }
});

// Buscar por código (para canje en POS)
router.get('/codigo/:codigo', async (req, res) => {
  try {
    const codigo = (req.params.codigo || '').trim().toUpperCase();
    const result = await pool.query(
      `SELECT gc.*, c.nombre AS cliente_nombre
       FROM gift_cards gc
       LEFT JOIN clientes c ON gc.cliente_id = c.id
       WHERE UPPER(gc.codigo) = $1`, [codigo]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gift card no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar gift card' });
  }
});

// Ver movimientos de una gift card
router.get('/:id/movimientos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gift_card_movimientos WHERE gift_card_id = $1 ORDER BY creado_en DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// Emitir una nueva gift card
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      monto, beneficiario_nombre, beneficiario_telefono, beneficiario_dni,
      cliente_id, comprador_nombre, local_id, emitida_por, migracion
    } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El monto debe ser mayor a cero' });
    }
    if (!beneficiario_nombre) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Falta el nombre del beneficiario' });
    }

    // Generar código único (reintenta si choca)
    let codigo;
    let intentos = 0;
    while (intentos < 10) {
      codigo = generarCodigo();
      const existe = await client.query('SELECT 1 FROM gift_cards WHERE codigo = $1', [codigo]);
      if (existe.rows.length === 0) break;
      intentos++;
    }

    const montoNum = parseFloat(monto);
    const gc = await client.query(
      `INSERT INTO gift_cards
        (codigo, monto_inicial, saldo, beneficiario_nombre, beneficiario_telefono, beneficiario_dni,
         cliente_id, comprador_nombre, estado, local_id, emitida_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activa', $9, $10) RETURNING *`,
      [
        codigo, montoNum, montoNum, beneficiario_nombre,
        beneficiario_telefono || null, beneficiario_dni || null,
        cliente_id || null, comprador_nombre || null, local_id || 1, emitida_por || null
      ]
    );

    const gcId = gc.rows[0].id;
    await client.query(
      `INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante, usuario_id)
       VALUES ($1, 'emision', $2, $3, $4)`,
      [gcId, montoNum, montoNum, emitida_por || null]
    );

    // Si es una gift card de migración (ya vendida con el software viejo), NO cuenta como ingreso de hoy.
    if (migracion !== true) {
      // La emisión entra como ingreso de caja (NO se factura por ARCA hasta el canje)
      await client.query(
        `INSERT INTO movimientos_caja (concepto, tipo, importe, referencia, local_id)
         VALUES ($1, 'I', $2, $3, $4)`,
        ['Gift Card ' + codigo, montoNum, codigo, local_id || 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(gc.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al emitir gift card: ' + error.message });
  } finally {
    client.release();
  }
});

// Canjear (descontar saldo) - se usará en la Entrega 2 desde el POS
router.post('/:id/canjear', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { importe, venta_id, usuario_id } = req.body;
    const gcRes = await client.query('SELECT * FROM gift_cards WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (gcRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Gift card no encontrada' });
    }
    const gc = gcRes.rows[0];
    const imp = parseFloat(importe);
    if (imp <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Importe inválido' });
    }
    if (parseFloat(gc.saldo) < imp) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente. Disponible: $' + gc.saldo });
    }

    const nuevoSaldo = parseFloat(gc.saldo) - imp;
    const nuevoEstado = nuevoSaldo <= 0 ? 'agotada' : 'activa';
    await client.query(
      'UPDATE gift_cards SET saldo = $1, estado = $2 WHERE id = $3',
      [nuevoSaldo, nuevoEstado, gc.id]
    );
    await client.query(
      `INSERT INTO gift_card_movimientos (gift_card_id, tipo, importe, saldo_resultante, venta_id, usuario_id)
       VALUES ($1, 'canje', $2, $3, $4, $5)`,
      [gc.id, imp, nuevoSaldo, venta_id || null, usuario_id || null]
    );

    await client.query('COMMIT');
    res.json({ saldo: nuevoSaldo, estado: nuevoEstado });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al canjear gift card' });
  } finally {
    client.release();
  }
});

module.exports = router;