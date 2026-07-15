-- Monto minimo de compra para que el DESCUENTO del cupon aplique (no confundir con
-- regalo_monto_minimo, que es el minimo para el regalo de campana). Vacio/NULL = sin minimo.
-- Correr una sola vez con psql (o con run-migration.js).

ALTER TABLE cupones ADD COLUMN IF NOT EXISTS descuento_monto_minimo NUMERIC;
