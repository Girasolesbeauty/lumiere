const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const Tesseract = require('tesseract.js');

// pdfjs-dist necesita Path2D/DOMMatrix/ImageData en el scope global para poder
// "dibujar" el PDF en un canvas. @napi-rs/canvas los trae, pero hay que
// engancharlos ANTES de pedir pdfjs-dist (si no, pdfjs no los encuentra).
const { createCanvas, Path2D, DOMMatrix, ImageData } = require('@napi-rs/canvas');
if (typeof global.Path2D === 'undefined') global.Path2D = Path2D;
if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = DOMMatrix;
if (typeof global.ImageData === 'undefined') global.ImageData = ImageData;
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Normaliza texto para comparar nombres (sin acentos, minusculas, sin signos)
const normalizar = (s) => {
  let t = (s || '').toLowerCase();
  t = t.replace(/[aàáäâ]/g, 'a').replace(/[eèéëê]/g, 'e').replace(/[iìíïî]/g, 'i')
       .replace(/[oòóöô]/g, 'o').replace(/[uùúüû]/g, 'u').replace(/ñ/g, 'n');
  t = t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
};

// Similitud por palabras en comun (0 a 1). Simple y sin dependencias externas.
const similitud = (a, b) => {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = new Set(na.split(' ').filter(w => w.length > 2));
  const wb = new Set(nb.split(' ').filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let comunes = 0;
  for (const w of wa) if (wb.has(w)) comunes++;
  return comunes / Math.max(wa.size, wb.size);
};

// Numero con formato argentino, tolerante a que tenga o no separador de miles:
// "11057,00", "12.500,00" y "1.048.754,39" matchean todos.
const NUM = '[\\d.]+,\\d{2}';

// Heuristica de lineas de factura. Prueba primero el formato "con codigo" (codigo interno
// del proveedor + codigo de barras + cantidad + Un + descripcion + precio + %desc + total,
// comun en facturas de laboratorios/distribuidoras tipo formulario continuo), y si no
// matchea cae al formato simple (cantidad + descripcion + precio). Ninguno es perfecto
// para todos los formatos -- por eso siempre se revisa antes de confirmar.
const reConCodigo = new RegExp(`^(\\d{1,10})\\s+(\\d{6,14})\\s+(\\d{1,4})\\s+[Uu]n\\.?\\s+(.{3,80}?)\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`);
const reSimple = /^(\d{1,4})\s+(.{3,80}?)\s+\$?\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/;

const parsearLineasTexto = (texto) => {
  const lineas = (texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const linea of lineas) {
    let m = linea.match(reConCodigo);
    if (m) {
      const cantidad = parseInt(m[3]);
      const nombre = m[4].trim();
      const costo_unitario = parseFloat(m[5].replace(/\./g, '').replace(',', '.')) || 0;
      if (cantidad > 0 && cantidad < 10000 && nombre.length >= 3) {
        items.push({ codigo_interno: m[1], codigo_barras: m[2], nombre_crudo: nombre, cantidad, costo_unitario });
      }
      continue;
    }
    m = linea.match(reSimple);
    if (m) {
      const cantidad = parseInt(m[1]);
      const nombre = m[2].trim();
      const precioStr = m[3].replace(/\./g, '').replace(',', '.');
      const costo_unitario = parseFloat(precioStr) || 0;
      if (cantidad > 0 && cantidad < 10000 && nombre.length >= 3) {
        items.push({ codigo_interno: null, codigo_barras: null, nombre_crudo: nombre, cantidad, costo_unitario });
      }
    }
  }
  return items;
};

// Excel/CSV: busca columnas por nombre parecido (no asume un formato fijo de proveedor)
const parsearExcel = (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
  const items = [];
  for (const fila of filas) {
    const claves = Object.keys(fila);
    const colCodigo = claves.find(k => /^cod|codigo/i.test(k));
    const colBarras = claves.find(k => /barra|ean/i.test(k));
    const colNombre = claves.find(k => /producto|descrip|detalle|item|articulo/i.test(k));
    const colCantidad = claves.find(k => /cant/i.test(k));
    const colPrecio = claves.find(k => /precio|costo|unitario/i.test(k));
    if (!colNombre) continue;
    const nombre = String(fila[colNombre] || '').trim();
    const cantidad = parseInt(fila[colCantidad]) || 0;
    const precioRaw = fila[colPrecio];
    const costo_unitario = typeof precioRaw === 'number'
      ? precioRaw
      : (parseFloat(String(precioRaw || '0').replace(/\./g, '').replace(',', '.')) || 0);
    if (nombre && cantidad > 0) {
      items.push({
        codigo_interno: colCodigo ? (String(fila[colCodigo] || '').trim() || null) : null,
        codigo_barras: colBarras ? (String(fila[colBarras] || '').trim() || null) : null,
        nombre_crudo: nombre, cantidad, costo_unitario
      });
    }
  }
  return items;
};

// Convierte cada pagina de un PDF en una imagen. Se usa como respaldo cuando el PDF
// no tiene texto "de verdad" adentro (factura generada con una tipografia especial que
// dibuja las letras en vez de escribirlas -- un lector de texto comun no puede leer nada
// ahi, aunque a simple vista se vea perfecto).
async function pdfAPaginasImagen(buffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    paginas.push(canvas.toBuffer('image/png'));
  }
  return paginas;
}

async function ocrDePaginas(paginas) {
  let texto = '';
  for (const png of paginas) {
    const { data } = await Tesseract.recognize(png, 'spa');
    texto += '\n' + data.text;
  }
  return texto;
}

// Procesa un archivo de factura (PDF, imagen o Excel/CSV) y sugiere los items + a que
// producto del catalogo corresponde cada uno. Prioridad para vincular cada linea:
// 1) codigo interno del proveedor ya aprendido antes (el mas confiable: el proveedor
//    repite siempre el mismo codigo para el mismo producto)
// 2) codigo de barras exacto contra el catalogo
// 3) nombre ya aprendido antes (de facturas anteriores de este proveedor)
// 4) parecido de nombre (aproximado, el menos confiable -- siempre se revisa antes de confirmar)
router.post('/parsear', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const { proveedor_id } = req.body;
    const mime = req.file.mimetype || '';
    const nombreArchivo = (req.file.originalname || '').toLowerCase();

    let itemsCrudos = [];
    let avisoOcr = null;

    if (mime === 'application/pdf' || nombreArchivo.endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      itemsCrudos = parsearLineasTexto(data.text);
      if (itemsCrudos.length === 0) {
        // El PDF no tenia texto legible (factura "dibujada" con tipografia especial).
        // La convertimos pagina por pagina en imagen y la leemos con OCR, igual que una foto.
        try {
          const paginas = await pdfAPaginasImagen(req.file.buffer);
          const textoOcr = await ocrDePaginas(paginas);
          itemsCrudos = parsearLineasTexto(textoOcr);
          if (itemsCrudos.length === 0) {
            avisoOcr = 'Se convirtio la factura a imagen y se leyo con reconocimiento de texto (OCR), pero no se pudieron detectar productos igual. Cargala a mano en "+ Nueva orden".';
          }
        } catch (eOcr) {
          console.error('Error al convertir PDF a imagen para OCR:', eOcr);
        }
      }
    } else if (mime.startsWith('image/')) {
      const { data } = await Tesseract.recognize(req.file.buffer, 'spa');
      itemsCrudos = parsearLineasTexto(data.text);
    } else if (
      nombreArchivo.endsWith('.xlsx') || nombreArchivo.endsWith('.xls') || nombreArchivo.endsWith('.csv') ||
      mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv'
    ) {
      itemsCrudos = parsearExcel(req.file.buffer);
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Subi un PDF, una foto/escaneo, o un Excel/CSV.' });
    }

    if (itemsCrudos.length === 0) {
      return res.json({ items: [], aviso: avisoOcr || 'No se detecto ningun producto automaticamente en el archivo. Podes cargar la orden a mano.' });
    }

    const productosRes = await pool.query('SELECT id, nombre, codigo_barras FROM productos WHERE activo = TRUE');
    const productos = productosRes.rows;
    const barcodeMap = new Map(productos.filter(p => p.codigo_barras).map(p => [String(p.codigo_barras).trim(), p]));

    let aliasCodigoMap = new Map();
    let aliasNombreMap = new Map();
    if (proveedor_id) {
      const aliasRes = await pool.query(
        'SELECT nombre_factura, codigo_factura, producto_id FROM proveedor_producto_alias WHERE proveedor_id = $1',
        [proveedor_id]
      );
      for (const a of aliasRes.rows) {
        if (a.codigo_factura) aliasCodigoMap.set(String(a.codigo_factura), a.producto_id);
        aliasNombreMap.set(normalizar(a.nombre_factura), a.producto_id);
      }
    }

    const items = itemsCrudos.map(it => {
      let productoIdSugerido = null;
      let esAliasConocido = false;

      if (it.codigo_interno && aliasCodigoMap.has(String(it.codigo_interno))) {
        productoIdSugerido = aliasCodigoMap.get(String(it.codigo_interno));
        esAliasConocido = true;
      } else if (it.codigo_barras && barcodeMap.has(String(it.codigo_barras))) {
        productoIdSugerido = barcodeMap.get(String(it.codigo_barras)).id;
        esAliasConocido = true;
      } else {
        const key = normalizar(it.nombre_crudo);
        if (aliasNombreMap.has(key)) {
          productoIdSugerido = aliasNombreMap.get(key);
          esAliasConocido = true;
        } else {
          let mejor = null, mejorScore = 0;
          for (const p of productos) {
            const score = similitud(it.nombre_crudo, p.nombre);
            if (score > mejorScore) { mejorScore = score; mejor = p; }
          }
          if (mejor && mejorScore >= 0.4) productoIdSugerido = mejor.id;
        }
      }

      const productoNombreSugerido = productoIdSugerido
        ? ((productos.find(pr => pr.id === productoIdSugerido) || {}).nombre || null)
        : null;

      return {
        codigo_interno: it.codigo_interno || null,
        codigo_barras: it.codigo_barras || null,
        nombre_crudo: it.nombre_crudo,
        cantidad: it.cantidad,
        costo_unitario: it.costo_unitario,
        producto_id_sugerido: productoIdSugerido,
        producto_nombre_sugerido: productoNombreSugerido,
        es_alias_conocido: esAliasConocido
      };
    });

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar la factura: ' + error.message });
  }
});

module.exports = router;
