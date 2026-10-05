const pool = require('../config/database');
const { porNegocio } = require('../lib/contexto');

// Columnas que se agregaron despues (se crean solas la primera vez)
const columnasListas = porNegocio(false);
const asegurarColumnas = async (db) => {
  if (columnasListas.get()) return;
  await db.query('ALTER TABLE controles_inventario ADD COLUMN IF NOT EXISTS valor_faltante NUMERIC DEFAULT 0');
  await db.query('ALTER TABLE controles_inventario ADD COLUMN IF NOT EXISTS valor_sobrante NUMERIC DEFAULT 0');
  await db.query('ALTER TABLE controles_inventario ADD COLUMN IF NOT EXISTS unidades_faltantes INTEGER DEFAULT 0');
  await db.query('ALTER TABLE controles_inventario ADD COLUMN IF NOT EXISTS unidades_sobrantes INTEGER DEFAULT 0');
  await db.query('ALTER TABLE controles_inventario_items ADD COLUMN IF NOT EXISTS contado_en TIMESTAMP');
  columnasListas.set(true);
};

// Nombre que se muestra del filtro (el proveedor se guarda por id)
const SELECT_CONTROL = `SELECT c.*, pr.nombre AS proveedor_nombre,
    (SELECT COUNT(*) FROM controles_inventario_items i WHERE i.control_id = c.id)::int AS total_items,
    (SELECT COUNT(*) FROM controles_inventario_items i WHERE i.control_id = c.id AND i.estado <> 'pendiente')::int AS items_contados
  FROM controles_inventario c
  LEFT JOIN proveedores pr ON c.tipo = 'proveedor' AND pr.id::text = c.filtro_valor`;

// Listar controles de un local (historial)
const getControles = async (req, res) => {
  try {
    try { await asegurarColumnas(pool); } catch (e) {}
    const { local_id } = req.query;
    const params = [];
    let q = SELECT_CONTROL + ' WHERE 1=1';
    if (local_id) { params.push(local_id); q += ` AND c.local_id = $${params.length}`; }
    q += ' ORDER BY c.creado_en DESC LIMIT 50';
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
      [local_id || 1, avisos_activos !== false, Math.min(365, Math.max(1, parseInt(dias_aviso) || 30))]
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
    try { await asegurarColumnas(client); } catch (e) {}
    const abierto = await client.query(`SELECT id FROM controles_inventario WHERE local_id = $1 AND estado = 'en_curso' LIMIT 1`, [localNum]);
    if (abierto.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya hay un control sin terminar en este local (#' + abierto.rows[0].id + '). Terminalo o cancelalo antes de empezar otro.', control_id: abierto.rows[0].id });
    }
    const colStock = localNum === 2 ? 'stock_ush' : 'stock_rg';
    const colCantidadIngreso = localNum === 2 ? 'cantidad_ush' : 'cantidad_rg';

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
      `SELECT p.id, p.nombre, p.marca, p.categoria, p.costo, p.codigo_barras, p.${colStock} AS stock_sistema
       FROM productos p ${where} ORDER BY p.nombre ASC`,
      params
    );

    if (prods.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay productos activos que coincidan con ese filtro' });
    }

    // El periodo a analizar arranca donde termino el ultimo control finalizado de este local
    // (o, si nunca se hizo ninguno, los ultimos 30 dias) -- asi se puede ver cuanto entro y
    // se vendio de cada producto desde la ultima vez que se conto de verdad.
    const ultimoRes = await client.query(
      `SELECT MAX(finalizado_en) AS ultimo FROM controles_inventario WHERE local_id = $1 AND estado = 'finalizado'`,
      [localNum]
    );
    const periodoDesde = ultimoRes.rows[0].ultimo || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const controlRes = await client.query(
      `INSERT INTO controles_inventario (tipo, filtro_valor, local_id, usuario_id, usuario_nombre, estado, periodo_desde)
       VALUES ($1, $2, $3, $4, $5, 'en_curso', $6) RETURNING *`,
      [tipo, filtroValor, localNum, usuario_id || null, usuario_nombre || null, periodoDesde]
    );
    const control = controlRes.rows[0];

    // Lo vendido y lo que entro de cada producto desde el ultimo control, en dos consultas
    // agrupadas (antes eran dos por producto y con muchos productos tardaba mucho)
    const ids = prods.rows.map(p => p.id);
    const vendidoPor = {}, ingresadoPor = {};
    try {
      const vRes = await client.query(
        `SELECT vi.producto_id, COALESCE(SUM(vi.cantidad), 0) AS total
         FROM venta_items vi JOIN ventas v ON vi.venta_id = v.id
         WHERE vi.producto_id = ANY($1::int[]) AND v.local_id = $2 AND v.creado_en >= $3
           AND COALESCE(v.anulada, FALSE) = FALSE
           AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')
         GROUP BY vi.producto_id`, [ids, localNum, periodoDesde]);
      vRes.rows.forEach(r => { vendidoPor[r.producto_id] = parseInt(r.total) || 0; });
    } catch (e) { /* si algo no calza, seguimos con 0 en vez de frenar todo el control */ }
    try {
      const iRes = await client.query(
        `SELECT oii.producto_id, COALESCE(SUM(oii.${colCantidadIngreso}), 0) AS total
         FROM ordenes_ingreso_items oii JOIN ordenes_ingreso oi ON oii.orden_id = oi.id
         WHERE oii.producto_id = ANY($1::int[]) AND oi.creado_en >= $2
         GROUP BY oii.producto_id`, [ids, periodoDesde]);
      iRes.rows.forEach(r => { ingresadoPor[r.producto_id] = parseInt(r.total) || 0; });
    } catch (e) { /* idem: si falla, 0 y seguimos */ }

    // Alta de los items de a 500 por consulta
    for (let k = 0; k < prods.rows.length; k += 500) {
      const lote = prods.rows.slice(k, k + 500);
      const vals = [], args = [];
      lote.forEach((prod, j) => {
        const b0 = j * 10;
        vals.push(`($${b0 + 1}, $${b0 + 2}, $${b0 + 3}, $${b0 + 4}, $${b0 + 5}, $${b0 + 6}, $${b0 + 7}, 'pendiente', $${b0 + 8}, $${b0 + 9}, $${b0 + 10})`);
        args.push(control.id, prod.id, prod.nombre, prod.marca, prod.categoria, prod.codigo_barras, prod.stock_sistema || 0,
          ingresadoPor[prod.id] || 0, vendidoPor[prod.id] || 0, prod.costo || 0);
      });
      await client.query(
        `INSERT INTO controles_inventario_items (control_id, producto_id, producto_nombre, producto_marca, producto_categoria, producto_codigo, stock_sistema, estado, ingresado_periodo, vendido_periodo, costo_unitario)
         VALUES ${vals.join(', ')}`, args);
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
    try { await asegurarColumnas(pool); } catch (e) {}
    const c = await pool.query(SELECT_CONTROL + ' WHERE c.id = $1', [id]);
    if (c.rows.length === 0) return res.status(404).json({ error: 'Control no encontrado' });
    const items = await pool.query('SELECT * FROM controles_inventario_items WHERE control_id = $1 ORDER BY producto_nombre ASC', [id]);
    res.json({ ...c.rows[0], items: items.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Registrar el conteo de un item puntual
const contarItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { stock_contado, sumar, borrar } = req.body;
    try { await asegurarColumnas(pool); } catch (e) {}
    const itemRes = await pool.query(
      `SELECT i.*, c.estado AS control_estado, c.local_id, p.stock_rg, p.stock_ush
       FROM controles_inventario_items i JOIN controles_inventario c ON c.id = i.control_id
       LEFT JOIN productos p ON p.id = i.producto_id
       WHERE i.id = $1 AND i.control_id = $2`, [itemId, id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
    const item = itemRes.rows[0];
    if (item.control_estado !== 'en_curso') return res.status(400).json({ error: 'Este control ya está cerrado' });
    // Deshacer el conteo de un producto (vuelve a pendiente)
    if (borrar === true) {
      const upd = await pool.query(`UPDATE controles_inventario_items SET stock_contado = NULL, diferencia = NULL, estado = 'pendiente', contado_en = NULL WHERE id = $1 RETURNING *`, [itemId]);
      return res.json(upd.rows[0]);
    }
    // "sumar": cada escaneo suma unidades a lo ya contado (contar de a una pasando el lector)
    const contado = sumar ? (item.stock_contado || 0) + (parseInt(sumar) || 1) : parseInt(stock_contado);
    if (isNaN(contado) || contado < 0 || contado > 1000000) return res.status(400).json({ error: 'Cantidad invalida' });
    const actual = item.local_id === 2 ? item.stock_ush : item.stock_rg;
    const sistema = actual === null || actual === undefined ? (item.stock_sistema || 0) : actual;
    const diferencia = contado - sistema;
    const estado = diferencia === 0 ? 'correcto' : diferencia < 0 ? 'faltante' : 'sobrante';
    const upd = await pool.query(
      `UPDATE controles_inventario_items SET stock_contado = $1, stock_sistema = $2, diferencia = $3, estado = $4, contado_en = NOW() WHERE id = $5 RETURNING *`,
      [contado, sistema, diferencia, estado, itemId]
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

    try { await asegurarColumnas(client); } catch (e) {}
    const cRes = await client.query('SELECT * FROM controles_inventario WHERE id = $1 FOR UPDATE', [id]);
    if (cRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Control no encontrado' }); }
    const control = cRes.rows[0];
    if (control.estado !== 'en_curso') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Este control ya se finalizó' }); }
    const colStock = control.local_id === 2 ? 'stock_ush' : 'stock_rg';

    const items = await client.query('SELECT * FROM controles_inventario_items WHERE control_id = $1', [id]);
    let correctos = 0, faltantes = 0, sobrantes = 0;
    let totalIngresado = 0, totalVendido = 0, valorPerdidaEstimado = 0, valorSobranteEstimado = 0, unidadesFaltantes = 0, unidadesSobrantes = 0;
    const mayoresFaltantes = [];

    for (const it of items.rows) {
      if (it.estado === 'correcto') correctos++;
      else if (it.estado === 'faltante') faltantes++;
      else if (it.estado === 'sobrante') sobrantes++;

      totalIngresado += it.ingresado_periodo || 0;
      totalVendido += it.vendido_periodo || 0;
      const costo = parseFloat(it.costo_unitario || 0);
      if (it.diferencia < 0) {
        valorPerdidaEstimado += Math.abs(it.diferencia) * costo; unidadesFaltantes += Math.abs(it.diferencia);
        mayoresFaltantes.push({ producto_nombre: it.producto_nombre, diferencia: it.diferencia, valor: Math.abs(it.diferencia) * costo });
      } else if (it.diferencia > 0) { valorSobranteEstimado += it.diferencia * costo; unidadesSobrantes += it.diferencia; }

      // Ajuste por DIFERENCIA sobre el stock de ahora: si se vendio algo despues de contarlo,
      // esa venta se respeta (antes se pisaba el stock con lo contado y se perdia).
      if (ajustar_stock === true && it.stock_contado !== null && it.stock_contado !== undefined && it.diferencia) {
        const upd = await client.query(
          `UPDATE productos SET ${colStock} = GREATEST(0, COALESCE(${colStock}, 0) + $1)
           WHERE id = $2 RETURNING ${colStock} AS nuevo`,
          [it.diferencia, it.producto_id]
        );
        await client.query('UPDATE productos SET stock = COALESCE(stock_rg, 0) + COALESCE(stock_ush, 0) WHERE id = $1', [it.producto_id]);
        const nuevo = upd.rows[0] ? upd.rows[0].nuevo : null;
        try {
          await client.query('SAVEPOINT ajuste');
          await client.query(
            `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [it.producto_id, nuevo === null ? null : nuevo - it.diferencia, nuevo, it.diferencia, 'Control de inventario #' + id, usuario_id || null, usuario_nombre || null, control.local_id]
          );
          await client.query('RELEASE SAVEPOINT ajuste');
        } catch (e2) { await client.query('ROLLBACK TO SAVEPOINT ajuste'); /* si no existe la tabla ajustes_stock, no frenar el resto */ }
      }
    }

    await client.query(
      `UPDATE controles_inventario SET estado='finalizado', ajustar_stock=$1, notas=$2, items_correctos=$3, items_faltantes=$4, items_sobrantes=$5, finalizado_en=NOW(),
         valor_faltante=$7, valor_sobrante=$8, unidades_faltantes=$9, unidades_sobrantes=$10 WHERE id=$6`,
      [ajustar_stock === true, notas || null, correctos, faltantes, sobrantes, id, valorPerdidaEstimado, valorSobranteEstimado, unidadesFaltantes, unidadesSobrantes]
    );
    await client.query(
      `INSERT INTO config_control_inventario (local_id, ultimo_control) VALUES ($1, NOW())
       ON CONFLICT (local_id) DO UPDATE SET ultimo_control = NOW()`,
      [control.local_id]
    );

    await client.query('COMMIT');
    res.json({
      correctos, faltantes, sobrantes, ajustado: ajustar_stock === true,
      total_ingresado: totalIngresado, total_vendido: totalVendido,
      valor_perdida_estimado: valorPerdidaEstimado, valor_sobrante_estimado: valorSobranteEstimado,
      unidades_faltantes: unidadesFaltantes, unidades_sobrantes: unidadesSobrantes,
      pendientes: items.rows.filter(i => i.estado === 'pendiente').length,
      mayores_faltantes: mayoresFaltantes.sort((a, b) => b.valor - a.valor).slice(0, 5)
    });
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
    const r = await pool.query(`DELETE FROM controles_inventario WHERE id = $1 AND estado = 'en_curso' RETURNING id`, [id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Solo se puede cancelar un control que está en curso' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

module.exports = { getControles, getConfig, guardarConfig, crearControl, getControl, contarItem, finalizarControl, cancelarControl };