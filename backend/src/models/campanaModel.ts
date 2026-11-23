// src/models/campanaModel.ts
// ============================================================================
// CAPA: Modelo. Tipos e interfaces del módulo Gestión de Campañas y Actividades
// ============================================================================

export const ESTADOS_CAMPANA = ['Planificada', 'Activa', 'Pausada', 'Finalizada', 'Cancelada'] as const;
export type EstadoCampana = (typeof ESTADOS_CAMPANA)[number];

export const TIPOS_ACTIVIDAD = ['CAMPANA', 'SOLICITUD_AYUDA', 'INVENTARIO', 'GENERAL'] as const;
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number];

export const ESTADOS_ACTIVIDAD = ['Planificada', 'En_Curso', 'Finalizada', 'Cancelada'] as const;
export type EstadoActividad = (typeof ESTADOS_ACTIVIDAD)[number];

export const ESTADOS_PARTICIPACION = ['Inscrito', 'Confirmado', 'Asistio', 'No_Asistio', 'Cancelado'] as const;
export type EstadoParticipacion = (typeof ESTADOS_PARTICIPACION)[number];

export interface Campana {
  id_campana: number;
  nombre: string;
  descripcion: string | null;
  portada_url: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  objetivo_recaudacion: number | null;
  estado: EstadoCampana;
  id_administrador: number;
  administrador_nombre?: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  // Métricas agregadas
  total_recaudado?: number;
  total_donaciones?: number;
  total_actividades?: number;
  total_voluntarios?: number;
}

export interface CampanaCrearDTO {
  nombre: string;
  descripcion?: string | null;
  portada_url?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  objetivo_recaudacion?: number | null;
  estado?: EstadoCampana;
}

export interface CampanaActualizarDTO extends Partial<CampanaCrearDTO> {}

export interface Actividad {
  id_actividad: number;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  max_voluntarios: number;
  tipo_actividad: TipoActividad;
  solicitud_ayuda_id: number | null;
  id_donacion: number | null;
  estado: EstadoActividad;
  creado_por_usuario_id: number;
  creador_nombre?: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
  // Campos derivados / relaciones
  campanas_asociadas?: { id_campana: number; nombre: string }[];
  voluntarios_inscritos?: number;
  cupos_disponibles?: number;
  mi_participacion?: ParticipacionItem | null;
}

export interface ActividadCrearDTO {
  nombre: string;
  descripcion?: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  max_voluntarios: number;
  tipo_actividad?: TipoActividad;
  solicitud_ayuda_id?: number | null;
  id_donacion?: number | null;
  id_campana?: number | null; // Atajo para vincular a campaña de una vez
  estado?: EstadoActividad;
}

export interface ActividadActualizarDTO extends Partial<ActividadCrearDTO> {}

export interface ParticipacionItem {
  id_participacion: number;
  id_voluntario: number;
  voluntario_nombre: string;
  voluntario_correo: string;
  voluntario_telefono: string | null;
  id_actividad: number;
  actividad_nombre?: string;
  actividad_fecha?: string;
  actividad_lugar?: string;
  fecha_inscripcion: string;
  asistio: boolean;
  estado: EstadoParticipacion;
  observaciones: string | null;
  horas_acreditadas: number;
  fecha_asistencia: string | null;
  marcado_por_usuario_id: number | null;
}

export interface RegistroAsistenciaDTO {
  asistio: boolean;
  estado?: EstadoParticipacion;
  horas_acreditadas?: number;
  observaciones?: string;
}
