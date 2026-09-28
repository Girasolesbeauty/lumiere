const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const pool = require('../config/database');

const router = express.Router();

// Asistente de ayuda: responde dudas sobre como usar Lumiere a partir del manual del
// sistema. Necesita la variable de entorno ANTHROPIC_API_KEY en el servidor.
const MANUAL = fs.readFileSync(path.join(__dirname, '..', 'ayuda', 'manual-lumiere.md'), 'utf8');

const INSTRUCCIONES = `Sos el asistente de ayuda de Lumiere, un sistema de gestión para comercios (punto de venta con factura electrónica de ARCA, stock, caja, clientes, compras, finanzas y equipo). Quien te escribe es un usuario del sistema: dueño, administrativo o vendedor de un negocio.

Tu trabajo es explicar cómo usar Lumiere y resolver dudas de uso. Respondé en español rioplatense (vos), claro y breve:
- Cuando pregunten cómo hacer algo, dá los pasos numerados, con el nombre exacto de la sección del menú, la pestaña y los botones como aparecen en el manual (por ejemplo: Finanzas → Resumen → "Registrar egreso").
- Si la pregunta es de concepto (qué es el punto de pedido, qué significa el margen neto), explicalo en 2 o 3 frases simples y, si aplica, dónde se ve en Lumiere.
- Basate en el manual de abajo. Si algo no está en el manual o no estás seguro de cómo funciona en Lumiere, decilo con honestidad y sugerí dónde mirar o consultar con el dueño del sistema; no inventes pantallas, botones ni funciones.
- No tenés acceso a los datos del negocio (ventas, stock, clientes): si te piden un número puntual, explicá en qué pantalla lo pueden ver.
- Si el usuario no ve una sección, probablemente le falte el permiso: tiene que pedírselo al jefe (Configuración → Usuarios).
- Para temas impositivos o contables puntuales, dá una orientación general y recomendá confirmarlo con el contador.
- Usá formato simple: párrafos cortos, listas con guiones o números y **negrita** para nombres de botones. Nada de tablas ni encabezados grandes.
- Solo ayudás con el uso de Lumiere y la gestión del comercio. Si preguntan otra cosa, respondé amablemente que solo podés ayudar con Lumiere.

<manual>
${MANUAL}
</manual>`;

let cliente = null;
const obtenerCliente = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cliente) cliente = new Anthropic();
  return cliente;
};

// Limite simple por IP para que nadie use el asistente sin freno (cada consulta tiene costo)
const USOS = new Map();
const LIMITE = 30; // consultas
const VENTANA_MS = 60 * 60 * 1000; // por hora
const permitido = (ip) => {
  const ahora = Date.now();
  const lista = (USOS.get(ip) || []).filter(t => ahora - t < VENTANA_MS);
  if (lista.length >= LIMITE) { USOS.set(ip, lista); return false; }
  lista.push(ahora);
  USOS.set(ip, lista);
  return true;
};

const NOMBRES_SECCION = {
  dashboard: 'Dashboard', pos: 'Punto de Venta', 'ventas-online': 'Ventas Online', 'buscar-precio': 'Buscar Precio',
  'cambio-devolucion': 'Cambio / Devolución', inventory: 'Inventario', ordenes: 'Ingresos', inconsistencias: 'Inconsistencias',
  kits: 'Kits', insumos: 'Insumos', 'control-inv': 'Control de Inventario', caja: 'Caja', 'caja-respaldo': 'Caja de Respaldo',
  cierre: 'Cierre de Caja', giftcards: 'Gift Cards', clients: 'Clientes', pedidos: 'Pedidos', fidelizacion: 'Fidelización',
  tareas: 'Tareas', finance: 'Finanzas', comprobantes: 'Comprobantes', comisiones: 'Comisiones', compras: 'Compras y proveedores',
  calculadoras: 'Calculadoras', productividad: 'Productividad', cupones: 'Cupones', promociones: 'Promociones',
  postventa: 'Postventa WA', portal: 'Portal Cliente', 'config-negocio': 'Configuración del Negocio', usuarios: 'Usuarios',
  'config-insumos': 'Insumos en POS', 'config-ticket': 'Ticket', auditoria: 'Auditoría',
};

router.get('/estado', (req, res) => {
  res.json({ disponible: !!process.env.ANTHROPIC_API_KEY });
});

router.post('/', async (req, res) => {
  const client = obtenerCliente();
  if (!client) return res.status(503).json({ error: 'El asistente todavía no está configurado en este servidor.' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'desconocida';
  if (!permitido(ip)) return res.status(429).json({ error: 'Hiciste muchas consultas seguidas. Probá de nuevo en un rato.' });

  // Conversacion: alternada usuario/asistente, solo texto, recortada a lo ultimo
  const entrada = Array.isArray(req.body.mensajes) ? req.body.mensajes : [];
  const mensajes = entrada
    .filter(m => m && (m.rol === 'usuario' || m.rol === 'asistente') && typeof m.texto === 'string' && m.texto.trim())
    .slice(-12)
    .map(m => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto.slice(0, 3000) }));
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift();
  if (!mensajes.length || mensajes[mensajes.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Escribí tu pregunta.' });
  }

  // Contexto de quien pregunta (va despues del manual, que queda en cache)
  let negocio = '';
  try {
    const r = await pool.query('SELECT nombre_negocio FROM configuracion_negocio WHERE id = 1');
    negocio = r.rows[0]?.nombre_negocio || '';
  } catch (e) { /* sin nombre de negocio no pasa nada */ }
  const rol = String(req.body.rol || '').slice(0, 30);
  const seccion = NOMBRES_SECCION[req.body.seccion] || '';
  const contexto = [
    negocio && `Negocio: ${negocio}.`,
    rol && `Rol del usuario: ${rol}.`,
    seccion && `El usuario está ahora en la sección: ${seccion}.`,
  ].filter(Boolean).join(' ');

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: INSTRUCCIONES, cache_control: { type: 'ephemeral' } },
        ...(contexto ? [{ type: 'text', text: contexto }] : []),
      ],
      messages: mensajes,
    });

    if (response.stop_reason === 'refusal') {
      return res.json({ texto: 'No puedo ayudarte con eso. Si es una duda sobre cómo usar Lumiere, probá contarme qué querés hacer.' });
    }
    const texto = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    res.json({ texto: texto || 'No pude armar una respuesta. ¿Podés reformular la pregunta?' });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'El asistente está muy ocupado. Probá de nuevo en un minuto.' });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Asistente: la clave de Anthropic no es válida');
      return res.status(503).json({ error: 'El asistente no está bien configurado en este servidor.' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Asistente: error de la API', error.status, error.message);
      return res.status(502).json({ error: 'El asistente no respondió. Probá de nuevo.' });
    }
    console.error('Asistente:', error);
    res.status(500).json({ error: 'El asistente no respondió. Probá de nuevo.' });
  }
});

module.exports = router;
