// src/repositories/campanaRepository.ts
// ============================================================================
// CAPA: Acceso a datos de Campañas y Actividades (PostgreSQL con pool).
// ============================================================================
import { pool } from '../config/database';
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

export const campanaRepository = {
  // ==========================================================================
  // CAMPAÑAS
  // ==========================================================================

  async listar(filtros: { estado?: string; q?: string } = {}): Promise<Campana[]> {
    let query = `
      SELECT 
        c.id_campana,
        c.nombre,
        c.descripcion,
        c.portada_url,
        to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(c.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
        c.objetivo_recaudacion,
        c.estado,
        c.id_administrador,
        (u.nombre || ' ' || u.apellido) AS administrador_nombre,
        to_char(c.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
        to_char(c.fecha_actualizacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_actualizacion,
        COALESCE(don.total_recaudado, 0) AS total_recaudado,
        COALESCE(don.total_donaciones, 0) AS total_donaciones,
        COALESCE(act.total_actividades, 0) AS total_actividades,
        COALESCE(vol.total_voluntarios, 0) AS total_voluntarios
      FROM campana c
      JOIN usuario u ON u.id_usuario = c.id_administrador
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(d.id_donacion) AS total_donaciones,
          COALESCE(SUM(CASE WHEN d.tipo_donacion = 'ECONOMICO' THEN de.monto ELSE d.cantidad_recibida END), 0) AS total_recaudado
        FROM donacion d
        LEFT JOIN detalle_economico de ON de.id_donacion = d.id_donacion
        WHERE d.campana_id = c.id_campana AND d.estado <> 'ANULADA'
      ) don ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(ac.id_actividad) AS total_actividades
        FROM actividad_campana ac
        WHERE ac.id_campana = c.id_campana
      ) act ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT p.id_voluntario) AS total_voluntarios
        FROM actividad_campana ac2
        JOIN participa p ON p.id_actividad = ac2.id_actividad
        WHERE ac2.id_campana = c.id_campana AND p.estado <> 'Cancelado'
      ) vol ON TRUE
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filtros.estado) {
      params.push(filtros.estado);
      query += ` AND c.estado = $${params.length}`;
    } else {
      // Por defecto, ocultar campañas canceladas (soft delete)
      query += ` AND c.estado <> 'Cancelada'`;
    }

    if (filtros.q) {
      params.push(`%${filtros.q}%`);
      query += ` AND (c.nombre ILIKE $${params.length} OR c.descripcion ILIKE $${params.length})`;
    }

    query += ` ORDER BY c.fecha_inicio DESC, c.id_campana DESC`;

    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      ...r,
      total_recaudado: Number(r.total_recaudado || 0),
      total_donaciones: Number(r.total_donaciones || 0),
      total_actividades: Number(r.total_actividades || 0),
      total_voluntarios: Number(r.total_voluntarios || 0),
      objetivo_recaudacion: r.objetivo_recaudacion ? Number(r.objetivo_recaudacion) : null,
    }));
  },

  async obtenerPorId(idCampana: number): Promise<Campana | null> {
    const query = `
      SELECT 
        c.id_campana,
        c.nombre,
        c.descripcion,
        c.portada_url,
        to_char(c.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
        to_char(c.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
        c.objetivo_recaudacion,
        c.estado,
        c.id_administrador,
        (u.nombre || ' ' || u.apellido) AS administrador_nombre,
        to_char(c.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
        to_char(c.fecha_actualizacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_actualizacion,
        COALESCE(don.total_recaudado, 0) AS total_recaudado,
        COALESCE(don.total_donaciones, 0) AS total_donaciones,
        COALESCE(act.total_actividades, 0) AS total_actividades,
        COALESCE(vol.total_voluntarios, 0) AS total_voluntarios
      FROM campana c
      JOIN usuario u ON u.id_usuario = c.id_administrador
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(d.id_donacion) AS total_donaciones,
          COALESCE(SUM(CASE WHEN d.tipo_donacion = 'ECONOMICO' THEN de.monto ELSE d.cantidad_recibida END), 0) AS total_recaudado
        FROM donacion d
        LEFT JOIN detalle_economico de ON de.id_donacion = d.id_donacion
        WHERE d.campana_id = c.id_campana AND d.estado <> 'ANULADA'
      ) don ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(ac.id_actividad) AS total_actividades
        FROM actividad_campana ac
        WHERE ac.id_campana = c.id_campana
      ) act ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT p.id_voluntario) AS total_voluntarios
        FROM actividad_campana ac2
        JOIN participa p ON p.id_actividad = ac2.id_actividad
        WHERE ac2.id_campana = c.id_campana AND p.estado <> 'Cancelado'
      ) vol ON TRUE
      WHERE c.id_campana = $1
    `;
    const { rows } = await pool.query(query, [idCampana]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      ...r,
      total_recaudado: Number(r.total_recaudado || 0),
      total_donaciones: Number(r.total_donaciones || 0),
      total_actividades: Number(r.total_actividades || 0),
      total_voluntarios: Number(r.total_voluntarios || 0),
      objetivo_recaudacion: r.objetivo_recaudacion ? Number(r.objetivo_recaudacion) : null,
    };
  },

  async crear(data: CampanaCrearDTO, idAdmin: number): Promise<Campana> {
    const query = `
      INSERT INTO campana (nombre, descripcion, portada_url, fecha_inicio, fecha_fin, objetivo_recaudacion, estado, id_administrador)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'Planificada'), $8)
      RETURNING id_campana
    `;
    const values = [
      data.nombre,
      data.descripcion ?? null,
      data.portada_url ?? null,
      data.fecha_inicio,
      data.fecha_fin ?? null,
      data.objetivo_recaudacion ?? null,
      data.estado ?? 'Planificada',
      idAdmin,
    ];
    const { rows } = await pool.query(query, values);
    return (await this.obtenerPorId(rows[0].id_campana))!;
  },

  async actualizar(idCampana: number, data: CampanaActualizarDTO): Promise<Campana | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.nombre !== undefined) {
      values.push(data.nombre);
      updates.push(`nombre = $${values.length}`);
    }
    if (data.descripcion !== undefined) {
      values.push(data.descripcion);
      updates.push(`descripcion = $${values.length}`);
    }
    if (data.portada_url !== undefined) {
      values.push(data.portada_url);
      updates.push(`portada_url = $${values.length}`);
    }
    if (data.fecha_inicio !== undefined) {
      values.push(data.fecha_inicio);
      updates.push(`fecha_inicio = $${values.length}`);
    }
    if (data.fecha_fin !== undefined) {
      values.push(data.fecha_fin);
      updates.push(`fecha_fin = $${values.length}`);
    }
    if (data.objetivo_recaudacion !== undefined) {
      values.push(data.objetivo_recaudacion);
      updates.push(`objetivo_recaudacion = $${values.length}`);
    }
    if (data.estado !== undefined) {
      values.push(data.estado);
      updates.push(`estado = $${values.length}`);
    }

    if (updates.length === 0) return this.obtenerPorId(idCampana);

    values.push(idCampana);
    const query = `
      UPDATE campana
      SET ${updates.join(', ')}, fecha_actualizacion = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
      WHERE id_campana = $${values.length}
      RETURNING id_campana
    `;
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return null;
    return this.obtenerPorId(idCampana);
  },

  async eliminar(idCampana: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE campana
         SET estado = 'Cancelada',
             fecha_actualizacion = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
       WHERE id_campana = $1 AND estado <> 'Cancelada'`,
      [idCampana]
    );
    return Boolean(rowCount && rowCount > 0);
  },

  // ==========================================================================
  // ACTIVIDADES
  // ==========================================================================

  async listarActividades(
    filtros: { id_campana?: number; tipo?: string; estado?: string; usuario_id?: number; q?: string } = {}
  ): Promise<Actividad[]> {
    let query = `
      SELECT 
        a.id_actividad,
        a.nombre,
        a.descripcion,
        to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
        to_char(a.hora_inicio, 'HH24:MI') AS hora_inicio,
        to_char(a.hora_fin, 'HH24:MI') AS hora_fin,
        a.lugar,
        a.max_voluntarios,
        a.tipo_actividad,
        a.solicitud_ayuda_id,
        a.id_donacion,
        a.estado,
        a.creado_por_usuario_id,
        (u.nombre || ' ' || u.apellido) AS creador_nombre,
        to_char(a.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
        to_char(a.fecha_actualizacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_actualizacion,
        COALESCE(p_count.inscritos, 0) AS voluntarios_inscritos,
        GREATEST(a.max_voluntarios - COALESCE(p_count.inscritos, 0), 0) AS cupos_disponibles
      FROM actividad a
      JOIN usuario u ON u.id_usuario = a.creado_por_usuario_id
      LEFT JOIN LATERAL (
        SELECT COUNT(p.id_participacion) AS inscritos
        FROM participa p
        WHERE p.id_actividad = a.id_actividad AND p.estado <> 'Cancelado'
      ) p_count ON TRUE
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filtros.id_campana) {
      params.push(filtros.id_campana);
      query += ` AND EXISTS (SELECT 1 FROM actividad_campana ac WHERE ac.id_actividad = a.id_actividad AND ac.id_campana = $${params.length})`;
    }

    if (filtros.tipo) {
      params.push(filtros.tipo);
      query += ` AND a.tipo_actividad = $${params.length}`;
    }

    if (filtros.estado) {
      params.push(filtros.estado);
      query += ` AND a.estado = $${params.length}`;
    } else {
      // Por defecto, ocultar actividades canceladas (soft delete)
      query += ` AND a.estado <> 'Cancelada'`;
    }

    if (filtros.q) {
      params.push(`%${filtros.q}%`);
      query += ` AND (a.nombre ILIKE $${params.length} OR a.descripcion ILIKE $${params.length} OR a.lugar ILIKE $${params.length})`;
    }

    query += ` ORDER BY a.fecha ASC, a.hora_inicio ASC`;

    const { rows } = await pool.query(query, params);

    // Adjuntar campañas asociadas y participación del usuario si corresponde
    for (const act of rows) {
      const campanasRes = await pool.query(
        `SELECT c.id_campana, c.nombre 
         FROM actividad_campana ac 
         JOIN campana c ON c.id_campana = ac.id_campana 
         WHERE ac.id_actividad = $1`,
        [act.id_actividad]
      );
      act.campanas_asociadas = campanasRes.rows;
      act.voluntarios_inscritos = Number(act.voluntarios_inscritos || 0);
      act.cupos_disponibles = Number(act.cupos_disponibles || 0);

      if (filtros.usuario_id) {
        const miPartRes = await pool.query(
          `SELECT 
             p.id_participacion, p.id_voluntario, p.id_actividad,
             to_char(p.fecha_inscripcion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inscripcion,
             p.asistio, p.estado, p.observaciones, p.horas_acreditadas,
             to_char(p.fecha_asistencia, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_asistencia
           FROM participa p
           WHERE p.id_actividad = $1 AND p.id_voluntario = $2`,
          [act.id_actividad, filtros.usuario_id]
        );
        act.mi_participacion = miPartRes.rows.length > 0 ? miPartRes.rows[0] : null;
      }
    }

    return rows;
  },

  async obtenerActividadPorId(idActividad: number, usuarioId?: number): Promise<Actividad | null> {
    const query = `
      SELECT 
        a.id_actividad,
        a.nombre,
        a.descripcion,
        to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
        to_char(a.hora_inicio, 'HH24:MI') AS hora_inicio,
        to_char(a.hora_fin, 'HH24:MI') AS hora_fin,
        a.lugar,
        a.max_voluntarios,
        a.tipo_actividad,
        a.solicitud_ayuda_id,
        a.id_donacion,
        a.estado,
        a.creado_por_usuario_id,
        (u.nombre || ' ' || u.apellido) AS creador_nombre,
        to_char(a.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
        to_char(a.fecha_actualizacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_actualizacion,
        COALESCE(p_count.inscritos, 0) AS voluntarios_inscritos,
        GREATEST(a.max_voluntarios - COALESCE(p_count.inscritos, 0), 0) AS cupos_disponibles
      FROM actividad a
      JOIN usuario u ON u.id_usuario = a.creado_por_usuario_id
      LEFT JOIN LATERAL (
        SELECT COUNT(p.id_participacion) AS inscritos
        FROM participa p
        WHERE p.id_actividad = a.id_actividad AND p.estado <> 'Cancelado'
      ) p_count ON TRUE
      WHERE a.id_actividad = $1
    `;
    const { rows } = await pool.query(query, [idActividad]);
    if (rows.length === 0) return null;
    const act = rows[0];

    const campanasRes = await pool.query(
      `SELECT c.id_campana, c.nombre 
       FROM actividad_campana ac 
       JOIN campana c ON c.id_campana = ac.id_campana 
       WHERE ac.id_actividad = $1`,
      [act.id_actividad]
    );
    act.campanas_asociadas = campanasRes.rows;
    act.voluntarios_inscritos = Number(act.voluntarios_inscritos || 0);
    act.cupos_disponibles = Number(act.cupos_disponibles || 0);

    if (usuarioId) {
      const miPartRes = await pool.query(
        `SELECT 
           p.id_participacion, p.id_voluntario, p.id_actividad,
           to_char(p.fecha_inscripcion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inscripcion,
           p.asistio, p.estado, p.observaciones, p.horas_acreditadas,
           to_char(p.fecha_asistencia, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_asistencia
         FROM participa p
         WHERE p.id_actividad = $1 AND p.id_voluntario = $2`,
        [act.id_actividad, usuarioId]
      );
      act.mi_participacion = miPartRes.rows.length > 0 ? miPartRes.rows[0] : null;
    }

    return act;
  },

  async crearActividad(data: ActividadCrearDTO, creadorId: number): Promise<Actividad> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO actividad (nombre, descripcion, fecha, hora_inicio, hora_fin, lugar, max_voluntarios, tipo_actividad, solicitud_ayuda_id, id_donacion, estado, creado_por_usuario_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'CAMPANA'), $9, $10, COALESCE($11, 'Planificada'), $12)
        RETURNING id_actividad
      `;
      const values = [
        data.nombre,
        data.descripcion ?? null,
        data.fecha,
        data.hora_inicio,
        data.hora_fin,
        data.lugar,
        data.max_voluntarios,
        data.tipo_actividad ?? 'CAMPANA',
        data.solicitud_ayuda_id ?? null,
        data.id_donacion ?? null,
        data.estado ?? 'Planificada',
        creadorId,
      ];
      const { rows } = await client.query(query, values);
      const idActividad = rows[0].id_actividad;

      if (data.id_campana) {
        await client.query(
          `INSERT INTO actividad_campana (id_actividad, id_campana) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [idActividad, data.id_campana]
        );
      }

      await client.query('COMMIT');
      return (await this.obtenerActividadPorId(idActividad))!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async actualizarActividad(idActividad: number, data: ActividadActualizarDTO): Promise<Actividad | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updates: string[] = [];
      const values: any[] = [];

      if (data.nombre !== undefined) {
        values.push(data.nombre);
        updates.push(`nombre = $${values.length}`);
      }
      if (data.descripcion !== undefined) {
        values.push(data.descripcion);
        updates.push(`descripcion = $${values.length}`);
      }
      if (data.fecha !== undefined) {
        values.push(data.fecha);
        updates.push(`fecha = $${values.length}`);
      }
      if (data.hora_inicio !== undefined) {
        values.push(data.hora_inicio);
        updates.push(`hora_inicio = $${values.length}`);
      }
      if (data.hora_fin !== undefined) {
        values.push(data.hora_fin);
        updates.push(`hora_fin = $${values.length}`);
      }
      if (data.lugar !== undefined) {
        values.push(data.lugar);
        updates.push(`lugar = $${values.length}`);
      }
      if (data.max_voluntarios !== undefined) {
        values.push(data.max_voluntarios);
        updates.push(`max_voluntarios = $${values.length}`);
      }
      if (data.tipo_actividad !== undefined) {
        values.push(data.tipo_actividad);
        updates.push(`tipo_actividad = $${values.length}`);
      }
      if (data.estado !== undefined) {
        values.push(data.estado);
        updates.push(`estado = $${values.length}`);
      }

      if (updates.length > 0) {
        values.push(idActividad);
        await client.query(
          `UPDATE actividad SET ${updates.join(', ')}, fecha_actualizacion = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz') WHERE id_actividad = $${values.length}`,
          values
        );
      }

      if (data.id_campana !== undefined) {
        await client.query(`DELETE FROM actividad_campana WHERE id_actividad = $1`, [idActividad]);
        if (data.id_campana) {
          await client.query(
            `INSERT INTO actividad_campana (id_actividad, id_campana) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [idActividad, data.id_campana]
          );
        }
      }

      await client.query('COMMIT');
      return this.obtenerActividadPorId(idActividad);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async eliminarActividad(idActividad: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE actividad
         SET estado = 'Cancelada',
             fecha_actualizacion = (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')
       WHERE id_actividad = $1 AND estado <> 'Cancelada'`,
      [idActividad]
    );
    return Boolean(rowCount && rowCount > 0);
  },

  // ==========================================================================
  // PARTICIPACIONES (VOLUNTARIADO)
  // ==========================================================================

  async inscribirVoluntario(idActividad: number, idUsuario: number, observaciones?: string): Promise<ParticipacionItem> {
    const query = `
      INSERT INTO participa (id_voluntario, id_actividad, estado, observaciones)
      VALUES ($1, $2, 'Inscrito', $3)
      ON CONFLICT (id_voluntario, id_actividad) 
      DO UPDATE SET estado = 'Inscrito', observaciones = EXCLUDED.observaciones
      RETURNING id_participacion
    `;
    const { rows } = await pool.query(query, [idUsuario, idActividad, observaciones ?? null]);
    return (await this.obtenerParticipacionPorId(rows[0].id_participacion))!;
  },

  async desinscribirVoluntario(idActividad: number, idUsuario: number): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE participa SET estado = 'Cancelado' WHERE id_actividad = $1 AND id_voluntario = $2 AND asistio = FALSE`,
      [idActividad, idUsuario]
    );
    return Boolean(rowCount && rowCount > 0);
  },

  async obtenerParticipacionPorId(idParticipacion: number): Promise<ParticipacionItem | null> {
    const query = `
      SELECT 
        p.id_participacion,
        p.id_voluntario,
        (u.nombre || ' ' || u.apellido) AS voluntario_nombre,
        u.correo AS voluntario_correo,
        u.telefono AS voluntario_telefono,
        p.id_actividad,
        a.nombre AS actividad_nombre,
        to_char(a.fecha, 'YYYY-MM-DD') AS actividad_fecha,
        a.lugar AS actividad_lugar,
        to_char(p.fecha_inscripcion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inscripcion,
        p.asistio,
        p.estado,
        p.observaciones,
        p.horas_acreditadas,
        to_char(p.fecha_asistencia, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_asistencia,
        p.marcado_por_usuario_id
      FROM participa p
      JOIN usuario u ON u.id_usuario = p.id_voluntario
      JOIN actividad a ON a.id_actividad = p.id_actividad
      WHERE p.id_participacion = $1
    `;
    const { rows } = await pool.query(query, [idParticipacion]);
    return rows.length > 0 ? rows[0] : null;
  },

  async listarVoluntariosPorActividad(idActividad: number): Promise<ParticipacionItem[]> {
    const query = `
      SELECT 
        p.id_participacion,
        p.id_voluntario,
        (u.nombre || ' ' || u.apellido) AS voluntario_nombre,
        u.correo AS voluntario_correo,
        u.telefono AS voluntario_telefono,
        p.id_actividad,
        to_char(p.fecha_inscripcion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inscripcion,
        p.asistio,
        p.estado,
        p.observaciones,
        p.horas_acreditadas,
        to_char(p.fecha_asistencia, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_asistencia,
        p.marcado_por_usuario_id
      FROM participa p
      JOIN usuario u ON u.id_usuario = p.id_voluntario
      WHERE p.id_actividad = $1
      ORDER BY p.fecha_inscripcion ASC
    `;
    const { rows } = await pool.query(query, [idActividad]);
    return rows;
  },

  async listarActividadesPorVoluntario(idUsuario: number): Promise<ParticipacionItem[]> {
    const query = `
      SELECT 
        p.id_participacion,
        p.id_voluntario,
        (u.nombre || ' ' || u.apellido) AS voluntario_nombre,
        u.correo AS voluntario_correo,
        u.telefono AS voluntario_telefono,
        p.id_actividad,
        a.nombre AS actividad_nombre,
        to_char(a.fecha, 'YYYY-MM-DD') AS actividad_fecha,
        a.lugar AS actividad_lugar,
        to_char(p.fecha_inscripcion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inscripcion,
        p.asistio,
        p.estado,
        p.observaciones,
        p.horas_acreditadas,
        to_char(p.fecha_asistencia, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_asistencia,
        p.marcado_por_usuario_id
      FROM participa p
      JOIN usuario u ON u.id_usuario = p.id_voluntario
      JOIN actividad a ON a.id_actividad = p.id_actividad
      WHERE p.id_voluntario = $1 AND p.estado <> 'Cancelado'
      ORDER BY a.fecha DESC, a.hora_inicio DESC
    `;
    const { rows } = await pool.query(query, [idUsuario]);
    return rows;
  },

  async registrarAsistencia(idParticipacion: number, data: RegistroAsistenciaDTO, marcadoPorId: number): Promise<ParticipacionItem> {
    const estado = data.estado ?? (data.asistio ? 'Asistio' : 'No_Asistio');
    const horas = data.asistio ? (data.horas_acreditadas ?? 2) : 0;
    const query = `
      UPDATE participa
      SET 
        asistio = $1,
        estado = $2,
        horas_acreditadas = $3,
        observaciones = COALESCE($4, observaciones),
        fecha_asistencia = CASE WHEN $1 = TRUE THEN (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz') ELSE NULL END,
        marcado_por_usuario_id = $5
      WHERE id_participacion = $6
      RETURNING id_participacion
    `;
    const { rows } = await pool.query(query, [
      data.asistio,
      estado,
      horas,
      data.observaciones ?? null,
      marcadoPorId,
      idParticipacion,
    ]);
    return (await this.obtenerParticipacionPorId(rows[0].id_participacion))!;
  },
};
