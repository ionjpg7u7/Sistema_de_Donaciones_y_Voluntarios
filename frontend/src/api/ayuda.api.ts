/**
 * ============================================================================
 * ARCHIVO: ayuda.api.ts
 * Llamadas HTTP del módulo Gestión de Beneficiarios y Ayudas.
 * Usa el cliente central (api/client.ts: baseURL + Bearer token).
 * ============================================================================
 */
import axios from 'axios';
import api from './client';
import type {
  BeneficiarioAyuda,
  AsignarDonacionPayload,
  CierreSolicitudPayload,
  CrearSolicitudPayload,
  FiltrosSolicitud,
  OportunidadAsignacion,
  RevisionSolicitudPayload,
  SolicitudAyuda,
  SolicitudAyudaDetalle,
} from '../types/ayuda.types';

/** Error normalizado del backend: mensaje principal + lista de errores. */
export interface ErrorApiAyuda {
  mensaje: string;
  errores: string[];
  status?: number;
}

export const leerErrorAyuda = (err: unknown): ErrorApiAyuda => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; errores?: string[] } | undefined;
    return {
      mensaje: data?.error || (err.response ? 'No se pudo completar la operación.' : 'No hay conexión con el servidor.'),
      errores: Array.isArray(data?.errores) ? data.errores : [],
      status: err.response?.status,
    };
  }
  return { mensaje: 'Ocurrió un error inesperado.', errores: [] };
};

const limpiarFiltros = (filtros: Partial<FiltrosSolicitud>): Record<string, string> => {
  const salida: Record<string, string> = {};
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (typeof valor === 'string' && valor.trim() !== '') salida[clave] = valor.trim();
  });
  return salida;
};

interface RespuestaSolicitud {
  mensaje: string;
  solicitud: SolicitudAyuda;
}

interface RespuestaAsignarDonacion {
  mensaje: string;
  asignacion: SolicitudAyuda;
}

export const ayudaApi = {
  listarBeneficiarios: async (q?: string): Promise<BeneficiarioAyuda[]> => {
    const res = await api.get<BeneficiarioAyuda[]>('/ayudas/beneficiarios', {
      params: q?.trim() ? { q: q.trim() } : undefined,
    });
    return res.data;
  },

  listarSolicitudes: async (filtros: Partial<FiltrosSolicitud> = {}): Promise<SolicitudAyuda[]> => {
    const res = await api.get<SolicitudAyuda[]>('/ayudas/solicitudes', {
      params: limpiarFiltros(filtros),
    });
    return res.data;
  },

  obtenerSolicitud: async (id: number): Promise<SolicitudAyudaDetalle> => {
    const res = await api.get<SolicitudAyudaDetalle>(`/ayudas/solicitudes/${id}`);
    return res.data;
  },

  crearSolicitud: async (payload: CrearSolicitudPayload): Promise<RespuestaSolicitud> => {
    const res = await api.post<RespuestaSolicitud>('/ayudas/solicitudes', payload);
    return res.data;
  },

  revisarSolicitud: async (
    id: number,
    payload: RevisionSolicitudPayload
  ): Promise<RespuestaSolicitud> => {
    const res = await api.patch<RespuestaSolicitud>(`/ayudas/solicitudes/${id}/revision`, payload);
    return res.data;
  },

  cerrarSolicitud: async (
    id: number,
    payload: CierreSolicitudPayload
  ): Promise<RespuestaSolicitud> => {
    const res = await api.patch<RespuestaSolicitud>(`/ayudas/solicitudes/${id}/cierre`, payload);
    return res.data;
  },

  iniciarEvaluacion: async (id: number): Promise<RespuestaSolicitud> => {
    const res = await api.patch<RespuestaSolicitud>(`/ayudas/solicitudes/${id}/evaluacion`);
    return res.data;
  },

  cancelarSolicitante: async (id: number, motivo_cancelacion: string): Promise<RespuestaSolicitud> => {
    const res = await api.patch<RespuestaSolicitud>(`/ayudas/solicitudes/${id}/cancelar-solicitante`, { motivo_cancelacion });
    return res.data;
  },
};

export default ayudaApi;

export const oportunidadesAsignacion = async (
  idSolicitud: number
): Promise<OportunidadAsignacion[]> => {
  const res = await api.get<OportunidadAsignacion[]>(
    `/ayudas/solicitudes/${idSolicitud}/asignaciones`
  );
  return res.data;
};

export const asignarDonacion = async (
  idSolicitud: number,
  payload: AsignarDonacionPayload
): Promise<RespuestaAsignarDonacion> => {
  const res = await api.patch<RespuestaAsignarDonacion>(
    `/ayudas/solicitudes/${idSolicitud}/asignaciones`,
    payload
  );
  return res.data;
};
