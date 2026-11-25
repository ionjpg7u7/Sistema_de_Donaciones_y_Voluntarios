// src/validators/ayudaValidator.ts
// ============================================================================
// CAPA: Validación de entrada del módulo Ayudas.
// Devuelve DTOs normalizados o lanza AppError (400) con un mensaje claro.
// ============================================================================
import { AppError } from '../utils/AppError';
import {
  ESTADOS_SOLICITUD,
  PRIORIDADES_AYUDA,
  TIPOS_AYUDA,
} from '../models/ayudaModel';
import type {
  CierreSolicitudInput,
  CrearSolicitudAyudaInput,
  FiltrosSolicitud,
  PrioridadAyuda,
  AsignarDonacionSolicitudInput,
  RevisionSolicitudInput,
  TipoAyuda,
} from '../models/ayudaModel';

const MAX_CANTIDAD = 999_999_999_999.99;

const vacio = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === '';
const aTexto = (v: unknown): string => String(v ?? '').trim();
const aNumero = (v: unknown): number | null => {
  if (vacio(v)) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const maximoDosDecimales = (n: number): boolean => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

export const validarId = (valor: unknown, nombre = 'solicitud'): number => {
  const n = aNumero(valor);
  if (n === null || !Number.isInteger(n) || n <= 0) {
    throw new AppError(`El identificador de ${nombre} no es válido.`, 400);
  }
  return n;
};

export const validarFiltrosSolicitud = (query: Record<string, unknown>): FiltrosSolicitud => {
  const estado = aTexto(query.estado).toUpperCase();
  if (estado && !(ESTADOS_SOLICITUD as readonly string[]).includes(estado)) {
    throw new AppError('El estado indicado no es válido.', 400);
  }

  const tipo = aTexto(query.tipo_ayuda).toUpperCase();
  if (tipo && !(TIPOS_AYUDA as readonly string[]).includes(tipo)) {
    throw new AppError('El tipo de ayuda indicado no es válido.', 400);
  }

  return {
    estado: estado || undefined,
    tipo_ayuda: tipo || undefined,
    q: aTexto(query.q) || undefined,
  };
};

export const validarCrearSolicitud = (
  body: Record<string, unknown>
): CrearSolicitudAyudaInput => {
  const tipoRecibido = aTexto(body.tipo_ayuda).toUpperCase();
  if (!tipoRecibido) throw new AppError('El tipo de ayuda es obligatorio.', 400);
  if (!(TIPOS_AYUDA as readonly string[]).includes(tipoRecibido)) {
    throw new AppError('El tipo de ayuda debe ser ALIMENTO, MATERIAL, ECONOMICO o GENERAL.', 400);
  }

  const necesidad = aTexto(body.necesidad);
  if (necesidad.length < 3) throw new AppError('La necesidad debe tener al menos 3 caracteres.', 400);
  if (necesidad.length > 150) throw new AppError('La necesidad no puede superar los 150 caracteres.', 400);

  const descripcion = aTexto(body.descripcion) || null;
  if (descripcion && descripcion.length > 1000) {
    throw new AppError('La descripción no puede superar los 1000 caracteres.', 400);
  }

  let cantidad: number | null = null;
  if (!vacio(body.cantidad_solicitada)) {
    const n = aNumero(body.cantidad_solicitada);
    if (n === null || n <= 0) {
      throw new AppError('La cantidad solicitada debe ser mayor a cero.', 400);
    }
    if (n > MAX_CANTIDAD) throw new AppError('La cantidad solicitada supera el máximo permitido.', 400);
    if (!maximoDosDecimales(n)) {
      throw new AppError('La cantidad solicitada admite como máximo 2 decimales.', 400);
    }
    cantidad = Math.round(n * 100) / 100;
  }

  let beneficiario: number | null = null;
  if (!vacio(body.beneficiario_usuario_id)) {
    const n = aNumero(body.beneficiario_usuario_id);
    if (n === null || !Number.isInteger(n) || n <= 0) {
      throw new AppError('El beneficiario seleccionado no es válido.', 400);
    }
    beneficiario = n;
  }

  const prioridadRecibida = aTexto(body.prioridad).toUpperCase();
  if (prioridadRecibida && !(PRIORIDADES_AYUDA as readonly string[]).includes(prioridadRecibida)) {
    throw new AppError('La prioridad debe ser BAJA, MEDIA o ALTA.', 400);
  }

  return {
    beneficiario_usuario_id: beneficiario,
    tipo_ayuda: tipoRecibido as TipoAyuda,
    necesidad,
    descripcion,
    cantidad_solicitada: cantidad,
    prioridad: (prioridadRecibida || 'MEDIA') as PrioridadAyuda,
  };
};

export const validarRevisionSolicitud = (
  body: Record<string, unknown>
): RevisionSolicitudInput => {
  const estado = aTexto(body.estado).toUpperCase();
  if (!['APROBADA', 'RECHAZADA'].includes(estado)) {
    throw new AppError('La revisión debe aprobar o rechazar la solicitud.', 400);
  }

  const motivo = aTexto(body.motivo_rechazo) || null;
  if (estado === 'RECHAZADA') {
    if (!motivo || motivo.length < 5) {
      throw new AppError('Indica un motivo de rechazo de al menos 5 caracteres.', 400);
    }
    if (motivo.length > 1000) throw new AppError('El motivo no puede superar los 1000 caracteres.', 400);
  }

  return {
    estado: estado as 'APROBADA' | 'RECHAZADA',
    motivo_rechazo: estado === 'RECHAZADA' ? motivo : null,
  };
};

export const validarCierreSolicitud = (
  body: Record<string, unknown>
): CierreSolicitudInput => {
  const estado = aTexto(body.estado).toUpperCase();
  if (!['ATENDIDA', 'CANCELADA'].includes(estado)) {
    throw new AppError('El cierre debe marcar la solicitud como atendida o cancelada.', 400);
  }

  const motivo = aTexto(body.motivo_cancelacion) || null;
  if (estado === 'CANCELADA') {
    if (!motivo || motivo.length < 5) {
      throw new AppError('Indica un motivo de cancelación de al menos 5 caracteres.', 400);
    }
    if (motivo.length > 1000) throw new AppError('El motivo no puede superar los 1000 caracteres.', 400);
  }

  return {
    estado: estado as 'ATENDIDA' | 'CANCELADA',
    motivo_cancelacion: estado === 'CANCELADA' ? motivo : null,
  };
};

export const validarAsignarDonacion = (
  body: Record<string, unknown>
): AsignarDonacionSolicitudInput => {
  const id = aNumero(body.donacion_id);
  if (id === null || !Number.isInteger(id) || id <= 0) {
    throw new AppError('El donación indicada no es válida.', 400);
  }

  const cant = aNumero(body.cantidad);
  if (cant === null || !Number.isFinite(cant) || cant <= 0) {
    throw new AppError('La cantidad debe ser un número mayor a cero.', 400);
  }
  if (!maximoDosDecimales(cant)) {
    throw new AppError('La cantidad admite como máximo 2 decimales.', 400);
  }

  const observ = aTexto(body.observaciones) || null;
  if (observ && observ.length > 200) {
    throw new AppError('Las observaciones no pueden superar 200 caracteres.', 400);
  }

  return {
    donacion_id: Math.round(id * 100) / 100 === id ? Math.round(id) : id,
    cantidad: Math.round(cant * 100) / 100,
    observaciones: observ,
  };
};
