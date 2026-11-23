// src/middlewares/donacionAccess.ts
// ============================================================================
// Autorización propia del módulo Gestión de Donaciones.
// Reutiliza `verificarToken` (que deja el JWT decodificado en req.usuario) y
// valida el rol CANÓNICO del token. Nunca se acepta el rol ni el id desde el
// body/query. No modifica authMiddleware.ts.
// ============================================================================
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import type { ActorDonacion, RolCanonico } from '../models/donacionModel';

const ROLES_CANONICOS: readonly RolCanonico[] = ['Administrador', 'Donante', 'Voluntario', 'Beneficiario'];

/** Extrae el actor autenticado del JWT ya verificado. */
export const actorDesdeRequest = (req: Request): ActorDonacion => {
  const u = req.usuario;
  const id = Number(u?.id_usuario);
  const rol = u?.rol as RolCanonico | undefined;
  const roles: string[] = Array.isArray(u?.roles) ? u.roles : (rol ? [rol] : []);
  if (!u || !Number.isInteger(id) || id <= 0 || !rol || !ROLES_CANONICOS.includes(rol)) {
    throw new AppError('Acceso denegado. Tu rol no tiene acceso a este módulo.', 403);
  }
  return { id_usuario: id, rol, nombre: u.nombre, roles };
};

/** Exige que el rol del JWT sea uno de los indicados o esté en roles múltiples. */
export const requerirRol =
  (...permitidos: RolCanonico[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const actor = actorDesdeRequest(req);
      const rolesUsuario = actor.roles || [actor.rol];
      const tienePermiso = permitidos.some(
        (p) => rolesUsuario.includes(p) || actor.rol === p || actor.rol === 'Administrador'
      );
      if (!tienePermiso) {
        throw new AppError('Acceso denegado. No tienes permisos para esta acción.', 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
