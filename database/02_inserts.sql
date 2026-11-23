-- =========================================================
-- DATOS DE PRUEBA: MÓDULO GESTIÓN DE USUARIOS
-- Nota: Todas las contraseñas encriptadas corresponden a '123456'
-- =========================================================

-- 1. TABLA BASE: USUARIO (12 registros)
INSERT INTO usuario (id_usuario, nombre, apellido, correo, telefono, password, estado, fecha_registro) VALUES
-- Administradores (IDs 1 y 2)
(1, 'Carla', 'Mamani Quispe', 'carla.admin@donacionesbo.org', '71234567', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-01-10 09:00:00'),
(2, 'Jorge', 'Fernandez Rojas', 'jorge.admin@donacionesbo.org', '71234568', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-01-11 09:30:00'),

-- Beneficiarios (IDs 3, 4 y 5)
(3, 'Rosa', 'Chambi Aguilar', 'rosa.chambi@gmail.com', '76001121', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-01 10:00:00'),
(4, 'Hector', 'Poma Yujra', 'hector.poma@gmail.com', '76001122', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-02 11:15:00'),
(5, 'Ana', 'Torrez Vidal', 'comedor.esperanza@gmail.com', '76001123', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-03 14:20:00'),

-- Donantes (IDs 6, 7, 8 y 9)
(6, 'Diego', 'Ramirez Soto', 'diego.ramirez@gmail.com', '76002201', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-05 15:00:00'),
(7, 'Sofia', 'Paredes Rivas', 'sofia.paredes@gmail.com', '76002202', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-06 16:30:00'),
(8, 'Andres', 'Guzman Flores', 'andres.guzman@gmail.com', '76002203', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-07 09:45:00'),
(9, 'Paola', 'Duran Vega', 'paola.duran@gmail.com', '76002204', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Inactivo', '2026-02-08 13:00:00'), -- Cuenta inactiva para pruebas

-- Voluntarios (IDs 10, 11 y 12)
(10, 'Luis', 'Choque Apaza', 'luis.choque@gmail.com', '76003301', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-10 08:30:00'),
(11, 'Valeria', 'Nina Choque', 'valeria.nina@gmail.com', '76003302', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-11 10:15:00'),
(12, 'Sebastian', 'Vega Luna', 'sebastian.vega@gmail.com', '76003303', '$2a$12$SYkWhr2bVMvKyYplaVy.VeNLKFFtY6tMDp6E9MmPp2Rzqb7qgM2RO', 'Activo', '2026-02-12 17:00:00');


-- =========================================================
-- 2. SUBTIPOS POR ROL
-- =========================================================

-- ---------- ADMINISTRADOR ----------
INSERT INTO administrador (id_usuario) VALUES
(1),
(2);

-- ---------- DONANTE ----------
-- Todos los que se registran nacen como donantes (IDs 3 a 12),
-- los que no dieron ubicación quedan con dirección y coordenadas NULL.
INSERT INTO donante (id_usuario, direccion, ubi_latitud, ubi_longitud) VALUES
(3,  NULL, NULL, NULL),
(4,  NULL, NULL, NULL),
(5,  NULL, NULL, NULL),
(6, 'Av. Busch #123, Miraflores, La Paz', -16.50384500, -68.12153200),
(7, 'Av. Arce #789, San Jorge, La Paz', -16.50912300, -68.12489100),
(8, 'Av. Ballivián #56, Calacoto, La Paz', -16.54123400, -68.08567800),
(9, 'Av. 6 de Agosto #300, Sopocachi, La Paz', -16.50765400, -68.12891000),
(10, NULL, NULL, NULL),
(11, NULL, NULL, NULL),
(12, NULL, NULL, NULL);

-- ---------- VOLUNTARIO ----------
-- Luis (10): coordinador, aprobado por el admin Carla (1)
-- Valeria (11): aprobada por el coordinador Luis (10)
-- Sebastian (12): Pendiente, para probar la aprobación
INSERT INTO voluntario (id_usuario, habilidades, disponibilidad, fecha_registro, es_coordinador, estado, revisado_por, fecha_revision) VALUES
(10, ARRAY['Logistica', 'Conduccion y Transporte', 'Carga'], 'Fines de semana', '2026-02-10 08:30:00', TRUE, 'Aprobado', 1, '2026-02-10 12:00:00'),
(11, ARRAY['Primeros Auxilios', 'Atencion Social', 'Organizacion'], 'Tardes (14:00 - 19:00)', '2026-02-11 10:15:00', FALSE, 'Aprobado', 10, '2026-02-12 09:00:00'),
(12, ARRAY['Cocina y Alimentacion', 'Inventario', 'Logistica'], 'Tiempo completo', '2026-02-12 17:00:00', FALSE, 'Pendiente', NULL, NULL);

-- ---------- BENEFICIARIO ----------
-- Rosa (3): verificada por Carla (1)
-- Hector (4): Pendiente, para probar la verificación
-- Ana (5): verificada por Jorge (2)
INSERT INTO beneficiario (id_usuario, tipo_beneficiario, documento, direccion, necesidad, descripcion, estado, revisado_por, fecha_revision) VALUES
(3, 'Persona', '5612345', 'Av. Buenos Aires #450, Zona Max Paredes, La Paz', 'Medicamentos e insumos médicos', 'Adulto mayor que requiere tratamiento mensual continuo.', 'Verificado', 1, '2026-02-03 09:00:00'),
(4, 'Familia', '6123456', 'Calle 4 #120, Villa Fátima, La Paz', 'Canasta familiar y ropa de abrigo', 'Familia de 5 integrantes afectada por pérdida de empleo.', 'Pendiente', NULL, NULL),
(5, 'Institucion', '1020304025', 'Av. Periférica #890, Zona Achachicala, La Paz', 'Alimentos no perecederos', 'Comedor popular infantil que atiende a 60 niños diariamente.', 'Verificado', 2, '2026-02-04 10:30:00');


-- =========================================================
-- 3. SINCRONIZAR SECUENCIA DE IDs EN POSTGRESQL
-- =========================================================
SELECT setval('usuario_id_usuario_seq', (SELECT MAX(id_usuario) FROM usuario));
-- =========================================================
-- 4. CATÁLOGOS INICIALES DE GESTIÓN DE DONACIONES
-- Se agregan al mismo archivo de inserts; no se modifican los registros
-- ni los roles de Gestión de Usuarios definidos anteriormente.
-- =========================================================
INSERT INTO unidad_medida (codigo, nombre, permite_decimales) VALUES
    ('UNI', 'Unidad', FALSE),
    ('KG', 'Kilogramo', TRUE),
    ('LT', 'Litro', TRUE),
    ('CAJA', 'Caja', FALSE),
    ('PAQ', 'Paquete', FALSE),
    ('BOLSA', 'Bolsa', FALSE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO donacion_categoria (nombre, tipo) VALUES
    ('Granos y cereales', 'ALIMENTO'),
    ('Enlatados y conservas', 'ALIMENTO'),
    ('Lácteos y derivados', 'ALIMENTO'),
    ('Frutas y verduras', 'ALIMENTO'),
    ('Bebidas', 'ALIMENTO'),
    ('Otros alimentos', 'ALIMENTO'),
    ('Ropa y calzado', 'MATERIAL'),
    ('Útiles escolares', 'MATERIAL'),
    ('Higiene personal', 'MATERIAL'),
    ('Muebles y enseres', 'MATERIAL'),
    ('Insumos médicos', 'MATERIAL'),
    ('Otros materiales', 'MATERIAL')
ON CONFLICT (tipo, nombre) DO NOTHING;

-- =========================================================
-- 5. MÓDULO 3: GESTIÓN DE CAMPAÑAS Y ACTIVIDADES
-- =========================================================

-- ---------- CAMPAÑAS (Activas, Planificadas/Futuras y Finalizadas) ----------
INSERT INTO campana (id_campana, nombre, descripcion, portada_url, fecha_inicio, fecha_fin, objetivo_recaudacion, estado, id_administrador, fecha_creacion) VALUES
(1, 'Campaña Solidaria Incendios Chiquitanía 2026',
    'Recaudación de víveres, agua, herramientas y fondos para bomberos voluntarios y familias afectadas por los incendios forestales en la Chiquitanía.',
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800',
    '2026-01-01', '2026-12-31', 50000.00, 'Activa', 1, '2026-01-01 10:00:00'),
(2, 'Campaña Frío Cero - Abriguemos La Paz (Invierno 2026)',
    'Colecta masiva de ropa de invierno, chamarras, frazadas y mantas térmicas para personas en situación de calle y familias vulnerables ante el frío altiplánico.',
    'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=800',
    '2026-05-01', '2026-12-31', 25000.00, 'Planificada', 2, '2026-02-28 11:30:00'),
(3, 'Campaña Banco de Alimentos para Comedores Populares',
    'Recolección permanente y masiva de alimentos secos, granos, conservas e insumos de primera necesidad para abastecer a 8 comedores comunitarios.',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800',
    '2026-01-01', '2026-12-31', 35000.00, 'Activa', 1, '2026-01-14 08:00:00'),
(4, 'Campaña Mochila Solidaria Escolar 2026',
    'Dotación de material pedagógico, cuadernos y mochilas para 200 estudiantes de primaria en zonas periurbanas de La Paz y El Alto.',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
    '2026-01-15', '2026-02-20', 15000.00, 'Finalizada', 1, '2026-01-10 09:00:00')
ON CONFLICT (id_campana) DO UPDATE 
SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, portada_url = EXCLUDED.portada_url, estado = EXCLUDED.estado, fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin;

SELECT setval('campana_id_campana_seq', COALESCE((SELECT MAX(id_campana) FROM campana), 1));

-- ---------- DONACIONES DE PRUEBA (Campañas, Solicitudes e Inventario) ----------
INSERT INTO donacion (id_donacion, codigo, donante_usuario_id, registrado_por_usuario_id, voluntario_usuario_id, tipo_donacion, modalidad, cantidad, cantidad_recibida, descripcion, fecha_donacion, campana_id, estado) VALUES
-- Campaña 1 (Incendios)
(1, 'DON-2026-0001', 6, 1, 10, 'ALIMENTO', 'PRESENCIAL', 50.00, 50.00, 'Donación de arroz para brigadas de bomberos (Campaña Incendios)', '2026-03-02 10:30:00', 1, 'ASIGNADA_PARCIAL'),
(3, 'DON-2026-0003', 8, 1, NULL, 'ECONOMICO', 'ONLINE', 1500.00, 1500.00, 'Aporte económico para compra de agua y combustible (Campaña Incendios)', '2026-03-04 16:45:00', 1, 'REGISTRADA'),
-- Campaña 3 (Banco de Alimentos)
(4, 'DON-2026-0004', 6, 1, NULL, 'ECONOMICO', 'ONLINE', 800.00, 800.00, 'Donación monetaria por QR para raciones de comedores infantiles', '2026-02-20 11:00:00', 3, 'REGISTRADA'),
-- Campaña 4 (Mochila Escolar - Finalizada)
(5, 'DON-2026-0005', 7, 1, NULL, 'MATERIAL', 'ONLINE', 100.00, 100.00, 'Donación de paquetes escolares y cuadernos (Campaña Mochilas)', '2026-01-25 15:30:00', 4, 'ASIGNADA_TOTAL'),
-- Donaciones Directas al INVENTARIO GENERAL (Presenciales, campana_id = NULL)
(2, 'DON-2026-0002', 7, 1, 10, 'MATERIAL', 'PRESENCIAL', 30.00, 30.00, 'Donación física de chompas de lana en sede central para almacén general', '2026-03-03 14:00:00', NULL, 'REGISTRADA'),
(6, 'DON-2026-0006', 8, 1, 10, 'MATERIAL', 'PRESENCIAL', 20.00, 20.00, 'Frazadas térmicas entregadas en oficina de acopio', '2026-03-04 17:00:00', NULL, 'REGISTRADA'),
-- Donación orientada a Solicitud de Ayuda Familiar
(7, 'DON-2026-0007', 6, 1, NULL, 'ALIMENTO', 'ONLINE', 25.00, 25.00, 'Canasta con víveres para apoyo a familias vulnerables', '2026-03-05 09:15:00', NULL, 'ASIGNADA_TOTAL')
ON CONFLICT (id_donacion) DO UPDATE 
SET codigo = EXCLUDED.codigo, campana_id = EXCLUDED.campana_id, estado = EXCLUDED.estado;

-- Detalles
INSERT INTO detalle_alimento (id_donacion, categoria_id, nombre_producto, unidad_medida_id, fecha_vencimiento) VALUES
(1, 1, 'Arroz de grano seleccionado', 2, '2026-12-31'),
(7, 1, 'Canasta de granos surtidos', 2, '2026-11-30')
ON CONFLICT (id_donacion) DO NOTHING;

INSERT INTO detalle_material (id_donacion, categoria_id, nombre_material, estado_material, unidad_medida_id) VALUES
(2, 7, 'Chompas de lana variadas', 'NUEVO', 1),
(5, 8, 'Útiles escolares y cuadernos', 'NUEVO', 5),
(6, 7, 'Frazadas térmicas polares', 'NUEVO', 1)
ON CONFLICT (id_donacion) DO NOTHING;

INSERT INTO detalle_economico (id_donacion, monto, moneda_codigo, metodo_pago, referencia_pago) VALUES
(3, 1500.00, 'BOB', 'QR', 'BCP-QR-891230491'),
(4, 800.00, 'BOB', 'TRANSFERENCIA', 'BNB-TR-40019283')
ON CONFLICT (id_donacion) DO NOTHING;

SELECT setval('donacion_codigo_seq', COALESCE((SELECT MAX(id_donacion) FROM donacion), 7));

-- Asignación de Donaciones a Beneficiarios y Solicitudes
INSERT INTO asignacion_donacion (id_asignacion, donacion_id, beneficiario_usuario_id, solicitud_ayuda_id, cantidad, fecha_asignacion, administrador_usuario_id, estado, observaciones) VALUES
(1, 7, 4, 1, 25.00, '2026-03-06 10:00:00', 1, 'ACTIVA', 'Asignada a la Familia Poma según solicitud de ayuda evaluada'),
(2, 1, 5, NULL, 20.00, '2026-03-07 11:30:00', 1, 'ACTIVA', 'Entrega parcial de 20 kg de arroz para Comedor Infantil Esperanza')
ON CONFLICT (id_asignacion) DO NOTHING;

-- ---------- ACTIVIDADES (Campañas, Solicitudes e Inventario) ----------
INSERT INTO actividad (id_actividad, nombre, descripcion, fecha, hora_inicio, hora_fin, lugar, max_voluntarios, tipo_actividad, solicitud_ayuda_id, id_donacion, estado, creado_por_usuario_id, fecha_creacion) VALUES
-- Actividades para Campaña 1 (Incendios)
(1, 'Clasificación y empaque de víveres para bomberos',
    'Recepción, armado de raciones secas e hidratación para brigadistas de la Chiquitanía.',
    '2026-03-10', '08:30:00', '13:00:00', 'Sede Central - Almacén Miraflores', 10, 'CAMPANA', NULL, NULL, 'Planificada', 1, '2026-03-01 10:00:00'),
(2, 'Colecta y recepción de donaciones en Plaza Mayor',
    'Punto presencial de acopio de vituallas, herramientas y alimentos no perecederos.',
    '2026-03-12', '09:00:00', '18:00:00', 'Plaza Mayor de San Francisco', 15, 'CAMPANA', NULL, NULL, 'Planificada', 1, '2026-03-01 11:00:00'),
(6, 'Distribución de kits de hidratación a brigadas',
    'Entrega y abastecimiento en cuartel de bomberos voluntarios antes de salida a campo.',
    '2026-03-15', '07:00:00', '11:30:00', 'Cuartel Bomberos Voluntarios Zona Sur', 8, 'CAMPANA', NULL, NULL, 'Planificada', 1, '2026-03-02 14:00:00'),

-- Actividades para Campaña 2 (Frío Cero - Futura)
(3, 'Selección y doblado de ropa de invierno',
    'Separación de ropa por tallas, abrigo y verificación de estado en taller de clasificación.',
    '2026-05-05', '14:00:00', '18:30:00', 'Centro Comunitario Sopocachi', 8, 'CAMPANA', NULL, NULL, 'Planificada', 2, '2026-03-02 09:30:00'),
(7, 'Jornada nocturna de reparto de mantas térmicas',
    'Brigada de recorrido nocturno para entrega de frazadas y sopa caliente a personas sin techo.',
    '2026-05-15', '19:00:00', '23:00:00', 'Puntos estratégicos Centro y Terminal de Buses', 12, 'CAMPANA', NULL, NULL, 'Planificada', 2, '2026-03-03 10:00:00'),

-- Actividades para Campaña 3 (Banco de Alimentos)
(8, 'Acopio y empaque de granos para comedores',
    'Pesaje y sellado de paquetes de arroz, fideo y lenteja para comedores populares.',
    '2026-03-18', '09:00:00', '14:00:00', 'Sede Central - Galpón Achachicala', 10, 'CAMPANA', NULL, NULL, 'En_Curso', 1, '2026-03-03 16:00:00'),

-- Actividad para Campaña 4 (Mochila Escolar - Finalizada)
(9, 'Armado y entrega de 100 mochilas escolares',
    'Jornada de armado de útiles y entrega formal a niños beneficiarios del comedor popular.',
    '2026-02-18', '08:30:00', '12:30:00', 'Comedor Popular Esperanza, Zona Achachicala', 6, 'CAMPANA', NULL, NULL, 'Finalizada', 1, '2026-01-20 09:00:00'),

-- Actividades vinculadas a SOLICITUDES DE AYUDA
(5, 'Entrega de víveres a familia damnificada',
    'Distribución directa de canasta de alimentos a la Familia Poma según solicitud de ayuda evaluada.',
    '2026-03-08', '15:00:00', '17:00:00', 'Zona Villa Fátima', 3, 'SOLICITUD_AYUDA', 1, NULL, 'Finalizada', 1, '2026-03-04 11:00:00'),
(10, 'Traslado de medicamentos a adulto mayor',
    'Apoyo a la Sra. Rosa Chambi con entrega y verificación de recetas médicas a domicilio.',
    '2026-03-20', '10:00:00', '12:00:00', 'Av. Buenos Aires #450, Max Paredes', 2, 'SOLICITUD_AYUDA', 2, NULL, 'Planificada', 1, '2026-03-04 12:00:00'),

-- Actividades vinculadas al INVENTARIO GENERAL
(4, 'Recojo a domicilio de donaciones voluminosas',
    'Traslado de ropa y alimentos desde el domicilio de donantes hasta el almacén central.',
    '2026-03-05', '10:00:00', '12:30:00', 'Zona Sur - Calacoto', 4, 'INVENTARIO', NULL, 2, 'Finalizada', 1, '2026-03-03 15:00:00'),
(11, 'Jornada general de conteo e inventariado en almacén',
    'Organización de estantes, recuento físico de bienes y control de stock en almacén central.',
    '2026-03-25', '09:00:00', '15:00:00', 'Almacén General Miraflores', 6, 'INVENTARIO', NULL, NULL, 'Planificada', 1, '2026-03-05 08:30:00')
ON CONFLICT (id_actividad) DO UPDATE
SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion, fecha = EXCLUDED.fecha, estado = EXCLUDED.estado;

SELECT setval('actividad_id_actividad_seq', COALESCE((SELECT MAX(id_actividad) FROM actividad), 11));

-- ---------- ASIGNACIÓN ACTIVIDAD - CAMPAÑA (ACTIVIDAD_CAMPAÑA) ----------
INSERT INTO actividad_campana (id_actividad, id_campana, fecha_asignacion) VALUES
-- Campaña 1 (Incendios)
(1, 1, '2026-03-01 10:30:00'),
(2, 1, '2026-03-01 11:30:00'),
(6, 1, '2026-03-02 14:30:00'),
-- Campaña 2 (Frío Cero)
(3, 2, '2026-03-02 10:00:00'),
(7, 2, '2026-03-03 10:30:00'),
-- Campaña 3 (Banco Alimentos)
(8, 3, '2026-03-03 16:30:00'),
-- Campaña 4 (Mochilas)
(9, 4, '2026-01-20 09:30:00')
ON CONFLICT (id_actividad, id_campana) DO NOTHING;

-- ---------- PARTICIPACIÓN DE VOLUNTARIOS (PARTICIPA) ----------
INSERT INTO participa (id_participacion, id_voluntario, id_actividad, fecha_inscripcion, asistio, estado, observaciones, horas_acreditadas, fecha_asistencia, marcado_por_usuario_id) VALUES
-- Actividad 1 (Campaña 1): Luis, Valeria y Andres inscritos
(1, 10, 1, '2026-03-02 09:00:00', FALSE, 'Inscrito', 'Coordinador general del grupo de clasificación', 0.00, NULL, NULL),
(2, 11, 1, '2026-03-02 09:30:00', FALSE, 'Inscrito', 'Encargada de botiquín y primeros auxilios', 0.00, NULL, NULL),
(6, 8,  1, '2026-03-03 11:00:00', FALSE, 'Inscrito', 'Voluntario en armado de paquetes', 0.00, NULL, NULL),

-- Actividad 2 (Campaña 1): Sofia inscrita
(7, 7,  2, '2026-03-04 10:00:00', FALSE, 'Inscrito', 'Recepción de donaciones en carpa central', 0.00, NULL, NULL),

-- Actividad 4 (Inventario - Finalizada): Luis y Diego
(3, 10, 4, '2026-03-03 16:00:00', TRUE, 'Asistio', 'Condujo la movilidad para el recojo', 2.50, '2026-03-05 12:30:00', 1),
(4, 6,  4, '2026-03-03 16:15:00', TRUE, 'Asistio', 'Ayudó en la carga y descarga de bienes', 2.50, '2026-03-05 12:30:00', 1),

-- Actividad 5 (Solicitud de Ayuda - Finalizada): Sebastian y Valeria
(5, 12, 5, '2026-03-06 10:00:00', TRUE, 'Asistio', 'Entrega y verificación en terreno', 2.00, '2026-03-08 17:00:00', 1),
(8, 11, 5, '2026-03-06 10:30:00', TRUE, 'Asistio', 'Acompañamiento social a la familia', 2.00, '2026-03-08 17:00:00', 1),

-- Actividad 8 (Campaña 3): Valeria
(9, 11, 8, '2026-03-05 14:00:00', FALSE, 'Inscrito', 'Supervisión de pesaje de granos', 0.00, NULL, NULL),

-- Actividad 9 (Campaña 4 - Finalizada): Luis, Valeria y Diego
(10, 10, 9, '2026-02-15 09:00:00', TRUE, 'Asistio', 'Coordinó la entrega de mochilas a niños', 4.00, '2026-02-18 12:30:00', 1),
(11, 11, 9, '2026-02-15 09:15:00', TRUE, 'Asistio', 'Organización de listas y entrega de refrigerio', 4.00, '2026-02-18 12:30:00', 1),
(12, 6,  9, '2026-02-16 10:00:00', TRUE, 'Asistio', 'Apoyo logístico y transporte de material', 4.00, '2026-02-18 12:30:00', 1),

-- Actividad 11 (Inventario): Sebastian inscrito
(13, 12, 11, '2026-03-07 15:00:00', FALSE, 'Inscrito', 'Conteo y rotulado en almacén central', 0.00, NULL, NULL)
ON CONFLICT (id_participacion) DO UPDATE
SET asistio = EXCLUDED.asistio, estado = EXCLUDED.estado, horas_acreditadas = EXCLUDED.horas_acreditadas;

SELECT setval('participa_id_participacion_seq', COALESCE((SELECT MAX(id_participacion) FROM participa), 13));

-- =========================================================
-- SINCRONIZACIÓN GENERAL DE SECUENCIAS
-- Evita errores de clave duplicada (código 23505) en inserciones posteriores
-- =========================================================
SELECT setval('usuario_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuario), 1));
SELECT setval('unidad_medida_id_unidad_seq', COALESCE((SELECT MAX(id_unidad) FROM unidad_medida), 1));
SELECT setval('donacion_categoria_id_categoria_seq', COALESCE((SELECT MAX(id_categoria) FROM donacion_categoria), 1));
SELECT setval('donacion_id_donacion_seq', COALESCE((SELECT MAX(id_donacion) FROM donacion), 1));
SELECT setval('asignacion_donacion_id_asignacion_seq', COALESCE((SELECT MAX(id_asignacion) FROM asignacion_donacion), 1));
SELECT setval('donacion_recepciones_id_recepcion_seq', COALESCE((SELECT MAX(id_recepcion) FROM donacion_recepciones), 1));
SELECT setval('comprobante_donacion_id_comprobante_seq', COALESCE((SELECT MAX(id_comprobante) FROM comprobante_donacion), 1));
SELECT setval('auditoria_donacion_id_auditoria_seq', COALESCE((SELECT MAX(id_auditoria) FROM auditoria_donacion), 1));
SELECT setval('campana_id_campana_seq', COALESCE((SELECT MAX(id_campana) FROM campana), 1));
SELECT setval('actividad_id_actividad_seq', COALESCE((SELECT MAX(id_actividad) FROM actividad), 1));
SELECT setval('participa_id_participacion_seq', COALESCE((SELECT MAX(id_participacion) FROM participa), 1));

SELECT setval('donacion_codigo_seq', GREATEST((SELECT last_value FROM donacion_codigo_seq), COALESCE((SELECT MAX(id_donacion) FROM donacion), 1) + 10));
SELECT setval('comprobante_donacion_seq', GREATEST((SELECT last_value FROM comprobante_donacion_seq), COALESCE((SELECT MAX(id_comprobante) FROM comprobante_donacion), 1) + 10));



