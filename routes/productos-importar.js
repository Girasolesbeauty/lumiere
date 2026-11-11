// Cargar productos de golpe: importar desde Excel o CSV (con vista previa) y productos de ejemplo para probar.
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const XLSX = require('xlsx');

const MAX_FILAS = 5000;

// ---------- lectura del archivo ----------
const limpiar = (t) => String(t === undefined || t === null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SINONIMOS = {
  nombre: ['nombre', 'producto', 'productos', 'articulo', 'articulos', 'descripcion', 'detalle', 'item', 'title', 'titulo', 'nombre del producto', 'nombre producto'],
  marca: ['marca', 'fabricante', 'brand'],
  categoria: ['categoria', 'rubro', 'familia', 'linea', 'tipo', 'seccion', 'category'],
  precio: ['precio', 'precio venta', 'precio de venta', 'precio publico', 'pvp', 'precio final', 'precio lista', 'valor', 'price', 'precio unitario'],
  costo: ['costo', 'precio costo', 'precio de costo', 'costo unitario', 'compra', 'precio compra', 'cost'],
  stock: ['stock', 'cantidad', 'existencia', 'existencias', 'unidades', 'stock actual', 'inventario', 'qty'],
  stock_minimo: ['stock minimo', 'minimo', 'stock min', 'min', 'punto de pedido', 'reposicion'],
  codigo_barras: ['codigo de barras', 'codigo barras', 'codigo', 'ean', 'sku', 'cod barras', 'barcode', 'cod', 'codigo de producto', 'upc'],
  proveedor: ['proveedor', 'proveedores', 'supplier', 'distribuidor'],
};
const CAMPOS = Object.keys(SINONIMOS);

// "$ 1.234,56" / "1234,5" / "1.234" / "1234.5" -> numero (o null)
const aNumero = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v === undefined || v === null ? '' : v).trim().replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
};

function leerArchivo(b64) {
  const buf = Buffer.from(String(b64 || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new Error('El archivo está vacío');
  if (buf.length > 6 * 1024 * 1024) throw new Error('El archivo es muy grande (máximo 6 MB). Dividilo en partes');
  let wb;
  // Excel (.xlsx empieza con "PK", .xls con D0CF) se lee tal cual; un CSV es texto: se decodifica como UTF-8 y, si no
  // lo es (Excel en español suele guardarlo en Windows-1252), como Latin-1, para que las tildes y la ñ no se rompan
  const esExcel = (buf[0] === 0x50 && buf[1] === 0x4b) || (buf[0] === 0xd0 && buf[1] === 0xcf);
  let entrada = { type: 'buffer', data: buf };
  if (!esExcel) {
    let texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { texto = buf.toString('latin1'); }
    entrada = { type: 'string', data: texto.replace(/^﻿/, '') };
  }
  try { wb = XLSX.read(entrada.data, { type: entrada.type, cellDates: false, raw: !esExcel }); } catch (e) { throw new Error('No pude leer el archivo. Guardalo como Excel (.xlsx) o CSV y probá de nuevo'); }
  const hoja = wb.Sheets[wb.SheetNames[0]];
  if (!hoja) throw new Error('El archivo no tiene hojas con datos');
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: true, blankrows: false });
  // Encabezado: la primera fila con al menos 2 celdas con texto
  let h = filas.findIndex(f => f.filter(x => String(x).trim() !== '').length >= 2);
  if (h < 0) throw new Error('No encontré datos en el archivo');
  const columnas = filas[h].map((c, i) => String(c).trim() || 'Columna ' + (i + 1));
  const datos = filas.slice(h + 1).filter(f => f.some(x => String(x).trim() !== ''));
  if (datos.length > MAX_FILAS) throw new Error('El archivo tiene más de ' + MAX_FILAS + ' filas. Dividilo en partes');
  return { columnas, datos };
}

// Detecta qué columna es cada dato (por el nombre del encabezado)
function detectarMapeo(columnas) {
  const norm = columnas.map(limpiar), usado = new Set(), mapeo = {};
  for (const campo of CAMPOS) {
    let idx = norm.findIndex((c, i) => !usado.has(i) && SINONIMOS[campo].includes(c));
    if (idx < 0) idx = norm.findIndex((c, i) => !usado.has(i) && c && SINONIMOS[campo].some(s => s.length > 3 && (c.includes(s) || (c.length > 3 && s.includes(c)))));
    mapeo[campo] = idx;
    if (idx >= 0) usado.add(idx);
  }
  return mapeo;
}

function armarFilas(datos, mapeo) {
  const get = (f, campo) => { const i = mapeo[campo]; return i === undefined || i === null || i < 0 ? '' : f[i]; };
  const productos = [], errores = [];
  const vistos = new Set();
  datos.forEach((f, n) => {
    const fila = n + 2; // aproximado: la 1 es el encabezado
    const nombre = String(get(f, 'nombre')).trim().replace(/\s+/g, ' ').slice(0, 150);
    if (!nombre) return errores.push({ fila, motivo: 'Sin nombre' });
    const precio = aNumero(get(f, 'precio'));
    if (precio === null || precio <= 0) return errores.push({ fila, nombre, motivo: 'Sin precio válido' });
    if (precio >= 1e8) return errores.push({ fila, nombre, motivo: 'Precio demasiado grande' });
    const costoN = aNumero(get(f, 'costo'));
    const stockN = aNumero(get(f, 'stock')), minN = aNumero(get(f, 'stock_minimo'));
    const p = {
      fila, nombre,
      marca: String(get(f, 'marca')).trim().slice(0, 100) || null,
      categoria: String(get(f, 'categoria')).trim().slice(0, 100) || null,
      precio: Math.round(precio * 100) / 100,
      costo: costoN !== null && costoN >= 0 && costoN < 1e8 ? Math.round(costoN * 100) / 100 : null,
      stock: stockN !== null && stockN > 0 ? Math.min(1e7, Math.round(stockN)) : 0,
      stock_minimo: minN !== null && minN >= 0 ? Math.min(1e6, Math.round(minN)) : null,
      codigo_barras: String(get(f, 'codigo_barras')).trim().replace(/\.0$/, '').slice(0, 50) || null,
      proveedor: String(get(f, 'proveedor')).trim().slice(0, 200) || null,
    };
    // Repetido si coincide el código de barras o el nombre con la marca
    const kCod = p.codigo_barras ? 'c:' + p.codigo_barras : null, kNom = 'n:' + limpiar(p.nombre) + '|' + limpiar(p.marca);
    if ((kCod && vistos.has(kCod)) || vistos.has(kNom)) return errores.push({ fila, nombre, motivo: 'Repetido en el archivo' });
    if (kCod) vistos.add(kCod);
    vistos.add(kNom);
    productos.push(p);
  });
  return { productos, errores };
}

// Cuáles ya existen en el negocio (por código de barras o por nombre + marca)
async function buscarExistentes(db, productos) {
  const r = (await db.query('SELECT id, nombre, marca, codigo_barras FROM productos')).rows;
  const porCodigo = new Map(), porNombre = new Map();
  r.forEach(x => { if (x.codigo_barras) porCodigo.set(String(x.codigo_barras).trim(), x.id); porNombre.set(limpiar(x.nombre) + '|' + limpiar(x.marca), x.id); });
  return productos.map(p => (p.codigo_barras && porCodigo.get(p.codigo_barras)) || porNombre.get(limpiar(p.nombre) + '|' + limpiar(p.marca)) || null);
}

router.use((req, res, next) => (req.usuario ? next() : res.status(401).json({ error: 'Sesión vencida' })));

// Vista previa o importación real (confirmar: true)
router.post('/importar', express.json({ limit: '9mb' }), async (req, res) => {
  const b = req.body || {};
  try {
    const { columnas, datos } = leerArchivo(b.archivo);
    const auto = detectarMapeo(columnas);
    const mapeo = { ...auto };
    if (b.mapeo && typeof b.mapeo === 'object') CAMPOS.forEach(c => { if (b.mapeo[c] !== undefined) { const i = parseInt(b.mapeo[c]); mapeo[c] = Number.isInteger(i) && i >= 0 && i < columnas.length ? i : -1; } });
    if (mapeo.nombre < 0 || mapeo.precio < 0) {
      return res.json({ ok: false, columnas, mapeo, falta: [mapeo.nombre < 0 ? 'nombre' : null, mapeo.precio < 0 ? 'precio' : null].filter(Boolean), total: datos.length });
    }
    const { productos, errores } = armarFilas(datos, mapeo);
    const existe = await buscarExistentes(pool, productos);
    const nuevos = existe.filter(x => !x).length, yaEstan = existe.length - nuevos;
    if (!b.confirmar) {
      return res.json({ ok: true, columnas, mapeo, total: datos.length, validos: productos.length, nuevos, ya_estan: yaEstan, errores: errores.slice(0, 15), n_errores: errores.length,
        muestra: productos.slice(0, 6) });
    }
    const actualizar = b.existentes === 'actualizar';
    // Solo se usa el local 2 si existe en este negocio
    const esUsh = String(b.local_id) === '2' && (await pool.query('SELECT 1 FROM locales WHERE id = 2').catch(() => ({ rows: [] }))).rows.length > 0;
    const client = await pool.connect();
    let creados = 0, actualizados = 0, salteados = 0, provNuevos = 0;
    try {
      await client.query('BEGIN');
      const provCache = new Map();
      const proveedorId = async (nombre) => {
        if (!nombre) return null;
        const k = limpiar(nombre);
        if (provCache.has(k)) return provCache.get(k);
        let r = (await client.query('SELECT id FROM proveedores WHERE LOWER(TRIM(nombre)) = LOWER($1) LIMIT 1', [nombre])).rows[0];
        if (!r) { r = (await client.query('INSERT INTO proveedores (nombre) VALUES ($1) RETURNING id', [nombre])).rows[0]; provNuevos++; }
        provCache.set(k, r.id); return r.id;
      };
      for (let i = 0; i < productos.length; i++) {
        const p = productos[i], id = existe[i];
        const prov = await proveedorId(p.proveedor);
        if (id) {
          if (!actualizar) { salteados++; continue; }
          await client.query(`UPDATE productos SET precio = $2, costo = COALESCE($3, costo), marca = COALESCE($4, marca), categoria = COALESCE($5, categoria),
            codigo_barras = COALESCE($6, codigo_barras), proveedor_id = COALESCE($7, proveedor_id), stock_minimo = COALESCE($8, stock_minimo) WHERE id = $1`,
            [id, p.precio, p.costo, p.marca, p.categoria, p.codigo_barras, prov, p.stock_minimo]);
          actualizados++;
        } else {
          await client.query(`INSERT INTO productos (nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, categoria, codigo_barras, local_id, proveedor_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 5), $9, $10, $11, $12)`,
            [p.nombre, p.marca, p.precio, p.costo, p.stock, esUsh ? 0 : p.stock, esUsh ? p.stock : 0, p.stock_minimo, p.categoria, p.codigo_barras, esUsh ? 2 : 1, prov]);
          creados++;
        }
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    console.log('[importar productos] creados ' + creados + ', actualizados ' + actualizados + ', salteados ' + salteados);
    res.json({ ok: true, hecho: true, creados, actualizados, salteados, proveedores_nuevos: provNuevos, errores: errores.slice(0, 15), n_errores: errores.length });
  } catch (e) {
    console.error('[importar productos]', e.message);
    res.status(400).json({ error: e.message || 'No se pudo importar' });
  }
});

// ---------- productos de ejemplo ----------
const EJEMPLOS = {
  cosmetica: { nombre: 'Cosmética y perfumería', items: [
    ['Limpiador facial en espuma 150 ml', 'Cosrx', 'Skincare', 18500, 9200, 14], ['Sérum vitamina C 30 ml', 'Skin1004', 'Skincare', 24900, 12400, 9], ['Protector solar FPS 50 50 ml', 'Beauty of Joseon', 'Skincare', 21900, 10800, 18],
    ['Crema hidratante 50 ml', 'Laneige', 'Skincare', 32000, 16500, 7], ['Tónico calmante 200 ml', 'Anua', 'Skincare', 27500, 13900, 11], ['Máscara de pestañas negra', 'Maybelline', 'Maquillaje', 9800, 4700, 22],
    ['Labial mate rosa', 'Rimmel', 'Maquillaje', 7600, 3500, 25], ['Base fluida tono medio', 'Revlon', 'Maquillaje', 15400, 7600, 12], ['Perfume floral 50 ml', 'Natura', 'Fragancias', 38900, 20100, 6], ['Crema de manos 75 ml', 'L\'Occitane', 'Cuerpo', 12900, 6300, 15],
  ] },
  ropa: { nombre: 'Ropa y accesorios', items: [
    ['Remera lisa algodón', 'Básicos', 'Remeras', 12900, 5400, 30], ['Jean recto azul', 'Denim Co', 'Pantalones', 39900, 18200, 14], ['Buzo canguro gris', 'Básicos', 'Abrigo', 34500, 15800, 10],
    ['Campera inflable negra', 'Nordic', 'Abrigo', 69900, 33000, 6], ['Vestido estampado', 'Flor', 'Vestidos', 42900, 19500, 8], ['Medias pack x3', 'Básicos', 'Accesorios', 6900, 2600, 40],
    ['Cinto de cuero', 'Cuero Sur', 'Accesorios', 15900, 7000, 12], ['Zapatillas urbanas blancas', 'Urban', 'Calzado', 59900, 28500, 9], ['Gorra visera curva', 'Nordic', 'Accesorios', 11900, 4900, 18], ['Bufanda de lana', 'Nordic', 'Accesorios', 14900, 6300, 11],
  ] },
  kiosco: { nombre: 'Kiosco y almacén', items: [
    ['Gaseosa cola 2,25 L', 'Coca-Cola', 'Bebidas', 3200, 2300, 36], ['Agua mineral 1,5 L', 'Villavicencio', 'Bebidas', 1500, 950, 48], ['Galletitas dulces 170 g', 'Oreo', 'Golosinas', 1800, 1200, 40],
    ['Alfajor triple', 'Havanna', 'Golosinas', 1400, 850, 60], ['Chocolate 100 g', 'Milka', 'Golosinas', 2900, 1900, 25], ['Papas fritas 150 g', 'Lay\'s', 'Snacks', 2600, 1700, 30],
    ['Yerba mate 1 kg', 'Taragüí', 'Almacén', 6800, 4900, 20], ['Fideos tirabuzón 500 g', 'Matarazzo', 'Almacén', 1700, 1150, 45], ['Leche entera 1 L', 'La Serenísima', 'Lácteos', 1900, 1400, 30], ['Cigarrillos box', 'Marlboro', 'Cigarrillos', 4800, 4100, 50],
  ] },
  ferreteria: { nombre: 'Ferretería y hogar', items: [
    ['Taladro percutor 650 W', 'Black+Decker', 'Herramientas', 89900, 61000, 5], ['Juego de destornilladores x6', 'Stanley', 'Herramientas', 14900, 8800, 14], ['Martillo carpintero', 'Stanley', 'Herramientas', 9800, 5400, 12],
    ['Cinta métrica 5 m', 'Stanley', 'Herramientas', 6200, 3300, 20], ['Pintura látex blanca 10 L', 'Alba', 'Pinturas', 46900, 31500, 8], ['Rodillo pintor 22 cm', 'Rodillos', 'Pinturas', 4500, 2200, 25],
    ['Cable unipolar 2,5 mm x 100 m', 'Pirelli', 'Electricidad', 52900, 36400, 7], ['Lámpara LED 9 W', 'Philips', 'Electricidad', 2300, 1100, 60], ['Tornillos autoperforantes x100', 'Fix', 'Bulonería', 3900, 1900, 30], ['Candado 50 mm', 'Yale', 'Seguridad', 8900, 4700, 16],
  ] },
};
const asegurarDemo = () => pool.query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_demo BOOLEAN NOT NULL DEFAULT FALSE');

router.get('/ejemplo', async (req, res) => {
  try {
    await asegurarDemo();
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM productos WHERE es_demo AND activo')).rows[0].n;
    const total = (await pool.query('SELECT COUNT(*)::int AS n FROM productos WHERE activo')).rows[0].n;
    res.json({ rubros: Object.entries(EJEMPLOS).map(([k, v]) => ({ k, nombre: v.nombre })), ejemplos: n, productos: total });
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar' }); }
});

router.post('/ejemplo', async (req, res) => {
  try {
    await asegurarDemo();
    const r = EJEMPLOS[String((req.body || {}).rubro || '')];
    if (!r) return res.status(400).json({ error: 'Elegí un rubro' });
    let n = 0;
    for (const [nombre, marca, categoria, precio, costo, stock] of r.items) {
      const ya = (await pool.query('SELECT 1 FROM productos WHERE LOWER(nombre) = LOWER($1) AND activo LIMIT 1', [nombre])).rows.length;
      if (ya) continue;
      await pool.query(`INSERT INTO productos (nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, categoria, local_id, es_demo)
        VALUES ($1, $2, $3, $4, $5, $5, 0, 5, $6, 1, TRUE)`, [nombre, marca, precio, costo, stock, categoria]);
      n++;
    }
    res.json({ ok: true, cargados: n });
  } catch (e) { console.error('[ejemplo]', e.message); res.status(500).json({ error: 'No se pudieron cargar los ejemplos' }); }
});

// Quitar los de ejemplo: se borran los que no se usaron en ninguna venta; los demás se desactivan
router.delete('/ejemplo', async (req, res) => {
  try {
    await asegurarDemo();
    const usados = (await pool.query(`UPDATE productos SET activo = FALSE WHERE es_demo AND activo AND EXISTS (SELECT 1 FROM venta_items vi WHERE vi.producto_id = productos.id)`)).rowCount;
    const borrados = (await pool.query(`DELETE FROM productos WHERE es_demo AND activo AND NOT EXISTS (SELECT 1 FROM venta_items vi WHERE vi.producto_id = productos.id)`).catch(async () =>
      pool.query('UPDATE productos SET activo = FALSE WHERE es_demo AND activo'))).rowCount;
    res.json({ ok: true, quitados: usados + borrados });
  } catch (e) { console.error('[ejemplo borrar]', e.message); res.status(500).json({ error: 'No se pudieron quitar' }); }
});

module.exports = router;
