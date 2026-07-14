-- Guarda quien registro cada egreso, para poder mostrarle a cada usuario
-- la fecha/hora del ultimo egreso que cargo el mismo (asi retoma donde dejo).
-- Correr una sola vez con psql.

ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id);
