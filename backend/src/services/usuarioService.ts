// src/services/usuarioService.ts
// ============================================================================
// CAPA: Negocio (gestión de usuarios).
// Reglas de negocio del CRUD de usuarios. Llama al repositorio y valida.
// No conoce Express (sin req/res).
// ============================================================================
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { usuarioRepository, normalizarRol } from '../repositories/usuarioRepository';
import { AppError } from '../utils/AppError';
import {
  validarDatosUsuario,
  esContraseñaSegura,
  validarDatosBeneficiario,
  validarDatosDonante,
  validarDatosVoluntario,
  normalizarHabilidades,
  validarCoordenadas,
  ROLES_VALIDOS,
  RolSistema,
} from '../utils/validaciones';
import type {
  UsuarioResponse,
  RolData,
  CrearUsuarioInput,
  UbicacionResponse,
} from '../models/usuarioModel';

// ---------- Helpers ----------

const construirDireccion = (
  calle?: string | null,
  zona?: string | null,
  ciudad?: string | null
): string | null => {
  const partes = [calle, zona, ciudad].map((p) => (p || '').trim()).filter(Boolean);
  return partes.length ? partes.join(', ') : null;
};

const valorDefinido = (v: unknown): boolean =>
  v !== undefined && v !== null && String(v).trim() !== '';

const normalizarRolUI = (rol?: string | null): RolSistema | null => {
  const valor = (rol || '').toLowerCase().trim();
  if (valor === 'administrador' || valor === 'admin') return 'Administrador';
  if (valor === 'coordinador') return 'Coordinador';
  if (valor === 'beneficiario') return 'Beneficiario';
  if (valor === 'donante' || valor === 'cliente') return 'Donante';
  if (valor === 'voluntario' || valor === 'empleado') return 'Voluntario';
  return null;
};

const normalizarRolesUI = (roles: unknown, rol: unknown): RolSistema[] => {
  const valores = Array.isArray(roles) ? roles : [rol];
  const normalizados = [...new Set(valores.map((valor) => normalizarRolUI(String(valor ?? ''))).filter((valor): valor is RolSistema => Boolean(valor)))];
  // Coordinador conserva también su rol de voluntario, que comparte subtipo.
  return normalizados.includes('Coordinador') && !normalizados.includes('Voluntario')
    ? [...normalizados, 'Voluntario']
    : normalizados;
};

const construirRolData = (
  rol: RolSistema,
  body: Record<string, any>,
  actual?: Record<string, any>,
  // Solo la selección administrativa del rol Coordinador puede asignar este
  // subtipo directamente; las solicitudes mantienen su estado actual.
  permitirCamposAdmin = false
): RolData => {
  const direccion =
    (valorDefinido(body.direccion) ? String(body.direccion).trim() : null) ||
    construirDireccion(body.calle, body.zona, body.ciudad) ||
    (actual?.direccion ?? null);

  const data: RolData = {};

  if (rol === 'Administrador') {
    return data;
  }

  if (rol === 'Beneficiario') {
    data.tipo_beneficiario = valorDefinido(body.tipo_beneficiario)
      ? String(body.tipo_beneficiario).trim()
      : (actual?.tipo_beneficiario ?? 'Persona');
    data.documento = valorDefinido(body.documento)
      ? String(body.documento).trim()
      : valorDefinido(body.ci_nit)
        ? String(body.ci_nit).trim()
        : (actual?.documento ?? null);
    data.direccion = direccion;
    data.necesidad = valorDefinido(body.necesidad)
      ? String(body.necesidad).trim()
      : (actual?.necesidad ?? null);
    data.descripcion = valorDefinido(body.descripcion)
      ? String(body.descripcion).trim()
      : (actual?.descripcion ?? null);
    // El estado solo lo modifica el flujo de revisión, nunca datos del perfil
    // ni el payload del formulario administrativo.
    data.estado_beneficiario = actual?.estado_beneficiario ?? 'Pendiente';

    const v = validarDatosBeneficiario({
      tipo_beneficiario: data.tipo_beneficiario || undefined,
      documento: data.documento || undefined,
      direccion: data.direccion || undefined,
      necesidad: data.necesidad || undefined,
      descripcion: data.descripcion || undefined,
      estado_beneficiario: data.estado_beneficiario || undefined,
    });
    if (!v.valido) throw new AppError(v.error!, 400);
    return data;
  }

  if (rol === 'Donante') {
    data.direccion = direccion;
    data.ubi_latitud = valorDefinido(body.ubi_latitud)
      ? Number(body.ubi_latitud)
      : (actual?.ubi_latitud ?? null);
    data.ubi_longitud = valorDefinido(body.ubi_longitud)
      ? Number(body.ubi_longitud)
      : (actual?.ubi_longitud ?? null);
    const v = validarDatosDonante({
      direccion: data.direccion,
      ubi_latitud: data.ubi_latitud,
      ubi_longitud: data.ubi_longitud,
    });
    if (!v.valido) throw new AppError(v.error!, 400);
    return data;
  }

  // Voluntario / Coordinador
  data.direccion = direccion;
  data.habilidades = body.habilidades !== undefined
    ? normalizarHabilidades(body.habilidades)
    : (actual?.habilidades || []);
  data.disponibilidad = valorDefinido(body.disponibilidad)
    ? String(body.disponibilidad).trim()
    : (actual?.disponibilidad ?? null);
  data.es_coordinador = rol === 'Coordinador'
    ? true
    : permitirCamposAdmin
      ? false
      : Boolean(actual?.es_coordinador);
  // La aprobación se controla en la bandeja de revisión. Los formularios
  // conservan el estado existente y nunca pueden promover la solicitud.
  data.estado_voluntario = rol === 'Coordinador'
    ? 'Aprobado'
    : (actual?.estado_voluntario ?? 'Pendiente');
  const v = validarDatosVoluntario({
    habilidades: data.habilidades || [],
    disponibilidad: data.disponibilidad || undefined,
  });
  if (!v.valido) throw new AppError(v.error!, 400);
  return data;
};

const firmarToken = (usuario: UsuarioResponse): string =>
  jwt.sign(
    {
      id: usuario.id_usuario,
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      roles: usuario.roles || [usuario.rol],
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
export const usuarioService = {
  // ---------- Listar ----------
  async listarUsuarios(): Promise<UsuarioResponse[]> {
    return usuarioRepository.obtenerTodos();
  },

  // ---------- Cambiar estado ----------
  async cambiarEstado(
    id: string | number,
    estado: string | boolean
  ): Promise<{ mensaje: string; usuario: unknown }> {
    if (!id || Number.isNaN(Number(id))) throw new AppError('ID de usuario inválido', 400);

    const estadoValido =
      typeof estado === 'boolean' ||
      (typeof estado === 'string' &&
        ['activo', 'inactivo'].includes(estado.toLowerCase().trim()));
    if (!estadoValido) {
      throw new AppError('Estado inválido. Debe ser "Activo" o "Inactivo".', 400);
    }

    const actualizado = await usuarioRepository.actualizarEstado(id, estado);
    if (!actualizado) throw new AppError('Usuario no encontrado', 404);

    return { mensaje: 'Estado actualizado', usuario: actualizado };
  },

  // ---------- Obtener perfil ----------
  async obtenerPerfil(id_usuario: number): Promise<UsuarioResponse> {
    if (!id_usuario) throw new AppError('No autorizado', 401);
    const perfil = await usuarioRepository.obtenerPorId(id_usuario);
    if (!perfil) throw new AppError('Perfil no encontrado', 404);
    return perfil;
  },

  // ---------- Actualizar perfil ----------
  async actualizarPerfil(
    id_usuario: number,
    body: Record<string, any>,
    file?: Express.Multer.File
  ): Promise<{ mensaje: string; token: string; perfil: UsuarioResponse }> {
    if (!id_usuario) throw new AppError('No autorizado', 401);

    const usuarioActual = await usuarioRepository.obtenerPorId(id_usuario);
    if (!usuarioActual) throw new AppError('Usuario no encontrado', 404);

    const { nombre, paterno, materno, correo, telefono, passwordActual, passwordNueva } = body;

    const v = validarDatosUsuario({
      nombre, paterno, materno, correo, telefono,
      calle: body.calle, zona: body.zona, ciudad: body.ciudad,
    });
    if (!v.valido) throw new AppError(v.error!, 400);

    let hashNueva: string | undefined;

    if (passwordNueva) {
      if (!passwordActual) {
        throw new AppError('Debés ingresar tu contraseña actual para cambiarla.', 400);
      }

      const vPwd = esContraseñaSegura(passwordNueva);
      if (!vPwd.valido) throw new AppError(vPwd.error!, 400);

      const userConHash = await usuarioRepository.obtenerPorCorreo(usuarioActual.correo);
      if (!userConHash?.contraseña) {
        throw new AppError('No se pudo verificar la contraseña actual', 401);
      }
      const ok = await bcrypt.compare(passwordActual, userConHash.contraseña);
      if (!ok) throw new AppError('La contraseña actual es incorrecta', 401);

      hashNueva = await bcrypt.hash(passwordNueva, 10);
    }

    const rolData = construirRolData(
      usuarioActual.rol as RolSistema,
      body,
      usuarioActual as unknown as Record<string, any>
    );

    let foto_url: string | undefined;
    if (file) {
      foto_url = `/uploads/perfiles/${file.filename}`;
    } else if (body.foto_url !== undefined) {
      foto_url = String(body.foto_url).trim();
    }

    const perfil = await usuarioRepository.actualizarPerfil(
      id_usuario,
      {
        nombre: String(nombre).trim(),
        paterno: String(paterno).trim(),
        materno: materno?.trim() || null,
        correo: String(correo).toLowerCase().trim(),
        telefono: String(telefono).trim(),
        contraseña: hashNueva,
        foto_url,
        rol: usuarioActual.rol,
      },
      rolData
    );

    if (!perfil) throw new AppError('Error al actualizar datos', 500);

    return {
      mensaje: 'Perfil actualizado con éxito',
      token: firmarToken(perfil),
      perfil,
    };
  },

  // ---------- Crear usuario (admin) ----------
  async crearUsuario(body: CrearUsuarioInput): Promise<{ mensaje: string; id_usuario: number }> {
    // `estado` se lee con cast seguro: si CrearUsuarioInput no lo declara,
    // la intersección lo aporta y el acceso sigue tipado.
    const { nombre, paterno, materno, correo, telefono, contraseña, rol, foto_url } = body;
    const estado = (body as CrearUsuarioInput & { estado?: string | boolean }).estado;

    const rolesNormalizados = normalizarRolesUI(body.roles, rol);
    const rolNormalizado = rolesNormalizados[0];
    if (!rolNormalizado) {
      throw new AppError(`Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}.`, 400);
    }

    const v = validarDatosUsuario({
      nombre, paterno, materno, correo, telefono,
      calle: body.calle, zona: body.zona, ciudad: body.ciudad,
    });
    if (!v.valido) throw new AppError(v.error!, 400);

    const vPwd = esContraseñaSegura(contraseña);
    if (!vPwd.valido) throw new AppError(vPwd.error!, 400);

    const correoNorm = String(correo).toLowerCase().trim();
    const existente = await usuarioRepository.obtenerPorCorreo(correoNorm);
    if (existente) throw new AppError('El correo ya está registrado', 400);

    const rolesData = rolesNormalizados
      .filter((rolItem) => !(rolItem === 'Voluntario' && rolesNormalizados.includes('Coordinador')))
      .map((rolItem) => ({
      rol: rolItem,
      data: construirRolData(rolItem, body as Record<string, any>, undefined, true),
      }));
    const rolData = rolesData[0].data;

    const datosBeneficiario = rolesData.find((item) => item.rol === 'Beneficiario')?.data;
    if (datosBeneficiario?.documento) {
      const ciExistente = await usuarioRepository.obtenerPorDocumento(datosBeneficiario.documento);
      if (ciExistente) throw new AppError('El documento (CI / NIT) ya está registrado', 400);
    }

    const hash = await bcrypt.hash(contraseña, 10);

    const nuevo = await usuarioRepository.crearUsuario(
      {
        nombre: String(nombre).trim(),
        paterno: String(paterno).trim(),
        materno: materno?.trim() || null,
        correo: correoNorm,
        telefono: String(telefono).trim(),
        contraseña: hash,
        foto_url: foto_url || null,
        estado_cuenta: estado ?? 'Activo',
        rol: rolNormalizado,
      },
      rolData,
      rolesData
    );

    return { mensaje: 'Usuario creado con éxito', id_usuario: nuevo.id_usuario };
  },

  // ---------- Actualizar usuario (admin) ----------
  async actualizarUsuario(
    id: string | number,
    body: Record<string, any>
  ): Promise<{ mensaje: string }> {
    if (!id || Number.isNaN(Number(id))) throw new AppError('ID de usuario inválido', 400);

    const { nombre, paterno, materno, correo, telefono, contraseña, rol, estado, foto_url } = body;

    const rolesNormalizados = normalizarRolesUI(body.roles, rol);
    const rolNormalizado = rolesNormalizados[0] || 'Donante';
    if (!rolesNormalizados.length && !Array.isArray(body.roles)) {
      throw new AppError(`Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}.`, 400);
    }

    const v = validarDatosUsuario({
      nombre, paterno, materno, correo, telefono,
      calle: body.calle, zona: body.zona, ciudad: body.ciudad,
    });
    if (!v.valido) throw new AppError(v.error!, 400);

    let hashNueva: string | undefined;
    if (contraseña && String(contraseña).trim()) {
      const vPwd = esContraseñaSegura(contraseña);
      if (!vPwd.valido) throw new AppError(vPwd.error!, 400);
      hashNueva = await bcrypt.hash(contraseña, 10);
    }

    if (estado && !['activo', 'inactivo'].includes(String(estado).toLowerCase().trim())) {
      throw new AppError('Estado inválido.', 400);
    }

    const usuarioActual = await usuarioRepository.obtenerPorId(id);
    if (!usuarioActual) throw new AppError('Usuario no encontrado', 404);

    const rolesData = rolesNormalizados
      .filter((rolItem) => !(rolItem === 'Voluntario' && rolesNormalizados.includes('Coordinador')))
      .map((rolItem) => ({
      rol: rolItem,
      data: construirRolData(rolItem, body, usuarioActual as unknown as Record<string, any>, true),
      }));
    const rolData = rolesData[0]?.data || {};

    const datosBeneficiario = rolesData.find((item) => item.rol === 'Beneficiario')?.data;
    if (datosBeneficiario?.documento) {
      const ciExistente = await usuarioRepository.obtenerPorDocumento(datosBeneficiario.documento);
      if (ciExistente && String(ciExistente.id_usuario) !== String(id)) {
        throw new AppError('El documento (CI / NIT) ya está registrado por otro usuario', 400);
      }
    }

    const rolesActuales = usuarioActual.roles || [];
    const rolesToRemove = rolesActuales.filter((rolActual) => !rolesNormalizados.includes(rolActual as RolSistema)) as RolSistema[];

    await usuarioRepository.actualizarUsuario(
      id,
      {
        nombre: String(nombre).trim(),
        paterno: String(paterno).trim(),
        materno: materno?.trim() || null,
        correo: String(correo).toLowerCase().trim(),
        telefono: String(telefono).trim(),
        contraseña: hashNueva,
        foto_url: foto_url !== undefined ? String(foto_url).trim() || null : undefined,
        // Si el payload no trae estado, conservar el actual en vez de reactivar.
        estado_cuenta: estado || usuarioActual.estado || 'Activo',
        rol: rolesNormalizados.length ? rolNormalizado : 'Usuario',
      },
      rolData,
      rolesData,
      rolesToRemove
    );

    return { mensaje: 'Usuario actualizado con éxito' };
  },

  // ---------- Eliminar ----------
  async eliminarUsuario(id: string | number): Promise<{ mensaje: string }> {
    if (!id || Number.isNaN(Number(id))) throw new AppError('ID de usuario inválido', 400);
    const eliminado = await usuarioRepository.eliminarUsuario(id);
    if (!eliminado) throw new AppError('Usuario no encontrado', 404);
    return { mensaje: 'Usuario eliminado' };
  },

  // ---------- Obtener por id (admin) ----------
  async obtenerPorId(id: string | number): Promise<UsuarioResponse> {
    if (!id || Number.isNaN(Number(id))) throw new AppError('ID de usuario inválido', 400);
    const usuario = await usuarioRepository.obtenerPorId(id);
    if (!usuario) throw new AppError('Usuario no encontrado', 404);
    return usuario;
  },

  // ---------- Ubicaciones geográficas de donantes ----------
  async obtenerUsuariosConUbicacion(): Promise<UbicacionResponse[]> {
    return await usuarioRepository.obtenerUsuariosConUbicacion();
  },

  async actualizarMiUbicacion(
    id_usuario: number,
    body: Record<string, any>
  ): Promise<{ mensaje: string; ubicacion: { lat: number; lng: number } }> {
    if (!id_usuario || Number.isNaN(Number(id_usuario))) {
      throw new AppError('ID de usuario inválido', 400);
    }

    const lat = body.latitud ?? body.lat ?? body.ubi_latitud;
    const lng = body.longitud ?? body.lng ?? body.ubi_longitud;

    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      throw new AppError('Coordenadas (latitud y longitud) requeridas', 400);
    }

    const numLat = Number(lat);
    const numLng = Number(lng);

    const validacion = validarCoordenadas(numLat, numLng);
    if (!validacion.valido) {
      throw new AppError(validacion.error || 'Coordenadas geográficas inválidas', 400);
    }

    await usuarioRepository.actualizarUbicacionDonante(id_usuario, numLat, numLng);

    return {
      mensaje: 'Ubicación actualizada con éxito',
      ubicacion: { lat: numLat, lng: numLng },
    };
  },

  // ---------- Solicitudes de Voluntarios ----------
  async obtenerSolicitudesVoluntarios(filtroEstado?: string) {
    return await usuarioRepository.obtenerSolicitudesVoluntarios(filtroEstado);
  },

  async revisarSolicitudVoluntario(
    id_voluntario: number | string,
    nuevoEstado: string,
    revisorId: number,
    motivoRechazo?: string
  ) {
    const estadoNorm = (nuevoEstado || '').toLowerCase().trim();
    if (!['aprobado', 'rechazado'].includes(estadoNorm)) {
      throw new AppError('El estado debe ser "Aprobado" o "Rechazado".', 400);
    }
    const estadoFinal = estadoNorm === 'aprobado' ? 'Aprobado' : 'Rechazado';
    if (Number(id_voluntario) === revisorId) {
      throw new AppError('No puedes aprobar ni rechazar tu propia solicitud.', 400);
    }
    const usuario = await usuarioRepository.obtenerPorId(id_voluntario);
    if (!usuario) throw new AppError('Solicitud de voluntariado no encontrada.', 404);
    return await usuarioRepository.revisarSolicitudVoluntario(
      id_voluntario,
      estadoFinal,
      revisorId,
      motivoRechazo
    );
  },

  // ---------- Solicitudes de Beneficiarios ----------
  async obtenerSolicitudesBeneficiarios(filtroEstado?: string) {
    return await usuarioRepository.obtenerSolicitudesBeneficiarios(filtroEstado);
  },

  async revisarSolicitudBeneficiario(
    id_beneficiario: number | string,
    nuevoEstado: string,
    revisorId: number,
    motivoRechazo?: string
  ) {
    const estadoNorm = (nuevoEstado || '').toLowerCase().trim();
    if (!['verificado', 'rechazado'].includes(estadoNorm)) {
      throw new AppError('El estado debe ser "Verificado" o "Rechazado".', 400);
    }
    const estadoFinal = estadoNorm === 'verificado' ? 'Verificado' : 'Rechazado';
    if (Number(id_beneficiario) === revisorId) {
      throw new AppError('No puedes aprobar ni rechazar tu propia solicitud.', 400);
    }
    const usuario = await usuarioRepository.obtenerPorId(id_beneficiario);
    if (!usuario) throw new AppError('Solicitud de beneficiario no encontrada.', 404);
    return await usuarioRepository.revisarSolicitudBeneficiario(
      id_beneficiario,
      estadoFinal,
      revisorId,
      motivoRechazo
    );
  },

  // ---------- Postulaciones desde Dashboard ----------
  async postularVoluntario(id_usuario: number, body: Record<string, any>) {
    if (!id_usuario) throw new AppError('Usuario no autenticado', 401);
    const usuario = await usuarioRepository.obtenerPorId(id_usuario);
    if (!usuario) throw new AppError('Usuario no encontrado', 404);
    if (usuario.estado_voluntario === 'Pendiente') throw new AppError('Tu solicitud de voluntariado ya está pendiente.', 400);
    if (usuario.estado_voluntario === 'Aprobado' || usuario.es_coordinador) throw new AppError('Ya tienes el rol Voluntario aprobado.', 400);
    const habilidades = body.habilidades ? normalizarHabilidades(body.habilidades) : ['General'];
    const disponibilidad = String(body.disponibilidad || 'A convenir').trim();
    const validacion = validarDatosVoluntario({ habilidades, disponibilidad });
    if (!validacion.valido) throw new AppError(validacion.error!, 400);
    const solicitud = await usuarioRepository.postularVoluntario(id_usuario, habilidades, disponibilidad);
    if (!solicitud) {
      throw new AppError(usuario.estado_voluntario === 'Pendiente' ? 'Tu solicitud de voluntariado ya está pendiente.' : 'Ya tienes el rol Voluntario aprobado.', 400);
    }
    return solicitud;
  },

  async postularBeneficiario(id_usuario: number, body: Record<string, any>) {
    if (!id_usuario) throw new AppError('Usuario no autenticado', 401);
    const usuario = await usuarioRepository.obtenerPorId(id_usuario);
    if (!usuario) throw new AppError('Usuario no encontrado', 404);
    if (usuario.estado_beneficiario === 'Verificado') {
      throw new AppError('Ya tienes el rol Beneficiario verificado.', 400);
    }
    const { tipo_beneficiario, documento, direccion, necesidad, descripcion } = body;
    if (!documento || !direccion || !necesidad) {
      throw new AppError('Documento (CI/NIT), dirección y necesidad son requeridos.', 400);
    }
    const solicitud = await usuarioRepository.postularBeneficiario(id_usuario, {
      tipo_beneficiario: tipo_beneficiario || 'Persona',
      documento: String(documento).trim(),
      direccion: String(direccion).trim(),
      necesidad: String(necesidad).trim(),
      descripcion: descripcion ? String(descripcion).trim() : null,
    });
    if (!solicitud) throw new AppError(usuario.estado_beneficiario === 'Pendiente' ? 'Tu solicitud de beneficiario ya está pendiente.' : 'Ya tienes el rol Beneficiario verificado.', 400);
    return solicitud;
  },
};
