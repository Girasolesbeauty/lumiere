const express = require('express');
const router = express.Router();
const forge = require('node-forge');
const axios = require('axios');
const pool = require('../config/database');
const { acreditarEfectivoEnCaja } = require('../controllers/ventasController');

const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';

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

async function obtenerUltimoComprobante(tipo, token, sign, cfg) {
  const tipoNum = tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11;
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

// --- Logica reutilizable: pedir CAE para una venta puntual ---
async function intentarEmitirCAE({ tipo, items, total, cliente_cuit, venta_id }) {
  const cfg = await obtenerConfigArca();
  const { token, sign } = await obtenerToken(cfg);
  const tipoNum = tipo === 'A' ? 1 : tipo === 'B' ? 6 : 11;
  const nroComprobante = await obtenerUltimoComprobante(tipo, token, sign, cfg);
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
        `SELECT local_id, usuario_id, medio_pago_id, medio_pago, monto_gift_card, total, numero_factura
         FROM ventas WHERE id = $1`, [venta_id]
      );
      if (ventaRow.rows.length > 0) {
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

// --- Reintentar todas las pendientes (se llama desde un cron cada X minutos) ---
router.post('/reintentar-pendientes', async (req, res) => {
  const pendientes = await pool.query(
    `SELECT v.id, v.tipo_factura, v.total, v.monto_gift_card, c.cuit_dni AS cliente_cuit
     FROM ventas v
     LEFT JOIN clientes c ON v.cliente_id = c.id
     WHERE v.canal = 'presencial' AND v.es_preventa = FALSE
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