// src/types/campana.types.ts
// ============================================================================
// Tipos para el módulo Gestión de Campañas y Actividades
// ============================================================================

export type EstadoCampana = 'Planificada' | 'Activa' | 'Pausada' | 'Finalizada' | 'Cancelada';
export type TipoActividad = 'CAMPANA' | 'SOLICITUD_AYUDA' | 'INVENTARIO' | 'GENERAL';
export type EstadoActividad = 'Planificada' | 'En_Curso' | 'Finalizada' | 'Cancelada';
export type EstadoParticipacion = 'Inscrito' | 'Confirmado' | 'Asistio' | 'No_Asistio' | 'Cancelado';

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
  total_recaudado?: number;
  total_donaciones?: number;
  total_actividades?: number;
  total_voluntarios?: number;
}

export interface CampanaFormDTO {
  nombre: string;
  descripcion?: string;
  portada_url?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  objetivo_recaudacion?: number | '';
  estado?: EstadoCampana;
}

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
  campanas_asociadas?: { id_campana: number; nombre: string }[];
  voluntarios_inscritos?: number;
  cupos_disponibles?: number;
  mi_participacion?: ParticipacionItem | null;
}

export interface ActividadFormDTO {
  nombre: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  max_voluntarios: number;
  tipo_actividad?: TipoActividad;
  id_campana?: number | '';
  estado?: EstadoActividad;
}

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
