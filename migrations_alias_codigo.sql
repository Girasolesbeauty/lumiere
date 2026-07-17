-- Permite recordar "el codigo interno tal del proveedor tal es este producto mio",
-- ademas del nombre. El codigo es mucho mas confiable que el nombre (el proveedor
-- lo repite igual en todas sus facturas), asi que se prioriza sobre el nombre.
-- Correr una sola vez (con run-migration.js o psql).

ALTER TABLE proveedor_producto_alias ADD COLUMN IF NOT EXISTS codigo_factura VARCHAR(100);

-- La restriccion original exigia nombre unico por proveedor SIEMPRE. Ahora que un mismo
-- producto puede tener filas identificadas por codigo (mas confiable) en vez de por nombre,
-- la reemplazamos por dos indices que no se pisan entre si:
--  - unico por (proveedor, codigo) cuando hay codigo
--  - unico por (proveedor, nombre) solo cuando NO hay codigo
ALTER TABLE proveedor_producto_alias DROP CONSTRAINT IF EXISTS proveedor_producto_alias_proveedor_id_nombre_factura_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_proveedor_codigo
  ON proveedor_producto_alias (proveedor_id, codigo_factura)
  WHERE codigo_factura IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_proveedor_nombre_sin_codigo
  ON proveedor_producto_alias (proveedor_id, nombre_factura)
  WHERE codigo_factura IS NULL;
