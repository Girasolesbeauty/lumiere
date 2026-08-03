-- Permite registrar una seña (pago parcial) al cargar una preventa: por ejemplo, la clienta
-- deja $15.000 en efectivo por un producto que sale $55.399 y todavia esta en transito. Esa
-- plata se acredita en caja al momento (no se espera a la entrega), y al confirmar la entrega
-- solo se cobra el saldo pendiente, no el total de nuevo.
-- Correr una sola vez (con run-migration.js o psql).

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_sena NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sena_medio_pago_id INTEGER;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sena_medio_pago_nombre TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sena_referencia TEXT;
