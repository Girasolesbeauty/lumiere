-- Bug: al crear un producto nuevo desde Inventario, el sistema guardaba el stock inicial
-- solo en la columna "stock" (el total), pero nunca en stock_rg / stock_ush (quedaban NULL).
-- Cualquier operacion que mira el stock de UN local puntual (vender, ajustar stock, alertas,
-- y el bloqueo de venta sin stock que agregamos) trata NULL como 0 -- por eso el producto
-- parecia tener stock en el total pero 0 en el local real.
-- Esto corrige los productos ya cargados que quedaron asi (nunca tocados por un ingreso de
-- mercaderia, que si carga stock_rg/stock_ush correctamente).
-- Correr una sola vez (con run-migration.js o psql).

UPDATE productos
SET stock_rg = CASE WHEN local_id = 2 THEN 0 ELSE COALESCE(stock, 0) END,
    stock_ush = CASE WHEN local_id = 2 THEN COALESCE(stock, 0) ELSE 0 END
WHERE stock_rg IS NULL AND stock_ush IS NULL;
