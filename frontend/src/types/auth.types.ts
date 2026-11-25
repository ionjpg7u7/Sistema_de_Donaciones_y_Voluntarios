/**
 * ============================================================================
 * ARCHIVO: auth.types.ts
 * PROPÓSITO: Tipos TypeScript para el flujo de autenticación.
 * ============================================================================
 */

export interface LoginRequest {
  correo: string;
  contraseña: string;
}

export interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: {
    id: number;
    id_usuario: number;
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string | null;
    estado: string;
    rol: string;
    roles: string[];
    es_coordinador?: boolean;
    es_donante?: boolean;
    estado_voluntario?: string | null;
    estado_beneficiario?: string | null;
    tipo_beneficiario?: 'Persona' | 'Familia' | 'Institucion' | null;
  };
}

export interface RegistroRequest {
  nombre: string;
  paterno: string;
  materno?: string;
  correo: string;
  telefono: string;
  contraseña: string;
  ci_nit?: string;
  calle?: string;
  zona?: string;
  ciudad?: string;
  direccion?: string;
  edad?: number | null;
}

export interface TokenPayload {
  id: number;
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface RecuperacionRequest {
  correo: string;
}

export interface ResetPasswordRequest {
  token: string;
  nuevaContraseña: string;
}

export interface ValidarTokenResponse {
  valido: boolean;
  correo: string;
}
