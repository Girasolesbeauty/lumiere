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
  // Explicacion de cada diferencia: por que falto o sobro, quien lo explico y cuando
  await db.query('ALTER TABLE controles_inventario_items ADD COLUMN IF NOT EXISTS motivo TEXT');
  await db.query('ALTER TABLE controles_inventario_items ADD COLUMN IF NOT EXISTS explicacion TEXT');
  await db.query('ALTER TABLE controles_inventario_items ADD COLUMN IF NOT EXISTS explicado_por TEXT');
  await db.query('ALTER TABLE controles_inventario_items ADD COLUMN IF NOT EXISTS explicado_en TIMESTAMP');
  columnasListas.set(true);
};

const limpiarTexto = (v, max) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

// Nombre que se muestra del filtro (el proveedor se guarda por id)
const SELECT_CONTROL = `SELECT c.*, pr.nombre AS proveedor_nombre,
    (SELECT COUNT(*) FROM controles_inventario_items i WHERE i.control_id = c.id)::int AS total_items,
    (SELECT COUNT(*) FROM controles_inventario_items i WHERE i.control_id = c.id AND i.estado <> 'pendiente')::int AS items_contados,
    (SELECT COUNT(*) FROM controles_inventario_items i WHERE i.control_id = c.id AND i.estado = 'faltante' AND COALESCE(TRIM(i.motivo), '') = '')::int AS sin_explicar
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

    // Explicaciones de las diferencias: las carga quien conto, antes de terminar.
    // Cada faltante tiene que tener su motivo (los sobrantes, si se quiere).
    const explicaciones = Array.isArray(req.body.explicaciones) ? req.body.explicaciones : [];
    for (const ex of explicaciones) {
      const motivo = limpiarTexto(ex && ex.motivo, 60);
      if (!ex || !ex.item_id || !motivo) continue;
      await client.query(
        `UPDATE controles_inventario_items SET motivo = $1, explicacion = $2, explicado_por = $3, explicado_en = NOW()
         WHERE id = $4 AND control_id = $5`,
        [motivo, limpiarTexto(ex.explicacion, 500) || null, limpiarTexto(usuario_nombre, 120) || null, ex.item_id, id]);
    }
    const sinExplicar = await client.query(
      `SELECT COUNT(*)::int AS n FROM controles_inventario_items WHERE control_id = $1 AND estado = 'faltante' AND COALESCE(TRIM(motivo), '') = ''`, [id]);
    if (sinExplicar.rows[0].n > 0) {
      await client.query('ROLLBACK');
      const n = sinExplicar.rows[0].n;
      return res.status(400).json({ error: (n === 1 ? 'Falta explicar 1 faltante' : 'Falta explicar ' + n + ' faltantes') + ' antes de terminar el control', sin_explicar: n });
    }

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

// Explicar (o corregir la explicacion de) una diferencia, tambien despues de terminado el control
const explicarItem = async (req, res) => {
  try {
    await asegurarColumnas(pool);
    const { id, itemId } = req.params;
    const motivo = limpiarTexto(req.body.motivo, 60);
    if (!motivo) return res.status(400).json({ error: 'Elegí el motivo' });
    const r = await pool.query(
      `UPDATE controles_inventario_items SET motivo = $1, explicacion = $2, explicado_por = $3, explicado_en = NOW()
       WHERE id = $4 AND control_id = $5 AND estado IN ('faltante', 'sobrante') RETURNING *`,
      [motivo, limpiarTexto(req.body.explicacion, 500) || null, limpiarTexto(req.body.usuario_nombre, 120) || null, itemId, id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Ese producto no tiene diferencia en este control' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Justificar varias diferencias juntas (en un control ya terminado, o mientras se cuenta)
const explicarVarios = async (req, res) => {
  const client = await pool.connect();
  try {
    await asegurarColumnas(client);
    const { id } = req.params;
    const lista = (Array.isArray(req.body.explicaciones) ? req.body.explicaciones : []).filter(e => e && e.item_id && limpiarTexto(e.motivo, 60));
    if (!lista.length) return res.status(400).json({ error: 'Elegí el motivo de al menos un producto' });
    await client.query('BEGIN');
    let guardados = 0;
    for (const ex of lista) {
      const r = await client.query(
        `UPDATE controles_inventario_items SET motivo = $1, explicacion = $2, explicado_por = $3, explicado_en = NOW()
         WHERE id = $4 AND control_id = $5 AND estado IN ('faltante', 'sobrante')`,
        [limpiarTexto(ex.motivo, 60), limpiarTexto(ex.explicacion, 500) || null, limpiarTexto(req.body.usuario_nombre, 120) || null, ex.item_id, id]);
      guardados += r.rowCount;
    }
    await client.query('COMMIT');
    const items = await pool.query('SELECT * FROM controles_inventario_items WHERE control_id = $1 ORDER BY producto_nombre ASC', [id]);
    res.json({ guardados, items: items.rows });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) {}
    console.error(e); res.status(500).json({ error: e.message });
  } finally { client.release(); }
};

// Informe de faltantes de un local: cada control terminado en el periodo, por que faltaron
// las cosas (motivos) y que productos faltan una y otra vez.
const informeFaltantes = async (req, res) => {
  try {
    await asegurarColumnas(pool);
    // local_id = 1, 2, o "todos" (los dos locales juntos)
    const todos = String(req.query.local_id || '').toLowerCase() === 'todos' || req.query.local_id === '0';
    const local = todos ? 0 : (parseInt(req.query.local_id) || 1);
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : new Date().toISOString().slice(0, 10);
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const cs = await pool.query(SELECT_CONTROL + ` WHERE ($1::int = 0 OR c.local_id = $1) AND c.estado = 'finalizado'
        AND c.finalizado_en >= $2::date AND c.finalizado_en < ($3::date + 1) ORDER BY c.finalizado_en DESC`, [local, desde, hasta]);
    const ids = cs.rows.map(c => c.id);
    const its = ids.length ? (await pool.query(
      `SELECT control_id, id, producto_id, producto_nombre, producto_marca, producto_categoria, producto_codigo, stock_sistema, stock_contado,
              diferencia, costo_unitario, estado, motivo, explicacion, explicado_por, explicado_en
         FROM controles_inventario_items WHERE control_id = ANY($1::int[]) AND estado = 'faltante'
        ORDER BY (ABS(diferencia) * COALESCE(costo_unitario, 0)) DESC, producto_nombre`, [ids])).rows : [];

    const porControl = {};
    const productos = {};
    const motivos = {};
    let unidades = 0, valor = 0, sinExplicar = 0;
    for (const it of its) {
      const u = Math.abs(it.diferencia || 0), v = u * parseFloat(it.costo_unitario || 0);
      (porControl[it.control_id] = porControl[it.control_id] || []).push({ ...it, unidades: u, valor: v });
      unidades += u; valor += v;
      const m = (it.motivo || '').trim() || 'Sin explicar';
      if (m === 'Sin explicar') sinExplicar++;
      motivos[m] = motivos[m] || { motivo: m, productos: 0, unidades: 0, valor: 0 };
      motivos[m].productos++; motivos[m].unidades += u; motivos[m].valor += v;
      const k = it.producto_id || it.producto_nombre;
      productos[k] = productos[k] || { producto_id: it.producto_id, nombre: it.producto_nombre, marca: it.producto_marca, veces: 0, unidades: 0, valor: 0, motivos: {} };
      productos[k].veces++; productos[k].unidades += u; productos[k].valor += v; productos[k].motivos[m] = (productos[k].motivos[m] || 0) + 1;
    }
    // TODO LO QUE FALTA, producto por producto y a costo, sin contar dos veces lo mismo:
    // si un control NO corrigio el stock, el mismo faltante vuelve a aparecer en el control
    // siguiente; en ese caso vale solo el ultimo conteo. Si lo corrigio, cada faltante es una
    // perdida nueva y se suma.
    const controlDe = {}; cs.rows.forEach(c => { controlDe[c.id] = c; });
    const cronologico = its.slice().sort((a, b) => new Date(controlDe[a.control_id].finalizado_en) - new Date(controlDe[b.control_id].finalizado_en));
    const acum = {};
    for (const it of cronologico) {
      const c = controlDe[it.control_id];
      const k = c.local_id + ':' + (it.producto_id || it.producto_nombre);
      const a = acum[k] = acum[k] || { producto_id: it.producto_id, nombre: it.producto_nombre, marca: it.producto_marca, categoria: it.producto_categoria, codigo: it.producto_codigo,
        local_id: c.local_id, firmes: 0, firmesValor: 0, pend: 0, pendValor: 0, motivos: new Set(), ultimo_control: null };
      const u = Math.abs(it.diferencia || 0), v = u * parseFloat(it.costo_unitario || 0);
      if (c.ajustar_stock) { a.firmes += u; a.firmesValor += v; a.pend = 0; a.pendValor = 0; }
      else { a.pend = u; a.pendValor = v; }
      a.costo_unitario = parseFloat(it.costo_unitario || 0);
      a.ultimo_control = c.finalizado_en;
      if ((it.motivo || '').trim()) a.motivos.add(it.motivo.trim());
    }
    const todoLoQueFalta = Object.values(acum).map(a => ({
      producto_id: a.producto_id, nombre: a.nombre, marca: a.marca, categoria: a.categoria, codigo: a.codigo, local_id: a.local_id,
      unidades: a.firmes + a.pend, valor: a.firmesValor + a.pendValor, costo_unitario: a.costo_unitario, ultimo_control: a.ultimo_control,
      motivos: [...a.motivos].join(', ') || 'Sin explicar',
    })).filter(x => x.unidades > 0).sort((x, y) => y.valor - x.valor || y.unidades - x.unidades);
    const porLocal = {};
    todoLoQueFalta.forEach(x => { const l = porLocal[x.local_id] = porLocal[x.local_id] || { local_id: x.local_id, productos: 0, unidades: 0, valor: 0 }; l.productos++; l.unidades += x.unidades; l.valor += x.valor; });
    const totalFalta = { productos: todoLoQueFalta.length, unidades: todoLoQueFalta.reduce((s, x) => s + x.unidades, 0), valor: todoLoQueFalta.reduce((s, x) => s + x.valor, 0) };

    const repetidos = Object.values(productos).filter(x => x.veces > 1).sort((a, b) => b.veces - a.veces || b.valor - a.valor).slice(0, 30)
      .map(x => ({ ...x, motivos: Object.entries(x.motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => m + (n > 1 ? ' ×' + n : '')).join(', ') }));
    res.json({
      local_id: local, desde, hasta,
      resumen: { controles: cs.rows.length, productos_con_faltante: its.length, unidades, valor, sin_explicar: sinExplicar },
      total_falta: totalFalta,
      falta_por_local: Object.values(porLocal).sort((a, b) => a.local_id - b.local_id),
      todo_lo_que_falta: todoLoQueFalta,
      motivos: Object.values(motivos).sort((a, b) => b.valor - a.valor || b.unidades - a.unidades),
      repetidos,
      controles: cs.rows.map(c => ({ ...c, faltantes: porControl[c.id] || [] })),
    });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Diagnostico de diferencias de stock entre locales: junta en un solo lugar las pistas de
// POR QUE el stock del sistema no coincide con lo que hay. Cada consulta va por separado:
// si una tabla no existe en esta base, esa parte sale vacia y el resto sigue.
const diagnosticoStock = async (req, res) => {
  const dias = Math.min(730, Math.max(7, parseInt(req.query.dias) || 180));
  const q = async (sql, params = []) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return null; } };
  try {
    try { await asegurarColumnas(pool); } catch (e) {}
    const [porUsuario, traspasos, ingresos, transito, negativos, sinStock, sinStockProd, espejo, ajustes] = await Promise.all([
      // 1) En que local vendio cada usuario (y cual tiene asignado)
      q(`SELECT u.id AS usuario_id, u.nombre, u.rol, u.local_id AS local_usuario, v.local_id AS local_venta,
                COUNT(DISTINCT v.id)::int AS ventas, COALESCE(SUM(vi.cantidad), 0)::int AS unidades, MAX(v.creado_en) AS ultima
           FROM ventas v
           JOIN usuarios u ON u.id = v.usuario_id
           LEFT JOIN venta_items vi ON vi.venta_id = v.id AND vi.producto_id IS NOT NULL
          WHERE v.creado_en >= NOW() - ($1 || ' days')::interval AND COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, 'presencial') = 'presencial'
          GROUP BY u.id, u.nombre, u.rol, u.local_id, v.local_id ORDER BY u.nombre, v.local_id`, [String(dias)]),
      // 2) Traspasos enviados que nadie recibio
      q(`SELECT id, producto_nombre, cantidad, local_origen, local_destino, usuario_nombre, creado_en,
                EXTRACT(DAY FROM NOW() - creado_en)::int AS dias
           FROM traspasos_stock WHERE COALESCE(estado, '') <> 'recibido' ORDER BY creado_en ASC LIMIT 200`),
      // 3) Mercaderia de facturas de proveedor que un local todavia no controlo
      q(`SELECT o.id AS orden_id, o.proveedor_nombre, o.numero_factura, o.creado_en, x.local_id,
                COUNT(*)::int AS productos, SUM(x.cantidad)::int AS unidades, EXTRACT(DAY FROM NOW() - o.creado_en)::int AS dias
           FROM ordenes_ingreso o
           JOIN (SELECT orden_id, 1 AS local_id, cantidad_rg AS cantidad FROM ordenes_ingreso_items WHERE COALESCE(cantidad_rg, 0) > 0 AND COALESCE(revisado_rg, FALSE) = FALSE
                 UNION ALL
                 SELECT orden_id, 2, cantidad_ush FROM ordenes_ingreso_items WHERE COALESCE(cantidad_ush, 0) > 0 AND COALESCE(revisado_ush, FALSE) = FALSE) x ON x.orden_id = o.id
          GROUP BY o.id, o.proveedor_nombre, o.numero_factura, o.creado_en, x.local_id ORDER BY o.creado_en ASC LIMIT 200`),
      // 4) Stock "en camino" que figura en cada local
      q(`SELECT 1 AS local_id, COUNT(*)::int AS productos, COALESCE(SUM(stock_transito_rg), 0)::int AS unidades FROM productos WHERE COALESCE(stock_transito_rg, 0) > 0 AND activo = TRUE
         UNION ALL
         SELECT 2, COUNT(*)::int, COALESCE(SUM(stock_transito_ush), 0)::int FROM productos WHERE COALESCE(stock_transito_ush, 0) > 0 AND activo = TRUE`),
      // 5) Productos con stock negativo (se vendio mas de lo que el sistema creia que habia)
      q(`SELECT id, nombre, marca, COALESCE(stock_rg, 0) AS stock_rg, COALESCE(stock_ush, 0) AS stock_ush FROM productos
          WHERE activo = TRUE AND (COALESCE(stock_rg, 0) < 0 OR COALESCE(stock_ush, 0) < 0) ORDER BY LEAST(COALESCE(stock_rg, 0), COALESCE(stock_ush, 0)) ASC LIMIT 100`),
      // 6) Ventas hechas "sin stock" segun el sistema (el producto estaba, el sistema decia que no)
      q(`SELECT COALESCE(local_id, 1) AS local_id, COUNT(*)::int AS veces, COALESCE(SUM(cantidad_vendida), 0)::int AS unidades
           FROM inconsistencias_stock WHERE creado_en >= NOW() - ($1 || ' days')::interval GROUP BY COALESCE(local_id, 1) ORDER BY 1`, [String(dias)]),
      q(`SELECT COALESCE(local_id, 1) AS local_id, producto_nombre, COUNT(*)::int AS veces, COALESCE(SUM(cantidad_vendida), 0)::int AS unidades
           FROM inconsistencias_stock WHERE creado_en >= NOW() - ($1 || ' days')::interval
          GROUP BY COALESCE(local_id, 1), producto_nombre ORDER BY unidades DESC LIMIT 30`, [String(dias)]),
      // 7) "Espejo": lo que falta en un local y sobra en el otro (segun los controles del periodo)
      q(`WITH d AS (
           SELECT i.producto_id, MAX(i.producto_nombre) AS nombre, c.local_id, SUM(i.diferencia)::int AS dif
             FROM controles_inventario_items i JOIN controles_inventario c ON c.id = i.control_id
            WHERE c.estado = 'finalizado' AND c.finalizado_en >= NOW() - ($1 || ' days')::interval AND i.estado IN ('faltante', 'sobrante')
            GROUP BY i.producto_id, c.local_id)
         SELECT a.producto_id, a.nombre, a.dif AS dif_local1, b.dif AS dif_local2
           FROM d a JOIN d b ON b.producto_id = a.producto_id AND a.local_id = 1 AND b.local_id = 2
          WHERE a.dif * b.dif < 0 ORDER BY LEAST(ABS(a.dif), ABS(b.dif)) DESC LIMIT 100`, [String(dias)]),
      // 8) Ajustes de stock hechos a mano por local
      q(`SELECT COALESCE(local_id, 1) AS local_id, COUNT(*)::int AS ajustes, COALESCE(SUM(CASE WHEN diferencia > 0 THEN diferencia ELSE 0 END), 0)::int AS sumado,
                COALESCE(SUM(CASE WHEN diferencia < 0 THEN -diferencia ELSE 0 END), 0)::int AS restado
           FROM ajustes_stock WHERE creado_en >= NOW() - ($1 || ' days')::interval AND COALESCE(motivo, '') NOT LIKE 'Control de inventario%'
          GROUP BY COALESCE(local_id, 1) ORDER BY 1`, [String(dias)]),
    ]);

    // Usuarios que vendieron en un local distinto al que tienen asignado
    const usuarios = {};
    for (const r of porUsuario || []) {
      const u = usuarios[r.usuario_id] = usuarios[r.usuario_id] || { usuario_id: r.usuario_id, nombre: r.nombre, rol: r.rol, local_usuario: r.local_usuario, ventas: {}, unidades: {}, ultima: {} };
      u.ventas[r.local_venta] = r.ventas; u.unidades[r.local_venta] = r.unidades; u.ultima[r.local_venta] = r.ultima;
    }
    const cruzados = Object.values(usuarios).map(u => {
      const propio = Number(u.local_usuario) || null;
      const otro = propio === 2 ? 1 : 2;
      return { ...u, ventas_en_otro: propio ? (u.ventas[otro] || 0) : 0, unidades_en_otro: propio ? (u.unidades[otro] || 0) : 0, otro_local: otro, ultima_en_otro: propio ? (u.ultima[otro] || null) : null };
    }).sort((a, b) => b.unidades_en_otro - a.unidades_en_otro);

    res.json({
      dias,
      ventas_por_usuario: cruzados,
      ventas_en_otro_local: { usuarios: cruzados.filter(u => u.ventas_en_otro > 0).length, ventas: cruzados.reduce((s, u) => s + u.ventas_en_otro, 0), unidades: cruzados.reduce((s, u) => s + u.unidades_en_otro, 0) },
      traspasos_pendientes: traspasos || [],
      ingresos_sin_controlar: ingresos || [],
      en_transito: transito || [],
      negativos: negativos || [],
      ventas_sin_stock: sinStock || [],
      ventas_sin_stock_productos: sinStockProd || [],
      espejo: espejo || [],
      ajustes_a_mano: ajustes || [],
      no_disponible: { traspasos: traspasos === null, ingresos: ingresos === null, ventas_sin_stock: sinStock === null, usuarios: porUsuario === null },
    });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

// Historia de un producto: TODO lo que le movio el stock en cada local (lo que llego, lo que
// se vendio, cambios, traspasos, ajustes, controles) en orden, con el saldo que deberia haber
// despues de cada movimiento. Sirve para ver si "la cuenta da" o donde se rompe.
const historiaProducto = async (req, res) => {
  const q = async (sql, params = []) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return []; } };
  try {
    const id = parseInt(req.params.id);
    const pr = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (!pr.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    const p = pr.rows[0];
    const [ingresos, ventas, cambios, ajustes, regalos, controles] = await Promise.all([
      q(`SELECT i.id, o.id AS orden_id, o.proveedor_nombre, o.numero_factura, o.creado_en, i.cantidad_rg, i.cantidad_ush, i.recibido_rg, i.recibido_ush,
                COALESCE(i.revisado_rg, FALSE) AS revisado_rg, COALESCE(i.revisado_ush, FALSE) AS revisado_ush,
                i.fecha_recepcion_rg, i.fecha_recepcion_ush, i.recibido_por_rg, i.recibido_por_ush
           FROM ordenes_ingreso_items i JOIN ordenes_ingreso o ON o.id = i.orden_id WHERE i.producto_id = $1`, [id]),
      q(`SELECT v.id, v.numero_factura, v.creado_en, v.local_id, v.preventa_local, v.es_preventa, v.estado_pago, v.canal, COALESCE(v.anulada, FALSE) AS anulada,
                vi.cantidad, u.nombre AS usuario
           FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id LEFT JOIN usuarios u ON u.id = v.usuario_id WHERE vi.producto_id = $1`, [id]),
      q(`SELECT id, creado_en, local_id, usuario_nombre, venta_origen_numero, producto_devuelto_id, cantidad_devuelta, producto_nuevo_id, cantidad_nueva
           FROM cambios_productos WHERE producto_devuelto_id = $1 OR producto_nuevo_id = $1`, [id]),
      q(`SELECT id, creado_en, COALESCE(local_id, 1) AS local_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_nombre FROM ajustes_stock WHERE producto_id = $1`, [id]),
      q(`SELECT id, entregado_en, local_entrega_id, entregado_por, campana FROM influencer_regalos WHERE producto_id = $1 AND estado = 'entregado' AND entregado_en IS NOT NULL`, [id]),
      q(`SELECT c.id, c.local_id, c.finalizado_en, c.ajustar_stock, c.usuario_nombre, i.stock_sistema, i.stock_contado, i.diferencia, i.motivo
           FROM controles_inventario_items i JOIN controles_inventario c ON c.id = i.control_id
          WHERE i.producto_id = $1 AND c.estado = 'finalizado' AND i.estado <> 'pendiente'`, [id]),
    ]);

    const armar = (L) => {
      const esUsh = L === 2;
      const mov = [];
      const enCamino = [];
      for (const i of ingresos) {
        const cant = esUsh ? i.cantidad_ush : i.cantidad_rg, rec = esUsh ? i.recibido_ush : i.recibido_rg, rev = esUsh ? i.revisado_ush : i.revisado_rg;
        const fecha = esUsh ? i.fecha_recepcion_ush : i.fecha_recepcion_rg, por = esUsh ? i.recibido_por_ush : i.recibido_por_rg;
        const ref = (i.proveedor_nombre || 'Proveedor') + (i.numero_factura ? ' · factura ' + i.numero_factura : '');
        if (rev && (rec || 0) > 0) mov.push({ fecha: fecha || i.creado_en, tipo: 'ingreso', cantidad: rec, detalle: 'Ingreso recibido: ' + ref + (rec !== cant ? ' (se esperaban ' + (cant || 0) + ')' : ''), usuario: por || null });
        else if (!rev && (cant || 0) > 0) enCamino.push({ fecha: i.creado_en, cantidad: cant, detalle: ref, orden_id: i.orden_id });
      }
      for (const v of ventas) {
        const loc = v.es_preventa ? (v.preventa_local || v.local_id) : v.local_id;
        if (Number(loc || 1) !== L) continue;
        if (v.es_preventa && v.estado_pago === 'reservado') { mov.push({ fecha: v.creado_en, tipo: 'reserva', cantidad: 0, detalle: 'Preventa ' + v.numero_factura + ' (reservado, todavía no se entregó: ' + v.cantidad + ' u.)', usuario: v.usuario }); continue; }
        mov.push({ fecha: v.creado_en, tipo: v.anulada ? 'venta_anulada' : 'venta', cantidad: v.anulada ? 0 : -v.cantidad,
          detalle: (v.canal === 'online' ? 'Venta online ' : 'Venta ') + v.numero_factura + (v.anulada ? ' (ANULADA: ' + v.cantidad + ' u. volvieron al stock)' : ''), usuario: v.usuario });
      }
      for (const c of cambios) {
        if (Number(c.local_id || 1) !== L) continue;
        if (Number(c.producto_devuelto_id) === id && c.cantidad_devuelta) mov.push({ fecha: c.creado_en, tipo: 'devolucion', cantidad: c.cantidad_devuelta, detalle: 'Devolución (cambio #' + c.id + (c.venta_origen_numero ? ', venta ' + c.venta_origen_numero : '') + ')', usuario: c.usuario_nombre, dudoso: true });
        if (Number(c.producto_nuevo_id) === id && c.cantidad_nueva) mov.push({ fecha: c.creado_en, tipo: 'cambio', cantidad: -c.cantidad_nueva, detalle: 'Se lo llevaron en un cambio (#' + c.id + ')', usuario: c.usuario_nombre });
      }
      for (const a of ajustes) {
        if (Number(a.local_id) !== L) continue;
        const m = a.motivo || '';
        const tipo = /^Control de inventario/i.test(m) ? 'control' : /traspaso/i.test(m) ? 'traspaso' : /^REVERSION/i.test(m) ? 'reversion' : 'ajuste';
        mov.push({ fecha: a.creado_en, tipo, cantidad: a.diferencia, detalle: (tipo === 'ajuste' ? 'Ajuste a mano: ' : '') + (m || 'sin motivo'), usuario: a.usuario_nombre,
          // Solo los controles y los ajustes a mano dejan anotado con certeza cuanto quedo en ESTE local
          queda: (tipo === 'control' || tipo === 'ajuste') ? a.stock_nuevo : null, ancla: tipo === 'control' || tipo === 'ajuste' });
      }
      for (const r of regalos) {
        if (Number(r.local_entrega_id || 1) !== L) continue;
        mov.push({ fecha: r.entregado_en, tipo: 'regalo', cantidad: -1, detalle: 'Regalo a influencer' + (r.campana ? ' (' + r.campana + ')' : ''), usuario: r.entregado_por });
      }
      for (const c of controles) {
        if (Number(c.local_id) !== L) continue;
        mov.push({ fecha: c.finalizado_en, tipo: 'conteo', cantidad: 0, detalle: 'Control #' + c.id + ': el sistema decía ' + c.stock_sistema + ', se contaron ' + c.stock_contado + (c.diferencia ? ' (' + (c.diferencia > 0 ? '+' : '') + c.diferencia + ')' : '') + (c.ajustar_stock ? '' : ' · NO se corrigió el stock') + (c.motivo ? ' · ' + c.motivo : ''), usuario: c.usuario_nombre });
      }
      mov.sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || (a.ancla ? 1 : 0) - (b.ancla ? 1 : 0));

      // Punto de partida: el ultimo movimiento que dejo anotado "quedaron N" (un ajuste, un
      // control, un traspaso). Desde ahi se suma y resta todo lo que vino despues.
      let iAncla = -1;
      for (let k = mov.length - 1; k >= 0; k--) if (mov[k].ancla && mov[k].queda !== null && mov[k].queda !== undefined) { iAncla = k; break; }
      const actual = Number(esUsh ? p.stock_ush : p.stock_rg) || 0;
      const sumaTodo = mov.reduce((s, m) => s + (m.cantidad || 0), 0);
      let saldo = iAncla >= 0 ? null : 0;
      const inicialImplicito = iAncla >= 0 ? null : actual - sumaTodo;
      const out = mov.map((m, k) => {
        if (iAncla >= 0) {
          if (k < iAncla) return { ...m, saldo: null };
          if (k === iAncla) { saldo = Number(m.queda); return { ...m, saldo, partida: true }; }
          saldo += (m.cantidad || 0); return { ...m, saldo };
        }
        saldo += (m.cantidad || 0);
        return { ...m, saldo: inicialImplicito + saldo };
      });
      const esperado = iAncla >= 0 ? saldo : null;
      const tot = (tipos) => mov.filter(m => tipos.includes(m.tipo)).reduce((s, m) => s + (m.cantidad || 0), 0);
      return {
        local_id: L, actual, en_camino: enCamino, en_transito: Number(esUsh ? p.stock_transito_ush : p.stock_transito_rg) || 0,
        totales: { ingresos: tot(['ingreso']), ventas: -tot(['venta']), devoluciones: tot(['devolucion']), cambios: -tot(['cambio']), traspasos: tot(['traspaso']),
          ajustes: tot(['ajuste', 'reversion']), controles: tot(['control']), regalos: -tot(['regalo']), ventas_anuladas: mov.filter(m => m.tipo === 'venta_anulada').length },
        partida: iAncla >= 0 ? { fecha: mov[iAncla].fecha, stock: Number(mov[iAncla].queda), detalle: mov[iAncla].detalle } : null,
        esperado, diferencia: esperado === null ? null : actual - esperado,
        inicial_implicito: inicialImplicito,
        movimientos: out.reverse(),
      };
    };
    res.json({
      producto: { id: p.id, nombre: p.nombre, marca: p.marca, categoria: p.categoria, codigo_barras: p.codigo_barras, costo: p.costo, tiene_variantes: p.tiene_variantes === true, creado_en: p.creado_en || null },
      locales: [armar(1), armar(2)],
    });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
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

module.exports = { getControles, getConfig, guardarConfig, crearControl, getControl, contarItem, finalizarControl, cancelarControl, explicarItem, explicarVarios, informeFaltantes, diagnosticoStock, historiaProducto };