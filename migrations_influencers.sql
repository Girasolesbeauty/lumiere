-- Programa de influencers: cupon vinculado a una venta + tabla de influencers y sus pagos.
-- Correr una sola vez con psql.

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cupon_id INTEGER REFERENCES cupones(id);

CREATE TABLE IF NOT EXISTS influencers (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  instagram TEXT,
  telefono TEXT,
  nivel TEXT NOT NULL DEFAULT 'inicial',
  comision_pct NUMERIC NOT NULL DEFAULT 2,
  cupon_id INTEGER REFERENCES cupones(id),
  cliente_id INTEGER REFERENCES clientes(id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Por si ya habias corrido una version anterior de esta migracion sin esta columna.
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id);

CREATE TABLE IF NOT EXISTS influencer_pagos (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  monto NUMERIC NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);
