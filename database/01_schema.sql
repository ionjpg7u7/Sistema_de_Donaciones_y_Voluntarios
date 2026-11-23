-- =========================================================
-- MÓDULO: GESTIÓN DE USUARIOS (bd_donaciones_voluntariado)
-- Herencia 1:1 con especialización solapada: un usuario puede
-- ser donante, voluntario y/o beneficiario a la vez.
-- =========================================================

-- 1. USUARIO (cuenta)
CREATE TABLE usuario (
    id_usuario     SERIAL PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    apellido       VARCHAR(100) NOT NULL,
    correo         VARCHAR(150) NOT NULL UNIQUE,
    telefono       VARCHAR(20),
    password       VARCHAR(255) NOT NULL,
    foto_url       VARCHAR(500),
    estado         VARCHAR(20) NOT NULL DEFAULT 'Activo'
                   CHECK (estado IN ('Activo','Inactivo','Eliminado')),
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ADMINISTRADOR
CREATE TABLE administrador (
    id_usuario INT PRIMARY KEY,
    CONSTRAINT fk_admin_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- 3. DONANTE (se crea automáticamente al registrarse)
CREATE TABLE donante (
    id_usuario   INT PRIMARY KEY,
    direccion    VARCHAR(255),
    ubi_latitud  DECIMAL(10,8),
    ubi_longitud DECIMAL(11,8),
    CONSTRAINT fk_donante_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_coordenadas_validas CHECK (
        (ubi_latitud  IS NULL OR ubi_latitud  BETWEEN -90 AND 90) AND
        (ubi_longitud IS NULL OR ubi_longitud BETWEEN -180 AND 180))
);

-- 4. VOLUNTARIO (la solicitud la aprueba el coordinador)
CREATE TABLE voluntario (
    id_usuario     INT PRIMARY KEY,
    habilidades    TEXT[] NOT NULL DEFAULT '{}',
    disponibilidad VARCHAR(100) NOT NULL,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    es_coordinador BOOLEAN NOT NULL DEFAULT FALSE,
    estado         VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                   CHECK (estado IN ('Pendiente','Aprobado','Rechazado')),
    revisado_por   INT,            -- coordinador que aprobó/rechazó
    fecha_revision TIMESTAMP,
    motivo_rechazo TEXT,
    CONSTRAINT fk_voluntario_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_voluntario_revisor FOREIGN KEY (revisado_por)
        REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    -- solo un voluntario aprobado puede ser coordinador
    CONSTRAINT chk_coordinador_aprobado
        CHECK (NOT es_coordinador OR estado = 'Aprobado'),
    -- nadie aprueba su propia solicitud
    CONSTRAINT chk_voluntario_no_autoaprobacion
        CHECK (revisado_por IS NULL OR revisado_por <> id_usuario)
);

-- 5. BENEFICIARIO (la solicitud la verifica el administrador)
CREATE TABLE beneficiario (
    id_usuario        INT PRIMARY KEY,
    tipo_beneficiario VARCHAR(30) NOT NULL
                      CHECK (tipo_beneficiario IN ('Persona','Familia','Institucion')),
    documento         VARCHAR(30) NOT NULL UNIQUE,  -- CI, NIT o Personería Jurídica
    direccion         VARCHAR(255) NOT NULL,
    necesidad         VARCHAR(150) NOT NULL,
    descripcion       TEXT,
    estado            VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                      CHECK (estado IN ('Pendiente','Verificado','Rechazado')),
    revisado_por      INT,           -- admin que verificó/rechazó
    fecha_revision    TIMESTAMP,
    motivo_rechazo    TEXT,
    CONSTRAINT fk_beneficiario_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_beneficiario_revisor FOREIGN KEY (revisado_por)
        REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    -- nadie verifica su propia solicitud
    CONSTRAINT chk_beneficiario_no_autoaprobacion
        CHECK (revisado_por IS NULL OR revisado_por <> id_usuario)
);

-- =========================================================
-- ÍNDICES
-- =========================================================
CREATE INDEX idx_usuario_estado         ON usuario(estado);
CREATE INDEX idx_voluntario_estado      ON voluntario(estado);
CREATE INDEX idx_beneficiario_documento ON beneficiario(documento);
CREATE INDEX idx_beneficiario_estado    ON beneficiario(estado);
-- (no hace falta índice en correo: UNIQUE ya lo crea)

-- MÓDULO 2: GESTIÓN DE DONACIONES
-- =========================================================

-- 1. CATÁLOGOS
CREATE TABLE IF NOT EXISTS unidad_medida (
    id_unidad         SERIAL PRIMARY KEY,
    codigo            VARCHAR(10)  NOT NULL UNIQUE,
    nombre            VARCHAR(50)  NOT NULL,
    permite_decimales BOOLEAN      NOT NULL DEFAULT FALSE,
    activa            BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS donacion_categoria (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(80) NOT NULL,
    tipo         VARCHAR(10) NOT NULL CHECK (tipo IN ('ALIMENTO', 'MATERIAL')),
    activa       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_donacion_categoria UNIQUE (tipo, nombre)
);

-- 2. SECUENCIAS DE NUMERACIÓN
CREATE SEQUENCE IF NOT EXISTS donacion_codigo_seq;
CREATE SEQUENCE IF NOT EXISTS comprobante_donacion_seq;

-- 3. DONACIÓN (tabla principal)
CREATE TABLE IF NOT EXISTS donacion (
    id_donacion               SERIAL PRIMARY KEY,
    codigo                    VARCHAR(20)   NOT NULL UNIQUE,
    donante_usuario_id        INT           NOT NULL,
    registrado_por_usuario_id INT           NOT NULL,
    voluntario_usuario_id     INT,
    tipo_donacion             VARCHAR(10)   NOT NULL
                              CHECK (tipo_donacion IN ('ALIMENTO', 'MATERIAL', 'ECONOMICO')),
    modalidad                 VARCHAR(10)   NOT NULL DEFAULT 'ONLINE'
                              CHECK (modalidad IN ('ONLINE', 'PRESENCIAL')),
    cantidad                  NUMERIC(14,2) NOT NULL CHECK (cantidad > 0),
    cantidad_recibida         NUMERIC(14,2) NOT NULL DEFAULT 0,
    descripcion               TEXT,
    fecha_donacion            TIMESTAMP     NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    campana_id                INT,
    estado                    VARCHAR(20)   NOT NULL DEFAULT 'REGISTRADA'
                              CHECK (estado IN ('REGISTRADA', 'ASIGNADA_PARCIAL', 'ASIGNADA_TOTAL', 'ANULADA')),
    motivo_anulacion          TEXT,
    fecha_anulacion           TIMESTAMP,
    anulada_por_usuario_id    INT,
    version                   INT           NOT NULL DEFAULT 1,
    fecha_actualizacion       TIMESTAMP     NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    CONSTRAINT fk_donacion_donante
        FOREIGN KEY (donante_usuario_id) REFERENCES donante(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_donacion_registrado_por
        FOREIGN KEY (registrado_por_usuario_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_donacion_voluntario
        FOREIGN KEY (voluntario_usuario_id) REFERENCES voluntario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_donacion_anulada_por
        FOREIGN KEY (anulada_por_usuario_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_donacion_anulacion
        CHECK (estado <> 'ANULADA'
               OR (motivo_anulacion IS NOT NULL AND anulada_por_usuario_id IS NOT NULL AND fecha_anulacion IS NOT NULL)),
    CONSTRAINT chk_donacion_voluntario_presencial
        CHECK (voluntario_usuario_id IS NULL OR modalidad = 'PRESENCIAL'),
    CONSTRAINT chk_donacion_recibida_no_negativa
        CHECK (cantidad_recibida >= 0),
    CONSTRAINT chk_donacion_recibida_no_supera_compromiso
        CHECK (cantidad_recibida <= cantidad)
);

-- 4. DETALLES POR TIPO (1:1 con donacion)
CREATE TABLE IF NOT EXISTS detalle_alimento (
    id_donacion       INT PRIMARY KEY,
    categoria_id      INT          NOT NULL,
    nombre_producto   VARCHAR(120),
    unidad_medida_id  INT          NOT NULL,
    fecha_vencimiento DATE         NOT NULL,
    CONSTRAINT fk_det_alimento_donacion  FOREIGN KEY (id_donacion)      REFERENCES donacion(id_donacion) ON DELETE CASCADE,
    CONSTRAINT fk_det_alimento_categoria FOREIGN KEY (categoria_id)     REFERENCES donacion_categoria(id_categoria),
    CONSTRAINT fk_det_alimento_unidad    FOREIGN KEY (unidad_medida_id) REFERENCES unidad_medida(id_unidad)
);

CREATE TABLE IF NOT EXISTS detalle_material (
    id_donacion      INT PRIMARY KEY,
    categoria_id     INT         NOT NULL,
    nombre_material  VARCHAR(120),
    estado_material  VARCHAR(25) NOT NULL
                     CHECK (estado_material IN ('NUEVO', 'USADO_BUEN_ESTADO', 'REPARABLE')),
    unidad_medida_id INT         NOT NULL,
    CONSTRAINT fk_det_material_donacion  FOREIGN KEY (id_donacion)      REFERENCES donacion(id_donacion) ON DELETE CASCADE,
    CONSTRAINT fk_det_material_categoria FOREIGN KEY (categoria_id)     REFERENCES donacion_categoria(id_categoria),
    CONSTRAINT fk_det_material_unidad    FOREIGN KEY (unidad_medida_id) REFERENCES unidad_medida(id_unidad)
);

CREATE TABLE IF NOT EXISTS detalle_economico (
    id_donacion     INT PRIMARY KEY,
    monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
    moneda_codigo   CHAR(3)       NOT NULL DEFAULT 'BOB' CHECK (moneda_codigo IN ('BOB', 'USD')),
    metodo_pago     VARCHAR(15)   NOT NULL
                    CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'QR')),
    referencia_pago VARCHAR(80),
    CONSTRAINT fk_det_economico_donacion FOREIGN KEY (id_donacion) REFERENCES donacion(id_donacion) ON DELETE CASCADE
);

-- 5. ASIGNACIÓN DE DONACIONES
CREATE TABLE IF NOT EXISTS asignacion_donacion (
    id_asignacion            SERIAL PRIMARY KEY,
    donacion_id              INT           NOT NULL,
    beneficiario_usuario_id  INT           NOT NULL,
    solicitud_ayuda_id       INT,
    cantidad                 NUMERIC(14,2) NOT NULL CHECK (cantidad > 0),
    fecha_asignacion         TIMESTAMP     NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    administrador_usuario_id INT           NOT NULL,
    estado                   VARCHAR(10)   NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'CANCELADA')),
    observaciones            VARCHAR(500),
    motivo_cancelacion       TEXT,
    fecha_cancelacion        TIMESTAMP,
    cancelada_por_usuario_id INT,
    CONSTRAINT fk_asignacion_donacion      FOREIGN KEY (donacion_id)              REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_beneficiario  FOREIGN KEY (beneficiario_usuario_id)  REFERENCES beneficiario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_administrador FOREIGN KEY (administrador_usuario_id) REFERENCES administrador(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_asignacion_cancelada_por FOREIGN KEY (cancelada_por_usuario_id) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_asignacion_cancelacion
        CHECK (estado <> 'CANCELADA'
               OR (motivo_cancelacion IS NOT NULL AND cancelada_por_usuario_id IS NOT NULL AND fecha_cancelacion IS NOT NULL))
);

-- 6. RECEPCIÓN DE DONACIONES
CREATE TABLE IF NOT EXISTS donacion_recepciones (
    id_recepcion          SERIAL PRIMARY KEY,
    donacion_id           INT           NOT NULL REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    tipo_recepcion        VARCHAR(10)   NOT NULL CHECK (tipo_recepcion IN ('DINERO', 'BIEN')),
    cantidad_declarada    NUMERIC(14,2) NOT NULL CHECK (cantidad_declarada > 0),
    cantidad_aceptada     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cantidad_aceptada >= 0),
    metodo_pago           VARCHAR(15),
    referencia            VARCHAR(120),
    fecha_recepcion       TIMESTAMP     NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    recibido_por_usuario_id INT         NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    estado                VARCHAR(12)   NOT NULL CHECK (estado IN ('ACEPTADA', 'PARCIAL', 'RECHAZADA')),
    observaciones         TEXT,
    motivo_rechazo        TEXT,
    CONSTRAINT chk_recepcion_aceptada_menor_declarada
        CHECK (cantidad_aceptada <= cantidad_declarada),
    CONSTRAINT chk_recepcion_metodo_dinero
        CHECK (tipo_recepcion <> 'DINERO' OR metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'QR'))
);

-- 7. COMPROBANTE DE DONACIÓN
CREATE TABLE IF NOT EXISTS comprobante_donacion (
    id_comprobante         SERIAL PRIMARY KEY,
    donacion_id            INT         NOT NULL,
    numero_comprobante     VARCHAR(20) NOT NULL UNIQUE,
    tipo                   VARCHAR(10) NOT NULL DEFAULT 'DONACION' CHECK (tipo IN ('DONACION')),
    fecha_emision          TIMESTAMP   NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    emitido_por_usuario_id INT         NOT NULL,
    estado                 VARCHAR(10) NOT NULL DEFAULT 'EMITIDO' CHECK (estado IN ('EMITIDO', 'ANULADO')),
    CONSTRAINT fk_comprobante_donacion  FOREIGN KEY (donacion_id)            REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    CONSTRAINT fk_comprobante_emisor    FOREIGN KEY (emitido_por_usuario_id) REFERENCES usuario(id_usuario)   ON DELETE RESTRICT,
    CONSTRAINT uq_comprobante_donacion_tipo UNIQUE (donacion_id, tipo)
);

-- 8. AUDITORÍA (append-only)
CREATE TABLE IF NOT EXISTS auditoria_donacion (
    id_auditoria      BIGSERIAL PRIMARY KEY,
    donacion_id       INT         NOT NULL,
    entidad_tipo      VARCHAR(30) NOT NULL,
    entidad_id        INT         NOT NULL,
    usuario_id        INT         NOT NULL,
    accion            VARCHAR(30) NOT NULL,
    datos_anteriores  JSONB,
    datos_nuevos      JSONB,
    motivo            TEXT,
    fecha_hora        TIMESTAMP   NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    CONSTRAINT fk_auditoria_donacion FOREIGN KEY (donacion_id) REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    CONSTRAINT fk_auditoria_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuario(id_usuario)   ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION fn_auditoria_donacion_inmutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'auditoria_donacion es de solo inserción (no se permite %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_donacion_inmutable ON auditoria_donacion;
CREATE TRIGGER trg_auditoria_donacion_inmutable
    BEFORE UPDATE OR DELETE ON auditoria_donacion
    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_donacion_inmutable();

-- 9. ÍNDICES MÓDULO DE DONACIONES
CREATE INDEX IF NOT EXISTS idx_donacion_donante          ON donacion(donante_usuario_id);
CREATE INDEX IF NOT EXISTS idx_donacion_voluntario       ON donacion(voluntario_usuario_id);
CREATE INDEX IF NOT EXISTS idx_donacion_tipo             ON donacion(tipo_donacion);
CREATE INDEX IF NOT EXISTS idx_donacion_estado           ON donacion(estado);
CREATE INDEX IF NOT EXISTS idx_donacion_fecha            ON donacion(fecha_donacion DESC);
CREATE INDEX IF NOT EXISTS idx_donacion_campana          ON donacion(campana_id) WHERE campana_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asignacion_donacion       ON asignacion_donacion(donacion_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_benef          ON asignacion_donacion(beneficiario_usuario_id);
CREATE INDEX IF NOT EXISTS idx_asignacion_activas        ON asignacion_donacion(donacion_id) WHERE estado = 'ACTIVA';
CREATE INDEX IF NOT EXISTS idx_donacion_recepciones_don  ON donacion_recepciones(donacion_id, fecha_recepcion DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_donacion_recepcion_ref
    ON donacion_recepciones(donacion_id, referencia) WHERE referencia IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auditoria_donacion        ON auditoria_donacion(donacion_id, fecha_hora DESC);





-- =========================================================
-- EXTENSIÓN DEL MÓDULO: INVENTARIO CENTRAL Y FOTOGRAFÍAS
-- Solo registra bienes aceptados. No crea tablas de Campañas ni Solicitudes.
-- =========================================================
CREATE TABLE IF NOT EXISTS inventario (
    id_inventario       SERIAL PRIMARY KEY,
    id_donacion         INT NOT NULL REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    id_recepcion        INT NOT NULL UNIQUE REFERENCES donacion_recepciones(id_recepcion) ON DELETE RESTRICT,
    tipo_item           VARCHAR(10) NOT NULL CHECK (tipo_item IN ('ALIMENTO','MATERIAL')),
    nombre_item         VARCHAR(120),
    cantidad_ingresada  NUMERIC(14,2) NOT NULL CHECK (cantidad_ingresada > 0),
    cantidad_disponible NUMERIC(14,2) NOT NULL CHECK (cantidad_disponible >= 0),
    unidad_medida_id    INT REFERENCES unidad_medida(id_unidad) ON DELETE RESTRICT,
    fecha_ingreso       TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    ubicacion           VARCHAR(120) NOT NULL DEFAULT 'Almacén general de la asociación',
    estado              VARCHAR(15) NOT NULL DEFAULT 'DISPONIBLE'
                        CHECK (estado IN ('DISPONIBLE','AGOTADO','BLOQUEADO')),
    CONSTRAINT chk_inventario_saldo CHECK (cantidad_disponible <= cantidad_ingresada),
    CONSTRAINT uq_inventario_origen UNIQUE (id_inventario, id_donacion)
);

-- Registro de salida futura del inventario. La FK al módulo propietario se
-- incorpora cuando Campañas/Solicitudes entreguen sus esquemas reales.
-- Exactamente uno de los destinos debe informarse.
CREATE TABLE IF NOT EXISTS inventario_destino (
    id_destino          SERIAL PRIMARY KEY,
    id_inventario       INT NOT NULL,
    id_donacion         INT NOT NULL,
    campana_id          INT,
    solicitud_ayuda_id  INT,
    cantidad            NUMERIC(14,2) NOT NULL CHECK (cantidad > 0),
    fecha_salida        TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    registrado_por_usuario_id INT NOT NULL REFERENCES administrador(id_usuario) ON DELETE RESTRICT,
    observaciones       TEXT,
    estado              VARCHAR(12) NOT NULL DEFAULT 'REGISTRADA'
                        CHECK (estado IN ('REGISTRADA','ANULADA')),
    CONSTRAINT fk_inventario_destino_origen FOREIGN KEY (id_inventario,id_donacion)
      REFERENCES inventario(id_inventario,id_donacion) ON DELETE RESTRICT,
    CONSTRAINT chk_inventario_destino_unico CHECK (
      (campana_id IS NOT NULL AND solicitud_ayuda_id IS NULL) OR
      (campana_id IS NULL AND solicitud_ayuda_id IS NOT NULL)
    )
);

-- Las salidas futuras se descuentan del inventario dentro de la misma
-- transacción. No se consulta ni modifica ninguna tabla de Campañas/Ayudas.
CREATE OR REPLACE FUNCTION fn_controlar_salida_inventario() RETURNS trigger AS $$
DECLARE
  v_donacion INT;
  v_disponible NUMERIC(14,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'No se eliminan salidas de inventario; use el estado ANULADA para conservar la trazabilidad.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id_inventario <> OLD.id_inventario OR NEW.id_donacion <> OLD.id_donacion
       OR NEW.cantidad <> OLD.cantidad OR NEW.campana_id IS DISTINCT FROM OLD.campana_id
       OR NEW.solicitud_ayuda_id IS DISTINCT FROM OLD.solicitud_ayuda_id THEN
      RAISE EXCEPTION 'No se puede cambiar el origen, cantidad o destino de una salida; anule y registre una nueva.';
    END IF;
    IF OLD.estado = NEW.estado THEN RETURN NEW; END IF;
    IF OLD.estado = 'REGISTRADA' AND NEW.estado = 'ANULADA' THEN
      UPDATE inventario
         SET cantidad_disponible = cantidad_disponible + OLD.cantidad,
             estado = 'DISPONIBLE'
       WHERE id_inventario = OLD.id_inventario;
      RETURN NEW;
    ELSIF OLD.estado = 'ANULADA' AND NEW.estado = 'REGISTRADA' THEN
      SELECT id_donacion, cantidad_disponible INTO v_donacion, v_disponible
        FROM inventario WHERE id_inventario = NEW.id_inventario FOR UPDATE;
      IF v_donacion IS DISTINCT FROM NEW.id_donacion OR v_disponible < NEW.cantidad THEN
        RAISE EXCEPTION 'No existe saldo suficiente para reactivar esta salida.';
      END IF;
      UPDATE inventario SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
        estado = CASE WHEN cantidad_disponible - NEW.cantidad = 0 THEN 'AGOTADO' ELSE 'DISPONIBLE' END
        WHERE id_inventario = NEW.id_inventario;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Transición de estado de salida no permitida.';
  END IF;

  SELECT id_donacion, cantidad_disponible INTO v_donacion, v_disponible
    FROM inventario WHERE id_inventario = NEW.id_inventario FOR UPDATE;
  IF v_donacion IS NULL OR v_donacion <> NEW.id_donacion THEN
    RAISE EXCEPTION 'La partida de inventario no corresponde a la donación indicada.';
  END IF;
  IF v_disponible < NEW.cantidad THEN
    RAISE EXCEPTION 'La cantidad solicitada supera el inventario disponible.';
  END IF;
  UPDATE inventario SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
    estado = CASE WHEN cantidad_disponible - NEW.cantidad = 0 THEN 'AGOTADO' ELSE 'DISPONIBLE' END
    WHERE id_inventario = NEW.id_inventario;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_controlar_salida_inventario ON inventario_destino;
CREATE TRIGGER trg_controlar_salida_inventario
BEFORE INSERT OR UPDATE OR DELETE ON inventario_destino
FOR EACH ROW EXECUTE FUNCTION fn_controlar_salida_inventario();

CREATE TABLE IF NOT EXISTS donacion_fotos (
    id_foto             SERIAL PRIMARY KEY,
    id_donacion         INT NOT NULL REFERENCES donacion(id_donacion) ON DELETE RESTRICT,
    nombre_original     VARCHAR(255) NOT NULL,
    clave_almacenamiento VARCHAR(500) NOT NULL UNIQUE,
    mime_type           VARCHAR(80) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
    tamanio_bytes       INT NOT NULL CHECK (tamanio_bytes > 0 AND tamanio_bytes <= 5242880),
    subido_por_usuario_id INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    fecha_subida        TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
);

CREATE INDEX IF NOT EXISTS idx_inventario_donacion ON inventario(id_donacion);
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON inventario(estado, fecha_ingreso DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_destino_donacion ON inventario_destino(id_donacion);
CREATE INDEX IF NOT EXISTS idx_inventario_destino_campana ON inventario_destino(campana_id) WHERE campana_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventario_destino_solicitud ON inventario_destino(solicitud_ayuda_id) WHERE solicitud_ayuda_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donacion_fotos_donacion ON donacion_fotos(id_donacion);

-- Cada recepción física aceptada de bienes crea automáticamente una partida
-- en el inventario general. El dinero no genera existencias físicas.
CREATE OR REPLACE FUNCTION fn_ingresar_donacion_a_inventario() RETURNS trigger AS $$
DECLARE
  v_tipo VARCHAR(10);
  v_nombre VARCHAR(120);
  v_unidad INT;
BEGIN
  IF NEW.tipo_recepcion <> 'BIEN' OR NEW.cantidad_aceptada <= 0 THEN
    RETURN NEW;
  END IF;
  SELECT d.tipo_donacion,
         COALESCE(da.nombre_producto, dm.nombre_material),
         COALESCE(da.unidad_medida_id, dm.unidad_medida_id)
    INTO v_tipo, v_nombre, v_unidad
    FROM donacion d
    LEFT JOIN detalle_alimento da ON da.id_donacion = d.id_donacion
    LEFT JOIN detalle_material dm ON dm.id_donacion = d.id_donacion
   WHERE d.id_donacion = NEW.donacion_id;
  IF v_tipo IN ('ALIMENTO','MATERIAL') THEN
    INSERT INTO inventario
      (id_donacion,id_recepcion,tipo_item,nombre_item,cantidad_ingresada,cantidad_disponible,unidad_medida_id)
    VALUES
      (NEW.donacion_id,NEW.id_recepcion,v_tipo,v_nombre,NEW.cantidad_aceptada,NEW.cantidad_aceptada,v_unidad);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recepcion_a_inventario ON donacion_recepciones;
CREATE TRIGGER trg_recepcion_a_inventario
AFTER INSERT ON donacion_recepciones
FOR EACH ROW EXECUTE FUNCTION fn_ingresar_donacion_a_inventario();

-- =========================================================
-- MÓDULO 3: GESTIÓN DE CAMPAÑAS Y ACTIVIDADES (Sprint 3)
-- =========================================================

-- 1. TABLA CAMPAÑA
CREATE TABLE IF NOT EXISTS campana (
    id_campana           SERIAL PRIMARY KEY,
    nombre               VARCHAR(150) NOT NULL,
    descripcion          TEXT,
    portada_url          VARCHAR(500),
    fecha_inicio         DATE NOT NULL,
    fecha_fin            DATE,
    objetivo_recaudacion NUMERIC(14,2) DEFAULT NULL,
    estado               VARCHAR(20) NOT NULL DEFAULT 'Planificada'
                         CHECK (estado IN ('Planificada', 'Activa', 'Pausada', 'Finalizada', 'Cancelada')),
    id_administrador     INT NOT NULL,
    fecha_creacion       TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    fecha_actualizacion  TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    CONSTRAINT fk_campana_administrador FOREIGN KEY (id_administrador)
        REFERENCES administrador(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT chk_campana_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT chk_campana_objetivo CHECK (objetivo_recaudacion IS NULL OR objetivo_recaudacion >= 0)
);

-- Vincular donación e inventario_destino con la tabla campana
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_donacion_campana'
    ) THEN
        ALTER TABLE donacion
            ADD CONSTRAINT fk_donacion_campana
            FOREIGN KEY (campana_id) REFERENCES campana(id_campana) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_inventario_destino_campana'
    ) THEN
        ALTER TABLE inventario_destino
            ADD CONSTRAINT fk_inventario_destino_campana
            FOREIGN KEY (campana_id) REFERENCES campana(id_campana) ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. TABLA ACTIVIDAD
-- Soporta los 3 tipos de iniciativas/destinos de donación y voluntariado:
-- a) Campañas
-- b) Solicitudes de ayuda
-- c) Donaciones directas al inventario / Actividades generales
CREATE TABLE IF NOT EXISTS actividad (
    id_actividad            SERIAL PRIMARY KEY,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT,
    fecha                   DATE NOT NULL,
    hora_inicio             TIME NOT NULL,
    hora_fin                TIME NOT NULL,
    lugar                   VARCHAR(255) NOT NULL,
    max_voluntarios         INT NOT NULL CHECK (max_voluntarios > 0),
    tipo_actividad          VARCHAR(30) NOT NULL DEFAULT 'CAMPANA'
                            CHECK (tipo_actividad IN ('CAMPANA', 'SOLICITUD_AYUDA', 'INVENTARIO', 'GENERAL')),
    solicitud_ayuda_id      INT DEFAULT NULL, -- Enlace para el módulo de Solicitudes de Ayuda
    id_donacion             INT DEFAULT NULL, -- Enlace opcional a donación directa (ej. recojo en domicilio)
    estado                  VARCHAR(20) NOT NULL DEFAULT 'Planificada'
                            CHECK (estado IN ('Planificada', 'En_Curso', 'Finalizada', 'Cancelada')),
    creado_por_usuario_id   INT NOT NULL,
    fecha_creacion          TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    fecha_actualizacion     TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    CONSTRAINT fk_actividad_creador FOREIGN KEY (creado_por_usuario_id)
        REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    CONSTRAINT fk_actividad_donacion FOREIGN KEY (id_donacion)
        REFERENCES donacion(id_donacion) ON DELETE SET NULL,
    CONSTRAINT chk_actividad_horas CHECK (hora_fin > hora_inicio)
);

-- 3. ACTIVIDAD_CAMPAÑA (Relación N:M entre Actividad y Campaña según MR)
CREATE TABLE IF NOT EXISTS actividad_campana (
    id_actividad     INT NOT NULL,
    id_campana       INT NOT NULL,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    PRIMARY KEY (id_actividad, id_campana),
    CONSTRAINT fk_actcamp_actividad FOREIGN KEY (id_actividad)
        REFERENCES actividad(id_actividad) ON DELETE CASCADE,
    CONSTRAINT fk_actcamp_campana FOREIGN KEY (id_campana)
        REFERENCES campana(id_campana) ON DELETE CASCADE
);

-- 4. PARTICIPA (Voluntarios inscritos en Actividades)
CREATE TABLE IF NOT EXISTS participa (
    id_participacion            SERIAL PRIMARY KEY,
    id_voluntario               INT NOT NULL,
    id_actividad                INT NOT NULL,
    fecha_inscripcion           TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'),
    asistio                     BOOLEAN NOT NULL DEFAULT FALSE,
    estado                      VARCHAR(20) NOT NULL DEFAULT 'Inscrito'
                                CHECK (estado IN ('Inscrito', 'Confirmado', 'Asistio', 'No_Asistio', 'Cancelado')),
    observaciones               TEXT,
    horas_acreditadas           NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (horas_acreditadas >= 0),
    fecha_asistencia            TIMESTAMP,
    marcado_por_usuario_id      INT,
    CONSTRAINT fk_participa_usuario FOREIGN KEY (id_voluntario)
        REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_participa_actividad FOREIGN KEY (id_actividad)
        REFERENCES actividad(id_actividad) ON DELETE CASCADE,
    CONSTRAINT fk_participa_marcador FOREIGN KEY (marcado_por_usuario_id)
        REFERENCES usuario(id_usuario) ON DELETE SET NULL,
    CONSTRAINT uq_participa_voluntario_actividad UNIQUE (id_voluntario, id_actividad)
);

-- 5. ÍNDICES MÓDULO 3
CREATE INDEX IF NOT EXISTS idx_campana_estado ON campana(estado);
CREATE INDEX IF NOT EXISTS idx_campana_fechas ON campana(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_actividad_fecha ON actividad(fecha);
CREATE INDEX IF NOT EXISTS idx_actividad_estado ON actividad(estado);
CREATE INDEX IF NOT EXISTS idx_actividad_tipo ON actividad(tipo_actividad);
CREATE INDEX IF NOT EXISTS idx_actcamp_campana ON actividad_campana(id_campana);
CREATE INDEX IF NOT EXISTS idx_participa_voluntario ON participa(id_voluntario);
CREATE INDEX IF NOT EXISTS idx_participa_actividad ON participa(id_actividad);
CREATE INDEX IF NOT EXISTS idx_participa_estado ON participa(estado);

-- 6. TRIGGERS Y FUNCIONES DE NEGOCIO

-- A) Control de cupo máximo de voluntarios por actividad
CREATE OR REPLACE FUNCTION fn_verificar_cupo_actividad() RETURNS trigger AS $$
DECLARE
    v_max INT;
    v_actual INT;
BEGIN
    IF NEW.estado = 'Cancelado' THEN
        RETURN NEW;
    END IF;

    SELECT max_voluntarios INTO v_max
      FROM actividad
     WHERE id_actividad = NEW.id_actividad;

    SELECT COUNT(*) INTO v_actual
      FROM participa
     WHERE id_actividad = NEW.id_actividad
       AND estado <> 'Cancelado'
       AND (TG_OP = 'INSERT' OR id_participacion <> NEW.id_participacion);

    IF v_actual >= v_max THEN
        RAISE EXCEPTION 'No hay cupos disponibles para esta actividad (cupo máximo: %)', v_max;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verificar_cupo_actividad ON participa;
CREATE TRIGGER trg_verificar_cupo_actividad
BEFORE INSERT OR UPDATE OF id_actividad, estado ON participa
FOR EACH ROW EXECUTE FUNCTION fn_verificar_cupo_actividad();

-- B) Conversión y aprobación automática de voluntario al completar actividad (regla de negocio del sistema)
-- "un usuario normal se convierte en voluntario solo cuando se haya inscrito a una actividad,
-- al haber completado la actividad se le marca asistencia y ahi ese usuario ya podra ser un voluntario"
CREATE OR REPLACE FUNCTION fn_promover_voluntario_por_asistencia() RETURNS trigger AS $$
DECLARE
    v_existe_voluntario BOOLEAN;
BEGIN
    IF (NEW.asistio = TRUE OR NEW.estado = 'Asistio') THEN
        SELECT EXISTS(SELECT 1 FROM voluntario WHERE id_usuario = NEW.id_voluntario) INTO v_existe_voluntario;

        IF NOT v_existe_voluntario THEN
            INSERT INTO voluntario (id_usuario, habilidades, disponibilidad, estado, revisado_por, fecha_revision)
            VALUES (
                NEW.id_voluntario,
                ARRAY['Participación en actividades'],
                'Fines de semana y convocatorias',
                'Aprobado',
                NEW.marcado_por_usuario_id,
                (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
            );
        ELSE
            UPDATE voluntario
               SET estado = 'Aprobado',
                   revisado_por = COALESCE(revisado_por, NEW.marcado_por_usuario_id),
                   fecha_revision = COALESCE(fecha_revision, (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz'))
             WHERE id_usuario = NEW.id_voluntario
               AND estado = 'Pendiente';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promover_voluntario_por_asistencia ON participa;
CREATE TRIGGER trg_promover_voluntario_por_asistencia
AFTER INSERT OR UPDATE OF asistio, estado ON participa
FOR EACH ROW EXECUTE FUNCTION fn_promover_voluntario_por_asistencia();


