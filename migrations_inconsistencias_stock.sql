-- Registra cada vez que se vendio un producto sin stock suficiente (dejaria el stock
-- en negativo) y la vendedora justifico por que igual se cargo la venta.
-- Correr una sola vez (con run-migration.js o psql).

CREATE TABLE IF NOT EXISTS inconsistencias_stock (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER REFERENCES productos(id),
  producto_nombre VARCHAR(255),
  local_id INTEGER,
  cantidad_vendida INTEGER,
  stock_disponible INTEGER,
  justificacion TEXT NOT NULL,
  venta_numero_factura VARCHAR(50),
  usuario_id INTEGER,
  usuario_nombre VARCHAR(255),
  creado_en TIMESTAMP DEFAULT NOW()
);
