// src/models/usuarioModel.ts
// ============================================================================
// CAPA: Modelo (solo tipos/contratos).
// NO contiene SQL, NO contiene lógica. Es el vocabulario compartido entre
// repositorio, servicio y controlador.
// ============================================================================

export type RolUsuario =
  | 'Administrador'
  | 'Coordinador'
  | 'Beneficiario'
  | 'Donante'
  | 'Voluntario'
  | 'Usuario';

/** Fila cruda tal como vuelve del SELECT con JOINs. */
export interface UsuarioRow {
  id_usuario: number;
  nombre: string;
  apellido: string | null;
  correo: string;
  telefono: string | null;
  contraseña?: string;
  foto_url?: string | null;
  estado: string;
  fecha_registro: Date | string;
  nivel_acceso?: string | null;
  tipo_beneficiario: string | null;
  documento: string | null;
  direccion_beneficiario: string | null;
  necesidad: string | null;
  descripcion: string | null;
  estado_beneficiario: string | null;
  revisado_por_beneficiario: number | null;
  motivo_rechazo_beneficiario: string | null;
  direccion_donante: string | null;
  ubi_latitud: string | number | null;
  ubi_longitud: string | number | null;
  habilidades: string[] | null;
  disponibilidad: string | null;
  es_coordinador: boolean | null;
  estado_voluntario: string | null;
  revisado_por_voluntario: number | null;
  motivo_rechazo_voluntario: string | null;
  fecha_registro_voluntario: Date | string | null;
  es_donante?: boolean;
  es_admin?: boolean;
  rol: RolUsuario;
}

/** Fila del SELECT de donantes con ubicación geográfica. */
export interface UbicacionRow {
  id_usuario: number;
  nombre: string;
  apellido: string | null;
  ubi_latitud: string | number;
  ubi_longitud: string | number;
}

/** Punto geográfico que consume el mapa del frontend. */
export interface UbicacionResponse {
  id: number;
  nombre: string;
  apellido?: string | null;
  lat: number | string;
  lng: number | string;
  direccion?: string | null;
}


/** Objeto de dominio que devuelve el repositorio/servicio. */
export interface UsuarioResponse {
  id_usuario: number;
  id: number;
  nombre: string;
  apellido: string;
  apellidos: string;
  paterno: string;
  materno: string;
  correo: string;
  telefono: string | null;
  contraseña?: string;
  foto_url?: string | null;
  estado: string;
  estado_cuenta: string;
  activo: boolean;
  fecha_registro?: Date | string;
  fecha_creacion?: Date | string;
  rol: RolUsuario;
  nivel_acceso?: string | null;
  tipo_beneficiario?: string | null;
  documento?: string | null;
  ci_nit?: string | null;
  direccion?: string | null;
  necesidad?: string | null;
  descripcion?: string | null;
  estado_beneficiario?: string | null;
  revisado_por_beneficiario?: number | null;
  motivo_rechazo_beneficiario?: string | null;
  ubi_latitud?: number | string | null;
  ubi_longitud?: number | string | null;
  habilidades?: string[];
  disponibilidad?: string | null;
  es_coordinador?: boolean;
  estado_voluntario?: string | null;
  revisado_por_voluntario?: number | null;
  motivo_rechazo_voluntario?: string | null;
  fecha_registro_voluntario?: Date | string | null;
  token_recuperacion?: string | null;
  fecha_expiracion_token?: Date | string | null;
  roles?: string[];
}

/** Datos de la tabla `usuario` (común). */
export interface UsuarioData {
  nombre: string;
  paterno: string;
  materno?: string | null;
  correo: string;
  telefono?: string | null;
  contraseña?: string;
  foto_url?: string | null;
  estado_cuenta?: string | boolean;
  rol?: string;
  estado?: string | boolean;
}

/** Datos del subtipo según el rol. */
export interface RolData {
  nivel_acceso?: string | null;
  tipo_beneficiario?: string | null;
  documento?: string | null;
  direccion?: string | null;
  necesidad?: string | null;
  descripcion?: string | null;
  estado_beneficiario?: string | null;
  ubi_latitud?: number | null;
  ubi_longitud?: number | null;
  habilidades?: string[] | null;
  disponibilidad?: string | null;
  es_coordinador?: boolean;
  estado_voluntario?: string | null;
  motivo_rechazo?: string | null;
}

/** Entrada pública para crear un usuario. */
export interface CrearUsuarioInput {
  nombre: string;
  paterno: string;
  materno?: string | null;
  correo: string;
  telefono: string;
  contraseña: string;
  foto_url?: string | null;
  rol?: string;
  estado_cuenta?: string | boolean;
  // Campos del subtipo
  nivel_acceso?: string | null;
  tipo_beneficiario?: string | null;
  documento?: string | null;
  direccion?: string | null;
  necesidad?: string | null;
  descripcion?: string | null;
  estado_beneficiario?: string | null;
  ubi_latitud?: number | string | null;
  ubi_longitud?: number | string | null;
  habilidades?: string[] | string | null;
  disponibilidad?: string | null;
  es_coordinador?: boolean;
}

/** Solicitud de voluntariado para coordinadores */
export interface SolicitudVoluntarioResponse {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  foto_url: string | null;
  habilidades: string[];
  disponibilidad: string;
  fecha_registro: Date | string;
  estado: string;
  es_coordinador: boolean;
  revisado_por: number | null;
  nombre_revisor?: string | null;
  motivo_rechazo: string | null;
}

/** Solicitud de beneficiario para administradores */
export interface SolicitudBeneficiarioResponse {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  foto_url: string | null;
  tipo_beneficiario: string;
  documento: string;
  direccion: string;
  necesidad: string;
  descripcion: string | null;
  fecha_registro: Date | string;
  estado: string;
  revisado_por: number | null;
  nombre_revisor?: string | null;
  motivo_rechazo: string | null;
}

/** Datos de entrada para el registro público de usuarios (auth). */
export interface RegistroInput {
  nombre: string;
  paterno: string;
  materno?: string | null;
  correo: string;
  telefono: string | number;
  contraseña: string;
  rol?: string | null;
  ci_nit?: string | null;
  calle?: string | null;
  zona?: string | null;
  ciudad?: string | null;
  direccion?: string | null;
  ubi_latitud?: number | string | null;
  ubi_longitud?: number | string | null;
  tipo_beneficiario?: string | null;
  documento?: string | null;
  necesidad?: string | null;
  descripcion?: string | null;
  habilidades?: string[] | string | null;
  disponibilidad?: string | null;
  [key: string]: unknown;
}

/** Respuesta del registro público. */
export interface RegistroResponse {
  mensaje: string;
  id_usuario: number;
  rol: RolUsuario;
  estado: string;
}
