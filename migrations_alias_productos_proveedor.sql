-- Memoria de "este nombre de producto en la factura de tal proveedor es este producto mio".
-- Se guarda cada vez que confirmas una factura cargada, para que la proxima vez que aparezca
-- el mismo nombre de ese mismo proveedor, el sistema ya lo reconozca solo.
-- Correr una sola vez (con run-migration.js o psql).

CREATE TABLE IF NOT EXISTS proveedor_producto_alias (
  id SERIAL PRIMARY KEY,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  nombre_factura VARCHAR(255) NOT NULL,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (proveedor_id, nombre_factura)
);
