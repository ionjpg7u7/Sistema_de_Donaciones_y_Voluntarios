// src/models/ayudaModel.ts
// ============================================================================
// CAPA: Modelo del módulo Gestión de Beneficiarios y Ayudas.
// Solo tipos, constantes y contratos compartidos. Sin SQL ni lógica.
// ============================================================================

export const TIPOS_AYUDA = ['ALIMENTO', 'MATERIAL', 'ECONOMICO', 'GENERAL'] as const;
export const PRIORIDADES_AYUDA = ['BAJA', 'MEDIA', 'ALTA'] as const;
export const ESTADOS_SOLICITUD = [
  'PENDIENTE',
  'EN_EVALUACION',
  'APROBADA',
  'RECHAZADA',
  'ATENDIDA',
  'CANCELADA',
] as const;

export type TipoAyuda = (typeof TIPOS_AYUDA)[number];
export type PrioridadAyuda = (typeof PRIORIDADES_AYUDA)[number];
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];
export type RolAyuda = 'Administrador' | 'Beneficiario';

/** Actor autenticado, derivado exclusivamente del JWT. */
export interface ActorAyuda {
  id_usuario: number;
  rol: RolAyuda;
  roles: string[];
  nombre: string;
}

/** Beneficiario verificado que puede recibir una solicitud. */
export interface BeneficiarioAyuda {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  tipo_beneficiario: string;
  documento: string;
  direccion: string;
  necesidad: string;
  descripcion: string | null;
  foto_url: string | null;
}

/** Fila del listado de solicitudes. */
export interface SolicitudAyudaItem {
  id_solicitud_ayuda: number;
  beneficiario_usuario_id: number;
  beneficiario_nombre: string;
  beneficiario_correo: string;
  foto_url: string | null;
  tipo_ayuda: TipoAyuda;
  necesidad: string;
  descripcion: string | null;
  cantidad_solicitada: number | null;
  prioridad: PrioridadAyuda;
  estado: EstadoSolicitud;
  creado_por_usuario_id: number;
  creado_por_nombre: string;
  evaluado_por_usuario_id: number | null;
  evaluado_por_nombre: string | null;
  fecha_creacion: string;
  fecha_evaluacion: string | null;
  fecha_cierre: string | null;
  motivo_rechazo: string | null;
  motivo_cancelacion: string | null;
  asignaciones_activas: number;
  cantidad_asignada: number;
}

/** Asignación de una donación vinculada a la solicitud (solo lectura). */
export interface AsignacionAyudaItem {
  id_asignacion: number;
  donacion_id: number;
  donacion_codigo: string;
  tipo_donacion: string;
  cantidad: number;
  fecha_asignacion: string;
  estado: 'ACTIVA' | 'CANCELADA';
  observaciones: string | null;
}

export interface SolicitudAyudaDetalle extends SolicitudAyudaItem {
  asignaciones: AsignacionAyudaItem[];
}

export interface FiltrosSolicitud {
  estado?: string;
  tipo_ayuda?: string;
  q?: string;
}

/** Entrada validada para crear una solicitud. */
export interface CrearSolicitudAyudaInput {
  beneficiario_usuario_id: number | null;
  tipo_ayuda: TipoAyuda;
  necesidad: string;
  descripcion: string | null;
  cantidad_solicitada: number | null;
  prioridad: PrioridadAyuda;
}

export interface RevisionSolicitudInput {
  estado: 'APROBADA' | 'RECHAZADA';
  motivo_rechazo: string | null;
}

export interface CierreSolicitudInput {
  estado: 'ATENDIDA' | 'CANCELADA';
  motivo_cancelacion: string | null;
}

/** Resumen de donaciones que pueden asignarse a una solicitud evaluada. */
export interface OportunidadAsignacion {
  id_donacion: number;
  codigo: string;
  tipo_donacion: string;
  cantidad: number;
  saldo_disponible: number;
  fecha_donacion: string;
  donante_nombre: string;
  estado_donacion: string;
}

export interface AsignarDonacionSolicitudInput {
  donacion_id: number;
  cantidad: number;
  observaciones: string | null;
}
