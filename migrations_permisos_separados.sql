-- Antes, Comprobantes/Calculadoras/Productividad compartian el permiso "finanzas.flujo",
-- Insumos/Control de Inventario compartian "inventario.ver", y Giftcards/Caja de Respaldo/
-- Cierre de Caja compartian "caja.ver". Por eso no se podian ver ni asignar por separado
-- en la pantalla de Permisos de cada usuario.
-- Ahora cada uno tiene su propio permiso. Este script le da automaticamente el nuevo
-- permiso a quien ya tenia el permiso "padre", para que nadie pierda acceso a nada.
-- Correr una sola vez con psql.

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'comprobantes.ver' FROM permisos_usuario WHERE permiso = 'finanzas.flujo'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'calculadoras.ver' FROM permisos_usuario WHERE permiso = 'finanzas.flujo'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'productividad.ver' FROM permisos_usuario WHERE permiso = 'finanzas.flujo'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'insumos.ver' FROM permisos_usuario WHERE permiso = 'inventario.ver'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'control_inv.ver' FROM permisos_usuario WHERE permiso = 'inventario.ver'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'giftcards.ver' FROM permisos_usuario WHERE permiso = 'caja.ver'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'caja_respaldo.ver' FROM permisos_usuario WHERE permiso = 'caja.ver'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_usuario (usuario_id, permiso)
SELECT usuario_id, 'cierre_caja.ver' FROM permisos_usuario WHERE permiso = 'caja.ver'
ON CONFLICT DO NOTHING;
