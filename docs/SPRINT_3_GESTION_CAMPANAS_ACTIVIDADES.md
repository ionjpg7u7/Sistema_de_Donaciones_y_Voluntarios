# Sprint 3 — Gestión de Campañas y Actividades

> Documentación técnica de todo lo implementado en el Sprint 3 (integrado sobre Sprints 1 y 2).  
> **Rama activa:** `sprint3-integracion-donaciones`

---

## 1. Resumen ejecutivo

El Sprint 3 agrega la **gestión completa de campañas y actividades**, integra el sistema de donaciones con las campañas, implementa el sistema de multi-rol en el dashboard y aplica eliminación lógica (soft delete) en campañas y actividades.

---

## 2. Base de datos — Tablas Sprint 3

| Tabla | Propósito |
|---|---|
| `CAMPANA` | Campañas solidarias organizadas por un administrador |
| `ACTIVIDAD` | Actividades genéricas de cualquier tipo de donación |
| `ACTIVIDAD_CAMPANA` | Relación N:N entre actividades y campañas |
| `ACTIVIDAD_SOLICITUD` | Relación N:N entre actividades y solicitudes de ayuda |
| `ACTIVIDAD_DONACION_INVENTARIO` | Relación N:N entre actividades y donaciones al inventario |
| `PARTICIPA` | Registro de participación de voluntarios en actividades (con asistencia) |

### Claves de diseño

- `CAMPANA.estado` puede ser: `'Activa'`, `'Finalizada'`, `'Cancelada'` (soft delete).
- `ACTIVIDAD.estado` puede ser: `'Pendiente'`, `'En_Progreso'`, `'Completada'`, `'Cancelada'` (soft delete).
- `PARTICIPA` registra `asistio BOOLEAN` para marcar asistencia post-actividad.
- Las relaciones de actividad con campaña/solicitud/inventario permiten que una misma actividad exista sin vínculo obligatorio.
- La columna `campana_id` en la tabla `DONACION` (Sprint 2) ya existía y es el vínculo entre una donación y la campaña a la que apoya.

---

## 3. Backend — Módulo Campañas

**Ruta base:** `/api/campanas`

### Estructura de archivos

```
backend/src/modules/campanas/
  campana.model.ts         ← interfaces TypeScript
  campana.repository.ts    ← SQL puro (pool de pg)
  campana.service.ts       ← lógica de negocio
  campana.controller.ts    ← controlador Express
  campana.routes.ts        ← rutas + middlewares de auth
```

### Endpoints — Campañas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/campanas` | Público | Lista campañas activas (paginación + filtros) |
| `GET` | `/api/campanas/admin` | Admin | Lista todas las campañas incluyendo canceladas |
| `GET` | `/api/campanas/:id` | Público | Detalle de una campaña |
| `POST` | `/api/campanas` | Admin | Crear campaña |
| `PUT` | `/api/campanas/:id` | Admin | Editar campaña |
| `DELETE` | `/api/campanas/:id` | Admin | **Soft delete** → estado = 'Cancelada' |

### Endpoints — Actividades

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/campanas/:id/actividades` | Auth | Lista actividades de una campaña |
| `POST` | `/api/campanas/:id/actividades` | Admin | Crear actividad en una campaña |
| `PUT` | `/api/campanas/actividades/:idAct` | Admin/Coord | Editar actividad |
| `DELETE` | `/api/campanas/actividades/:idAct` | Admin | **Soft delete** → estado = 'Cancelada' |

### Endpoints — Participación de voluntarios

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/api/campanas/actividades/:id/voluntarios` | Admin/Coord | Lista voluntarios inscritos |
| `POST` | `/api/campanas/actividades/:id/inscribirse` | Voluntario | Inscribirse en actividad |
| `PUT` | `/api/campanas/actividades/:id/asistencia/:idVol` | Admin/Coord | Marcar/desmarcar asistencia |
| `DELETE` | `/api/campanas/actividades/:id/desinscribirse` | Voluntario | Retirarse de actividad |

### Soft delete implementado

```typescript
// En campana.repository.ts
eliminar(id)         → UPDATE campana SET estado = 'Cancelada'  WHERE id_campana = $1
eliminarActividad(id) → UPDATE actividad SET estado = 'Cancelada' WHERE id_actividad = $1

// En consultas de listado
listar()      → WHERE estado != 'Cancelada'   (panel público y donante)
listarAdmin() → sin filtro de estado           (admin ve todo)
```

---

## 4. Frontend — Módulo Campañas

### Rutas

| Ruta | Componente | Acceso |
|---|---|---|
| `/campanas` | `CampanasPage.tsx` | Autenticado |
| `/campanas/:id` | `CampanaDetallePage.tsx` | Autenticado |

### Panel Administrador

**CampanasPage (vista admin):**
- Tabla de campañas con filtros (estado, búsqueda por nombre).
- Crear / editar campaña (modal `CampanaFormModal`): nombre, portada (URL), descripción, fecha inicio/fin, estado.
- **Cancelar campaña** (soft delete) — botón "Cancelar" → `estado = 'Cancelada'`. Se muestra aviso al usuario.
- Ver detalle → `CampanaDetallePage`.

**CampanaDetallePage (admin):**
- Lista de actividades con estado, fecha, lugar, cupos.
- Crear / editar actividad (modal `ActividadFormModal`).
- **Cancelar actividad** (soft delete).
- Ver voluntarios inscritos por actividad → tabla con nombre, estado, asistencia.
- **Marcar/desmarcar asistencia** de cada voluntario.

### Panel Donante

- Lista de campañas activas con portada, descripción, fechas.
- Botón **"Donar a esta Campaña"** → navega a `/donaciones?campanaId=X`.
- Botón para ver actividades disponibles e inscribirse como voluntario.

### Panel Voluntario

- Lista de campañas con actividades abiertas y cupos restantes.
- Inscribirse / desinscribirse de actividades.
- Ver historial de actividades en las que participó con estado de asistencia.

---

## 5. Flujo "Donar desde Campaña"

```
/campanas → "Donar a esta Campaña" (id=X)
  → navigate('/donaciones?campanaId=X')
    → DonacionesPage: lee ?campanaId con useSearchParams
      → pasa campanaIdInicial={X} a DonacionesTab
        → DonacionesTab: abre DonacionFormModal automáticamente
          → DonacionFormModal: pre-selecciona campaña X
          → muestra banner verde + subtítulo contextual
          → usuario puede cambiar la campaña si desea
        → al guardar: donacion.campana_id = X en la BD
```

### Archivos modificados (Sprint 2 — rama `sprint3-integracion-donaciones`)

| Archivo | Cambio |
|---|---|
| `DonacionesPage.tsx` | Lee `?campanaId` con `useSearchParams`; limpia param tras consumirlo |
| `DonacionesTab.tsx` | Acepta `campanaIdInicial`; abre modal automáticamente cuando hay valor; columna **Destino** con badges `🎯 Campaña` vs `📦 Inventario` en tabla y tarjetas móviles |
| `DonacionFormModal.tsx` | Acepta `campanaIdInicial`; pre-llena `valores.campana_id`; muestra banner contextual y opciones claras entre Campaña e Inventario General |
| `DonacionDetalleModal.tsx` | Muestra el campo **Destino** especificando el nombre de la Campaña o "Inventario General" |
| `donacionRepository.ts` | Realiza `LEFT JOIN campana c` para proveer `campana_nombre` en listado y detalle |
| `donacionModel.ts` | Agrega `campana_nombre?: string | null` a los modelos de respuesta |
| `usuarioRepository.ts` / `authService.ts` | Emite `roles: string[]` en el JWT y respuestas para habilitar el multi-rol completo |

---

## 6. Dashboard multi-rol

Un usuario puede tener varios roles simultáneamente. El dashboard muestra secciones adicionales para cada rol secundario detectado.

### Lógica de detección (Dashboard.tsx)

```typescript
// Rol principal → del campo usuario.rol (JWT)
const rolNormalizado = usuario?.rol.toLowerCase();

// Roles secundarios:
const rolesJwt = Array.isArray(usuario?.roles) ? usuario.roles.map(r => r.toLowerCase()) : [];

const esVoluntarioSecundario = usuario?.estado_voluntario === 'Aprobado'
  && rolNormalizado !== 'voluntario' && rolNormalizado !== 'administrador';

const esBeneficiarioSecundario = usuario?.estado_beneficiario === 'Verificado'
  && rolNormalizado !== 'beneficiario' && rolNormalizado !== 'administrador';

const rolesSecundarios: PanelRol[] = [];
if (esVoluntarioSecundario || rolesJwt.includes('voluntario'))  → push(PANEL_VOLUNTARIO)
if (esBeneficiarioSecundario || rolesJwt.includes('beneficiario')) → push(PANEL_BENEFICIARIO)
if (rolesJwt.includes('donante') && rol ≠ donante) → push(PANEL_DONANTE)
```

### Renderizado

Cada panel secundario se renderiza debajo de los módulos del panel principal, separado por un borde horizontal, con:
- **Chip de etiqueta:** "También eres Voluntario" / "También eres Donante" / "También eres Beneficiario".
- KPI cards del rol secundario.
- Módulos del rol secundario (con navegación funcional o "En desarrollo").

---

## 7. Módulos activados en el Dashboard

Módulos marcados con `enDesarrollo: false` (ruta ya funcional en Sprint 3):

| Panel | Módulo | Ruta |
|---|---|---|
| Cliente (usuario base) | Campañas Solidarias | `/campanas` |
| Cliente (usuario base) | Mis Donaciones | `/donaciones` |
| Donante | Explorar Campañas | `/campanas` |
| Donante | Mis Donaciones | `/donaciones` |
| Beneficiario | Campañas Disponibles | `/campanas` |

---

## 8. Fix: Freeze en `/campanas` (admin)

**Causa:** `cargarTodo()` llamaba al endpoint de donaciones propias para todos los roles dentro de un único `Promise.all`. Cuando el admin accedía, ese endpoint fallaba (sin permisos) y cancelaba toda la carga, congelando la pantalla.

**Fix aplicado en `CampanasPage.tsx`:**
```typescript
// Las llamadas de campañas y actividades tienen .catch(() => []) individuales
const [campanas, actividades] = await Promise.all([
  api.listar().catch(() => []),
  api.listarActividades().catch(() => []),
]);

// La carga de donaciones propias se hace FUERA del Promise.all,
// solo para donantes, con su propio bloque try/catch:
if (esDonante) {
  const donaciones = await donacionApi.listar().catch(() => []);
  setMisDonaciones(Array.isArray(donaciones) ? donaciones : []);
}
```

---

## 9. Levantamiento del entorno

### 1. Base de datos (Docker)
```bash
# Levantar solo la BD
docker compose -f compose.db.yaml up -d

# Para recrear con datos frescos
docker compose -f compose.db.yaml down -v
docker compose -f compose.db.yaml up -d
```

### 2. Backend
```bash
cd backend
npm run dev
# API disponible en http://localhost:4000/api
```

### 3. Frontend
```bash
cd frontend
npm run dev
# UI disponible en http://localhost:5173
```

---

## 10. Credenciales de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `carla.admin@donacionesbo.org` | `123456` |
| Donante | `diego.ramirez@gmail.com` | `123456` |
| Voluntario Coordinador | `luis.choque@gmail.com` | `123456` |
| Voluntario Pendiente | `sebastian.vega@gmail.com` | `123456` |

---

## 11. Pendiente (otros sprints)

| Feature | Responsable |
|---|---|
| Panel de solicitudes de ayuda para admin | Sprint 4+ |
| Gestión de donaciones al inventario (admin) | Sprint 4+ |
| `/mi-impacto` para donantes | Sprint 4+ |
| `/convocatorias` para voluntarios | Sprint 4+ |
| Verificación de pagos QR | Sprint 4+ |
| Reportes y métricas | Sprint 4+ |

---

*Generado: Sprint 3 — Sistema de Donaciones y Voluntariado — 2026*
