-- Registro de empleadas (vendedoras) por local, cada una con su propio porcentaje de
-- comision (independiente de la comision por facturacion del local que ya existia).
-- Si una empleada deja de trabajar (ej: Cintia), se marca activo = FALSE en vez de
-- borrarla, para no perder el historial.
-- Correr una sola vez (con run-migration.js o psql).

CREATE TABLE IF NOT EXISTS empleados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  local_id INTEGER NOT NULL REFERENCES locales(id),
  comision_pct NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);
