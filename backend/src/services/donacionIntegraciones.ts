// src/services/donacionIntegraciones.ts
// ============================================================================
// PUNTO ÚNICO DE INTEGRACIÓN con módulos que aún no tienen esquema en el
// repositorio: Campañas y Solicitudes de Ayuda.
//
// Donaciones NO crea tablas ni lee/escribe tablas de otros módulos. Cuando
// el equipo dueño de cada módulo entregue su esquema/API, solo hay que
// reemplazar el cuerpo de estas funciones (y agregar la FK por migración):
//
//   campanasIntegracion.listarActivas()  → consultar campañas activas y en rango
//   campanasIntegracion.estaActiva(id)   → existe, activa y dentro de fechas
//   solicitudesIntegracion.estaAprobada  → solicitud evaluada y aprobada
// ============================================================================

import { pool } from '../config/database';

export interface CampanaResumen {
  id_campana: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
}

export const campanasIntegracion = {
  async listarActivas(): Promise<CampanaResumen[]> {
    const { rows } = await pool.query(
      `SELECT id_campana, nombre, descripcion, to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio, to_char(fecha_fin, 'YYYY-MM-DD') as fecha_fin
       FROM campana
       WHERE LOWER(estado) = 'activa'
       ORDER BY fecha_inicio ASC`
    );
    return rows;
  },
  async estaActiva(idCampana: number): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM campana
       WHERE id_campana = $1
         AND LOWER(estado) = 'activa'`,
      [idCampana]
    );
    return rows.length > 0;
  },
};

export const solicitudesIntegracion = {
  disponible: false,
  async estaAprobada(_idSolicitud: number): Promise<boolean> {
    return false;
  },
};
