// src/middlewares/ayudaAccess.ts
// ============================================================================
// Autorización del módulo Gestión de Beneficiarios y Ayudas.
// Reutiliza el JWT ya validado por verificarToken y nunca confía en roles
// enviados por body/query.
// ============================================================================
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import type { ActorAyuda, RolAyuda } from '../models/ayudaModel';

const normalizarRol = (rol: unknown): RolAyuda | null => {
  const valor = String(rol ?? '').toLowerCase().trim();
  if (valor === 'administrador' || valor === 'admin') return 'Administrador';
  if (valor === 'beneficiario') return 'Beneficiario';
  return null;
};

export const actorDesdeRequest = (req: Request): ActorAyuda => {
  const usuario = req.usuario;
  if (!usuario) throw new AppError('Acceso denegado. Inicia sesión nuevamente.', 401);

  const id = Number(usuario.id_usuario);
  const rolesCrudos = Array.isArray(usuario.roles) && usuario.roles.length
    ? usuario.roles
    : [usuario.rol];
  const roles = rolesCrudos
    .map(normalizarRol)
    .filter((rol): rol is RolAyuda => rol !== null);
  const rol = roles.includes('Administrador')
    ? 'Administrador'
    : roles.includes('Beneficiario')
      ? 'Beneficiario'
      : null;

  if (!Number.isInteger(id) || id <= 0 || !rol) {
    throw new AppError('Acceso denegado. Tu rol no tiene acceso a este módulo.', 403);
  }

  return {
    id_usuario: id,
    rol,
    roles: [...new Set(roles)],
    nombre: usuario.nombre || '',
  };
};

export const requerirRolAyuda =
  (...permitidos: RolAyuda[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const actor = actorDesdeRequest(req);
      if (!permitidos.includes(actor.rol)) {
        throw new AppError('Acceso denegado. No tienes permisos para esta acción.', 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
