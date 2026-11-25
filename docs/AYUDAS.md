# Módulo: Gestión de Beneficiarios y Ayudas

Implementa las solicitudes de ayuda de beneficiarios verificados y su evaluación por administradores. Reutiliza el módulo de Usuarios: no crea un tipo de usuario nuevo ni duplica la verificación.

## Base de datos

- `database/03_solicitudes_ayuda.sql` crea `solicitud_ayuda`, sus índices y las claves foráneas de `asignacion_donacion`, `inventario_destino` y `actividad`.
- El script se ejecuta automáticamente solo al inicializar un volumen `pgdata` vacío. En una base existente, aplícalo manualmente:
  ```bash
  docker exec postgres-db-donaciones_y_voluntariado sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -f /docker-entrypoint-initdb.d/03_solicitudes_ayuda.sql'
  ```
- Incluye dos solicitudes históricas (`id_solicitud_ayuda` 1 y 2) porque los seeds de Donaciones y Actividades ya las referencian. No las borres.

## Reglas de negocio

- Solo un beneficiario con `beneficiario.estado = 'Verificado'` y `usuario.estado = 'Activo'` puede recibir o crear solicitudes.
- Un beneficiario autenticado solo ve y crea sus propias solicitudes.
- Un administrador puede crear solicitudes para cualquier beneficiario verificado, evaluarlas y cerrarlas.
- Estados: `PENDIENTE → EN_EVALUACION → APROBADA | RECHAZADA`; desde `APROBADA` se puede cerrar como `ATENDIDA` o `CANCELADA`.
- Rechazar o cancelar exige un motivo de al menos 5 caracteres.
- Donaciones considera asignable una solicitud únicamente si está `APROBADA`. `ATENDIDA` ya no admite nuevas asignaciones.
- Los roles se leen exclusivamente del JWT (`Administrador`, `Beneficiario`); nunca del body ni de la query.

## API (`/api/ayudas`, requiere JWT)

| Método | Ruta | Roles | Descripción |
| --- | --- | --- | --- |
| GET | `/beneficiarios?q=` | Administrador | Directorio de beneficiarios verificados y activos. |
| GET | `/solicitudes?estado=&tipo_ayuda=&q=` | Administrador, Beneficiario | Bandeja completa (admin) o historial propio (beneficiario). |
| GET | `/solicitudes/:id` | Administrador, Beneficiario (propia) | Detalle con asignaciones de donaciones. |
| GET | `/solicitudes/:id/asignaciones` | Administrador | Donaciones activas disponibles para asignar. |
| PATCH | `/solicitudes/:id/asignaciones` | Administrador | Asigna una donación activa (`donacion_id`, `cantidad`, `observaciones` opcional). |
| POST | `/solicitudes` | Administrador, Beneficiario | Crea una solicitud `PENDIENTE`. El admin debe enviar `beneficiario_usuario_id`. |
| PATCH | `/solicitudes/:id/revision` | Administrador | `{ "estado": "APROBADA" \| "RECHAZADA", "motivo_rechazo"?: "..." }`. |
| PATCH | `/solicitudes/:id/cierre` | Administrador | `{ "estado": "ATENDIDA" \| "CANCELADA", "motivo_cancelacion"?: "..." }`. |

Cuerpo de creación:

```json
{
  "beneficiario_usuario_id": 5,
  "tipo_ayuda": "ALIMENTO",
  "necesidad": "Canasta familiar",
  "descripcion": "Familia de cuatro personas",
  "cantidad_solicitada": 25,
  "prioridad": "ALTA"
}
```

Tipos: `ALIMENTO`, `MATERIAL`, `ECONOMICO`, `GENERAL`. Prioridades: `BAJA`, `MEDIA`, `ALTA`.

## Frontend

- Ruta privada `/ayudas` (`frontend/src/pages/AyudasPage.tsx`).
- Administrador: pestañas «Solicitudes de ayuda» y «Beneficiarios verificados».
- Beneficiario: solo sus solicitudes; puede abrir el formulario con `/ayudas?nueva=1`.
- El acceso directo desde el sidebar es «5. Gestión de Beneficiarios y Ayudas».
- El Dashboard del beneficiario enlaza «Solicitar Apoyo» a `/ayudas?nueva=1` y «Mis Solicitudes» a `/ayudas`.

## Verificación

```bash
cd backend && npx tsc --noEmit && npm run build
cd frontend && npx tsc --noEmit && npm run build
```

Prueba manual mínima: iniciar sesión como administrador (`carla.admin@donacionesbo.org` / `Passw123`), crear una solicitud para un beneficiario verificado, aprobarla y marcarla como atendida. Luego iniciar sesión como beneficiario verificado (`rosa.chambi@gmail.com` / `Passw123`) y comprobar que solo ve sus propias solicitudes.
