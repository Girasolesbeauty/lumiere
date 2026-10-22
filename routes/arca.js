const express = require('express');
const router = express.Router();
const forge = require('node-forge');
const axios = require('axios');
const pool = require('../config/database');
const { acreditarEfectivoEnCaja } = require('../controllers/ventasController');
const { porNegocio } = require('../lib/contexto');

const WSAA_URL = process.env.ARCA_WSAA_URL || 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = process.env.ARCA_WSFE_URL || 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';

// Lee los datos fiscales (CUIT, punto de venta, certificado y clave) desde la configuracion
// del negocio guardada en la base. Si algun campo no esta cargado ahi, cae a las variables
// de entorno ARCA_CERT/ARCA_KEY (asi esta copia sigue funcionando igual que antes, sin
// obligar a recargar el certificado si ya estaba puesto por variable de entorno).
async function obtenerConfigArca() {
  const r = await pool.query('SELECT cuit, punto_venta, arca_cert, arca_key FROM configuracion_negocio WHERE id = 1');
  const fila = r.rows[0] || {};
  const cuit = (fila.cuit || process.env.ARCA_CUIT || '').replace(/[^0-9]/g, '');
  const puntoVenta = parseInt(fila.punto_venta) || parseInt(process.env.ARCA_PUNTO_VENTA) || 1;
  const cert = fila.arca_cert || process.env.ARCA_CERT;
  const key = fila.arca_key || process.env.ARCA_KEY;
  if (!cuit) throw new Error('Falta configurar el CUIT en Configuracion del Negocio antes de facturar');
  if (!cert || !key) throw new Error('Falta configurar el certificado de ARCA en Configuracion del Negocio antes de facturar');
  return { cuit, puntoVenta, cert, key };
}

function generarTRA() {
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - 60000);
  const hasta = new Date(ahora.getTime() + 600000);
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${desde.toISOString()}</generationTime>
    <expirationTime>${hasta.toISOString()}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
}

function firmarTRA(tra, cert, key) {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(key),
    certificate: forge.pki.certificateFromPem(cert),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{
      type: forge.pki.oids.contentType,
      value: forge.pki.oids.data
    }, {
      type: forge.pki.oids.messageDigest
    }, {
      type: forge.pki.oids.signingTime,
      value: new Date()
    }]
  });
  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, 'binary').toString('base64');
}

async function obtenerToken(cfg) {
  const tokenGuardado = await pool.query(
    `SELECT token, sign, expiracion FROM arca_tokens 
     WHERE expiracion > NOW() 
     ORDER BY id DESC LIMIT 1`
  );
  if (tokenGuardado.rows.length > 0) {
    return { token: tokenGuardado.rows[0].token, sign: tokenGuardado.rows[0].sign };
  }
  const tra = generarTRA();
  const cms = firmarTRA(tra, cfg.cert, cfg.key);
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov.ar">
      <in0>${cms}</in0>
    </loginCms>
  </soap:Body>
</soap:Envelope>`;
  const response = await axios.post(WSAA_URL, soapBody, {
    headers: { 'Content-Type': 'text/xml', 'SOAPAction': '' }
  });
  const xml = response.data;
  const returnMatch = xml.match(/<loginCmsReturn>(.*?)<\/loginCmsReturn>/s);
  const innerXml = returnMatch ? returnMatch[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&') : '';
  const tokenMatch = innerXml.match(/<token>(.*?)<\/token>/s);
  const signMatch = innerXml.match(/<sign>(.*?)<\/sign>/s);
  const expMatch = innerXml.match(/<expirationTime>(.*?)<\/expirationTime>/s);
  if (!tokenMatch || !signMatch) throw new Error('No se pudo obtener token de ARCA. Respuesta: ' + xml.substring(0, 500));
  const token = tokenMatch[1];
  const sign = signMatch[1];
  const expiracion = expMatch ? new Date(expMatch[1]) : new Date(Date.now() + 3600000);
  await pool.query(
    `INSERT INTO arca_tokens (token, sign, expiracion) VALUES ($1, $2, $3)`,
    [token, sign, expiracion]
  );
  return { token, sign };
}

// Codigo de comprobante en ARCA: facturas A=1, B=6, C=11; notas de credito A=3, B=8, C=13
const codigoComprobante = (tipo, notaCredito) => notaCredito
  ? (tipo === 'A' ? 3 : tipo === 'B' ? 8 : 13)
  : (tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11);

async function obtenerUltimoComprobante(tipo, token, sign, cfg, notaCredito = false) {
  const tipoNum = codigoComprobante(tipo, notaCredito);
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${cfg.cuit}</Cuit>
      </Auth>
      <PtoVta>${cfg.puntoVenta}</PtoVta>
      <CbteTipo>${tipoNum}</CbteTipo>
    </FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;
  const response = await axios.post(WSFE_URL, soapBody, {
    headers: { 'Content-Type': 'text/xml', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado' }
  });
  const nroMatch = response.data.match(/<CbteNro>(\d+)<\/CbteNro>/);
  return (nroMatch ? parseInt(nroMatch[1]) : 0) + 1;
}

// Tipo y numero de documento de la clienta (CUIT, DNI o consumidor final)
function documentoCliente(tipo, cliente_cuit) {
  const docLimpio = cliente_cuit ? cliente_cuit.toString().replace(/[^0-9]/g, '') : '';
  if (tipo === 'A') return { docTipo: 80, docNro: docLimpio || 0 };
  if (docLimpio.length === 11) return { docTipo: 80, docNro: docLimpio };
  if (docLimpio.length === 7 || docLimpio.length === 8) return { docTipo: 96, docNro: docLimpio };
  return { docTipo: 99, docNro: 0 };
}

// --- Logica reutilizable: pedir CAE para una venta puntual ---
async function intentarEmitirCAE({ tipo, items, total, cliente_cuit, venta_id }) {
  const cfg = await obtenerConfigArca();
  const { token, sign } = await obtenerToken(cfg);
  const tipoNum = codigoComprobante(tipo, false);
  const nroComprobante = await obtenerUltimoComprobante(tipo, token, sign, cfg);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).replace(/-/g, '');
  const ivaTotal = 0;
  const neto = total;

  const { docTipo, docNro } = documentoCliente(tipo, cliente_cuit);

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${cfg.cuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${cfg.puntoVenta}</PtoVta>
          <CbteTipo>${tipoNum}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${docNro}</DocNro>
            <CbteDesde>${nroComprobante}</CbteDesde>
            <CbteHasta>${nroComprobante}</CbteHasta>
            <CbteFch>${hoy}</CbteFch>
            <ImpTotal>${total}</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
           <ImpNeto>0</ImpNeto>
<ImpOpEx>${total}</ImpOpEx>
<ImpIVA>0</ImpIVA>
            <ImpTrib>0</ImpTrib>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            ${tipo === 'A' ? `<Iva><AlicIva><Id>5</Id><BaseImp>${neto}</BaseImp><Importe>${ivaTotal}</Importe></AlicIva></Iva>` : ''}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  const response = await axios.post(WSFE_URL, soapBody, {
    headers: { 'Content-Type': 'text/xml', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar' }
  });

  const caeMatch = response.data.match(/<CAE>(.*?)<\/CAE>/);
  const caeFchMatch = response.data.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);
  const resultMatch = response.data.match(/<Resultado>(.*?)<\/Resultado>/);

  if (!caeMatch || resultMatch?.[1] !== 'A') {
    const errMatch = response.data.match(/<Msg>(.*?)<\/Msg>/);
    throw new Error(errMatch ? errMatch[1] : 'ARCA rechazo la factura. Respuesta: ' + response.data.substring(0, 300));
  }

  const cae = caeMatch[1];
  const caeFch = caeFchMatch ? caeFchMatch[1] : '';

  if (venta_id) {
    await pool.query(
      `UPDATE ventas SET cae = $1, estado = $2, nro_comprobante = $3, cae_vto = $4, punto_venta = $5,
         estado_facturacion = 'facturada', intentos_facturacion = intentos_facturacion + 1, ultimo_error_facturacion = NULL
       WHERE id = $6`,
      [cae, 'emitida', nroComprobante, caeFch, cfg.puntoVenta, venta_id]
    );

    // Recien ahora que ARCA confirmo la factura de verdad, se acredita el efectivo en la
    // Caja (movimientos_caja_efectivo). Asi, si una venta fallo al facturar y alguien la
    // volvio a cargar de nuevo por error (pensando que no habia funcionado), la version
    // que quedo sin facturar nunca suma plata fantasma a la Caja -- solo la que
    // efectivamente se emitio.
    try {
      const ventaRow = await pool.query(
        `SELECT local_id, usuario_id, medio_pago_id, medio_pago, monto_gift_card, total, numero_factura, es_preventa
         FROM ventas WHERE id = $1`, [venta_id]
      );
      // Preventa: el efectivo ya entro a la Caja con la seña y con el saldo (al entregarla); no se vuelve a sumar
      if (ventaRow.rows.length > 0 && ventaRow.rows[0].es_preventa !== true) {
        const v = ventaRow.rows[0];
        const pagosMixtos = await pool.query(
          `SELECT medio_pago_id, medio_pago_nombre, importe FROM venta_pagos WHERE venta_id = $1`,
          [venta_id]
        );
        const montoGC = parseFloat(v.monto_gift_card) || 0;
        const ingresoCaja = parseFloat(v.total) - montoGC;
        if (ingresoCaja > 0) {
          await acreditarEfectivoEnCaja(pool, {
            pagos: pagosMixtos.rows.length > 0 ? pagosMixtos.rows : null,
            medio_pago_id: v.medio_pago_id, medio_pago_nombre: v.medio_pago,
            monto: ingresoCaja, local_id: v.local_id || 1, usuario_id: v.usuario_id,
            concepto: 'Venta ' + (v.numero_factura || '')
          });
        }
      }
    } catch (e) {
      console.error('No se pudo acreditar el efectivo en Caja para la venta ' + venta_id + ':', e.message);
      // No frenamos la respuesta de la factura por esto -- la factura ya se emitio bien,
      // esto solo afecta el resumen de Caja y se puede corregir a mano si hace falta.
    }
  }

  return {
    cae, caeFch, nroComprobante, tipo, puntoVenta: cfg.puntoVenta,
    mensaje: `Factura ${tipo} N° ${String(cfg.puntoVenta).padStart(4,'0')}-${String(nroComprobante).padStart(8,'0')} emitida correctamente`
  };
}

async function marcarError(venta_id, mensaje) {
  if (!venta_id) return;
  await pool.query(
    `UPDATE ventas SET intentos_facturacion = intentos_facturacion + 1, ultimo_error_facturacion = $1
     WHERE id = $2`,
    [mensaje, venta_id]
  );
}

router.get('/ultimo-comprobante/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const cfg = await obtenerConfigArca();
    const { token, sign } = await obtenerToken(cfg);
    const siguiente = await obtenerUltimoComprobante(tipo, token, sign, cfg);
    res.json({ siguiente });
  } catch (error) {
    res.status(500).json({ error: 'Error: ' + error.message });
  }
});

router.post('/emitir', async (req, res) => {
  const { venta_id } = req.body;
  try {
    const resultado = await intentarEmitirCAE(req.body);
    res.json(resultado);
  } catch (error) {
    console.error('Error ARCA emitir:', error.message);
    await marcarError(venta_id, error.message);
    res.status(500).json({ error: 'Error al emitir factura: ' + error.message });
  }
});

router.get('/estado', async (req, res) => {
  try {
    const cfg = await obtenerConfigArca();
    await obtenerToken(cfg);
    res.json({ estado: 'conectado', cuit: cfg.cuit, puntoVenta: cfg.puntoVenta });
  } catch (error) {
    res.status(500).json({ estado: 'error', mensaje: error.message });
  }
});

// --- Cantidad de facturas realmente pendientes (para el badge del POS) ---
router.get('/pendientes/count', async (req, res) => {
  try {
    await require('../lib/preventasFactura').asegurar();
    const r = await pool.query(
      `SELECT COUNT(*) FROM ventas
       WHERE canal = 'presencial' AND (es_preventa = FALSE OR estado_pago = 'confirmada')
         AND (cae IS NULL OR cae = '')
         AND monto_gift_card < total
         AND estado_facturacion != 'no_aplica'`
    );
    res.json({ pendientes: parseInt(r.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lista completa (no solo el numero) de ventas pendientes de facturar, para mostrar
// en una pantalla donde se puedan ver y reintentar una por una.
router.get('/pendientes', async (req, res) => {
  try {
    await require('../lib/preventasFactura').asegurar();
    const { local_id } = req.query;
    let q = `SELECT v.id, v.numero_factura, v.total, v.creado_en, v.ultimo_error_facturacion,
                    v.intentos_facturacion, v.local_id, c.nombre AS cliente_nombre
             FROM ventas v
             LEFT JOIN clientes c ON v.cliente_id = c.id
             WHERE v.canal = 'presencial' AND (v.es_preventa = FALSE OR v.estado_pago = 'confirmada')
               AND (v.cae IS NULL OR v.cae = '')
               AND v.monto_gift_card < v.total
               AND v.estado_facturacion != 'no_aplica'`;
    const params = [];
    if (local_id) { params.push(local_id); q += ` AND v.local_id = $${params.length}`; }
    q += ' ORDER BY v.creado_en ASC';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Reintentar todas las pendientes (se llama desde un cron cada X minutos) ---
// Reintentar UNA venta puntual (desde el panel de pendientes) -- usa los datos ya
// guardados de esa venta, no lo que haya en el carrito actual del POS. Asi se puede
// reintentar cualquier pendiente de la lista, no solo la ultima que fallo en esta sesion.
router.post('/reintentar/:venta_id', async (req, res) => {
  try {
    const { venta_id } = req.params;
    const ventaRes = await pool.query(
      `SELECT v.id, v.tipo_factura, v.total, v.monto_gift_card, c.cuit_dni AS cliente_cuit
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1`,
      [venta_id]
    );
    if (ventaRes.rows.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });
    const venta = ventaRes.rows[0];
    const itemsRes = await pool.query(
      `SELECT vi.producto_id, vi.cantidad, vi.precio_unitario FROM venta_items vi WHERE vi.venta_id = $1`,
      [venta.id]
    );
    const resultado = await intentarEmitirCAE({
      tipo: venta.tipo_factura || 'B',
      items: itemsRes.rows,
      total: parseFloat(venta.total) - parseFloat(venta.monto_gift_card || 0),
      cliente_cuit: venta.cliente_cuit,
      venta_id: venta.id
    });
    res.json(resultado);
  } catch (error) {
    await marcarError(req.params.venta_id, error.message);
    res.status(500).json({ error: 'Error al emitir factura: ' + error.message });
  }
});

// --- Notas de credito ---
// Anulan (total o parcialmente) una factura que ya tiene CAE. Es solo el comprobante fiscal:
// no devuelve stock ni mueve la caja (eso se hace con Cambios / anular venta como siempre).
const listaNC = porNegocio(false);
async function asegurarNC() {
  if (listaNC.get()) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS notas_credito (
    id SERIAL PRIMARY KEY,
    venta_id INT NOT NULL,
    tipo CHAR(1) NOT NULL,
    punto_venta INT NOT NULL,
    nro INT NOT NULL,
    cae TEXT NOT NULL,
    cae_vto TEXT,
    importe NUMERIC(14,2) NOT NULL,
    motivo TEXT,
    usuario_id INT,
    usuario_nombre TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW())`);
  await pool.query('CREATE INDEX IF NOT EXISTS notas_credito_venta_idx ON notas_credito (venta_id)');
  listaNC.set(true);
}
const puedeHacerNC = (req) => req.usuario && ['jefe', 'admin', 'administrativo'].includes(req.usuario.rol);
const redondear = (n) => Math.round(n * 100) / 100;

async function pedirCAENotaCredito({ cfg, token, sign, venta, importe }) {
  const tipo = venta.tipo_factura || 'B';
  const tipoNum = codigoComprobante(tipo, true);
  const nro = await obtenerUltimoComprobante(tipo, token, sign, cfg, true);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).replace(/-/g, '');
  const { docTipo, docNro } = documentoCliente(tipo, venta.cliente_cuit);
  const ptoVtaFactura = parseInt(venta.punto_venta) || cfg.puntoVenta;
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${cfg.cuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${cfg.puntoVenta}</PtoVta>
          <CbteTipo>${tipoNum}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${docNro}</DocNro>
            <CbteDesde>${nro}</CbteDesde>
            <CbteHasta>${nro}</CbteHasta>
            <CbteFch>${hoy}</CbteFch>
            <ImpTotal>${importe}</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
            <ImpNeto>0</ImpNeto>
            <ImpOpEx>${importe}</ImpOpEx>
            <ImpIVA>0</ImpIVA>
            <ImpTrib>0</ImpTrib>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            <CbtesAsoc>
              <CbteAsoc>
                <Tipo>${codigoComprobante(tipo, false)}</Tipo>
                <PtoVta>${ptoVtaFactura}</PtoVta>
                <Nro>${venta.nro_comprobante}</Nro>
                <Cuit>${cfg.cuit}</Cuit>
              </CbteAsoc>
            </CbtesAsoc>
            ${tipo === 'A' ? `<Iva><AlicIva><Id>5</Id><BaseImp>${importe}</BaseImp><Importe>0</Importe></AlicIva></Iva>` : ''}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;
  const response = await axios.post(WSFE_URL, soapBody, {
    headers: { 'Content-Type': 'text/xml', 'SOAPAction': 'http://ar.gov.afip.dif.FEV1/FECAESolicitar' }
  });
  const caeMatch = response.data.match(/<CAE>(.*?)<\/CAE>/);
  const caeFchMatch = response.data.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);
  const resultMatch = response.data.match(/<Resultado>(.*?)<\/Resultado>/);
  if (!caeMatch || !caeMatch[1] || resultMatch?.[1] !== 'A') {
    const obs = response.data.match(/<Obs>[\s\S]*?<Msg>(.*?)<\/Msg>/);
    const errMatch = obs || response.data.match(/<Msg>(.*?)<\/Msg>/);
    throw new Error(errMatch ? errMatch[1] : 'ARCA rechazó la nota de crédito. Respuesta: ' + String(response.data).substring(0, 300));
  }
  return { tipo, nro, puntoVenta: cfg.puntoVenta, cae: caeMatch[1], caeVto: caeFchMatch ? caeFchMatch[1] : '' };
}

// Notas de credito ya emitidas de una venta
router.get('/notas-credito/:venta_id', async (req, res) => {
  try {
    await asegurarNC();
    const r = await pool.query('SELECT * FROM notas_credito WHERE venta_id = $1 ORDER BY id', [parseInt(req.params.venta_id) || 0]);
    res.json({ notas: r.rows });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las notas de crédito: ' + error.message });
  }
});

// Emitir una nota de credito (total si no se manda importe)
router.post('/nota-credito/:venta_id', async (req, res) => {
  if (!puedeHacerNC(req)) return res.status(403).json({ error: 'Solo la dueña o administración puede emitir notas de crédito' });
  const ventaId = parseInt(req.params.venta_id) || 0;
  const motivo = String((req.body && req.body.motivo) || '').trim().slice(0, 300);
  if (!motivo) return res.status(400).json({ error: 'Contá el motivo de la nota de crédito' });
  let client;
  try {
    await asegurarNC();
    client = await pool.connect();
    await client.query('BEGIN');
    // Una nota de credito a la vez: la numeracion sale del ultimo autorizado en ARCA
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('lumiere_arca_nc'))`);
    const vr = await client.query(
      `SELECT v.id, v.tipo_factura, v.total, COALESCE(v.monto_gift_card, 0) AS monto_gift_card, v.cae, v.punto_venta, v.nro_comprobante,
         c.cuit_dni AS cliente_cuit
       FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id WHERE v.id = $1 FOR UPDATE OF v`, [ventaId]);
    const venta = vr.rows[0];
    if (!venta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Venta no encontrada' }); }
    if (!venta.cae || !venta.nro_comprobante) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Esta venta no tiene factura con CAE: no hace falta nota de crédito' }); }
    const facturado = redondear(parseFloat(venta.total) - parseFloat(venta.monto_gift_card || 0));
    const previas = await client.query('SELECT COALESCE(SUM(importe), 0) AS s FROM notas_credito WHERE venta_id = $1', [ventaId]);
    const disponible = redondear(facturado - parseFloat(previas.rows[0].s));
    if (disponible <= 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Esta factura ya tiene nota de crédito por el total' }); }
    const pedido = req.body && req.body.importe !== undefined && req.body.importe !== null && req.body.importe !== '' ? redondear(Number(req.body.importe)) : disponible;
    if (!(pedido > 0)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El importe tiene que ser mayor a cero' }); }
    if (pedido > disponible) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'El importe no puede superar lo que queda de la factura ($' + disponible.toLocaleString('es-AR') + ')' }); }

    const cfg = await obtenerConfigArca();
    const { token, sign } = await obtenerToken(cfg);
    const nc = await pedirCAENotaCredito({ cfg, token, sign, venta, importe: pedido });
    const ins = await client.query(
      `INSERT INTO notas_credito (venta_id, tipo, punto_venta, nro, cae, cae_vto, importe, motivo, usuario_id, usuario_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::int, (SELECT nombre FROM usuarios WHERE id = $9::int)) RETURNING *`,
      [ventaId, nc.tipo, nc.puntoVenta, nc.nro, nc.cae, nc.caeVto, pedido, motivo, req.usuario.id || null]);
    await client.query('COMMIT');
    res.json({
      nota: ins.rows[0], disponible: redondear(disponible - pedido),
      mensaje: `Nota de crédito ${nc.tipo} N° ${String(nc.puntoVenta).padStart(4, '0')}-${String(nc.nro).padStart(8, '0')} emitida correctamente`
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error ARCA nota de credito:', error.message);
    res.status(500).json({ error: 'No se pudo emitir la nota de crédito: ' + error.message });
  } finally {
    if (client) client.release();
  }
});

router.post('/reintentar-pendientes', async (req, res) => {
  const pendientes = await pool.query(
    `SELECT v.id, v.tipo_factura, v.total, v.monto_gift_card, c.cuit_dni AS cliente_cuit
     FROM ventas v
     LEFT JOIN clientes c ON v.cliente_id = c.id
     WHERE v.canal = 'presencial' AND (v.es_preventa = FALSE OR v.estado_pago = 'confirmada')
       AND (v.cae IS NULL OR v.cae = '')
       AND v.monto_gift_card < v.total
       AND v.estado_facturacion != 'no_aplica'
     ORDER BY v.id ASC`
  );

  const resultados = [];
  // Serial, no en paralelo: la numeracion de comprobante depende del ultimo autorizado en ARCA
  for (const venta of pendientes.rows) {
    const itemsRes = await pool.query(
      `SELECT vi.producto_id, vi.cantidad, vi.precio_unitario
       FROM venta_items vi WHERE vi.venta_id = $1`,
      [venta.id]
    );
    const items = itemsRes.rows;
    try {
      const r = await intentarEmitirCAE({
        tipo: venta.tipo_factura || 'B',
        items,
        total: parseFloat(venta.total) - parseFloat(venta.monto_gift_card || 0),
        cliente_cuit: venta.cliente_cuit,
        venta_id: venta.id
      });
      resultados.push({ venta_id: venta.id, ok: true, cae: r.cae });
    } catch (error) {
      await marcarError(venta.id, error.message);
      resultados.push({ venta_id: venta.id, ok: false, error: error.message });
    }
  }

  res.json({ procesadas: resultados.length, resultados });
});

module.exports = router;