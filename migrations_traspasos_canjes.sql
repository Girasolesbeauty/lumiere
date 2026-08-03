-- Dos herramientas nuevas para Inventario:
--
-- 1) traspasos_stock: cuando se manda mercaderia de un local al otro (ej: un producto
--    que no rota en Rio Grande se manda a Ushuaia). No cambia el stock total combinado,
--    solo lo redistribuye entre stock_rg y stock_ush.
--
-- 2) canjes_empleados: cuando en vez de (o ademas de) pagarle en dinero a una empleada,
--    se le entrega mercaderia. Descuenta stock real del local, sin generar venta ni
--    factura. Requiere que ya exista la tabla "empleados" (migrations_empleados.sql).
--
-- Correr una sola vez (con run-migration.js o psql), despues de migrations_empleados.sql.

CREATE TABLE IF NOT EXISTS traspasos_stock (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  producto_nombre TEXT,
  cantidad INTEGER NOT NULL,
  local_origen INTEGER NOT NULL,
  local_destino INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nombre TEXT,
  notas TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canjes_empleados (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER REFERENCES empleados(id),
  empleado_nombre TEXT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  producto_nombre TEXT,
  cantidad INTEGER NOT NULL,
  valor_unitario NUMERIC,
  valor_total NUMERIC,
  local_id INTEGER NOT NULL,
  usuario_id INTEGER,
  usuario_nombre TEXT,
  notas TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);
