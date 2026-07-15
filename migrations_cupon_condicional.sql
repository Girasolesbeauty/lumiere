-- Permite que un cupon tenga una tasa de descuento distinta segun el medio de pago.
-- Ejemplo: cupon base 10%, pero 15% si la clienta paga por "Transferencia".
-- condicion_medio_pago: texto que debe aparecer en el medio de pago de la venta (ej: "Transferencia").
-- valor_condicional: el valor (mismo tipo % o $ que el cupon) que se usa cuando se cumple la condicion.
-- Correr una sola vez con psql.

ALTER TABLE cupones ADD COLUMN IF NOT EXISTS condicion_medio_pago VARCHAR(100);
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS valor_condicional NUMERIC;

-- Cupon tipo "regalo por monto minimo" (ej: 1 mascarilla de regalo en compras desde $20.000).
-- Es informativo: el sistema avisa a la vendedora que el ticket ya califica y ella agrega
-- el producto de regalo a mano con precio $0 (el descuento de stock ya ocurre normalmente
-- al cargarlo como item de la venta).
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS regalo_producto_id INTEGER REFERENCES productos(id);
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS regalo_producto_nombre VARCHAR(255);
ALTER TABLE cupones ADD COLUMN IF NOT EXISTS regalo_monto_minimo NUMERIC;
