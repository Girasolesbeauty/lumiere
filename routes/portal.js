const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { NIVELES, VENTA_VALIDA, obtenerUmbrales, gastoDeCliente } = require('../lib/niveles');

// El DNI se compara solo por sus numeros: "30.111.222", "30111222" y "30 111 222" son el mismo.
const soloNumeros = (x) => String(x || '').replace(/\D/g, '');
const buscarPorDni = (dni) => pool.query(
  `SELECT * FROM clientes WHERE regexp_replace(COALESCE(cuit_dni, ''), '\\D', '', 'g') = $1
    ORDER BY (password_hash IS NOT NULL) DESC, id LIMIT 1`, [soloNumeros(dni)]);

// Limite de intentos de ingreso: 8 errores cada 15 minutos por DNI (evita que alguien pruebe claves sin parar)
const intentos = new Map();
const VENTANA_MS = 15 * 60 * 1000, MAX_INTENTOS = 8;
const bloqueado = (k) => {
  const r = intentos.get(k);
  if (!r || Date.now() - r.desde > VENTANA_MS) { intentos.delete(k); return false; }
  return r.n >= MAX_INTENTOS;
};
const sumarIntento = (k) => {
  if (intentos.size > 5000) intentos.clear();
  const r = intentos.get(k);
  if (!r || Date.now() - r.desde > VENTANA_MS) intentos.set(k, { n: 1, desde: Date.now() });
  else r.n++;
};

// Nombre y logo del negocio para mostrar en el portal (publico, sin datos sensibles)
router.get('/negocio', async (req, res) => {
  try {
    const r = await pool.query('SELECT nombre_negocio, logo_url FROM configuracion_negocio WHERE id = 1');
    res.json(r.rows[0] || { nombre_negocio: null, logo_url: null });
  } catch (e) { res.json({ nombre_negocio: null, logo_url: null }); }
});

// Middleware: valida el token del portal de clientas (separado del de empleadas)
const verificarTokenCliente = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No autorizado' });
  try {
    const token = auth.replace('Bearer ', '');
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    if (datos.tipo !== 'cliente') return res.status(401).json({ error: 'Token invalido' });
    req.clienteId = datos.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido o vencido' });
  }
};

// Registro: la clienta ya debe existir en la base (por DNI), solo crea su acceso al portal
router.post('/registro', async (req, res) => {
  try {
    const { dni, email, password } = req.body;
    if (!soloNumeros(dni) || !password) {
      return res.status(400).json({ error: 'El DNI y la contraseña son obligatorios' });
    }
    if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña tiene que tener al menos 6 caracteres' });
    const result = await buscarPorDni(dni);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No encontramos ese DNI. Si ya compraste en el local, pedí que lo carguen en tu ficha y volvé a intentar.' });
    }
    const cliente = result.rows[0];
    if (cliente.password_hash) {
      return res.status(400).json({ error: 'Ese DNI ya tiene una cuenta. Ingresá con tu contraseña.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE clientes SET password_hash = $1, portal_email = $2, portal_registrado_en = NOW() WHERE id = $3',
      [hashedPassword, email || null, cliente.id]
    );
    const token = jwt.sign({ id: cliente.id, tipo: 'cliente' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, puntos: cliente.puntos, nivel: cliente.nivel }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la cuenta' });
  }
});

// Login de clientas
router.post('/login', async (req, res) => {
  try {
    const { dni, password } = req.body;
    const ip = soloNumeros(dni) || 'vacio';
    if (bloqueado(ip)) return res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' });
    const result = await buscarPorDni(dni);
    if (result.rows.length === 0) {
      sumarIntento(ip);
      return res.status(401).json({ error: 'El DNI o la contraseña no son correctos' });
    }
    const cliente = result.rows[0];
    if (!cliente.password_hash) {
      return res.status(401).json({ error: 'Todavía no creaste tu cuenta con ese DNI. Tocá "Crear mi cuenta".' });
    }
    const passwordValido = await bcrypt.compare(String(password || ''), cliente.password_hash);
    if (!passwordValido) {
      sumarIntento(ip);
      return res.status(401).json({ error: 'El DNI o la contraseña no son correctos' });
    }
    intentos.delete(ip);
    const token = jwt.sign({ id: cliente.id, tipo: 'cliente' }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, puntos: cliente.puntos, nivel: cliente.nivel, email: cliente.portal_email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

// Datos del cliente logueado: puntos, nivel, historial de compras
router.get('/mis-datos', verificarTokenCliente, async (req, res) => {
  try {
    const clienteRes = await pool.query('SELECT id, nombre, email, telefono, puntos, nivel, total_compras, creado_en, fecha_nacimiento FROM clientes WHERE id = $1', [req.clienteId]);
    if (clienteRes.rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    const c = clienteRes.rows[0];
    const [umbrales, gastado] = await Promise.all([obtenerUmbrales(), gastoDeCliente(pool, req.clienteId).catch(() => parseFloat(c.total_compras) || 0)]);
    const cumpleEsteMes = !!c.fecha_nacimiento && new Date(c.fecha_nacimiento).getUTCMonth() === new Date().getMonth();
    delete c.fecha_nacimiento;

    const comprasRes = await pool.query(
      `SELECT v.id, v.numero_factura, v.total, v.creado_en,
        COALESCE(json_agg(json_build_object('nombre', p.nombre, 'cantidad', vi.cantidad)) FILTER (WHERE vi.id IS NOT NULL), '[]') AS items
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       LEFT JOIN productos p ON vi.producto_id = p.id
       WHERE v.cliente_id = $1 AND ${VENTA_VALIDA}
       GROUP BY v.id
       ORDER BY v.creado_en DESC
       LIMIT 50`,
      [req.clienteId]
    );

    res.json({ ...c, total_compras: gastado, gastado, umbrales, niveles: NIVELES, cumple_este_mes: cumpleEsteMes, pesos_por_punto: 100, compras: comprasRes.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

// Premios disponibles para el cliente logueado (respeta stock y mes de cumpleanos)
router.get('/premios', verificarTokenCliente, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM premios_fidelizacion WHERE activo = TRUE ORDER BY puntos_requeridos ASC');
    const clienteRes = await pool.query('SELECT fecha_nacimiento FROM clientes WHERE id = $1', [req.clienteId]);
    const fechaNac = clienteRes.rows[0]?.fecha_nacimiento;
    const mesActual = new Date().getMonth() + 1;
    const esMesCumple = fechaNac && (new Date(fechaNac).getMonth() + 1) === mesActual;

    // Se muestran TODOS los premios activos (motiva ver lo que se puede ganar). Los que hoy no se
    // pueden canjear vienen marcados: agotado o de cumpleanos fuera de su mes. El canje igual lo controla.
    const premios = result.rows
      .map(p => ({ ...p, disponible: p.stock_total === null ? null : Math.max(p.stock_total - (p.stock_usado || 0), 0) }))
      .map(p => ({ ...p, agotado: p.disponible === 0, fuera_de_mes: !!p.solo_mes_cumpleanos && !esMesCumple }));

    res.json(premios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener premios' });
  }
});

// Canjear un premio: genera codigo para mostrar en el local
router.post('/canjear', verificarTokenCliente, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { premio_id } = req.body;
    const clienteRes = await client.query('SELECT puntos, nivel, fecha_nacimiento FROM clientes WHERE id = $1 FOR UPDATE', [req.clienteId]);
    if (clienteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const cliente = clienteRes.rows[0];

    const premioRes = await client.query('SELECT * FROM premios_fidelizacion WHERE id = $1 AND activo = TRUE FOR UPDATE', [premio_id]);
    if (premioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Premio no disponible' });
    }
    const premio = premioRes.rows[0];

    if (premio.solo_mes_cumpleanos) {
      const mesActual = new Date().getMonth() + 1;
      const esMesCumple = cliente.fecha_nacimiento && (new Date(cliente.fecha_nacimiento).getMonth() + 1) === mesActual;
      if (!esMesCumple) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Este premio es exclusivo del mes de tu cumpleanos' });
      }
    }

    const rango = (n) => Math.max(0, NIVELES.indexOf(n || 'Bronze'));
    if (rango(cliente.nivel) < rango(premio.nivel_minimo)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este premio es para clientes nivel ' + premio.nivel_minimo + ' o más' });
    }

    if (premio.stock_total !== null && (premio.stock_total - (premio.stock_usado || 0)) <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este premio ya no tiene stock disponible' });
    }

    if (cliente.puntos < premio.puntos_requeridos) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No tenes suficientes puntos para este premio' });
    }

    await client.query('UPDATE clientes SET puntos = puntos - $1 WHERE id = $2', [premio.puntos_requeridos, req.clienteId]);
    await client.query('UPDATE premios_fidelizacion SET stock_usado = COALESCE(stock_usado, 0) + 1 WHERE id = $1', [premio_id]);

    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo, intentos = 0;
    while (intentos < 10) {
      codigo = 'PREMIO-' + Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
      const existe = await client.query('SELECT id FROM canjes_premios WHERE codigo = $1', [codigo]);
      if (existe.rows.length === 0) break;
      intentos++;
    }

    await client.query(
      `INSERT INTO canjes_premios (premio_id, cliente_id, codigo, puntos_usados, estado) VALUES ($1, $2, $3, $4, 'pendiente')`,
      [premio_id, req.clienteId, codigo, premio.puntos_requeridos]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Canje realizado! Mostra este codigo en el local', codigo });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al realizar el canje' });
  } finally {
    client.release();
  }
});

// Historial de canjes del cliente logueado
router.get('/mis-canjes', verificarTokenCliente, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cp.*, p.nombre AS premio_nombre, p.imagen_url
       FROM canjes_premios cp JOIN premios_fidelizacion p ON cp.premio_id = p.id
       WHERE cp.cliente_id = $1 ORDER BY cp.creado_en DESC`,
      [req.clienteId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tus canjes' });
  }
});

// Datos del sector influencer (solo si esta clienta esta vinculada a una influencer). 404 si no aplica.
router.get('/mi-influencer', verificarTokenCliente, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.codigo AS cupon_codigo, c.valor AS cupon_valor, c.tipo AS cupon_tipo,
        COALESCE(v.total_vendido, 0) AS total_vendido,
        COALESCE(v.cant_ventas, 0) AS cant_ventas,
        ROUND(COALESCE(v.total_vendido, 0) * i.comision_pct / 100, 2) AS comision_generada,
        COALESCE(p.total_pagado, 0) AS total_pagado,
        ROUND(COALESCE(v.total_vendido, 0) * i.comision_pct / 100, 2) - COALESCE(p.total_pagado, 0) AS pendiente
      FROM influencers i
      LEFT JOIN cupones c ON c.id = i.cupon_id
      LEFT JOIN (
        SELECT cupon_id, SUM(total) AS total_vendido, COUNT(*) AS cant_ventas
        FROM ventas
        WHERE cupon_id IS NOT NULL
        GROUP BY cupon_id
      ) v ON v.cupon_id = i.cupon_id
      LEFT JOIN (
        SELECT influencer_id, SUM(monto) AS total_pagado
        FROM influencer_pagos
        GROUP BY influencer_id
      ) p ON p.influencer_id = i.id
      WHERE i.cliente_id = $1 AND i.activo = TRUE
    `, [req.clienteId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No sos una influencer registrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tus datos de influencer' });
  }
});

// Regalos de campana asignados a esta influencer (solo si esta vinculada). Lista vacia si no aplica.
router.get('/mis-regalos', verificarTokenCliente, async (req, res) => {
  try {
    const inf = await pool.query('SELECT id FROM influencers WHERE cliente_id = $1 AND activo = TRUE', [req.clienteId]);
    if (inf.rows.length === 0) return res.json([]);
    const result = await pool.query(
      `SELECT id, producto_nombre, campana, codigo, estado, creado_en, entregado_en
       FROM influencer_regalos WHERE influencer_id = $1 ORDER BY creado_en DESC`,
      [inf.rows[0].id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tus regalos' });
  }
});

module.exports = router;