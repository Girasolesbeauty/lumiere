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
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id, proveedor_id } = req.body;
    // El stock inicial se carga en el local donde se creo el producto (stock_rg o stock_ush),
    // no solo en el campo "stock" agregado -- si no, cualquier operacion que mire el stock de
    // un local puntual (vender, ajustar, alertas) lo ve en 0 aunque el total muestre el numero real.
    const stockInicial = parseInt(stock) || 0;
    const esUsh = local_id === 2 || local_id === '2';
    const stockRg = esUsh ? 0 : stockInicial;
    const stockUsh = esUsh ? stockInicial : 0;
    const result = await pool.query(
      `INSERT INTO productos (nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id, proveedor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [nombre, marca, precio, costo, stockInicial, stockRg, stockUsh, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id || 1, proveedor_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo, proveedor_id } = req.body;
    const result = await pool.query(
      `UPDATE productos SET nombre=$1, marca=$2, precio=$3, costo=$4, stock=$5, 
       stock_minimo=$6, lead_time_dias=$7, categoria=$8, codigo_barras=$9,
       activo=COALESCE($10, activo), proveedor_id=$11
       WHERE id=$12 RETURNING *`,
      [nombre, marca, precio, costo, stock, stock_minimo, lead_time_dias, categoria, codigo_barras, activo, proveedor_id || null, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar producto' });
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

// Ajuste manual de stock (queda registrado quien, cuando y por que).
// Acepta modo "exacto" (nuevo valor final) o "diferencia" (+/-).
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

// Recalcula el stock minimo de cada producto segun su propio ritmo de venta real:
// promedio diario vendido x 30 dias de colchon deseado. Usa hasta 60 dias de historial,
// pero si el producto (o el negocio) tiene menos dias de datos, promedia sobre los dias
// reales disponibles en vez de dividir siempre por 60 -- si no, el promedio sale mas bajo
// de lo real y el stock minimo queda subestimado justo cuando el producto es nuevo.
// Con menos de 14 dias de historia, se prefiere no tocar el producto: muy poca info
// para que el numero sea confiable, y podria salir muy errático.
const recalcularStockMinimo = async (req, res) => {
  try {
    const DIAS_HISTORIAL = 60;
    const DIAS_COLCHON = 30;
    const DIAS_MINIMOS_CONFIABLES = 14;
    const result = await pool.query(`
      SELECT vi.producto_id, SUM(vi.cantidad) AS total_vendido,
             MIN(v.creado_en) AS primera_venta
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      WHERE v.creado_en >= NOW() - INTERVAL '${DIAS_HISTORIAL} days'
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

      const promedioDiario = totalVendido / diasReales;
      const nuevoMinimo = Math.max(1, Math.ceil(promedioDiario * DIAS_COLCHON));
      const upd = await pool.query(
        'UPDATE productos SET stock_minimo = $1 WHERE id = $2 AND activo = TRUE RETURNING nombre, stock_minimo',
        [nuevoMinimo, row.producto_id]
      );
      if (upd.rows.length > 0) {
        actualizados++;
        detalle.push({ producto: upd.rows[0].nombre, stock_minimo_nuevo: upd.rows[0].stock_minimo, dias_usados: diasReales });
      }
    }

    res.json({ mensaje: 'Stock minimo recalculado', productos_actualizados: actualizados, omitidos_por_poca_historia: omitidosPocaHistoria, detalle });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al recalcular stock minimo: ' + error.message });
  }
};

// Sugerencia de compra: para un proveedor puntual, calcula cuanto pedir de cada producto
// segun el ritmo real de venta en el periodo elegido (configurable). Devuelve stock minimo,
// punto de pedido (igual formula que las alertas, para que sea consistente en todo el
// sistema) y el lote recomendado a pedir para cubrir "dias_cobertura" hacia adelante,
// descontando lo que ya esta en camino (transito).
const getSugerenciaCompra = async (req, res) => {
  try {
    const { proveedor_id, local_id, dias_analisis, dias_cobertura } = req.query;
    if (!proveedor_id) return res.status(400).json({ error: 'Elegi un proveedor' });

    const diasAnalisis = parseInt(dias_analisis) || 30;
    const diasCobertura = parseInt(dias_cobertura) || 45;
    const esConsolidado = !local_id || local_id === 'consolidado';
    const esUsh = local_id === '2' || local_id === 2;

    // En modo consolidado se suman los dos locales (stock real + lo que ya viene en camino
    // en cualquiera de los dos); si se elige un local puntual, solo cuenta el de ese local.
    const colStockSelect = esConsolidado
      ? '(COALESCE(stock_rg,0) + COALESCE(stock_ush,0))'
      : (esUsh ? 'COALESCE(stock_ush,0)' : 'COALESCE(stock_rg,0)');
    const colTransitoSelect = esConsolidado
      ? '(COALESCE(stock_transito_rg,0) + COALESCE(stock_transito_ush,0))'
      : (esUsh ? 'COALESCE(stock_transito_ush,0)' : 'COALESCE(stock_transito_rg,0)');

    const productosRes = await pool.query(
      `SELECT id, nombre, marca, codigo_barras, ${colStockSelect} AS stock_actual, ${colTransitoSelect} AS en_transito,
              COALESCE(stock_minimo, 0) AS stock_minimo, COALESCE(lead_time_dias, 0) AS lead_time_dias
       FROM productos
       WHERE proveedor_id = $1 AND activo = TRUE
       ORDER BY nombre ASC`,
      [proveedor_id]
    );

    let ventasQuery = `
      SELECT vi.producto_id, SUM(vi.cantidad) AS vendido
      FROM venta_items vi
      JOIN ventas v ON v.id = vi.venta_id
      JOIN productos p ON p.id = vi.producto_id
      WHERE p.proveedor_id = $1
        AND v.creado_en >= NOW() - ($2 || ' days')::interval
        AND (COALESCE(v.es_preventa, FALSE) = FALSE OR v.estado_pago = 'confirmada')`;
    const ventasParams = [proveedor_id, diasAnalisis];
    // En consolidado, las ventas de los dos locales se suman todas (no se filtra por local_id).
    if (!esConsolidado && local_id) { ventasParams.push(local_id); ventasQuery += ` AND v.local_id = $${ventasParams.length}`; }
    ventasQuery += ' GROUP BY vi.producto_id';
    const ventasRes = await pool.query(ventasQuery, ventasParams);

    const ventasPorProducto = {};
    ventasRes.rows.forEach(r => { ventasPorProducto[r.producto_id] = parseFloat(r.vendido) || 0; });

    const productos = productosRes.rows.map(p => {
      const vendidoPeriodo = ventasPorProducto[p.id] || 0;
      const ritmoDiario = vendidoPeriodo / diasAnalisis;
      const puntoPedido = Math.ceil(1.2 * p.lead_time_dias + p.stock_minimo);
      const stockObjetivo = Math.ceil(ritmoDiario * diasCobertura);
      const stockActual = p.stock_actual || 0;
      const enTransito = p.en_transito || 0;
      const loteRecomendado = Math.max(stockObjetivo - stockActual - enTransito, 0);
      return {
        id: p.id, nombre: p.nombre, marca: p.marca, codigo_barras: p.codigo_barras,
        stock_actual: stockActual, en_transito: enTransito,
        stock_minimo: p.stock_minimo, punto_pedido: puntoPedido,
        vendido_periodo: vendidoPeriodo, ritmo_diario: Math.round(ritmoDiario * 100) / 100,
        lote_recomendado: loteRecomendado, necesita_pedido: stockActual <= puntoPedido
      };
    });

    productos.sort((a, b) => (b.necesita_pedido - a.necesita_pedido) || (a.stock_actual - b.stock_actual));
    res.json({ dias_analisis: diasAnalisis, dias_cobertura: diasCobertura, consolidado: esConsolidado, productos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al calcular la sugerencia de compra: ' + error.message });
  }
};

module.exports = { getAll, getById, create, update, remove, getAlertas, getTransito, ajustarStock, getHistorialAjustes, recalcularStockMinimo, getSugerenciaCompra };