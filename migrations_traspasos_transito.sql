-- Los traspasos entre locales ahora funcionan igual que las ordenes de ingreso: cuando se
-- manda mercaderia, el local de origen la pierde al instante, pero el local de destino no la
-- recibe como stock vendible hasta que alguien confirma que llego fisicamente (puede ser al
-- otro dia). Mientras tanto, se ve como "en transito" (columna stock_transito_rg/stock_transito_ush
-- que ya existia, usada por las ordenes de ingreso).
-- Correr una sola vez (con run-migration.js o psql), despues de migrations_traspasos_canjes.sql.

ALTER TABLE traspasos_stock ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'en_transito';
ALTER TABLE traspasos_stock ADD COLUMN IF NOT EXISTS cantidad_recibida INTEGER;
ALTER TABLE traspasos_stock ADD COLUMN IF NOT EXISTS nota_inconsistencia TEXT;
ALTER TABLE traspasos_stock ADD COLUMN IF NOT EXISTS recibido_por TEXT;
ALTER TABLE traspasos_stock ADD COLUMN IF NOT EXISTS recibido_en TIMESTAMP;

-- Los traspasos que ya se habian hecho ANTES de este cambio (con la logica vieja, donde el
-- destino recibia el stock al instante) hay que marcarlos como ya recibidos. Si no, la pantalla
-- los va a mostrar como "pendientes de confirmar" y si alguien los confirma, se sumaria ese
-- stock una segunda vez (ya lo tienen desde el dia que se hizo el traspaso).
UPDATE traspasos_stock
SET estado = 'recibido', cantidad_recibida = cantidad, recibido_en = creado_en
WHERE estado = 'en_transito';
