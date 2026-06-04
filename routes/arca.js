const express = require('express');
const router = express.Router();
const forge = require('node-forge');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const CUIT = '30717641945';
const PUNTO_VENTA = 5;
const CERT_CONTENT = process.env.ARCA_CERT;
const KEY_CONTENT = process.env.ARCA_KEY;

const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';

// Generar TRA (Ticket de Requerimiento de Acceso)
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

// Firmar TRA con certificado
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

// Obtener token de acceso de ARCA
async function obtenerToken() {
  // Verificar si hay token válido en DB
  const tokenGuardado = await pool.query(
    `SELECT token, sign, expiracion FROM arca_tokens 
     WHERE expiracion > NOW() 
     ORDER BY id DESC LIMIT 1`
  );
  
  if (tokenGuardado.rows.length > 0) {
    return {
      token: tokenGuardado.rows[0].token,
      sign: tokenGuardado.rows[0].sign
    };
  }
  
  // Generar nuevo token
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
  // Decodificar el XML escapado dentro de loginCmsReturn
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
  
  // Guardar token en DB
  await pool.query(
    `INSERT INTO arca_tokens (token, sign, expiracion) VALUES ($1, $2, $3)`,
    [token, sign, expiracion]
  );
  
  return { token, sign };
}

// Obtener último número de comprobante
router.get('/ultimo-comprobante/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const { token, sign } = await obtenerToken();
    
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
    const nro = nroMatch ? parseInt(nroMatch[1]) : 0;
    
    res.json({ ultimo: nro, siguiente: nro + 1 });
  } catch (error) {
    console.error('Error ARCA:', error.message);
    res.status(500).json({ error: 'Error al conectar con ARCA: ' + error.message });
  }
});

// Emitir factura electrónica y obtener CAE
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
  return { data: { siguiente: (nroMatch ? parseInt(nroMatch[1]) : 0) + 1 } };
}
router.post('/emitir', async (req, res) => {
  try {
    const { tipo, items, total, cliente_cuit, venta_id } = req.body;
    const { token, sign } = await obtenerToken();
    
    const tipoNum = tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11;
    
    // Obtener siguiente número
    const ultimoRes = await obtenerUltimoComprobante(tipo, token, sign);
    const nroComprobante = ultimoRes.data.siguiente;
    
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ivaTotal = tipo === 'A' ? Math.round(total * 0.21 / 1.21 * 100) / 100 : 0;
    const neto = tipo === 'A' ? Math.round(total / 1.21 * 100) / 100 : total;
    
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
            <DocTipo>${tipo === 'A' ? 80 : 99}</DocTipo>
            <DocNro>${cliente_cuit ? cliente_cuit.replace(/[-]/g, '') : 0}</DocNro>
            <CbteDesde>${nroComprobante}</CbteDesde>
            <CbteHasta>${nroComprobante}</CbteHasta>
            <CbteFch>${hoy}</CbteFch>
            <ImpTotal>${total}</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
            <ImpNeto>${neto}</ImpNeto>
            <ImpOpEx>0</ImpOpEx>
            <ImpIVA>${ivaTotal}</ImpIVA>
            <ImpTrib>0</ImpTrib>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            ${tipo === 'A' ? `<Iva>
              <AlicIva>
                <Id>5</Id>
                <BaseImp>${neto}</BaseImp>
                <Importe>${ivaTotal}</Importe>
              </AlicIva>
            </Iva>` : ''}
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
      throw new Error(errMatch ? errMatch[1] : 'ARCA rechazó la factura');
    }
    
    const cae = caeMatch[1];
    const caeFch = caeFchMatch ? caeFchMatch[1] : '';
    
    // Actualizar venta con CAE
    if (venta_id) {
      await pool.query(
        'UPDATE ventas SET cae = $1, estado = $2 WHERE id = $3',
        [cae, 'emitida', venta_id]
      );
    }
    
    res.json({ 
      cae, 
      caeFch, 
      nroComprobante,
      tipo,
      puntoVenta: PUNTO_VENTA,
      mensaje: `Factura ${tipo} N° ${String(PUNTO_VENTA).padStart(4,'0')}-${String(nroComprobante).padStart(8,'0')} emitida correctamente`
    });
    
  } catch (error) {
    console.error('Error ARCA:', error.message);
    res.status(500).json({ error: 'Error al emitir factura: ' + error.message });
  }
});

// Verificar conexión con ARCA
router.get('/estado', async (req, res) => {
  try {
    await obtenerToken();
    res.json({ estado: 'conectado', cuit: CUIT, puntoVenta: PUNTO_VENTA });
  } catch (error) {
    res.status(500).json({ estado: 'error', mensaje: error.message });
  }
});

module.exports = router;