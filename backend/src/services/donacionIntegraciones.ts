// src/services/donacionIntegraciones.ts
// ============================================================================
// PUNTO ÚNICO DE INTEGRACIÓN con los módulos propietarios de Campañas y
// Solicitudes de Ayuda.
//
// Donaciones NO crea tablas ni escribe tablas de otros módulos. Este archivo
// solo consume sus contratos de lectura:
//
//   campanasIntegracion.listarActivas()  → campañas activas
//   campanasIntegracion.estaActiva(id)   → existe y está activa
//   solicitudesIntegracion.estaAprobada  → solicitud evaluada y aprobada
// ============================================================================

import { pool } from '../config/database';
import { ayudaRepository } from '../repositories/ayudaRepository';

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
  disponible: true,
  async estaAprobada(idSolicitud: number): Promise<boolean> {
    return ayudaRepository.estaAprobada(idSolicitud);
  },
};
