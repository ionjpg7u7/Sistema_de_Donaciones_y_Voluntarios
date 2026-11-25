// src/controllers/ayudaController.ts
// ============================================================================
// CAPA: Controlador del módulo Gestión de Beneficiarios y Ayudas.
// Traduce HTTP a llamadas de servicio. Los errores los maneja errorMiddleware.
// ============================================================================
import type { Request, Response } from 'express';
import { actorDesdeRequest } from '../middlewares/ayudaAccess';
import { ayudaService } from '../services/ayudaService';
import {
  validarAsignarDonacion,
  validarCierreSolicitud,
  validarCrearSolicitud,
  validarFiltrosSolicitud,
  validarId,
  validarRevisionSolicitud,
} from '../validators/ayudaValidator';

export const ayudaController = {
  async listarBeneficiarios(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const q = String(req.query.q ?? '').trim();
    const beneficiarios = await ayudaService.listarBeneficiarios(actor, q);
    res.status(200).json(beneficiarios);
  },

  async listarSolicitudes(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const filtros = validarFiltrosSolicitud(req.query as Record<string, unknown>);
    const solicitudes = await ayudaService.listarSolicitudes(actor, filtros);
    res.status(200).json(solicitudes);
  },

  async obtenerSolicitud(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const solicitud = await ayudaService.obtenerSolicitud(actor, id);
    res.status(200).json(solicitud);
  },

  async crearSolicitud(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const input = validarCrearSolicitud(req.body as Record<string, unknown>);
    const solicitud = await ayudaService.crearSolicitud(actor, input);
    res.status(201).json({ mensaje: 'Solicitud de ayuda registrada.', solicitud });
  },

  async revisarSolicitud(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const input = validarRevisionSolicitud(req.body as Record<string, unknown>);
    const solicitud = await ayudaService.revisarSolicitud(actor, id, input);
    res.status(200).json({
      mensaje: input.estado === 'APROBADA' ? 'Solicitud aprobada.' : 'Solicitud rechazada.',
      solicitud,
    });
  },

  async cerrarSolicitud(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const input = validarCierreSolicitud(req.body as Record<string, unknown>);
    const solicitud = await ayudaService.cerrarSolicitud(actor, id, input);
    res.status(200).json({
      mensaje: input.estado === 'ATENDIDA' ? 'Solicitud marcada como atendida.' : 'Solicitud cancelada.',
      solicitud,
    });
  },

  async asignarDonacion(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const input = validarAsignarDonacion(req.body as Record<string, unknown>);
    const resultado = await ayudaService.asignarDonacion(actor, id, input);
    res.status(200).json({
      mensaje: 'Donación asignada exitosamente.',
      asignacion: resultado,
    });
  },

  async oportunidadesAsignaciones(req: Request, res: Response): Promise<void> {
    const id = validarId(req.params.id);
    const oportunidades = await ayudaService.oportunidadesAsignaciones(id);
    res.status(200).json(oportunidades);
  },

  async iniciarEvaluacion(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const solicitud = await ayudaService.iniciarEvaluacion(actor, id);
    res.status(200).json({ mensaje: 'Solicitud puesta en evaluación.', solicitud });
  },

  async cancelarSolicitante(req: Request, res: Response): Promise<void> {
    const actor = actorDesdeRequest(req);
    const id = validarId(req.params.id);
    const motivo = String((req.body as Record<string, unknown>)?.motivo_cancelacion ?? '').trim();
    const solicitud = await ayudaService.cancelarSolicitante(actor, id, motivo);
    res.status(200).json({ mensaje: 'Solicitud cancelada.', solicitud });
  },
};
