// src/controllers/campanaController.ts
// ============================================================================
// CAPA: Controlador de Campañas y Actividades.
// ============================================================================
import type { Request, Response } from 'express';
import { campanaService } from '../services/campanaService';

export const campanaController = {
  // --- Campañas ---
  async listar(req: Request, res: Response) {
    const { estado, q } = req.query;
    const campanas = await campanaService.listarCampanas({
      estado: estado as string,
      q: q as string,
    });
    res.json(campanas);
  },

  async listarPublicas(req: Request, res: Response) {
    const { q } = req.query;
    const campanas = await campanaService.listarCampanas({
      estado: 'Activa',
      q: q as string,
    });
    res.json(campanas);
  },

  async obtenerPorId(req: Request, res: Response) {
    const id = Number(req.params.id);
    const campana = await campanaService.obtenerCampanaPorId(id);
    res.json(campana);
  },

  async crear(req: Request, res: Response) {
    const adminId = (req as any).usuario.id_usuario;
    const campana = await campanaService.crearCampana(req.body, adminId);
    res.status(201).json({
      mensaje: 'Campaña creada exitosamente',
      campana,
    });
  },

  async actualizar(req: Request, res: Response) {
    const id = Number(req.params.id);
    const campana = await campanaService.actualizarCampana(id, req.body);
    res.json({
      mensaje: 'Campaña actualizada exitosamente',
      campana,
    });
  },

  async eliminar(req: Request, res: Response) {
    const id = Number(req.params.id);
    await campanaService.eliminarCampana(id);
    res.json({ mensaje: 'Campaña cancelada/archivada exitosamente' });
  },

  // --- Actividades ---
  async listarActividades(req: Request, res: Response) {
    const { id_campana, tipo, estado, q } = req.query;
    const usuarioId = (req as any).usuario?.id_usuario;
    const actividades = await campanaService.listarActividades({
      id_campana: id_campana ? Number(id_campana) : undefined,
      tipo: tipo as string,
      estado: estado as string,
      usuario_id: usuarioId,
      q: q as string,
    });
    res.json(actividades);
  },

  async listarActividadesPublicas(req: Request, res: Response) {
    const { id_campana, tipo, q } = req.query;
    const actividades = await campanaService.listarActividades({
      id_campana: id_campana ? Number(id_campana) : undefined,
      tipo: tipo as string,
      estado: 'Planificada',
      q: q as string,
    });
    res.json(actividades);
  },

  async obtenerActividadPorId(req: Request, res: Response) {
    const id = Number(req.params.id);
    const usuarioId = (req as any).usuario?.id_usuario;
    const actividad = await campanaService.obtenerActividadPorId(id, usuarioId);
    res.json(actividad);
  },

  async crearActividad(req: Request, res: Response) {
    const creadorId = (req as any).usuario.id_usuario;
    const actividad = await campanaService.crearActividad(req.body, creadorId);
    res.status(201).json({
      mensaje: 'Actividad creada exitosamente',
      actividad,
    });
  },

  async actualizarActividad(req: Request, res: Response) {
    const id = Number(req.params.id);
    const actividad = await campanaService.actualizarActividad(id, req.body);
    res.json({
      mensaje: 'Actividad actualizada exitosamente',
      actividad,
    });
  },

  async eliminarActividad(req: Request, res: Response) {
    const id = Number(req.params.id);
    await campanaService.eliminarActividad(id);
    res.json({ mensaje: 'Actividad cancelada exitosamente' });
  },

  // --- Participaciones / Voluntariado ---
  async inscribirse(req: Request, res: Response) {
    const idActividad = Number(req.params.id);
    const idUsuario = (req as any).usuario.id_usuario;
    const { observaciones } = req.body;
    const participacion = await campanaService.inscribirVoluntario(idActividad, idUsuario, observaciones);
    res.status(201).json({
      mensaje: 'Inscripción a la actividad realizada exitosamente',
      participacion,
    });
  },

  async desinscribirse(req: Request, res: Response) {
    const idActividad = Number(req.params.id);
    const idUsuario = (req as any).usuario.id_usuario;
    await campanaService.desinscribirVoluntario(idActividad, idUsuario);
    res.json({ mensaje: 'Inscripción cancelada exitosamente' });
  },

  async listarVoluntariosActividad(req: Request, res: Response) {
    const idActividad = Number(req.params.id);
    const voluntarios = await campanaService.listarVoluntariosActividad(idActividad);
    res.json(voluntarios);
  },

  async misActividades(req: Request, res: Response) {
    const idUsuario = (req as any).usuario.id_usuario;
    const participaciones = await campanaService.listarMisActividades(idUsuario);
    res.json(participaciones);
  },

  async registrarAsistencia(req: Request, res: Response) {
    const idParticipacion = Number(req.params.idParticipacion);
    const marcadoPorId = (req as any).usuario.id_usuario;
    const participacion = await campanaService.registrarAsistencia(idParticipacion, req.body, marcadoPorId);
    res.json({
      mensaje: 'Asistencia registrada exitosamente. Estado de voluntario actualizado.',
      participacion,
    });
  },
};
