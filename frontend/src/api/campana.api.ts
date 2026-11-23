// src/api/campana.api.ts
// ============================================================================
// LLAMADAS HTTP: Módulo Gestión de Campañas y Actividades
// ============================================================================
import api from './client';
import type { Campana, CampanaFormDTO, Actividad, ActividadFormDTO, ParticipacionItem } from '../types/campana.types';

export const campanaApi = {
  // --- Rutas Públicas (Landing) ---
  listarPublicas: async (): Promise<Campana[]> => {
    const res = await api.get('/campanas/publicas');
    return res.data;
  },

  listarActividadesPublicas: async (): Promise<Actividad[]> => {
    const res = await api.get('/campanas/publicas/actividades');
    return res.data;
  },

  obtenerPublicaPorId: async (id: number): Promise<Campana> => {
    const res = await api.get(`/campanas/publicas/${id}`);
    return res.data;
  },

  // --- Campañas (Autenticado) ---
  listar: async (filtros: { estado?: string; q?: string } = {}): Promise<Campana[]> => {
    const res = await api.get('/campanas', { params: filtros });
    return res.data;
  },

  obtenerPorId: async (id: number): Promise<Campana> => {
    const res = await api.get(`/campanas/${id}`);
    return res.data;
  },

  crear: async (data: CampanaFormDTO): Promise<{ mensaje: string; campana: Campana }> => {
    const res = await api.post('/campanas', data);
    return res.data;
  },

  actualizar: async (id: number, data: Partial<CampanaFormDTO>): Promise<{ mensaje: string; campana: Campana }> => {
    const res = await api.put(`/campanas/${id}`, data);
    return res.data;
  },

  eliminar: async (id: number): Promise<{ mensaje: string }> => {
    const res = await api.delete(`/campanas/${id}`);
    return res.data;
  },

  // --- Actividades (Autenticado) ---
  listarActividades: async (filtros: { id_campana?: number; tipo?: string; estado?: string; q?: string } = {}): Promise<Actividad[]> => {
    const res = await api.get('/campanas/actividades', { params: filtros });
    return res.data;
  },

  obtenerActividadPorId: async (id: number): Promise<Actividad> => {
    const res = await api.get(`/campanas/actividades/${id}`);
    return res.data;
  },

  crearActividad: async (data: ActividadFormDTO): Promise<{ mensaje: string; actividad: Actividad }> => {
    const res = await api.post('/campanas/actividades', data);
    return res.data;
  },

  actualizarActividad: async (id: number, data: Partial<ActividadFormDTO>): Promise<{ mensaje: string; actividad: Actividad }> => {
    const res = await api.put(`/campanas/actividades/${id}`, data);
    return res.data;
  },

  eliminarActividad: async (id: number): Promise<{ mensaje: string }> => {
    const res = await api.delete(`/campanas/actividades/${id}`);
    return res.data;
  },

  // --- Voluntariado / Participaciones ---
  inscribirse: async (idActividad: number, observaciones?: string): Promise<{ mensaje: string; participacion: ParticipacionItem }> => {
    const res = await api.post(`/campanas/actividades/${idActividad}/inscribirse`, { observaciones });
    return res.data;
  },

  desinscribirse: async (idActividad: number): Promise<{ mensaje: string }> => {
    const res = await api.post(`/campanas/actividades/${idActividad}/desinscribirse`);
    return res.data;
  },

  listarMisActividades: async (): Promise<ParticipacionItem[]> => {
    const res = await api.get('/campanas/mis-actividades');
    return res.data;
  },

  listarVoluntariosActividad: async (idActividad: number): Promise<ParticipacionItem[]> => {
    const res = await api.get(`/campanas/actividades/${idActividad}/voluntarios`);
    return res.data;
  },

  registrarAsistencia: async (
    idParticipacion: number,
    data: { asistio: boolean; horas_acreditadas?: number; observaciones?: string }
  ): Promise<{ mensaje: string; participacion: ParticipacionItem }> => {
    const res = await api.post(`/campanas/actividades/participaciones/${idParticipacion}/asistencia`, data);
    return res.data;
  },
};
