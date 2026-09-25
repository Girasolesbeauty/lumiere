-- Variantes de producto (ej: Talle, Color) -- cada variante tiene su propio stock
-- por local, independiente del stock general del producto.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS tiene_variantes BOOLEAN DEFAULT FALSE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_variante VARCHAR(50);

CREATE TABLE IF NOT EXISTS producto_variantes (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  valor VARCHAR(100) NOT NULL,
  codigo_barras VARCHAR(100),
  imagen_url TEXT,
  stock_rg INTEGER DEFAULT 0,
  stock_ush INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producto_variantes_producto ON producto_variantes(producto_id);

-- Las ventas y ajustes de stock necesitan saber si fue una variante puntual (no solo el producto general)
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS variante_id INTEGER REFERENCES producto_variantes(id);
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS variante_valor VARCHAR(100);
ALTER TABLE ajustes_stock ADD COLUMN IF NOT EXISTS variante_id INTEGER REFERENCES producto_variantes(id);
