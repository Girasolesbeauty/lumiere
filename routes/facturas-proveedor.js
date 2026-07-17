const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const Tesseract = require('tesseract.js');

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

// Heuristica generica para lineas de texto tipo "2 CREMA HIDRATANTE 250ML   $12.500,00"
// No es perfecto para todos los formatos de factura -- por eso siempre se revisa antes de confirmar.
const parsearLineasTexto = (texto) => {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  const reLinea = /^(\d{1,4})\s+(.{3,80}?)\s+\$?\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/;
  for (const linea of lineas) {
    const m = linea.match(reLinea);
    if (m) {
      const cantidad = parseInt(m[1]);
      const nombre = m[2].trim();
      const precioStr = m[3].replace(/\./g, '').replace(',', '.');
      const costo_unitario = parseFloat(precioStr) || 0;
      if (cantidad > 0 && cantidad < 10000 && nombre.length >= 3) {
        items.push({ nombre_crudo: nombre, cantidad, costo_unitario });
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
    if (nombre && cantidad > 0) items.push({ nombre_crudo: nombre, cantidad, costo_unitario });
  }
  return items;
};

// Procesa un archivo de factura (PDF, imagen o Excel/CSV) y sugiere los items + a que
// producto del catalogo corresponde cada uno (usando lo aprendido de facturas anteriores
// de ese proveedor, o una comparacion de nombres si es la primera vez).
router.post('/parsear', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const { proveedor_id } = req.body;
    const mime = req.file.mimetype || '';
    const nombreArchivo = (req.file.originalname || '').toLowerCase();

    let itemsCrudos = [];
    if (mime === 'application/pdf' || nombreArchivo.endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      itemsCrudos = parsearLineasTexto(data.text);
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
      return res.json({ items: [], aviso: 'No se detecto ningun producto automaticamente en el archivo. Podes cargar la orden a mano.' });
    }

    const productosRes = await pool.query('SELECT id, nombre FROM productos WHERE activo = TRUE');
    const productos = productosRes.rows;

    let aliasMap = new Map();
    if (proveedor_id) {
      const aliasRes = await pool.query(
        'SELECT nombre_factura, producto_id FROM proveedor_producto_alias WHERE proveedor_id = $1',
        [proveedor_id]
      );
      aliasMap = new Map(aliasRes.rows.map(a => [normalizar(a.nombre_factura), a.producto_id]));
    }

    const items = itemsCrudos.map(it => {
      const key = normalizar(it.nombre_crudo);
      let productoIdSugerido = aliasMap.get(key) || null;
      let productoNombreSugerido = null;
      let esAliasConocido = false;

      if (productoIdSugerido) {
        esAliasConocido = true;
        const p = productos.find(pr => pr.id === productoIdSugerido);
        productoNombreSugerido = p ? p.nombre : null;
      } else {
        let mejor = null, mejorScore = 0;
        for (const p of productos) {
          const score = similitud(it.nombre_crudo, p.nombre);
          if (score > mejorScore) { mejorScore = score; mejor = p; }
        }
        if (mejor && mejorScore >= 0.4) {
          productoIdSugerido = mejor.id;
          productoNombreSugerido = mejor.nombre;
        }
      }

      return {
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
