// src/services/authService.ts
// ============================================================================
// CAPA: Negocio (autenticación).
// Reglas de negocio: validar datos, hashear contraseñas, emitir JWT,
// gestionar recuperación de contraseña. No conoce Express.
// ============================================================================
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { usuarioRepository } from '../repositories/usuarioRepository';
import { emailService } from './emailService';
import { AppError } from '../utils/AppError';
import {
  validarDatosUsuario,
  esContraseñaSegura,
  esCorreoValido,
  esCiNitValido,
} from '../utils/validaciones';
import type {
  UsuarioResponse,
  RolData,
  RegistroInput,
  RegistroResponse,
} from '../models/usuarioModel';

const firmarToken = (usuario: UsuarioResponse): string =>
  jwt.sign(
    {
      id: usuario.id_usuario,
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      roles: usuario.roles,
      es_coordinador: Boolean(usuario.es_coordinador),
      es_donante: Boolean(usuario.es_donante),
      estado_voluntario: usuario.estado_voluntario ?? null,
      estado_beneficiario: usuario.estado_beneficiario ?? null,
      tipo_beneficiario: usuario.tipo_beneficiario ?? null,
      foto_url: usuario.foto_url,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '8h' }
  );

// ============================================================================
// Servicio público
// ============================================================================
export const authService = {
  // ---------- Registro público (Donante, Beneficiario, Voluntario) ----------
  async registrar(dto: RegistroInput): Promise<RegistroResponse> {
    const validacion = validarDatosUsuario(dto);
    if (!validacion.valido) throw new AppError(validacion.error!, 400);

    const validacionPwd = esContraseñaSegura(dto.contraseña);
    if (!validacionPwd.valido) throw new AppError(validacionPwd.error!, 400);

    if (dto.ci_nit && !esCiNitValido(dto.ci_nit)) {
      throw new AppError('El CI/NIT debe tener entre 5 y 15 dígitos numéricos.', 400);
    }
    if (dto.calle && String(dto.calle).trim().length > 150) {
      throw new AppError('La calle no puede superar los 150 caracteres.', 400);
    }

    const correo = dto.correo.toLowerCase().trim();
    const existente = await usuarioRepository.obtenerPorCorreo(correo);
    if (existente) throw new AppError('El correo ya está registrado', 400);

    const rolRaw = String(dto.rol || '').toLowerCase().trim();
    if (rolRaw === 'admin' || rolRaw === 'administrador') {
      throw new AppError('No está permitido registrarse como Administrador desde el formulario público.', 403);
    }

    // El registro solo crea la cuenta; las solicitudes se completan desde el dashboard.
    const rol = 'Usuario' as const;

    const estadoCuenta = 'Activo';
    const mensaje = 'Cuenta creada. Luego podrás solicitar participar o registrar una donación.';
    const rolData: RolData = {};

    const hash = await bcrypt.hash(dto.contraseña, 10);

    const nuevo = await usuarioRepository.crearUsuario(
      {
        nombre: dto.nombre.trim(),
        paterno: dto.paterno.trim(),
        materno: dto.materno?.trim() || null,
        correo,
        telefono: String(dto.telefono).trim(),
        contraseña: hash,
        estado_cuenta: estadoCuenta,
        rol,
      },
      rolData
    );

    return {
      id_usuario: nuevo.id_usuario,
      mensaje,
      rol,
      estado: estadoCuenta,
    };
  },

  // ---------- Login ----------
  async login(dto: { correo: string; contraseña: string }): Promise<{
    token: string;
    usuario: {
      id: number;
      id_usuario: number;
      nombre: string;
      apellido: string;
      correo: string;
      telefono: string | null;
      estado: string;
      rol: string;
      roles: string[];
      es_coordinador?: boolean;
      es_donante?: boolean;
      estado_voluntario?: string | null;
      estado_beneficiario?: string | null;
      foto_url?: string | null;
      tipo_beneficiario?: string | null;
    };
  }> {
    const { correo, contraseña } = dto;
    if (!correo || !contraseña) {
      throw new AppError('Correo y contraseña son obligatorios.', 400);
    }
    if (!esCorreoValido(correo)) {
      throw new AppError('El correo no tiene un formato válido.', 400);
    }
    if (String(contraseña).length < 6) {
      throw new AppError('Contraseña inválida.', 400);
    }

    const usuario = await usuarioRepository.obtenerPorCorreo(correo.toLowerCase().trim());
    if (!usuario || !usuario.contraseña) {
      throw new AppError('Credenciales inválidas', 401);
    }
    // Borrado lógico: la cuenta sigue en la BD, pero no puede iniciar sesión.
    if (usuario.estado === 'Eliminado') {
      throw new AppError('Credenciales inválidas', 401);
    }
    if (usuario.estado !== 'Activo' || usuario.activo === false) {
      if (usuario.estado_voluntario === 'Rechazado') {
        throw new AppError('Tu solicitud de voluntariado fue rechazada. Contactá al coordinador.', 403);
      }
      if (usuario.estado_voluntario === 'Pendiente') {
        throw new AppError('Tu solicitud de voluntariado está pendiente de aprobación por el coordinador.', 403);
      }
      throw new AppError('Tu cuenta se encuentra inactiva o en revisión. Contactá al soporte.', 403);
    }

    const hash = usuario.contraseña;
    const esHash = /^\$2[aby]\$/.test(hash);
    const ok = esHash
      ? await bcrypt.compare(contraseña, hash)
      : contraseña === hash; // compatibilidad con texto plano legado

    if (!ok) throw new AppError('Credenciales inválidas', 401);

    const token = firmarToken(usuario);
    return {
      token,
      usuario: {
        id: usuario.id_usuario,
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        telefono: usuario.telefono,
        estado: usuario.estado,
        rol: usuario.rol,
        roles: usuario.roles,
        es_coordinador: Boolean(usuario.es_coordinador),
        es_donante: Boolean(usuario.es_donante),
        estado_voluntario: usuario.estado_voluntario ?? null,
        estado_beneficiario: usuario.estado_beneficiario ?? null,
        tipo_beneficiario: usuario.tipo_beneficiario ?? null,
        foto_url: usuario.foto_url || null,
      },
    };
  },

  async refrescarSesion(id_usuario: number) {
    const usuario = await usuarioRepository.obtenerPorId(id_usuario);
    if (!usuario) throw new AppError('La cuenta no está disponible.', 401);
    if (usuario.estado !== 'Activo') throw new AppError('La cuenta está inactiva.', 403);
    return {
      token: firmarToken(usuario),
      usuario: {
        id: usuario.id_usuario,
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        telefono: usuario.telefono,
        estado: usuario.estado,
        rol: usuario.rol,
        roles: usuario.roles,
        es_coordinador: Boolean(usuario.es_coordinador),
        es_donante: Boolean(usuario.es_donante),
        estado_voluntario: usuario.estado_voluntario ?? null,
        estado_beneficiario: usuario.estado_beneficiario ?? null,
        tipo_beneficiario: usuario.tipo_beneficiario ?? null,
        foto_url: usuario.foto_url || null,
      },
    };
  },

  // ---------- Solicitar recuperación ----------
  async solicitarRecuperacion(correo: string): Promise<{ mensaje: string }> {
    if (!correo) throw new AppError('El correo es obligatorio.', 400);
    if (!esCorreoValido(correo)) {
      throw new AppError('El correo no tiene un formato válido.', 400);
    }

    const correoNorm = correo.toLowerCase().trim();
    const usuario = await usuarioRepository.obtenerPorCorreo(correoNorm);

    // Respuesta idéntica exista o no (anti-enumeración)
    const RESPUESTA = { mensaje: 'Si el correo está registrado, te enviamos las instrucciones.' };
    if (!usuario) return RESPUESTA;

    // Borrado lógico: no se envían instrucciones a cuentas eliminadas.
    if (usuario.estado === 'Eliminado') return RESPUESTA;

    const token = crypto.randomBytes(32).toString('hex');
    const fechaExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await usuarioRepository.guardarTokenRecuperacion(correoNorm, token, fechaExp);

    await emailService.enviarRecuperacionPassword(
      correoNorm,
      usuario.nombre,
      token
    );

    return RESPUESTA;
  },

  // ---------- Validar token ----------
  async validarToken(token: string): Promise<{ valido: true; correo: string }> {
    if (!token) throw new AppError('Token no proporcionado', 400);

    const usuario = await usuarioRepository.obtenerPorTokenRecuperacion(token);
    if (!usuario) throw new AppError('Token inválido', 404);

    if (!usuario.fecha_expiracion_token || new Date() > new Date(usuario.fecha_expiracion_token)) {
      throw new AppError('El token ha expirado', 400);
    }

    return { valido: true, correo: usuario.correo };
  },

  // ---------- Reset password ----------
  async resetPassword(dto: { token: string; nuevaContraseña: string }): Promise<{ mensaje: string }> {
    const { token, nuevaContraseña } = dto;
    if (!token || !nuevaContraseña) {
      throw new AppError('Token y contraseña son obligatorios.', 400);
    }

    const validacionPwd = esContraseñaSegura(nuevaContraseña);
    if (!validacionPwd.valido) throw new AppError(validacionPwd.error!, 400);

    const usuario = await usuarioRepository.obtenerPorTokenRecuperacion(token);
    if (!usuario) throw new AppError('Token inválido o ya utilizado', 404);

    if (!usuario.fecha_expiracion_token || new Date() > new Date(usuario.fecha_expiracion_token)) {
      throw new AppError('El token ha expirado. Solicitá uno nuevo.', 400);
    }

    const hash = await bcrypt.hash(nuevaContraseña, 10);
    await usuarioRepository.actualizarContraseñaConToken(usuario.id_usuario, hash);

    return { mensaje: 'Contraseña actualizada con éxito' };
  },
};
