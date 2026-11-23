// src/services/campanaService.ts
// ============================================================================
// CAPA: Servicio. Lógica de negocio de Campañas y Actividades.
// ============================================================================
import { campanaRepository } from '../repositories/campanaRepository';
import type {
  Campana,
  CampanaCrearDTO,
  CampanaActualizarDTO,
  Actividad,
  ActividadCrearDTO,
  ActividadActualizarDTO,
  ParticipacionItem,
  RegistroAsistenciaDTO,
} from '../models/campanaModel';
import { AppError } from '../utils/AppError';

export const campanaService = {
  // Campañas
  async listarCampanas(filtros: { estado?: string; q?: string } = {}): Promise<Campana[]> {
    return campanaRepository.listar(filtros);
  },

  async obtenerCampanaPorId(id: number): Promise<Campana> {
    const c = await campanaRepository.obtenerPorId(id);
    if (!c) throw new AppError('Campaña no encontrada', 404);
    return c;
  },

  async crearCampana(data: CampanaCrearDTO, idAdmin: number): Promise<Campana> {
    if (!data.nombre || data.nombre.trim() === '') {
      throw new AppError('El nombre de la campaña es obligatorio', 400);
    }
    if (!data.fecha_inicio) {
      throw new AppError('La fecha de inicio es obligatoria', 400);
    }
    if (data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
      throw new AppError('La fecha de fin no puede ser anterior a la fecha de inicio', 400);
    }
    return campanaRepository.crear(data, idAdmin);
  },

  async actualizarCampana(id: number, data: CampanaActualizarDTO): Promise<Campana> {
    await this.obtenerCampanaPorId(id);
    if (data.fecha_inicio && data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
      throw new AppError('La fecha de fin no puede ser anterior a la fecha de inicio', 400);
    }
    const actualizada = await campanaRepository.actualizar(id, data);
    if (!actualizada) throw new AppError('Error al actualizar la campaña', 500);
    return actualizada;
  },

  async eliminarCampana(id: number): Promise<void> {
    const eliminada = await campanaRepository.eliminar(id);
    if (!eliminada) throw new AppError('Campaña no encontrada o no se pudo eliminar', 404);
  },

  // Actividades
  async listarActividades(
    filtros: { id_campana?: number; tipo?: string; estado?: string; usuario_id?: number; q?: string } = {}
  ): Promise<Actividad[]> {
    return campanaRepository.listarActividades(filtros);
  },

  async obtenerActividadPorId(id: number, usuarioId?: number): Promise<Actividad> {
    const act = await campanaRepository.obtenerActividadPorId(id, usuarioId);
    if (!act) throw new AppError('Actividad no encontrada', 404);
    return act;
  },

  async crearActividad(data: ActividadCrearDTO, creadorId: number): Promise<Actividad> {
    if (!data.nombre || data.nombre.trim() === '') {
      throw new AppError('El nombre de la actividad es obligatorio', 400);
    }
    if (!data.fecha) {
      throw new AppError('La fecha de la actividad es obligatoria', 400);
    }
    if (!data.hora_inicio || !data.hora_fin) {
      throw new AppError('La hora de inicio y de fin son obligatorias', 400);
    }
    if (data.hora_fin <= data.hora_inicio) {
      throw new AppError('La hora de fin debe ser posterior a la hora de inicio', 400);
    }
    if (!data.lugar || data.lugar.trim() === '') {
      throw new AppError('El lugar de la actividad es obligatorio', 400);
    }
    if (!data.max_voluntarios || data.max_voluntarios <= 0) {
      throw new AppError('El cupo máximo de voluntarios debe ser mayor a 0', 400);
    }
    return campanaRepository.crearActividad(data, creadorId);
  },

  async actualizarActividad(id: number, data: ActividadActualizarDTO): Promise<Actividad> {
    await this.obtenerActividadPorId(id);
    if (data.hora_inicio && data.hora_fin && data.hora_fin <= data.hora_inicio) {
      throw new AppError('La hora de fin debe ser posterior a la hora de inicio', 400);
    }
    const actualizada = await campanaRepository.actualizarActividad(id, data);
    if (!actualizada) throw new AppError('Error al actualizar la actividad', 500);
    return actualizada;
  },

  async eliminarActividad(id: number): Promise<void> {
    const eliminada = await campanaRepository.eliminarActividad(id);
    if (!eliminada) throw new AppError('Actividad no encontrada o no se pudo eliminar', 404);
  },

  // Participaciones
  async inscribirVoluntario(idActividad: number, idUsuario: number, observaciones?: string): Promise<ParticipacionItem> {
    const act = await this.obtenerActividadPorId(idActividad);
    if (act.estado === 'Finalizada' || act.estado === 'Cancelada') {
      throw new AppError(`No es posible inscribirse a una actividad ${act.estado.toLowerCase()}`, 400);
    }
    if (act.cupos_disponibles !== undefined && act.cupos_disponibles <= 0) {
      throw new AppError('No hay cupos disponibles en esta actividad', 400);
    }
    return campanaRepository.inscribirVoluntario(idActividad, idUsuario, observaciones);
  },

  async desinscribirVoluntario(idActividad: number, idUsuario: number): Promise<void> {
    const ok = await campanaRepository.desinscribirVoluntario(idActividad, idUsuario);
    if (!ok) throw new AppError('No se encontró una inscripción activa para cancelar o ya se registró asistencia', 400);
  },

  async listarVoluntariosActividad(idActividad: number): Promise<ParticipacionItem[]> {
    await this.obtenerActividadPorId(idActividad);
    return campanaRepository.listarVoluntariosPorActividad(idActividad);
  },

  async listarMisActividades(idUsuario: number): Promise<ParticipacionItem[]> {
    return campanaRepository.listarActividadesPorVoluntario(idUsuario);
  },

  async registrarAsistencia(
    idParticipacion: number,
    data: RegistroAsistenciaDTO,
    marcadoPorId: number
  ): Promise<ParticipacionItem> {
    return campanaRepository.registrarAsistencia(idParticipacion, data, marcadoPorId);
  },
};
