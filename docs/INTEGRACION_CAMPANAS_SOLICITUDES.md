# Puntos de integración para Campañas y Solicitudes de Ayuda

Este documento delimita el contrato entre Gestión de Donaciones y los módulos propietarios. Donaciones no crea ni administra campañas ni solicitudes: solo consume sus contratos de lectura.

## Flujo ya preparado

1. Una donación de alimentos/materiales se registra en `donacion`.
2. El personal registra su recepción en `donacion_recepciones`.
3. El trigger `trg_recepcion_a_inventario` inserta una partida en `inventario` por la cantidad aceptada. El dinero no crea existencias físicas.
4. La salida se registra en `inventario_destino` con:
   - `id_inventario`: partida exacta de existencias.
   - `id_donacion`: donación que originó esa partida; una FK compuesta valida que ambos identificadores correspondan.
   - `campana_id` **o** `solicitud_ayuda_id`: exactamente uno de los dos destinos.
   - `cantidad`, administrador que registra, fecha y observaciones.
5. El trigger `trg_controlar_salida_inventario` bloquea la partida, comprueba el saldo, descuenta la cantidad y permite anular una salida restaurando el saldo. No permite borrar salidas ni cambiar su origen/destino/cantidad.

## Contrato implementado

- **Campañas:** `backend/src/services/donacionIntegraciones.ts`, métodos `listarActivas` y `estaActiva`. Las tablas `campana` y `actividad` viven en `database/01_schema.sql`.
- **Solicitudes de Ayuda:** el mismo archivo, método `solicitudesIntegracion.estaAprobada`. Consulta `solicitud_ayuda` (creada en `database/03_solicitudes_ayuda.sql`) y devuelve `true` únicamente cuando el estado es `APROBADA`. Una solicitud `ATENDIDA` ya no admite nuevas asignaciones.
- **Claves foráneas reales:** `fk_inventario_destino_campana`, `fk_asignacion_solicitud_ayuda`, `fk_inventario_destino_solicitud` y `fk_actividad_solicitud_ayuda` ya existen. La API del módulo de ayudas está en `/api/ayudas` y se documenta en `docs/AYUDAS.md`.
- **Pantalla de salida:** la creación de campañas está en `/campanas`; las solicitudes de ayuda se gestionan en `/ayudas`. La selección de una solicitud al asignar una donación todavía puede hacerse por API (`solicitud_ayuda_id`), no desde la interfaz de asignación.

## Restricciones

- No insertar ni actualizar directamente tablas de Campañas o Solicitudes desde el módulo de Donaciones.
- No asignar ambos destinos a una misma salida.
- No registrar cantidades superiores al saldo disponible.
- Las salidas anuladas se conservan para trazabilidad.
