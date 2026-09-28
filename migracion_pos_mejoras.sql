-- Mejoras del Punto de Venta (septiembre 2026). Se puede correr mas de una vez sin problema.

-- 1) Que hace el POS al terminar una venta: imprimir el ticket (lo de siempre), enviarlo
--    online por WhatsApp, o preguntarle a la vendedora cada vez.
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS modo_ticket VARCHAR(20) DEFAULT 'imprimir';
UPDATE configuracion_negocio SET modo_ticket = 'imprimir' WHERE modo_ticket IS NULL;

-- 2) Desafios de venta: la vendedora acepta el reto de superar el ticket promedio de la
--    clienta. Juntando X retos superados en el mes gana un canje de producto de hasta $Y.
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS retos_activo BOOLEAN DEFAULT true;
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS retos_meta_mensual INTEGER DEFAULT 10;
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS retos_premio_monto NUMERIC(12,2) DEFAULT 50000;

CREATE TABLE IF NOT EXISTS retos_vendedoras (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER,
  usuario_nombre TEXT,
  cliente_id INTEGER,
  cliente_nombre TEXT,
  venta_id INTEGER,
  meta NUMERIC(12,2) NOT NULL,
  vendido NUMERIC(12,2) NOT NULL,
  logrado BOOLEAN NOT NULL,
  local_id INTEGER,
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retos_vendedoras_usuario_fecha ON retos_vendedoras (usuario_id, creado_en);

CREATE TABLE IF NOT EXISTS retos_premios (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  usuario_nombre TEXT,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  retos_logrados INTEGER,
  monto_premio NUMERIC(12,2),
  estado VARCHAR(20) DEFAULT 'pendiente', -- pendiente | entregado
  producto_id INTEGER,
  producto_nombre TEXT,
  valor_producto NUMERIC(12,2),
  canje_id INTEGER,
  local_id INTEGER,
  entregado_en TIMESTAMP,
  entregado_por TEXT,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE (usuario_id, anio, mes)
);

-- Los premios se entregan como canje de mercaderia (misma tabla que los canjes con
-- empleadas). En la base real ya existe; esto es por si alguna copia no la tiene.
CREATE TABLE IF NOT EXISTS canjes_empleados (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER,
  empleado_nombre TEXT,
  producto_id INTEGER,
  producto_nombre TEXT,
  cantidad INTEGER,
  valor_unitario NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  local_id INTEGER,
  usuario_id INTEGER,
  usuario_nombre TEXT,
  notas TEXT,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- 3) Configuracion de comisiones: tipo de comision y periodo, por local.
--    Las reglas que ya existen quedan como estaban (premio fijo por meta, diario).
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) DEFAULT 'metas_monto';
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS periodo VARCHAR(20) DEFAULT 'diaria';
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS porcentaje NUMERIC(6,3) DEFAULT 0;
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS minimo NUMERIC(14,2) DEFAULT 0;
ALTER TABLE reglas_comision ADD COLUMN IF NOT EXISTS tramos JSONB DEFAULT '[]'::jsonb;
UPDATE reglas_comision SET tipo = 'metas_monto' WHERE tipo IS NULL;
UPDATE reglas_comision SET periodo = 'diaria' WHERE periodo IS NULL;

-- 4) Ventas online de otros canales (ya facturadas por su plataforma): de donde vino la
--    venta, el N° de pedido, el comprobante que ya se emitio y el envio cobrado.
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS plataforma VARCHAR(40);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS comprobante_externo TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS referencia TEXT;

-- 5) Cambios y devoluciones: varios productos por operacion, devolucion pura, motivo y si
--    lo devuelto vuelve al stock (un producto fallado no vuelve).
ALTER TABLE cambios_productos ADD COLUMN IF NOT EXISTS detalle JSONB;
ALTER TABLE cambios_productos ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE cambios_productos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'cambio';
ALTER TABLE cambios_productos ADD COLUMN IF NOT EXISTS cliente_id INTEGER;
