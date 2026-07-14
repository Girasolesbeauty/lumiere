-- La tabla de calculadoras de precio nunca se creo en la base de datos.
-- Por eso el guardado fallaba con "relation calculadoras_precio does not exist".
-- Correr una sola vez con psql.

CREATE TABLE IF NOT EXISTS calculadoras_precio (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipo VARCHAR(50) NOT NULL,
  margen NUMERIC DEFAULT 1,
  iva NUMERIC DEFAULT 0,
  extras JSONB DEFAULT '[]',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);
