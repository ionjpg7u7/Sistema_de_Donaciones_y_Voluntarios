-- =========================================================
-- MÓDULO 4: GESTIÓN DE BENEFICIARIOS Y AYUDAS
-- Solicitudes de ayuda de beneficiarios verificados.
--
-- Este script se agrega al final del flujo de inicialización:
--   01_schema.sql -> 02_inserts.sql -> 03_solicitudes_ayuda.sql
--
-- En una base existente aplicarlo manualmente; no volver a ejecutar
-- 01_schema.sql ni 02_inserts.sql completos.
-- =========================================================

BEGIN;

-- 1. SOLICITUD DE AYUDA
CREATE TABLE IF NOT EXISTS solicitud_ayuda (
    id_solicitud_ayuda        SERIAL PRIMARY KEY,
    beneficiario_usuario_id   INT          NOT NULL,
    tipo_ayuda                VARCHAR(20)  NOT NULL
                              CHECK (tipo_ayuda IN ('ALIMENTO','MATERIAL','ECONOMICO','GENERAL')),
    necesidad                 VARCHAR(150) NOT NULL,
    descripcion               TEXT,
    cantidad_solicitada       NUMERIC(14,2),
    prioridad                 VARCHAR(10)  NOT NULL DEFAULT 'MEDIA'
                              CHECK (prioridad IN ('BAJA','MEDIA','ALTA')),
    estado                    VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                              CHECK (estado IN ('PENDIENTE','EN_EVALUACION','APROBADA','RECHAZADA','ATENDIDA','CANCELADA')),
    creado_por_usuario_id     INT          NOT NULL,
    evaluado_por_usuario_id   INT,
    fecha_creacion            TIMESTAMP    NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    fecha_evaluacion          TIMESTAMP,
    fecha_cierre              TIMESTAMP,
    motivo_rechazo            TEXT,
    motivo_cancelacion        TEXT,
    CONSTRAINT fk_solicitud_ayuda_beneficiario
        FOREIGN KEY (beneficiario_usuario_id) REFERENCES beneficiario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_ayuda_creador
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitud_ayuda_evaluador
        FOREIGN KEY (evaluado_por_usuario_id) REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    CONSTRAINT chk_solicitud_ayuda_cantidad
        CHECK (cantidad_solicitada IS NULL OR cantidad_solicitada > 0),
    CONSTRAINT chk_solicitud_ayuda_no_autoaprobar
        CHECK (evaluado_por_usuario_id IS NULL OR evaluado_por_usuario_id <> beneficiario_usuario_id),
    CONSTRAINT chk_solicitud_ayuda_cierre
        CHECK (estado NOT IN ('RECHAZADA','CANCELADA')
               OR (motivo_rechazo IS NOT NULL OR motivo_cancelacion IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_solicitud_ayuda_estado
    ON solicitud_ayuda(estado);
CREATE INDEX IF NOT EXISTS idx_solicitud_ayuda_beneficiario
    ON solicitud_ayuda(beneficiario_usuario_id, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_solicitud_ayuda_fecha
    ON solicitud_ayuda(fecha_creacion DESC);

-- 2. COMPATIBILIDAD CON LOS SEEDS DE DONACIONES Y ACTIVIDADES
-- 02_inserts.sql ya usa solicitud_ayuda_id = 1 y 2. Se crean esas filas
-- históricas antes de agregar las claves foráneas.
INSERT INTO solicitud_ayuda (
    id_solicitud_ayuda, beneficiario_usuario_id, tipo_ayuda, necesidad, descripcion,
    cantidad_solicitada, prioridad, estado, creado_por_usuario_id,
    evaluado_por_usuario_id, fecha_creacion, fecha_evaluacion
) VALUES
    (1, 4, 'ALIMENTO', 'Canasta familiar y ropa de abrigo',
     'Solicitud histórica vinculada a la asignación de la donación DON-2026-0007.',
     25.00, 'ALTA', 'APROBADA', 1, 1, '2026-03-05 09:00:00', '2026-03-05 15:00:00'),
    (2, 3, 'GENERAL', 'Medicamentos e insumos médicos',
     'Solicitud histórica vinculada a la actividad de traslado de medicamentos.',
     NULL, 'MEDIA', 'APROBADA', 1, 1, '2026-03-04 11:30:00', '2026-03-04 16:00:00')
ON CONFLICT (id_solicitud_ayuda) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('solicitud_ayuda', 'id_solicitud_ayuda'),
    GREATEST(
        (SELECT COALESCE(MAX(id_solicitud_ayuda), 0) FROM solicitud_ayuda),
        2
    ),
    true
);

-- 3. CLAVES FORÁNEAS EN LAS COLUMNAS YA RESERVADAS POR OTROS MÓDULOS
-- Se agregan solo si no existen. Así una instalación limpia y una base
-- existente quedan con el mismo contrato.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_asignacion_solicitud_ayuda'
    ) THEN
        ALTER TABLE asignacion_donacion
            ADD CONSTRAINT fk_asignacion_solicitud_ayuda
            FOREIGN KEY (solicitud_ayuda_id)
            REFERENCES solicitud_ayuda(id_solicitud_ayuda)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventario_destino_solicitud'
    ) THEN
        ALTER TABLE inventario_destino
            ADD CONSTRAINT fk_inventario_destino_solicitud
            FOREIGN KEY (solicitud_ayuda_id)
            REFERENCES solicitud_ayuda(id_solicitud_ayuda)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_actividad_solicitud_ayuda'
    ) THEN
        ALTER TABLE actividad
            ADD CONSTRAINT fk_actividad_solicitud_ayuda
            FOREIGN KEY (solicitud_ayuda_id)
            REFERENCES solicitud_ayuda(id_solicitud_ayuda)
            ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
