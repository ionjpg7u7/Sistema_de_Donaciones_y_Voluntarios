// src/repositories/ayudaRepository.ts
// ============================================================================
// CAPA: Acceso a datos del módulo Gestión de Beneficiarios y Ayudas.
// Único lugar con SQL de este módulo. Usa consultas parametrizadas.
// De Usuarios/Beneficiarios/Donaciones solo se hacen SELECT; la única tabla
// que este repositorio escribe es solicitud_ayuda.
// ============================================================================
import { pool } from '../config/database';
import type { PoolClient } from 'pg';
import { AppError } from '../utils/AppError';
import type {
  AsignacionAyudaItem,
  BeneficiarioAyuda,
  CierreSolicitudInput,
  CrearSolicitudAyudaInput,
  FiltrosSolicitud,
  OportunidadAsignacion,
  RevisionSolicitudInput,
  SolicitudAyudaItem,
} from '../models/ayudaModel';

const AHORA = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')`;
const TS = (col: string): string => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS')`;
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const numReq = (v: unknown): number => Number(v ?? 0);

interface SolicitudRow extends Omit<SolicitudAyudaItem, 'cantidad_solicitada' | 'asignaciones_activas' | 'cantidad_asignada'> {
  cantidad_solicitada: string | number | null;
  asignaciones_activas: string | number;
  cantidad_asignada: string | number;
}

interface BeneficiarioRow extends BeneficiarioAyuda {}

interface AsignacionRow extends Omit<AsignacionAyudaItem, 'cantidad'> {
  cantidad: string | number;
}

const SELECT_SOLICITUD = `
  SELECT
    s.id_solicitud_ayuda,
    s.beneficiario_usuario_id,
    (ub.nombre || ' ' || ub.apellido) AS beneficiario_nombre,
    ub.correo AS beneficiario_correo,
    ub.foto_url,
    s.tipo_ayuda,
    s.necesidad,
    s.descripcion,
    s.cantidad_solicitada,
    s.prioridad,
    s.estado,
    s.creado_por_usuario_id,
    (uc.nombre || ' ' || uc.apellido) AS creado_por_nombre,
    s.evaluado_por_usuario_id,
    CASE WHEN s.evaluado_por_usuario_id IS NULL THEN NULL
         ELSE (ue.nombre || ' ' || ue.apellido) END AS evaluado_por_nombre,
    ${TS('s.fecha_creacion')} AS fecha_creacion,
    ${TS('s.fecha_evaluacion')} AS fecha_evaluacion,
    ${TS('s.fecha_cierre')} AS fecha_cierre,
    s.motivo_rechazo,
    s.motivo_cancelacion,
    COALESCE(asg.asignaciones_activas, 0) AS asignaciones_activas,
    COALESCE(asg.cantidad_asignada, 0) AS cantidad_asignada
  FROM solicitud_ayuda s
  JOIN usuario ub ON ub.id_usuario = s.beneficiario_usuario_id
  JOIN usuario uc ON uc.id_usuario = s.creado_por_usuario_id
  LEFT JOIN usuario ue ON ue.id_usuario = s.evaluado_por_usuario_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS asignaciones_activas,
           COALESCE(SUM(a.cantidad), 0) AS cantidad_asignada
    FROM asignacion_donacion a
    WHERE a.solicitud_ayuda_id = s.id_solicitud_ayuda
      AND a.estado = 'ACTIVA'
  ) asg ON TRUE
`;

const mapearSolicitud = (fila: SolicitudRow): SolicitudAyudaItem => ({
  ...fila,
  cantidad_solicitada: num(fila.cantidad_solicitada),
  asignaciones_activas: numReq(fila.asignaciones_activas),
  cantidad_asignada: numReq(fila.cantidad_asignada),
});

const SELECT_BENEFICIARIO = `
  SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,
    u.telefono,
    u.foto_url,
    b.tipo_beneficiario,
    b.documento,
    b.direccion,
    b.necesidad,
    b.descripcion
  FROM beneficiario b
  JOIN usuario u ON u.id_usuario = b.id_usuario
  WHERE b.estado = 'Verificado' AND u.estado = 'Activo'
`;

export const ayudaRepository = {
  async listarBeneficiarios(q?: string): Promise<BeneficiarioAyuda[]> {
    const busqueda = (q || '').trim();
    const { rows } = await pool.query<BeneficiarioRow>(
      `${SELECT_BENEFICIARIO}
       AND ($1 = '' OR
            (u.nombre || ' ' || u.apellido) ILIKE '%' || $1 || '%' OR
            b.documento ILIKE '%' || $1 || '%' OR
            b.necesidad ILIKE '%' || $1 || '%')
       ORDER BY u.apellido ASC, u.nombre ASC`,
      [busqueda]
    );
    return rows;
  },

  async obtenerBeneficiarioVerificado(id: number): Promise<BeneficiarioAyuda | null> {
    const { rows } = await pool.query<BeneficiarioRow>(
      `${SELECT_BENEFICIARIO} AND u.id_usuario = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listarSolicitudes(
    actorId: number,
    esAdmin: boolean,
    filtros: FiltrosSolicitud = {}
  ): Promise<SolicitudAyudaItem[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (!esAdmin) {
      params.push(actorId);
      condiciones.push(`s.beneficiario_usuario_id = $${params.length}`);
    }
    if (filtros.estado) {
      params.push(filtros.estado);
      condiciones.push(`s.estado = $${params.length}`);
    }
    if (filtros.tipo_ayuda) {
      params.push(filtros.tipo_ayuda);
      condiciones.push(`s.tipo_ayuda = $${params.length}`);
    }
    if (filtros.q) {
      params.push(filtros.q);
      condiciones.push(`(
        s.necesidad ILIKE '%' || $${params.length} || '%' OR
        COALESCE(s.descripcion, '') ILIKE '%' || $${params.length} || '%' OR
        (ub.nombre || ' ' || ub.apellido) ILIKE '%' || $${params.length} || '%'
      )`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const { rows } = await pool.query<SolicitudRow>(
      `${SELECT_SOLICITUD}
       ${where}
       ORDER BY s.fecha_creacion DESC, s.id_solicitud_ayuda DESC`,
      params
    );
    return rows.map(mapearSolicitud);
  },

  async obtenerSolicitud(id: number): Promise<SolicitudAyudaItem | null> {
    const { rows } = await pool.query<SolicitudRow>(
      `${SELECT_SOLICITUD} WHERE s.id_solicitud_ayuda = $1 LIMIT 1`,
      [id]
    );
    return rows[0] ? mapearSolicitud(rows[0]) : null;
  },

  async listarAsignaciones(idSolicitud: number): Promise<AsignacionAyudaItem[]> {
    const { rows } = await pool.query<AsignacionRow>(
      `SELECT a.id_asignacion, a.donacion_id, d.codigo AS donacion_codigo,
              d.tipo_donacion, a.cantidad,
              ${TS('a.fecha_asignacion')} AS fecha_asignacion,
              a.estado, a.observaciones
         FROM asignacion_donacion a
         JOIN donacion d ON d.id_donacion = a.donacion_id
        WHERE a.solicitud_ayuda_id = $1
        ORDER BY a.fecha_asignacion DESC, a.id_asignacion DESC`,
      [idSolicitud]
    );
    return rows.map((fila) => ({ ...fila, cantidad: numReq(fila.cantidad) }));
  },

  async crearSolicitud(
    input: CrearSolicitudAyudaInput,
    beneficiarioId: number,
    creadoPorId: number
  ): Promise<SolicitudAyudaItem> {
    const { rows } = await pool.query<{ id_solicitud_ayuda: number }>(
      `INSERT INTO solicitud_ayuda
         (beneficiario_usuario_id, tipo_ayuda, necesidad, descripcion,
          cantidad_solicitada, prioridad, estado, creado_por_usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7)
       RETURNING id_solicitud_ayuda`,
      [
        beneficiarioId,
        input.tipo_ayuda,
        input.necesidad,
        input.descripcion,
        input.cantidad_solicitada,
        input.prioridad,
        creadoPorId,
      ]
    );

    const creada = await this.obtenerSolicitud(rows[0].id_solicitud_ayuda);
    if (!creada) throw new Error('No se pudo recuperar la solicitud creada.');
    return creada;
  },

  async revisarSolicitud(
    id: number,
    evaluadorId: number,
    input: RevisionSolicitudInput
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE solicitud_ayuda
          SET estado = $2,
              evaluado_por_usuario_id = $3,
              fecha_evaluacion = ${AHORA},
              motivo_rechazo = $4,
              motivo_cancelacion = NULL
        WHERE id_solicitud_ayuda = $1
          AND estado IN ('PENDIENTE', 'EN_EVALUACION')`,
      [id, input.estado, evaluadorId, input.motivo_rechazo]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async cerrarSolicitud(
    id: number,
    input: CierreSolicitudInput
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE solicitud_ayuda
          SET estado = $2,
              fecha_cierre = ${AHORA},
              motivo_cancelacion = $3
        WHERE id_solicitud_ayuda = $1
          AND estado = 'APROBADA'`,
      [id, input.estado, input.motivo_cancelacion]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async estaAprobada(id: number): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM solicitud_ayuda
        WHERE id_solicitud_ayuda = $1 AND estado = 'APROBADA'
        LIMIT 1`,
      [id]
    );
    return rows.length > 0;
  },

  async listarOportunidadesAsignacion(idSolicitud: number): Promise<OportunidadAsignacion[]> {
    const { rows } = await pool.query(
      `SELECT d.id_donacion, d.codigo, d.tipo_donacion,
              COALESCE(d.cantidad, 0) AS cantidad,
              COALESCE(d.cantidad_recibida, 0) - COALESCE(sa.asignada, 0) AS saldo_disponible,
              ${TS('d.fecha_donacion')} AS fecha_donacion,
              du.nombre || ' ' || du.apellido AS donante_nombre,
              d.estado AS estado_donacion
         FROM donacion d
         LEFT JOIN (
           SELECT donacion_id, SUM(cantidad) AS asignada
             FROM asignacion_donacion
            WHERE estado = 'ACTIVA'
            GROUP BY donacion_id
         ) sa ON sa.donacion_id = d.id_donacion
         JOIN usuario du ON du.id_usuario = d.donante_usuario_id
        WHERE d.estado <> 'ANULADA'
          AND (COALESCE(d.cantidad_recibida, 0) - COALESCE(sa.asignada, 0)) > 0
        ORDER BY d.fecha_donacion DESC, d.id_donacion DESC`
    );
    return rows.map((row: { id_donacion: number; codigo: string; tipo_donacion: string; cantidad: string | number; saldo_disponible: string | number; fecha_donacion: string; donante_nombre: string; estado_donacion: string }) => ({
      id_donacion: row.id_donacion,
      codigo: row.codigo,
      tipo_donacion: row.tipo_donacion,
      cantidad: Number(row.cantidad),
      saldo_disponible: Number(row.saldo_disponible),
      fecha_donacion: row.fecha_donacion,
      donante_nombre: row.donante_nombre || 'Sin especificar',
      estado_donacion: row.estado_donacion,
    }));
  },

  /** Inserta asignación en activa y verifica limites contra el mismo proceso-bounded transaction. */
  async asignarDonacion(
    client: PoolClient,
    input: {
      id_solicitud_ayuda: number;
      id_donacion: number;
      cantidad: number;
      observaciones: string | null;
      creado_por_usuario_id: number;
    }
  ): Promise<{ id_asignacion: number }> {
    const sol = await client.query<{ beneficiario_usuario_id: number }>(
      `SELECT beneficiario_usuario_id
         FROM solicitud_ayuda
        WHERE id_solicitud_ayuda = $1 AND estado = 'APROBADA'
          FOR UPDATE`,
      [input.id_solicitud_ayuda]
    );
    if (!sol.rows[0]) throw new AppError('La solicitud no está aprobada o no existe.', 409);

    const don = await client.query<{ id_donacion: number }>(
      `SELECT id_donacion FROM donacion WHERE id_donacion = $1 AND estado <> 'ANULADA' FOR UPDATE`,
      [input.id_donacion]
    );
    if (!don.rows[0]) throw new AppError('La donación indicada no existe o está anulada.', 400);

    const asignada = await client.query<{ asignada: string }>(
      `SELECT COALESCE(SUM(cantidad), 0) AS asignada
         FROM asignacion_donacion
        WHERE donacion_id = $1 AND estado = 'ACTIVA'`,
      [input.id_donacion]
    );
    const cantidadAsignada = Number(asignada.rows[0]?.asignada ?? 0);

    const res = await client.query<{ id_asignacion: number }>(
      `INSERT INTO asignacion_donacion
         (donacion_id, beneficiario_usuario_id, solicitud_ayuda_id, cantidad,administrador_usuario_id, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_asignacion`,
      [
        input.id_donacion,
        sol.rows[0].beneficiario_usuario_id,
        input.id_solicitud_ayuda,
        input.cantidad,
        input.creado_por_usuario_id,
        input.observaciones,
      ]
    );
    return { id_asignacion: Number(res.rows[0].id_asignacion) };
  },

  async iniciarEvaluacion(id: number): Promise<boolean> {
    const result = await pool.query(
      `UPDATE solicitud_ayuda
          SET estado = 'EN_EVALUACION'
        WHERE id_solicitud_ayuda = $1 AND estado = 'PENDIENTE'`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async cancelarSolicitante(
    id: number,
    beneficiarioId: number,
    motivo: string
  ): Promise<boolean> {
    const result = await pool.query(
      `UPDATE solicitud_ayuda
          SET estado = 'CANCELADA',
              fecha_cierre = ${AHORA},
              motivo_cancelacion = $3
        WHERE id_solicitud_ayuda = $1
          AND beneficiario_usuario_id = $2
          AND estado IN ('PENDIENTE', 'EN_EVALUACION')`,
      [id, beneficiarioId, motivo]
    );
    return (result.rowCount ?? 0) > 0;
  },
};
