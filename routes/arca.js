const express = require('express');
const router = express.Router();
const forge = require('node-forge');
const axios = require('axios');
const pool = require('../config/database');

const CUIT = '30717641945';
const PUNTO_VENTA = 5;
const CERT_CONTENT = process.env.ARCA_CERT;
const KEY_CONTENT = process.env.ARCA_KEY;

const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';

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

function firmarTRA(tra) {
  const cert = CERT_CONTENT;
  const key = KEY_CONTENT;
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

async function obtenerToken() {
  const tokenGuardado = await pool.query(
    `SELECT token, sign, expiracion FROM arca_tokens 
     WHERE expiracion > NOW() 
     ORDER BY id DESC LIMIT 1`
  );
  if (tokenGuardado.rows.length > 0) {
    return { token: tokenGuardado.rows[0].token, sign: tokenGuardado.rows[0].sign };
  }
  const tra = generarTRA();
  const cms = firmarTRA(tra);
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

async function obtenerUltimoComprobante(tipo, token, sign) {
  const tipoNum = tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11;
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${CUIT}</Cuit>
      </Auth>
      <PtoVta>${PUNTO_VENTA}</PtoVta>
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

// --- Lógica reutilizable: pedir CAE para una venta puntual ---
async function intentarEmitirCAE({ tipo, items, total, cliente_cuit, venta_id }) {
  const { token, sign } = await obtenerToken();
  const tipoNum = tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11;
  const nroComprobante = await obtenerUltimoComprobante(tipo, token, sign);
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ivaTotal = 0;
  const neto = total;

  const docLimpio = cliente_cuit ? cliente_cuit.toString().replace(/[^0-9]/g, '') : '';
  let docTipo, docNro;
  if (tipo === 'A') {
    docTipo = 80;
    docNro = docLimpio || 0;
  } else if (docLimpio.length === 11) {
    docTipo = 80; docNro = docLimpio;
  } else if (docLimpio.length === 7 || docLimpio.length === 8) {
    docTipo = 96; docNro = docLimpio;
  } else {
    docTipo = 99; docNro = 0;
  }

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${token}</Token>
        <Sign>${sign}</Sign>
        <Cuit>${CUIT}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${PUNTO_VENTA}</PtoVta>
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
      [cae, 'emitida', nroComprobante, caeFch, PUNTO_VENTA, venta_id]
    );
  }

  return {
    cae, caeFch, nroComprobante, tipo, puntoVenta: PUNTO_VENTA,
    mensaje: `Factura ${tipo} N° ${String(PUNTO_VENTA).padStart(4,'0')}-${String(nroComprobante).padStart(8,'0')} emitida correctamente`
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
    const { token, sign } = await obtenerToken();
    const siguiente = await obtenerUltimoComprobante(tipo, token, sign);
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
    await obtenerToken();
    res.json({ estado: 'conectado', cuit: CUIT, puntoVenta: PUNTO_VENTA });
  } catch (error) {
    res.status(500).json({ estado: 'error', mensaje: error.message });
  }
});

// --- NUEVO: cantidad de facturas realmente pendientes (para el badge del POS) ---
router.get('/pendientes/count', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT COUNT(*) FROM ventas
       WHERE canal = 'presencial' AND es_preventa = FALSE
         AND (cae IS NULL OR cae = '')
         AND monto_gift_card < total
         AND estado_facturacion != 'no_aplica'`
    );
    res.json({ pendientes: parseInt(r.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NUEVO: reintentar todas las pendientes (se llama desde un cron cada X minutos) ---
router.post('/reintentar-pendientes', async (req, res) => {
  const pendientes = await pool.query(
    `SELECT v.id, v.tipo_factura, v.total, c.cuit_dni AS cliente_cuit
     FROM ventas v
     LEFT JOIN clientes c ON v.cliente_id = c.id
     WHERE v.canal = 'presencial' AND v.es_preventa = FALSE
       AND (v.cae IS NULL OR v.cae = '')
       AND v.monto_gift_card < v.total
       AND v.estado_facturacion != 'no_aplica'
     ORDER BY v.id ASC`
  );

  const resultados = [];
  // Serial, no en paralelo: la numeración de comprobante depende del último autorizado en ARCA
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