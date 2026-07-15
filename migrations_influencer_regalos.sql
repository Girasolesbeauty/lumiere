-- Regalos que se le asignan a una influencer por campana (ej: "Dia de la madre 2026").
-- La influencer ve el regalo pendiente en su portal con un codigo, y lo retira en el local
-- mostrando ese codigo. El local lo valida y ahi se descuenta el stock real.
-- Correr una sola vez con psql.

CREATE TABLE IF NOT EXISTS influencer_regalos (
  id SERIAL PRIMARY KEY,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id),
  producto_id INTEGER REFERENCES productos(id),
  producto_nombre VARCHAR(255),
  campana VARCHAR(255),
  codigo VARCHAR(30) UNIQUE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  local_entrega_id INTEGER,
  entregado_en TIMESTAMP,
  entregado_por VARCHAR(255),
  creado_en TIMESTAMP DEFAULT NOW()
);
