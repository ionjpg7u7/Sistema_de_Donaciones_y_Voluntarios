import type {
  EstadoSolicitud,
  PrioridadAyuda,
  TipoAyuda,
} from '../types/ayuda.types';

export const ETIQUETA_TIPO_AYUDA: Record<TipoAyuda, string> = {
  ALIMENTO: 'Alimento',
  MATERIAL: 'Material',
  ECONOMICO: 'Económica',
  GENERAL: 'General',
};

export const ETIQUETA_PRIORIDAD: Record<PrioridadAyuda, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
};

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  EN_EVALUACION: 'En evaluación',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
};

export const DESCRIPCION_ESTADO: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Esperando revisión de un administrador.',
  EN_EVALUACION: 'Un administrador está revisando la solicitud.',
  APROBADA: 'Aprobada para recibir asignaciones de donaciones.',
  RECHAZADA: 'No fue aprobada; revisa el motivo registrado.',
  ATENDIDA: 'La ayuda fue entregada y la solicitud quedó cerrada.',
  CANCELADA: 'La solicitud fue cancelada.',
};

/** 1234.5 → "1.234,5" (formato es-BO) */
export const formatoNumero = (n: number | null | undefined): string =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Texto local de Bolivia: "2026-11-22T14:05:00" → "22/11/2026 14:05". */
export const formatoFechaHora = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const [fecha, hora = ''] = iso.split('T');
  const [a, m, d] = fecha.split('-');
  const hhmm = hora.slice(0, 5);
  return a && m && d ? `${d}/${m}/${a}${hhmm ? ` ${hhmm}` : ''}` : iso;
};

export const nombreCompleto = (nombre: string | null | undefined, apellido: string | null | undefined): string =>
  [nombre, apellido].filter(Boolean).join(' ').trim() || 'Sin nombre';

/** Convierte `foto_url` del backend en una URL cargable del frontend. */
export const urlPerfil = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};
