-- =========================================================
-- DATOS FICTICIOS PARA DEMO DE LUMIERE (version corregida,
-- ajustada a la estructura real de la base)
-- Correr en la base NUEVA de la demo, nunca en la real.
-- =========================================================

INSERT INTO locales (id, nombre, direccion, activo) VALUES
  (1, 'Local Centro', 'Av. Principal 123', TRUE),
  (2, 'Sucursal Norte', 'Calle Comercial 456', TRUE);

INSERT INTO roles (id, nombre) VALUES
  (1, 'Jefe'),
  (2, 'Vendedora');

INSERT INTO configuracion_negocio (id, nombre_negocio, punto_venta) VALUES
  (1, 'Lumiere Demo', 1)
ON CONFLICT (id) DO UPDATE SET nombre_negocio = 'Lumiere Demo';

INSERT INTO config_ticket (id, mostrar_cliente, mostrar_numero, mostrar_fecha, mensaje_pie, texto_extra)
VALUES (1, TRUE, TRUE, TRUE, 'Gracias por tu compra!', 'Esto es una demo de Lumiere')
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuarios (id, nombre, email, password, rol, rol_id, local_id) VALUES
  (1, 'Admin Demo', 'admin@demo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'jefe', 1, 1),
  (2, 'Vendedora Demo 1', 'vendedora1@demo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'vendedora', 2, 1),
  (3, 'Vendedora Demo 2', 'vendedora2@demo.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'vendedora', 2, 2);

INSERT INTO medios_pago (id, nombre, tipo, cuotas, con_interes, coeficiente, comision, activo, disponible_online) VALUES
  (1, 'Efectivo', 'efectivo', 1, FALSE, 1.0, 0, TRUE, FALSE),
  (2, 'Debito', 'debito', 1, FALSE, 1.0, 0.8, TRUE, TRUE),
  (3, 'Credito 1 cuota', 'credito', 1, FALSE, 1.0, 3.5, TRUE, TRUE),
  (4, 'Credito 3 cuotas', 'credito', 3, TRUE, 1.15, 3.5, TRUE, TRUE),
  (5, 'Transferencia', 'transferencia', 1, FALSE, 1.0, 0, TRUE, TRUE),
  (6, 'Mercado Pago', 'plataforma', 1, FALSE, 1.0, 1.5, TRUE, TRUE);

INSERT INTO categorias_costo (id, nombre, tipo, subtipo) VALUES
  (1, 'Mercaderia', 'variable', NULL),
  (2, 'Comisiones', 'variable', NULL),
  (3, 'Envios', 'variable', NULL),
  (4, 'Alquiler', 'fijo', NULL),
  (5, 'Servicios (luz/agua/internet)', 'fijo', NULL),
  (6, 'Marketing', 'administrativo', NULL),
  (7, 'Sueldos', 'sueldo', NULL);

INSERT INTO proveedores (id, nombre, cuit, telefono, dias_pago, forma_pago, categoria) VALUES
  (1, 'Distribuidora Central', '30712345671', '5491100000001', 30, 'transferencia', 'mercaderia'),
  (2, 'Mayorista del Sur', '30712345672', '5491100000002', 45, 'echeck', 'mercaderia'),
  (3, 'Importadora Norte', '30712345673', '5491100000003', 15, 'transferencia', 'mercaderia');

INSERT INTO productos (id, nombre, marca, precio, costo, stock, stock_rg, stock_ush, stock_minimo, lead_time_dias, categoria, codigo_barras, local_id, proveedor_id, activo) VALUES
  (1,  'Agua Mineral 500ml',        'Fuente Azul',    1200,  650,  40, 25, 15, 10, 3, 'Bebidas',       '7791000000011', 1, 1, TRUE),
  (2,  'Gaseosa Cola 1.5L',         'Cola Real',       2400, 1300,  30, 18, 12, 8,  3, 'Bebidas',       '7791000000012', 1, 1, TRUE),
  (3,  'Jugo Natural 1L',           'Frutal',          2100, 1100,  25, 15, 10, 8,  3, 'Bebidas',       '7791000000013', 1, 1, TRUE),
  (4,  'Alfajor Triple',            'Dulzura',          950,  480,  60, 35, 25, 15, 2, 'Snacks',        '7791000000014', 1, 2, TRUE),
  (5,  'Papas Fritas 150g',         'Cruncho',         1800,  950,  35, 20, 15, 10, 2, 'Snacks',        '7791000000015', 1, 2, TRUE),
  (6,  'Chocolate Barra',           'CacaoMax',        1500,  780,  45, 28, 17, 12, 2, 'Snacks',        '7791000000016', 1, 2, TRUE),
  (7,  'Cuaderno A4 Rayado',        'Notex',           3200, 1700,  20, 12, 8,  6,  5, 'Papeleria',     '7791000000017', 1, 3, TRUE),
  (8,  'Lapicera Azul x3',          'Escribe',         1100,  550,  50, 30, 20, 10, 5, 'Papeleria',     '7791000000018', 1, 3, TRUE),
  (9,  'Carpeta N3',                'Notex',           4500, 2400,  15, 9,  6,  5,  5, 'Papeleria',     '7791000000019', 1, 3, TRUE),
  (10, 'Auriculares Bluetooth',     'SoundGo',        18500, 9800,  12, 7,  5,  4,  10,'Electronica',   '7791000000020', 1, 3, TRUE),
  (11, 'Cargador USB-C',            'PowerLine',       6500, 3200,  18, 11, 7,  6,  7, 'Electronica',   '7791000000021', 1, 3, TRUE),
  (12, 'Power Bank 10000mAh',       'PowerLine',      15900, 8500,  10, 6,  4,  4,  10,'Electronica',   '7791000000022', 1, 3, TRUE),
  (13, 'Detergente 750ml',         'Limpix',           2300, 1200,  28, 17, 11, 8,  3, 'Limpieza',      '7791000000023', 1, 2, TRUE),
  (14, 'Lavandina 1L',              'Limpix',          1400,  700,  32, 20, 12, 10, 3, 'Limpieza',      '7791000000024', 1, 2, TRUE),
  (15, 'Rollo Cocina x2',           'Suavetex',        2600, 1350,  22, 13, 9,  8,  3, 'Limpieza',      '7791000000025', 1, 2, TRUE),
  (16, 'Vela Aromatica',            'Aromas',          3400, 1700,  16, 10, 6,  6,  5, 'Regaleria',     '7791000000026', 1, 3, TRUE),
  (17, 'Portaretrato Mediano',      'Decora',          4200, 2100,  14, 8,  6,  5,  5, 'Regaleria',     '7791000000027', 1, 3, TRUE),
  (18, 'Taza Ceramica',             'Decora',          3800, 1900,  18, 11, 7,  6,  5, 'Regaleria',     '7791000000028', 1, 3, TRUE),
  (19, 'Pila AA x4',                'Energex',         2900, 1500,  40, 24, 16, 12, 3, 'Electronica',   '7791000000029', 1, 3, TRUE),
  (20, 'Termo 1L',                  'Termic',         12500, 6500,  11, 6,  5,  4,  10,'Bazar',         '7791000000030', 1, 2, TRUE);

INSERT INTO clientes (id, nombre, email, cuit_dni, telefono, local_id, puntos, nivel) VALUES
  (1, 'Maria Fernandez',   'maria.fernandez@demo.com',   '30111111', '5491100001111', 1, 1200, 'Silver'),
  (2, 'Juan Perez',        'juan.perez@demo.com',        '30222222', '5491100002222', 1, 3400, 'Gold'),
  (3, 'Lucia Gomez',       'lucia.gomez@demo.com',       '30333333', '5491100003333', 1, 200,  'Bronze'),
  (4, 'Carlos Rodriguez',  'carlos.rodriguez@demo.com',  '30444444', '5491100004444', 2, 800,  'Bronze'),
  (5, 'Ana Martinez',      'ana.martinez@demo.com',      '30555555', '5491100005555', 2, 5200, 'Platinum'),
  (6, 'Diego Sanchez',     'diego.sanchez@demo.com',     '30666666', '5491100006666', 2, 150,  'Bronze'),
  (7, 'Sofia Lopez',       'sofia.lopez@demo.com',       '30777777', '5491100007777', 1, 2100, 'Silver'),
  (8, 'Martin Torres',     'martin.torres@demo.com',     '30888888', '5491100008888', 2, 400,  'Bronze');

INSERT INTO reglas_comision (local_id, umbral_1, comision_1, umbral_2, comision_2, umbral_3, comision_3) VALUES
  (1, 50000, 5000, 100000, 3000, 150000, 2000),
  (2, 40000, 5000, 80000,  3000, 120000, 2000);

DO $$
DECLARE
  d INT;
  v_id INT;
  loc INT;
  usr INT;
  prod INT;
  cant INT;
  v_precio NUMERIC;
BEGIN
  FOR d IN 0..29 LOOP
    loc := CASE WHEN d % 2 = 0 THEN 1 ELSE 2 END;
    usr := CASE WHEN loc = 1 THEN 2 ELSE 3 END;
    prod := 1 + (d % 20);
    cant := 1 + (d % 4);
    SELECT precio INTO v_precio FROM productos WHERE id = prod;

    INSERT INTO ventas (local_id, usuario_id, total, canal, medio_pago, medio_pago_id, es_preventa, estado_pago, numero_factura, creado_en)
    VALUES (
      loc, usr, v_precio * cant, 'presencial',
      CASE WHEN d % 3 = 0 THEN 'Efectivo' WHEN d % 3 = 1 THEN 'Debito' ELSE 'Mercado Pago' END,
      CASE WHEN d % 3 = 0 THEN 1 WHEN d % 3 = 1 THEN 2 ELSE 6 END,
      FALSE, 'pagado', 'DEMO-' || LPAD((1000 + d)::text, 5, '0'),
      NOW() - (d || ' days')::interval
    )
    RETURNING id INTO v_id;

    INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario)
    VALUES (v_id, prod, cant, v_precio);
  END LOOP;
END $$;
