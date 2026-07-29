const pool = require('../config/database');

// Listar controles de un local (historial)
const getControles = async (req, res) => {
  try {
    const { local_id } = req.query;
    const params = [];
    let q = 'SELECT * FROM controles_inventario WHERE 1=1';
    if (local_id) { params.push(local_id); q += ` AND local_id = $${params.length}`; }
    q += ' ORDER BY creado_en DESC LIMIT 50';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Configuracion de avisos (cada cuanto recordar hacer un control)
const getConfig = async (req, res) => {
  try {
    const { local_id } = req.query;
    const r = await pool.query('SELECT * FROM config_control_inventario WHERE local_id = $1', [local_id || 1]);
    if (r.rows.length === 0) {
      return res.json({ local_id: parseInt(local_id) || 1, avisos_activos: true, dias_aviso: 30, ultimo_control: null });
    }
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const guardarConfig = async (req, res) => {
  try {
    const { local_id, avisos_activos, dias_aviso } = req.body;
    await pool.query(
      `INSERT INTO config_control_inventario (local_id, avisos_activos, dias_aviso)
       VALUES ($1, $2, $3)
       ON CONFLICT (local_id) DO UPDATE SET avisos_activos = $2, dias_aviso = $3`,
      [local_id || 1, avisos_activos !== false, dias_aviso || 30]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Crear un control nuevo: total, por categoria, por marca, o por proveedor
const crearControl = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { tipo, categoria, marca, proveedor_id, local_id, usuario_id, usuario_nombre } = req.body;
    const localNum = local_id === 2 || local_id === '2' ? 2 : 1;
    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';

    let filtroValor = null;
    let where = 'WHERE p.activo = TRUE';
    const params = [];
    if (tipo === 'categoria') {
      if (!categoria) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegi una categoria' }); }
      filtroValor = categoria;
      params.push(categoria); where += ` AND p.categoria = $${params.length}`;
    } else if (tipo === 'marca') {
      if (!marca) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegi una marca' }); }
      filtroValor = marca;
      params.push(marca); where += ` AND p.marca = $${params.length}`;
    } else if (tipo === 'proveedor') {
      if (!proveedor_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elegi un proveedor' }); }
      filtroValor = String(proveedor_id);
      params.push(proveedor_id); where += ` AND p.proveedor_id = $${params.length}`;
    }

    const prods = await client.query(
      `SELECT p.id, p.nombre, p.marca, p.categoria, p.${colStock} AS stock_sistema
       FROM productos p ${where} ORDER BY p.nombre ASC`,
      params
    );

    if (prods.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay productos activos que coincidan con ese filtro' });
    }

    const controlRes = await client.query(
      `INSERT INTO controles_inventario (tipo, filtro_valor, local_id, usuario_id, usuario_nombre, estado)
       VALUES ($1, $2, $3, $4, $5, 'en_curso') RETURNING *`,
      [tipo, filtroValor, localNum, usuario_id || null, usuario_nombre || null]
    );
    const control = controlRes.rows[0];

    for (const prod of prods.rows) {
      await client.query(
        `INSERT INTO controles_inventario_items (control_id, producto_id, producto_nombre, producto_marca, producto_categoria, stock_sistema, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')`,
        [control.id, prod.id, prod.nombre, prod.marca, prod.categoria, prod.stock_sistema || 0]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(control);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
};

// Ver un control con todos sus items
const getControl = async (req, res) => {
  try {
    const { id } = req.params;
    const c = await pool.query('SELECT * FROM controles_inventario WHERE id = $1', [id]);
    if (c.rows.length === 0) return res.status(404).json({ error: 'Control no encontrado' });
    const items = await pool.query('SELECT * FROM controles_inventario_items WHERE control_id = $1 ORDER BY producto_nombre ASC', [id]);
    res.json({ ...c.rows[0], items: items.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Registrar el conteo de un item puntual
const contarItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { stock_contado } = req.body;
    const itemRes = await pool.query('SELECT * FROM controles_inventario_items WHERE id = $1', [itemId]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
    const item = itemRes.rows[0];
    const contado = parseInt(stock_contado);
    if (isNaN(contado)) return res.status(400).json({ error: 'Cantidad invalida' });
    const diferencia = contado - (item.stock_sistema || 0);
    const estado = diferencia === 0 ? 'correcto' : diferencia < 0 ? 'faltante' : 'sobrante';
    const upd = await pool.query(
      `UPDATE controles_inventario_items SET stock_contado = $1, diferencia = $2, estado = $3 WHERE id = $4 RETURNING *`,
      [contado, diferencia, estado, itemId]
    );
    res.json(upd.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Finalizar un control: cuenta totales, y opcionalmente ajusta el stock real
const finalizarControl = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { ajustar_stock, usuario_id, usuario_nombre, notas } = req.body;

    const cRes = await client.query('SELECT * FROM controles_inventario WHERE id = $1', [id]);
    if (cRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Control no encontrado' }); }
    const control = cRes.rows[0];
    const colStock = control.local_id === 2 ? 'stock_ush' : 'stock_rg';

    const items = await client.query('SELECT * FROM controles_inventario_items WHERE control_id = $1', [id]);
    let correctos = 0, faltantes = 0, sobrantes = 0;

    for (const it of items.rows) {
      if (it.estado === 'correcto') correctos++;
      else if (it.estado === 'faltante') faltantes++;
      else if (it.estado === 'sobrante') sobrantes++;

      if (ajustar_stock === true && it.stock_contado !== null && it.stock_contado !== undefined) {
        await client.query(
          `UPDATE productos SET ${colStock} = $1,
             stock = CASE WHEN '${colStock}' = 'stock_rg' THEN $1 + COALESCE(stock_ush,0) ELSE COALESCE(stock_rg,0) + $1 END
           WHERE id = $2`,
          [it.stock_contado, it.producto_id]
        );
        try {
          await client.query(
            `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [it.producto_id, it.stock_sistema, it.stock_contado, it.diferencia, 'Control de inventario #' + id, usuario_id || null, usuario_nombre || null, control.local_id]
          );
        } catch (e2) { /* si no existe la tabla ajustes_stock en este entorno, no frenar el resto */ }
      }
    }

    await client.query(
      `UPDATE controles_inventario SET estado='finalizado', ajustar_stock=$1, notas=$2, items_correctos=$3, items_faltantes=$4, items_sobrantes=$5, finalizado_en=NOW() WHERE id=$6`,
      [ajustar_stock === true, notas || null, correctos, faltantes, sobrantes, id]
    );
    await client.query(
      `INSERT INTO config_control_inventario (local_id, ultimo_control) VALUES ($1, NOW())
       ON CONFLICT (local_id) DO UPDATE SET ultimo_control = NOW()`,
      [control.local_id]
    );

    await client.query('COMMIT');
    res.json({ correctos, faltantes, sobrantes, ajustado: ajustar_stock === true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
};

// Cancelar (borrar) un control en curso
const cancelarControl = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM controles_inventario WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { getControles, getConfig, guardarConfig, crearControl, getControl, contarItem, finalizarControl, cancelarControl };