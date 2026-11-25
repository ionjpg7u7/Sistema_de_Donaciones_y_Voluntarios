// src/services/ayudaService.ts
// ============================================================================
// CAPA: Servicio del módulo Gestión de Beneficiarios y Ayudas.
// Reglas de negocio; no conoce Express (sin req/res).
// ============================================================================
import { AppError } from '../utils/AppError';
import { pool } from '../config/database';
import { ayudaRepository } from '../repositories/ayudaRepository';
import type {
  ActorAyuda,
  BeneficiarioAyuda,
  AsignarDonacionSolicitudInput,
  CierreSolicitudInput,
  OportunidadAsignacion,
  CrearSolicitudAyudaInput,
  FiltrosSolicitud,
  RevisionSolicitudInput,
  SolicitudAyudaDetalle,
  SolicitudAyudaItem,
} from '../models/ayudaModel';

const esAdmin = (actor: ActorAyuda): boolean => actor.rol === 'Administrador';

const verificarAcceso = (actor: ActorAyuda, solicitud: SolicitudAyudaItem): void => {
  if (!esAdmin(actor) && solicitud.beneficiario_usuario_id !== actor.id_usuario) {
    throw new AppError('No puedes consultar una solicitud de otro beneficiario.', 403);
  }
};

export const ayudaService = {
  async listarBeneficiarios(actor: ActorAyuda, q?: string): Promise<BeneficiarioAyuda[]> {
    if (!esAdmin(actor)) {
      throw new AppError('Solo un administrador puede consultar el directorio de beneficiarios.', 403);
    }
    return ayudaRepository.listarBeneficiarios(q);
  },

  async listarSolicitudes(
    actor: ActorAyuda,
    filtros: FiltrosSolicitud
  ): Promise<SolicitudAyudaItem[]> {
    return ayudaRepository.listarSolicitudes(actor.id_usuario, esAdmin(actor), filtros);
  },

  async obtenerSolicitud(actor: ActorAyuda, id: number): Promise<SolicitudAyudaDetalle> {
    const solicitud = await ayudaRepository.obtenerSolicitud(id);
    if (!solicitud) throw new AppError('Solicitud de ayuda no encontrada.', 404);
    verificarAcceso(actor, solicitud);

    return {
      ...solicitud,
      asignaciones: await ayudaRepository.listarAsignaciones(id),
    };
  },

  async crearSolicitud(
    actor: ActorAyuda,
    input: CrearSolicitudAyudaInput
  ): Promise<SolicitudAyudaItem> {
    const beneficiarioId = esAdmin(actor)
      ? input.beneficiario_usuario_id
      : actor.id_usuario;

    if (!beneficiarioId) {
      throw new AppError('Selecciona el beneficiario para la solicitud.', 400);
    }
    if (!esAdmin(actor) && input.beneficiario_usuario_id && input.beneficiario_usuario_id !== actor.id_usuario) {
      throw new AppError('Solo puedes crear solicitudes para tu propio beneficiario.', 403);
    }

    const beneficiario = await ayudaRepository.obtenerBeneficiarioVerificado(beneficiarioId);
    if (!beneficiario) {
      throw new AppError(
        'El beneficiario no existe, no está activo o todavía no fue verificado por un administrador.',
        400
      );
    }

    return ayudaRepository.crearSolicitud(input, beneficiarioId, actor.id_usuario);
  },

  async revisarSolicitud(
    actor: ActorAyuda,
    id: number,
    input: RevisionSolicitudInput
  ): Promise<SolicitudAyudaItem> {
    if (!esAdmin(actor)) {
      throw new AppError('Solo un administrador puede evaluar solicitudes de ayuda.', 403);
    }

    const actual = await ayudaRepository.obtenerSolicitud(id);
    if (!actual) throw new AppError('Solicitud de ayuda no encontrada.', 404);
    if (!['PENDIENTE', 'EN_EVALUACION'].includes(actual.estado)) {
      throw new AppError('La solicitud ya fue evaluada o cerrada.', 409);
    }

    const actualizada = await ayudaRepository.revisarSolicitud(id, actor.id_usuario, input);
    if (!actualizada) {
      throw new AppError('La solicitud cambió de estado. Recarga e inténtalo de nuevo.', 409);
    }

    const resultado = await ayudaRepository.obtenerSolicitud(id);
    if (!resultado) throw new AppError('No se pudo recuperar la solicitud actualizada.', 500);
    return resultado;
  },

  async cerrarSolicitud(
    actor: ActorAyuda,
    id: number,
    input: CierreSolicitudInput
  ): Promise<SolicitudAyudaItem> {
    if (!esAdmin(actor)) {
      throw new AppError('Solo un administrador puede cerrar solicitudes de ayuda.', 403);
    }

    const actual = await ayudaRepository.obtenerSolicitud(id);
    if (!actual) throw new AppError('Solicitud de ayuda no encontrada.', 404);
    if (actual.estado !== 'APROBADA') {
      throw new AppError('Solo una solicitud aprobada puede marcarse como atendida o cancelada.', 409);
    }

    const cerrada = await ayudaRepository.cerrarSolicitud(id, input);
    if (!cerrada) {
      throw new AppError('La solicitud cambió de estado. Recarga e inténtalo de nuevo.', 409);
    }

    const resultado = await ayudaRepository.obtenerSolicitud(id);
    if (!resultado) throw new AppError('No se pudo recuperar la solicitud actualizada.', 500);
    return resultado;
  },

  /** Punto consumido por donaciones: una solicitud aprobada admite asignaciones. */
  async estaAprobada(id: number): Promise<boolean> {
    return ayudaRepository.estaAprobada(id);
  },

  async asignarDonacion(
    actor: ActorAyuda,
    id: number,
    input: AsignarDonacionSolicitudInput
  ): Promise<SolicitudAyudaItem> {
    if (!esAdmin(actor)) {
      throw new AppError('Solo un administrador puede asignar donaciones a ayudas.', 403);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const actual = await client.query<{ beneficiario_usuario_id: number }>(
        `SELECT beneficiario_usuario_id
           FROM solicitud_ayuda
          WHERE id_solicitud_ayuda = $1 AND estado = 'APROBADA'
            FOR UPDATE`,
        [id]
      );
      if (!actual.rows[0]) {
        throw new AppError('La solicitud no está aprobada o no existe.', 409);
      }

      const idDonacion = Number(input.donacion_id);
      if (!Number.isInteger(idDonacion) || idDonacion <= 0) {
        throw new AppError('El donación indicada no es válida.', 400);
      }
      const cantidad = Number(input.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new AppError('La cantidad debe ser un número mayor a cero.', 400);
      }
      if (cantidad > 999_999_999_999.99) {
        throw new AppError('La cantidad excede el máximo permitido.', 400);
      }

      const donacion = await client.query<{ cantidad: string; cantidad_recibida: string; estado: string }>(
        `SELECT cantidad, cantidad_recibida, estado
           FROM donacion
          WHERE id_donacion = $1
            FOR UPDATE`,
        [idDonacion]
      );
      if (!donacion.rows[0] || donacion.rows[0].estado === 'ANULADA') {
        throw new AppError('La donación indicada no existe o está anulada.', 400);
      }

      const asignada = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(cantidad), 0) AS total
           FROM asignacion_donacion
          WHERE donacion_id = $1 AND estado = 'ACTIVA'`,
        [idDonacion]
      );
      const saldo = Math.round((Number(donacion.rows[0].cantidad_recibida) - Number(asignada.rows[0]?.total ?? 0)) * 100) / 100;
      if (cantidad * 100 > saldo * 100) {
        throw new AppError(`La cantidad excede el saldo disponible (${saldo}).`, 409);
      }

      const idAsignacion = await ayudaRepository.asignarDonacion(client, {
        id_solicitud_ayuda: id,
        id_donacion: idDonacion,
        cantidad,
        observaciones: input.observaciones,
        creado_por_usuario_id: actor.id_usuario,
      });
      if (!idAsignacion) throw new AppError('No se pudo asignar la donación.', 500);

      const asignadaActualizada = await client.query<{ total: string }>(
        `SELECT COALESCE(SUM(cantidad), 0) AS total
           FROM asignacion_donacion
          WHERE donacion_id = $1 AND estado = 'ACTIVA'`,
        [idDonacion]
      );
      const totalAsignado = Number(asignadaActualizada.rows[0]?.total ?? 0);
      const cantidadCompromiso = Number(donacion.rows[0].cantidad);
      const nuevoEstado = totalAsignado >= cantidadCompromiso
        ? 'ASIGNADA_TOTAL'
        : totalAsignado > 0
          ? 'ASIGNADA_PARCIAL'
          : 'REGISTRADA';
      await client.query(
        `UPDATE donacion
            SET estado = $2, version = version + 1,
                fecha_actualizacion = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
          WHERE id_donacion = $1`,
        [idDonacion, nuevoEstado]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    const resultado = await ayudaRepository.obtenerSolicitud(id);
    if (!resultado) throw new AppError('No se pudo recuperar la solicitud actualizada.', 500);
    return resultado;
  },

  async oportunidadesAsignaciones(id: number): Promise<OportunidadAsignacion[]> {
    return ayudaRepository.listarOportunidadesAsignacion(id);
  },

  async iniciarEvaluacion(actor: ActorAyuda, id: number): Promise<SolicitudAyudaItem> {
    if (!esAdmin(actor)) throw new AppError('Solo un administrador puede iniciar la evaluación.', 403);
    const actual = await ayudaRepository.obtenerSolicitud(id);
    if (!actual) throw new AppError('Solicitud de ayuda no encontrada.', 404);
    if (actual.estado !== 'PENDIENTE') throw new AppError('Solo una solicitud pendiente puede pasar a evaluación.', 409);
    if (!(await ayudaRepository.iniciarEvaluacion(id))) throw new AppError('La solicitud cambió de estado.', 409);
    const resultado = await ayudaRepository.obtenerSolicitud(id);
    if (!resultado) throw new AppError('No se pudo recuperar la solicitud actualizada.', 500);
    return resultado;
  },

  async cancelarSolicitante(actor: ActorAyuda, id: number, motivo: string): Promise<SolicitudAyudaItem> {
    if (esAdmin(actor)) throw new AppError('Usa el cierre administrativo para cancelar solicitudes.', 400);
    if (!motivo || motivo.trim().length < 5) throw new AppError('Indica un motivo de cancelación de al menos 5 caracteres.', 400);
    if (motivo.trim().length > 1000) throw new AppError('El motivo no puede superar los 1000 caracteres.', 400);

    const actual = await ayudaRepository.obtenerSolicitud(id);
    if (!actual) throw new AppError('Solicitud de ayuda no encontrada.', 404);
    verificarAcceso(actor, actual);
    if (!['PENDIENTE', 'EN_EVALUACION'].includes(actual.estado)) {
      throw new AppError('Solo puedes cancelar solicitudes pendientes o en evaluación.', 409);
    }

    if (!(await ayudaRepository.cancelarSolicitante(id, actor.id_usuario, motivo.trim()))) {
      throw new AppError('La solicitud cambió de estado. Recarga e inténtalo de nuevo.', 409);
    }
    const resultado = await ayudaRepository.obtenerSolicitud(id);
    if (!resultado) throw new AppError('No se pudo recuperar la solicitud actualizada.', 500);
    return resultado;
  },
};
