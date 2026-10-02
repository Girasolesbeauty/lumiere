const pool = require('../config/database');

// Agrega campos calculados de disponibilidad real (stock - reservado de preventas) sin tocar el resto.
const conDisponible = (rows, local) => rows.map(p => {
  const esUsh = local === '2' || local === 2 || local === 'ush';
  const reservado = esUsh ? (p.reservado_ush || 0) : (p.reservado_rg || 0);
  const transito = esUsh ? (p.stock_transito_ush || 0) : (p.stock_transito_rg || 0);
  const stockRG = p.stock_rg != null ? p.stock_rg : (p.stock || 0);
  const stockUSH = p.stock_ush != null ? p.stock_ush : 0;
  // "stock del local actual" (para la vista Mi local)
  const stockLocal = esUsh ? stockUSH : stockRG;
  return {
    ...p,
    stock_rg: stockRG,
    stock_ush: stockUSH,
    stock_consolidado: stockRG + stockUSH,
    stock_local: stockLocal,
    reservado: reservado,
    // "disponible" ahora se calcula sobre el stock del local actual
    disponible: Math.max(stockLocal - reservado, 0),
    transito_local: transito
  };
});

const getAll = async (req, res) => {
  try {
    const { local, estado } = req.query;
    // estado: 'activos' (default, no rompe nada de lo que ya usa este endpoint),
    // 'inactivos', o 'todos'.
    let where = 'WHERE p.activo = TRUE';
    if (estado === 'inactivos') where = 'WHERE p.activo = FALSE';
    else if (estado === 'todos') where = '';
    let whereSimple = where.replace('p.activo', 'activo');
    let result;
    try {
      // Intenta traer el nombre del proveedor (para el buscador). Si la columna no existe, cae al SELECT simple.
      result = await pool.query(`SELECT p.*, pr.nombre AS proveedor_nombre
                                 FROM productos p
                                 LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
                                 ${where} ORDER BY p.nombre ASC`);
    } catch (e) {
      result = await pool.query(`SELECT * FROM productos ${whereSimple} ORDER BY nombre ASC`);
    }
    res.json(conDisponible(result.rows, local));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { local } = req.query;
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(conDisponible(result.rows, local)[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

const create = async (req, res) => {
  try {
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id, proveedor_id, tiene_variantes, tipo_variante } = req.body;
    // El stock inicial se carga en el local donde se creo el producto (stock_rg o stock_ush),
    // no solo en el campo "stock" agregado -- si no, cualquier operacion que mire el stock de
    // un local puntual (vender, ajustar, alertas) lo ve en 0 aunque el total muestre el numero real.
    const stockInicial = parseInt(stock) || 0;
    const esUsh = local_id === 2 || local_id === '2';
    const stockRg = esUsh ? 0 : stockInicial;
    const stockUsh = esUsh ? stockInicial : 0;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id, proveedor_id, tiene_variantes, tipo_variante)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [nombre, marca, precio, costo, stockInicial, stockRg, stockUsh, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id || 1, proveedor_id || null, tiene_variantes || false, tipo_variante || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo, proveedor_id, tiene_variantes, tipo_variante } = req.body;
    const result = await pool.query(
      `UPDATE productos SET nombre=$1, marca=$2, precio=$3, costo=$4, stock=$5, 
       stock_minimo=$6, lead_time_dias=$7, categoria=$8, codigo_barras=$9,
       activo=COALESCE($10, activo), proveedor_id=$11, tiene_variantes=COALESCE($12, tiene_variantes), tipo_variante=$13
       WHERE id=$14 RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo, proveedor_id || null, tiene_variantes, tipo_variante || null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// ---- Fotos de productos (modo Catalogo del POS) ----
// Se guardan en una tabla aparte (producto_imagenes) para que la lista de productos no
// se vuelva pesada. El navegador las achica antes de mandarlas (miniaturas JPEG).
const TAMANO_MAX_IMAGEN = 400 * 1024;
const getImagenes = async (req, res) => {
  try {
    const r = await pool.query('SELECT producto_id, imagen FROM producto_imagenes');
    res.json(r.rows);
  } catch (error) {
    // Si la tabla todavia no existe (falta la migracion), se devuelve vacio
    res.json([]);
  }
};
const getImagen = async (req, res) => {
  try {
    const r = await pool.query('SELECT imagen FROM producto_imagenes WHERE producto_id = $1', [req.params.id]);
    res.json({ imagen: r.rows[0] ? r.rows[0].imagen : null });
  } catch (error) { res.json({ imagen: null }); }
};
const guardarImagen = async (req, res) => {
  try {
    const imagen = String((req.body && req.body.imagen) || '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(imagen)) return res.status(400).json({ error: 'La imagen no es valida' });
    if (imagen.length > TAMANO_MAX_IMAGEN) return res.status(400).json({ error: 'La imagen es muy pesada' });
    await pool.query(
      `INSERT INTO producto_imagenes (producto_id, imagen, actualizado_en) VALUES ($1, $2, NOW())
       ON CONFLICT (producto_id) DO UPDATE SET imagen = EXCLUDED.imagen, actualizado_en = NOW()`,
      [req.params.id, imagen]
    );
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Error al guardar la imagen' }); }
};
const borrarImagen = async (req, res) => {
  try {
    await pool.query('DELETE FROM producto_imagenes WHERE producto_id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Error al borrar la imagen' }); }
};

// Activar / desactivar un producto sin tocar el resto de sus datos
const cambiarEstado = async (req, res) => {
  try {
    const activo = req.body && req.body.activo !== false;
    const r = await pool.query('UPDATE productos SET activo = $1 WHERE id = $2 RETURNING id, nombre, activo', [activo, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(r.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar el estado del producto' });
  }
};

const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // Si tiene ventas reales, NO se borra (protege el historial de ventas)
    const ventas = await client.query('SELECT COUNT(*) FROM venta_items WHERE producto_id = $1', [id]);
    if (parseInt(ventas.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este producto tiene ventas registradas, no se puede borrar. Si no lo usas mas, editalo y desactivalo.' });
    }

    // Borrar primero los vinculos que no son ventas (ajustes de stock, items de kit)
    await client.query('DELETE FROM ajustes_stock WHERE producto_id = $1', [id]);
    // kit_items puede no existir en algunos entornos; se intenta y se ignora si falla
    try { await client.query('DELETE FROM kit_items WHERE producto_id = $1', [id]); } catch (e) {}

    const del = await client.query('DELETE FROM productos WHERE id = $1', [id]);
    await client.query('COMMIT');

    if (del.rowCount === 0) {
      return res.status(404).json({ error: 'No se encontro el producto para borrar.' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'No se pudo borrar: ' + error.message });
  } finally {
    client.release();
  }
};

const getAlertas = async (req, res) => {
  try {
    const { local_id } = req.query;
    let query = `
      SELECT *, 
        CEIL(1.2 * lead_time_dias + stock_minimo) AS punto_pedido,
        CASE WHEN stock <= CEIL(1.2 * lead_time_dias + stock_minimo) 
             THEN true ELSE false END AS necesita_pedido
      FROM productos 
      WHERE activo = TRUE
      AND stock <= CEIL(1.2 * lead_time_dias + stock_minimo)
    `;
    const params = [];
    if (local_id) {
      params.push(local_id);
      query += ` AND local_id = $${params.length}`;
    }
    query += ' ORDER BY stock ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
};

// Listado de todo el stock en transito (de ordenes de ingreso aun no recibidas), separado por local.
const getTransito = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, marca, codigo_barras,
        COALESCE(stock_transito_rg, 0) AS transito_rg,
        COALESCE(stock_transito_ush, 0) AS transito_ush,
        COALESCE(reservado_rg, 0) AS reservado_rg,
        COALESCE(reservado_ush, 0) AS reservado_ush
       FROM productos
       WHERE activo = TRUE AND (COALESCE(stock_transito_rg, 0) > 0 OR COALESCE(stock_transito_ush, 0) > 0)
       ORDER BY nombre ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener stock en transito' });
  }
};

// Puede ajustar stock: el jefe o quien tenga el permiso "inventario.ajustar"
async function puedeAjustar(db, usuarioId) {
  if (!usuarioId) return false;
  const u = await db.query(`SELECT rol, rol_id FROM usuarios WHERE id = $1`, [usuarioId]);
  if (u.rows.length && (u.rows[0].rol === 'jefe' || Number(u.rows[0].rol_id) === 1)) return true;
  const p = await db.query(`SELECT 1 FROM permisos_usuario WHERE usuario_id = $1 AND permiso = 'inventario.ajustar'`, [usuarioId]);
  return p.rows.length > 0;
}

// Pedidos de ajuste de quien no tiene permiso: quedan pendientes hasta que alguien los apruebe
let tablaSolicitudes = false;
async function asegurarSolicitudes(db) {
  if (tablaSolicitudes) return;
  await db.query(`CREATE TABLE IF NOT EXISTS ajustes_pendientes (
    id SERIAL PRIMARY KEY, producto_id INT NOT NULL, local_id INT DEFAULT 1, modo TEXT NOT NULL, valor INT NOT NULL,
    motivo TEXT NOT NULL, stock_al_pedir INT, usuario_id INT, usuario_nombre TEXT, estado TEXT DEFAULT 'pendiente',
    resuelto_por TEXT, resuelto_en TIMESTAMP, nota TEXT, creado_en TIMESTAMP DEFAULT NOW())`);
  tablaSolicitudes = true;
}

const solicitarAjuste = async (req, res) => {
  try {
    await asegurarSolicitudes(pool);
    const { id } = req.params;
    const { modo, valor, motivo, usuario_id, usuario_nombre, local_id } = req.body;
    if (!motivo || !String(motivo).trim()) return res.status(400).json({ error: 'El motivo del ajuste es obligatorio' });
    const v = parseInt(valor);
    if (isNaN(v)) return res.status(400).json({ error: 'Ingresá un número válido' });
    const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
    const p = await pool.query(`SELECT ${colStock} AS s FROM productos WHERE id = $1`, [id]);
    if (!p.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    const r = await pool.query(
      `INSERT INTO ajustes_pendientes (producto_id, local_id, modo, valor, motivo, stock_al_pedir, usuario_id, usuario_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, (local_id === 2 || local_id === '2') ? 2 : 1, modo === 'diferencia' ? 'diferencia' : 'exacto', v, String(motivo).trim(), p.rows[0].s || 0, usuario_id || null, usuario_nombre || null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const getAjustesPendientes = async (req, res) => {
  try {
    await asegurarSolicitudes(pool);
    const r = await pool.query(
      `SELECT a.*, p.nombre AS producto_nombre, p.marca AS producto_marca,
              CASE WHEN a.local_id = 2 THEN p.stock_ush ELSE p.stock_rg END AS stock_actual
       FROM ajustes_pendientes a JOIN productos p ON p.id = a.producto_id
       WHERE a.estado = 'pendiente' ${req.query.local_id ? 'AND a.local_id = $1' : ''}
       ORDER BY a.creado_en ASC`, req.query.local_id ? [String(req.query.local_id) === '2' ? 2 : 1] : []);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
};

const resolverAjuste = async (req, res) => {
  const client = await pool.connect();
  try {
    await asegurarSolicitudes(client);
    const { id } = req.params;
    const { aprobar, usuario_id, usuario_nombre, nota } = req.body;
    if (!(await puedeAjustar(client, usuario_id))) return res.status(403).json({ error: 'No tenés permiso para aprobar ajustes de stock' });
    await client.query('BEGIN');
    const a = await client.query(`SELECT * FROM ajustes_pendientes WHERE id = $1 FOR UPDATE`, [id]);
    if (!a.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado' }); }
    const s = a.rows[0];
    if (s.estado !== 'pendiente') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Este pedido ya se resolvió' }); }
    let resultado = null;
    if (aprobar === true) {
      resultado = await aplicarAjuste(client, { id: s.producto_id, modo: s.modo, valor: s.valor, local_id: s.local_id,
        motivo: s.motivo + ' (pedido por ' + (s.usuario_nombre || 'usuario') + ', aprobado por ' + (usuario_nombre || 'jefe') + ')',
        usuario_id: s.usuario_id, usuario_nombre: s.usuario_nombre });
      if (resultado.error) { await client.query('ROLLBACK'); return res.status(400).json({ error: resultado.error }); }
    }
    await client.query(`UPDATE ajustes_pendientes SET estado = $1, resuelto_por = $2, resuelto_en = NOW(), nota = $3 WHERE id = $4`,
      [aprobar === true ? 'aprobado' : 'rechazado', usuario_nombre || null, nota || null, id]);
    await client.query('COMMIT');
    res.json({ ok: true, estado: aprobar === true ? 'aprobado' : 'rechazado', ...(resultado || {}) });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); console.error(e); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
};

// Aplica un ajuste dentro de una transaccion abierta. Devuelve { stock_anterior, stock_nuevo } o { error }
async function aplicarAjuste(client, { id, modo, valor, motivo, usuario_id, usuario_nombre, local_id }) {
  const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
  const prodRes = await client.query(`SELECT ${colStock} AS stock_local FROM productos WHERE id = $1 FOR UPDATE`, [id]);
  if (prodRes.rows.length === 0) return { error: 'Producto no encontrado' };
  const stockAnterior = prodRes.rows[0].stock_local || 0;
  const stockNuevo = modo === 'diferencia' ? stockAnterior + parseInt(valor) : parseInt(valor);
  if (isNaN(stockNuevo) || stockNuevo < 0) return { error: 'El stock resultante no puede ser negativo' };
  await client.query(
    `UPDATE productos SET ${colStock} = $1, stock = COALESCE(${colStock === 'stock_rg' ? 'stock_ush' : 'stock_rg'}, 0) + $1 WHERE id = $2`,
    [stockNuevo, id]);
  await client.query(
    `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, stockAnterior, stockNuevo, stockNuevo - stockAnterior, String(motivo).trim(), usuario_id || null, usuario_nombre || null, local_id || 1]);
  return { stock_anterior: stockAnterior, stock_nuevo: stockNuevo };
}

// Ajuste manual de stock (queda registrado quien, cuando y por que).
// Acepta modo "exacto" (nuevo valor final) o "diferencia" (+/-).
// Solo el jefe o quien tenga el permiso "inventario.ajustar"; el resto lo pide con solicitarAjuste.
const ajustarStock = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { modo, valor, motivo, usuario_id, usuario_nombre, local_id } = req.body;

    if (!motivo || !motivo.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El motivo del ajuste es obligatorio' });
    }
    if (usuario_id && !(await puedeAjustar(client, usuario_id))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No tenés permiso para ajustar stock: pedí autorización', sin_permiso: true });
    }

    const colStock = (local_id === 2 || local_id === '2') ? 'stock_ush' : 'stock_rg';
    const prodRes = await client.query(`SELECT ${colStock} AS stock_local FROM productos WHERE id = $1`, [id]);
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const stockAnterior = prodRes.rows[0].stock_local || 0;

    let stockNuevo;
    if (modo === 'diferencia') {
      stockNuevo = stockAnterior + parseInt(valor);
    } else {
      stockNuevo = parseInt(valor);
    }
    if (isNaN(stockNuevo) || stockNuevo < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El stock resultante no puede ser negativo' });
    }

    // Ajusta el stock del local elegido y sincroniza el total
    await client.query(
      `UPDATE productos SET ${colStock} = $1,
         stock = CASE WHEN '${colStock}' = 'stock_rg' THEN $1 + COALESCE(stock_ush, 0) ELSE COALESCE(stock_rg, 0) + $1 END
       WHERE id = $2`,
      [stockNuevo, id]
    );
    await client.query(
      `INSERT INTO ajustes_stock (producto_id, stock_anterior, stock_nuevo, diferencia, motivo, usuario_id, usuario_nombre, local_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, stockAnterior, stockNuevo, stockNuevo - stockAnterior, motivo.trim(), usuario_id || null, usuario_nombre || null, local_id || 1]
    );

    await client.query('COMMIT');
    res.json({ stock_anterior: stockAnterior, stock_nuevo: stockNuevo });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al ajustar stock: ' + error.message });
  } finally {
    client.release();
  }
};

// Historial de ajustes (para auditoria)
const getHistorialAjustes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.nombre AS producto_nombre
       FROM ajustes_stock a
       JOIN productos p ON a.producto_id = p.id
       ORDER BY a.creado_en DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial de ajustes' });
  }
};

// Recalcula el "stock minimo" de cada producto (lo que usan las alertas de stock bajo) con la
// misma formula que "Que pedir": punto de pedido = venta diaria x (demora del proveedor + dias
// de seguridad). Usa hasta 60 dias de ventas; con menos de 14 dias de historia no toca el
// producto (muy poca info para que el numero sea confiable).
// La usan el boton "Recalcular stock minimo" y el recalculo automatico de cada noche.
async function recalcularMinimos(diasSeguridad = 7) {
  const DIAS_HISTORIAL = 60;
  const DIAS_SEGURIDAD = Math.min(90, Math.max(0, parseInt(diasSeguridad) || 0));
  const DIAS_MINIMOS_CONFIABLES = 14;
  const result = await pool.query(`
    SELECT vi.producto_id, SUM(vi.cantidad) AS total_vendido, MIN(v.creado_en) AS primera_venta,
           MAX(COALESCE(p.lead_time_dias, 7)) AS lead_time
    FROM venta_items vi
    JOIN ventas v ON v.id = vi.venta_id
    JOIN productos p ON p.id = vi.producto_id
    WHERE v.creado_en >= NOW() - INTERVAL '${DIAS_HISTORIAL} days'
      AND COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
      AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')
    GROUP BY vi.producto_id
  `);

  let actualizados = 0;
  let omitidosPocaHistoria = 0;
  const detalle = [];
  for (const row of result.rows) {
    const totalVendido = parseFloat(row.total_vendido) || 0;
    if (totalVendido <= 0) continue;
    const diasDesdePrimeraVenta = Math.max(1, Math.ceil((Date.now() - new Date(row.primera_venta).getTime()) / (1000 * 60 * 60 * 24)));
    const diasReales = Math.min(DIAS_HISTORIAL, diasDesdePrimeraVenta);
    if (diasReales < DIAS_MINIMOS_CONFIABLES) { omitidosPocaHistoria++; continue; }
    const ritmo = totalVendido / diasReales;
    const nuevoMinimo = Math.max(1, Math.ceil(ritmo * (parseInt(row.lead_time) || 7)) + Math.ceil(ritmo * DIAS_SEGURIDAD));
    const upd = await pool.query(
      'UPDATE productos SET stock_minimo = $1 WHERE id = $2 AND activo = TRUE RETURNING nombre, stock_minimo',
      [nuevoMinimo, row.producto_id]
    );
    if (upd.rows.length > 0) {
      actualizados++;
      detalle.push({ producto: upd.rows[0].nombre, stock_minimo_nuevo: upd.rows[0].stock_minimo, dias_usados: diasReales });
    }
  }
  return { productos_actualizados: actualizados, omitidos_por_poca_historia: omitidosPocaHistoria, detalle };
}

const recalcularStockMinimo = async (req, res) => {
  try {
    const r = await recalcularMinimos(req.body && req.body.dias_seguridad !== undefined ? req.body.dias_seguridad : 7);
    res.json({ mensaje: 'Stock minimo recalculado', ...r });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al recalcular stock minimo: ' + error.message });
  }
};

const VENTA_VALIDA_SQL = `COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
  AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')`;

// Formula unica de reposicion (la usan "Que pedir" y "Recalcular stock minimo"):
//   stock minimo (colchon)  = venta diaria x dias de seguridad
//   punto de pedido         = venta diaria x demora del proveedor + stock minimo
//   cuanto pedir            = venta diaria x (demora + dias a cubrir) + stock minimo - disponible
// "Disponible" = stock + lo que ya viene en camino - lo reservado por preventas.
const calcularReposicion = ({ vendido, diasVenta, stock, transito, reservado, leadTime, diasSeguridad, diasCobertura }) => {
  const ritmo = diasVenta > 0 ? vendido / diasVenta : 0;
  const disponible = stock + transito - reservado;
  const minimo = ritmo > 0 ? Math.ceil(ritmo * diasSeguridad) : 0;
  const puntoPedido = ritmo > 0 ? Math.ceil(ritmo * leadTime) + minimo : 0;
  const objetivo = ritmo > 0 ? Math.ceil(ritmo * (leadTime + diasCobertura)) + minimo : 0;
  const sugerido = Math.max(0, objetivo - disponible);
  return {
    ritmo_diario: Math.round(ritmo * 100) / 100,
    disponible, stock_minimo_calc: minimo, punto_pedido: puntoPedido, sugerido, objetivo,
    // Lo que sobra por encima de lo que hace falta (se puede traspasar a otro local)
    excedente: Math.max(0, disponible - objetivo),
    dias_de_stock: ritmo > 0 ? Math.floor(Math.max(0, stock - reservado) / ritmo) : null,
    necesita_pedido: ritmo > 0 && disponible <= puntoPedido,
  };
};

// Rotacion del inventario: que rota rapido, que esta lento o parado, clasificacion ABC por ventas
// y cuanta plata hay en cada grupo. Periodo configurable (30/60/90/180 dias) y por local.
//   dias de stock = stock / venta diaria del periodo
//   rapido <= 30 dias · normal <= 90 · lento > 90 · parado = sin ventas en el periodo
//   ABC: A = productos que suman el 80% de lo vendido, B = el siguiente 15%, C = el resto
// Productos nuevos: hasta que no pasan N dias desde que llegaron (se cargaron o entro su primer
// ingreso) quedan "en evaluacion" y no se marcan lentos ni parados. N lo elige cada negocio
// (por defecto 45). Su ritmo de venta se mide sobre los dias que llevan, no sobre todo el periodo.
let columnaCreadoProducto = null;
const DIAS_EVALUACION_DEFECTO = 45;
const getRotacion = async (req, res) => {
  try {
    const dias = [30, 60, 90, 180].includes(parseInt(req.query.dias)) ? parseInt(req.query.dias) : 90;
    const lid = String(req.query.local_id || '');
    const localNum = ['1', 'rg'].includes(lid) ? 1 : ['2', 'ush'].includes(lid) ? 2 : null;
    const colStock = localNum === 1 ? 'COALESCE(p.stock_rg, p.stock, 0)' : localNum === 2 ? 'COALESCE(p.stock_ush, 0)' : 'COALESCE(p.stock, 0)';
    const VALIDA = `COALESCE(v.anulada, FALSE) = FALSE AND COALESCE(v.canal, '') <> 'prueba'
      AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')`;
    const filtroLocal = localNum !== null ? `AND v.local_id = ${localNum}` : '';
    if (columnaCreadoProducto === null) {
      const c = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'productos' AND column_name = 'creado_en'`);
      columnaCreadoProducto = c.rows.length > 0;
    }
    let diasEvaluacion = DIAS_EVALUACION_DEFECTO;
    try {
      const cfg = await pool.query('SELECT * FROM configuracion_negocio WHERE id = 1');
      const v = cfg.rows[0] && parseInt(cfg.rows[0].rotacion_dias_evaluacion);
      if (v >= 0) diasEvaluacion = v;
    } catch (e) { /* sin configuracion: valor por defecto */ }
    const hayIngresos = !!(await pool.query(`SELECT to_regclass('ordenes_ingreso_items') AS t`)).rows[0].t;
    const r = await pool.query(`
      SELECT p.id, p.nombre, p.marca, p.categoria, COALESCE(p.costo, 0) AS costo, COALESCE(p.precio, 0) AS precio,
             COALESCE(p.lead_time_dias, 7) AS lead_time, pr.nombre AS proveedor, ${colStock} AS stock,
             COALESCE(s.unidades, 0) AS unidades, COALESCE(s.monto, 0) AS monto, u.ultima AS ultima_venta,
             GREATEST(${columnaCreadoProducto ? 'p.creado_en' : 'NULL::timestamp'}, ${hayIngresos ? 'pi.primero' : 'NULL::timestamp'}) AS llego_en
      FROM productos p
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      LEFT JOIN (
        SELECT vi.producto_id, SUM(vi.cantidad) AS unidades, SUM(vi.cantidad * vi.precio_unitario) AS monto
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
        WHERE ${VALIDA} AND v.creado_en >= NOW() - INTERVAL '${dias} days' ${filtroLocal}
        GROUP BY vi.producto_id
      ) s ON s.producto_id = p.id
      LEFT JOIN (
        SELECT vi.producto_id, MAX(v.creado_en) AS ultima
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
        WHERE ${VALIDA} ${filtroLocal}
        GROUP BY vi.producto_id
      ) u ON u.producto_id = p.id
      ${hayIngresos ? `LEFT JOIN (
        SELECT oii.producto_id, MIN(oi.creado_en) AS primero
        FROM ordenes_ingreso_items oii JOIN ordenes_ingreso oi ON oi.id = oii.orden_id
        GROUP BY oii.producto_id
      ) pi ON pi.producto_id = p.id` : ''}
      WHERE p.activo = TRUE AND (${colStock} > 0 OR COALESCE(s.unidades, 0) > 0)`);

    const productos = r.rows.map(row => {
      const stock = parseFloat(row.stock) || 0, unidades = parseFloat(row.unidades) || 0;
      const costo = parseFloat(row.costo) || 0, precio = parseFloat(row.precio) || 0;
      // Dias que lleva el producto en el local (null = no se sabe: se toma como viejo)
      const edad = row.llego_en ? Math.max(0, Math.floor((Date.now() - new Date(row.llego_en).getTime()) / 86400000)) : null;
      const enEvaluacion = edad !== null && edad < diasEvaluacion;
      // El ritmo de un producto nuevo se mide sobre los dias que lleva, no sobre todo el periodo
      const diasVenta = edad !== null && edad < dias ? Math.max(7, edad) : dias;
      const ritmo = unidades / diasVenta;
      const diasStock = ritmo > 0 ? stock / ritmo : null;
      let estado;
      if (stock <= 0) estado = 'agotado';
      else if (diasStock !== null && diasStock <= 30) estado = 'rapido';
      else if (enEvaluacion) estado = 'nuevo';
      else if (unidades <= 0) estado = 'parado';
      else if (diasStock <= 90) estado = 'normal';
      else estado = 'lento';
      const leadTime = parseInt(row.lead_time) || 7;
      return {
        id: row.id, nombre: row.nombre, marca: row.marca, categoria: row.categoria, proveedor: row.proveedor,
        stock, unidades, monto: parseFloat(row.monto) || 0, costo, precio,
        valor_costo: Math.max(0, stock) * costo,
        dias_stock: diasStock !== null ? Math.round(diasStock) : null,
        ultima_venta: row.ultima_venta,
        estado,
        edad_dias: edad,
        evalua_en: enEvaluacion ? diasEvaluacion - edad : 0,
        // Descuento maximo que todavia recupera el costo (para liquidar sin perder)
        descuento_max: precio > 0 && costo > 0 && precio > costo ? Math.floor((1 - costo / precio) * 100) : 0,
        reponer: stock <= 0 ? unidades > 0 : (diasStock !== null && diasStock <= leadTime + 7),
      };
    });

    // ABC por lo vendido en el periodo
    const conVentas = productos.filter(x => x.monto > 0).sort((a, b) => b.monto - a.monto);
    const totalVendido = conVentas.reduce((s, x) => s + x.monto, 0);
    let acumulado = 0;
    conVentas.forEach(x => { const antes = acumulado; acumulado += x.monto; x.abc = antes / totalVendido < 0.8 ? 'A' : antes / totalVendido < 0.95 ? 'B' : 'C'; });
    productos.forEach(x => { if (!x.abc) x.abc = 'C'; });
    // Solo los reponer de clase A o B (los que de verdad venden)
    productos.forEach(x => { x.reponer = x.reponer && x.abc !== 'C'; });

    const suma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
    const valorTotal = suma(productos, x => x.valor_costo);
    const clases = ['A', 'B', 'C'].map(c => {
      const l = productos.filter(x => x.abc === c);
      return { clase: c, productos: l.length, ventas: suma(l, x => x.monto), ventas_pct: totalVendido > 0 ? suma(l, x => x.monto) / totalVendido * 100 : 0, valor_costo: suma(l, x => x.valor_costo), valor_pct: valorTotal > 0 ? suma(l, x => x.valor_costo) / valorTotal * 100 : 0 };
    });
    const porEstado = {};
    ['rapido', 'normal', 'lento', 'parado', 'agotado', 'nuevo'].forEach(e => {
      const l = productos.filter(x => x.estado === e);
      porEstado[e] = { productos: l.length, valor_costo: suma(l, x => x.valor_costo) };
    });

    // Alquiler real por mes (promedio de los ultimos 90 dias), para el costo de espacio de la
    // mercaderia quieta. Lo compartido entre locales (sin local) cuenta la mitad para cada uno.
    let alquilerMes = 0;
    try {
      const al = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN m.local_id IS NULL AND $1::int IS NOT NULL THEN m.importe / 2 ELSE m.importe END), 0) AS total
        FROM movimientos_caja m LEFT JOIN categorias_costo cc ON cc.id = m.categoria_id
        WHERE m.tipo = 'E' AND COALESCE(m.anulado, FALSE) = FALSE
          AND (cc.nombre ILIKE '%alquil%' OR m.concepto ILIKE '%alquil%')
          AND m.creado_en >= NOW() - INTERVAL '90 days'
          AND ($1::int IS NULL OR m.local_id = $1::int OR m.local_id IS NULL)`, [localNum]);
      alquilerMes = (parseFloat(al.rows[0].total) || 0) / 3;
    } catch (e) { console.error('alquiler para rotacion:', e.message); }
    const unidadesStock = productos.reduce((s, x) => s + Math.max(0, x.stock), 0);
    const unidadesQuietas = productos.filter(x => x.estado === 'parado' || x.estado === 'lento').reduce((s, x) => s + Math.max(0, x.stock), 0);

    res.json({
      dias, local_id: localNum, dias_evaluacion: diasEvaluacion,
      alquiler_mes: alquilerMes,
      unidades_stock: unidadesStock,
      unidades_quietas: unidadesQuietas,
      valor_total: valorTotal,
      vendido_total: totalVendido,
      por_estado: porEstado,
      clases,
      reponer: productos.filter(x => x.reponer).length,
      productos: productos.sort((a, b) => b.valor_costo - a.valor_costo),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular la rotación: ' + error.message });
  }
};

// Sugerencia de compra para un proveedor: cada producto con su ritmo real de venta por local,
// el punto de pedido, cuanto pedir para cubrir N dias y el costo estimado del pedido.
const getSugerenciaCompra = async (req, res) => {
  try {
    const { proveedor_id } = req.query;
    if (!proveedor_id) return res.status(400).json({ error: 'Elegi un proveedor' });
    const diasAnalisis = Math.min(365, Math.max(7, parseInt(req.query.dias_analisis) || 30));
    const diasCobertura = Math.min(365, Math.max(1, parseInt(req.query.dias_cobertura) || 30));
    const diasSeguridad = Math.min(90, Math.max(0, parseInt(req.query.dias_seguridad ?? 7) || 0));
    const leadOverride = req.query.lead_time !== undefined && req.query.lead_time !== '' ? Math.max(0, parseInt(req.query.lead_time) || 0) : null;

    const hayVariantes = !!(await pool.query(`SELECT to_regclass('producto_variantes') AS t`)).rows[0].t;
    const [provRes, prodRes, ventasRes, varRes] = await Promise.all([
      pool.query('SELECT id, nombre, whatsapp, telefono, email FROM proveedores WHERE id = $1', [proveedor_id]),
      pool.query(`
        SELECT id, nombre, marca, codigo_barras, categoria, COALESCE(costo, 0) AS costo, COALESCE(precio, 0) AS precio,
          COALESCE(stock_rg, 0) AS stock_rg, COALESCE(stock_ush, 0) AS stock_ush,
          COALESCE(stock_transito_rg, 0) AS transito_rg, COALESCE(stock_transito_ush, 0) AS transito_ush,
          COALESCE(reservado_rg, 0) AS reservado_rg, COALESCE(reservado_ush, 0) AS reservado_ush,
          COALESCE(stock_minimo, 0) AS stock_minimo, COALESCE(lead_time_dias, 7) AS lead_time_dias,
          GREATEST(1, LEAST($2::int, CEIL(EXTRACT(EPOCH FROM (NOW() - COALESCE(creado_en, NOW() - INTERVAL '365 days'))) / 86400)::int)) AS dias_vida
        FROM productos WHERE proveedor_id = $1 AND activo = TRUE ORDER BY nombre`, [proveedor_id, diasAnalisis]),
      pool.query(`
        SELECT vi.producto_id, v.local_id, SUM(vi.cantidad) AS vendido
        FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id JOIN productos p ON p.id = vi.producto_id
        WHERE p.proveedor_id = $1 AND v.creado_en >= NOW() - ($2 || ' days')::interval AND ${VENTA_VALIDA_SQL}
        GROUP BY vi.producto_id, v.local_id`, [proveedor_id, diasAnalisis]),
      // Productos con variantes (talles, colores): su stock esta en cada variante
      !hayVariantes ? { rows: [] } : pool.query(`
        SELECT pv.producto_id, SUM(COALESCE(pv.stock_rg, 0)) AS stock_rg, SUM(COALESCE(pv.stock_ush, 0)) AS stock_ush, COUNT(*) AS cantidad
        FROM producto_variantes pv JOIN productos p ON p.id = pv.producto_id
        WHERE p.proveedor_id = $1 AND COALESCE(pv.activo, TRUE) = TRUE
        GROUP BY pv.producto_id`, [proveedor_id]),
    ]);
    if (provRes.rows.length === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const vendidos = {};
    ventasRes.rows.forEach(r => {
      const k = r.producto_id;
      if (!vendidos[k]) vendidos[k] = { 1: 0, 2: 0 };
      vendidos[k][Number(r.local_id) === 2 ? 2 : 1] += parseFloat(r.vendido) || 0;
    });
    const variantes = {};
    varRes.rows.forEach(r => { variantes[r.producto_id] = r; });

    // Demora del proveedor: la que se eligio en pantalla, o la mas comun entre sus productos
    const conteoLead = {};
    prodRes.rows.forEach(p => { conteoLead[p.lead_time_dias] = (conteoLead[p.lead_time_dias] || 0) + 1; });
    const leadComun = prodRes.rows.length ? parseInt(Object.entries(conteoLead).sort((a, b) => b[1] - a[1])[0][0]) : 7;

    const productos = prodRes.rows.map(p => {
      const leadTime = leadOverride !== null ? leadOverride : parseInt(p.lead_time_dias);
      // Un producto nuevo se mide sobre los dias que lleva cargado, no sobre todo el periodo
      const diasVenta = Math.max(7, Math.min(diasAnalisis, parseInt(p.dias_vida) || diasAnalisis));
      const vv = variantes[p.id];
      const stock = {
        1: parseInt(p.stock_rg) + (vv ? parseInt(vv.stock_rg) || 0 : 0),
        2: parseInt(p.stock_ush) + (vv ? parseInt(vv.stock_ush) || 0 : 0),
      };
      const vend = vendidos[p.id] || { 1: 0, 2: 0 };
      const porLocal = {};
      [1, 2].forEach(l => {
        porLocal[l] = {
          stock: stock[l],
          transito: parseInt(l === 1 ? p.transito_rg : p.transito_ush) || 0,
          reservado: parseInt(l === 1 ? p.reservado_rg : p.reservado_ush) || 0,
          vendido: vend[l],
          ...calcularReposicion({
            vendido: vend[l], diasVenta, stock: stock[l],
            transito: parseInt(l === 1 ? p.transito_rg : p.transito_ush) || 0,
            reservado: parseInt(l === 1 ? p.reservado_rg : p.reservado_ush) || 0,
            leadTime, diasSeguridad, diasCobertura,
          }),
        };
      });
      const total = calcularReposicion({
        vendido: vend[1] + vend[2], diasVenta, stock: stock[1] + stock[2],
        transito: porLocal[1].transito + porLocal[2].transito,
        reservado: porLocal[1].reservado + porLocal[2].reservado,
        leadTime, diasSeguridad, diasCobertura,
      });
      return {
        id: p.id, nombre: p.nombre, marca: p.marca, codigo_barras: p.codigo_barras, categoria: p.categoria,
        costo: parseFloat(p.costo), precio: parseFloat(p.precio),
        lead_time_dias: leadTime, dias_venta: diasVenta, stock_minimo_guardado: parseInt(p.stock_minimo),
        tiene_variantes: !!vv, cantidad_variantes: vv ? parseInt(vv.cantidad) : 0,
        vendido: vend[1] + vend[2], stock: stock[1] + stock[2],
        transito: porLocal[1].transito + porLocal[2].transito, reservado: porLocal[1].reservado + porLocal[2].reservado,
        ...total,
        por_local: porLocal,
        sin_ventas: vend[1] + vend[2] === 0,
      };
    });
    const orden = (x) => (x.necesita_pedido ? 0 : x.sugerido > 0 ? 1 : x.sin_ventas ? 3 : 2);
    productos.sort((a, b) => orden(a) - orden(b) || (a.dias_de_stock ?? 9999) - (b.dias_de_stock ?? 9999));

    res.json({
      proveedor: provRes.rows[0],
      dias_analisis: diasAnalisis, dias_cobertura: diasCobertura, dias_seguridad: diasSeguridad,
      lead_time: leadOverride !== null ? leadOverride : leadComun, lead_time_comun: leadComun,
      productos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular la sugerencia de compra: ' + error.message });
  }
};

// Guarda la demora de entrega del proveedor en todos sus productos
const guardarLeadTimeProveedor = async (req, res) => {
  try {
    const provId = parseInt(req.body.proveedor_id);
    const dias = parseInt(req.body.lead_time_dias);
    if (!provId || isNaN(dias) || dias < 0 || dias > 180) return res.status(400).json({ error: 'Poné una demora entre 0 y 180 días' });
    const r = await pool.query('UPDATE productos SET lead_time_dias = $1 WHERE proveedor_id = $2 AND activo = TRUE', [dias, provId]);
    res.json({ ok: true, productos_actualizados: r.rowCount });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la demora: ' + error.message });
  }
};

// Guarda el punto de pedido calculado como "stock minimo" de cada producto (lo usan las
// alertas de stock bajo): asi el aviso salta justo cuando hay que volver a pedir.
const guardarMinimos = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    let n = 0;
    for (const it of items) {
      const id = parseInt(it.id); const min = parseInt(it.stock_minimo);
      if (!id || isNaN(min) || min < 0) continue;
      const r = await pool.query('UPDATE productos SET stock_minimo = $1 WHERE id = $2', [min, id]);
      n += r.rowCount;
    }
    res.json({ ok: true, productos_actualizados: n });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar: ' + error.message });
  }
};

module.exports = { getRotacion, recalcularMinimos, guardarLeadTimeProveedor, guardarMinimos, getAll, getById, create, update, remove, getAlertas, getTransito, ajustarStock, getHistorialAjustes, recalcularStockMinimo, getSugerenciaCompra, cambiarEstado, getImagenes, getImagen, guardarImagen, borrarImagen , solicitarAjuste, getAjustesPendientes, resolverAjuste };