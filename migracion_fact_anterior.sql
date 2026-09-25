-- Interruptor para mostrar u ocultar la seccion de "facturacion del sistema anterior"
-- en Finanzas. Por defecto queda APAGADO (oculto) -- correcto tanto para la demo como
-- para cualquier cliente nuevo. Correr esta parte en las DOS bases (real y demo).
ALTER TABLE configuracion_negocio ADD COLUMN IF NOT EXISTS mostrar_facturacion_anterior BOOLEAN DEFAULT FALSE;
