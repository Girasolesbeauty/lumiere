-- Precio sugerido a cobrarle al cliente por este insumo (ej: caja de regalo $500).
-- Es solo una sugerencia -- en el POS se puede editar el monto igual al momento de la venta.
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS precio_sugerido_cliente NUMERIC DEFAULT 0;
