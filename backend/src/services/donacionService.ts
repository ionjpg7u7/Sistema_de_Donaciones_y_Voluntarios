// src/services/donacionService.ts
// ============================================================================
// CAPA: Negocio (Gestión de Donaciones).
// Reglas de estados, saldos, propiedad y auditoría. No conoce Express.
// Toda escritura múltiple ocurre en UNA transacción, con bloqueo de la fila
// de la donación (SELECT ... FOR UPDATE) para evitar sobre-asignaciones.
// ============================================================================
import { AppError } from '../utils/AppError';
import { conTransaccion, donacionRepository as repo } from '../repositories/donacionRepository';
import {
  DonacionValidationError,
  fechaHoyBolivia,
  redondear2,
  validarAsignacion,
  validarDonacion,
  validarFiltrosAsignacion,
  validarFiltrosDonacion,
  validarIdPositivo,
  validarMotivo,
} from '../validators/donacionValidator';
import { campanasIntegracion, solicitudesIntegracion } from './donacionIntegraciones';
import { donacionNotificador } from './donacionNotificador';
import type {
  ActorDonacion,
  AsignacionItem,
  CatalogosDonacion,
  DonacionDetalle,
  DonacionListaItem,
  DonacionNormalizada,
  EntregaPendienteItem,
  EstadoDonacion,
  Modalidad,
  Paginado,
  ReporteDonaciones,
  ResumenReporte,
} from '../models/donacionModel';

type Cuerpo = Record<string, unknown>;
const cuerpo = (b: unknown): Cuerpo => (b && typeof b === 'object' ? (b as Cuerpo) : {});

const MAX_FILAS_REPORTE = 5000;

// ---------------------------------------------------------------------------
// Helpers de dominio
// ---------------------------------------------------------------------------
/** Estado derivado de cuánto está asignado. ANULADA no se calcula: se fija al anular. */
export const estadoSegunAsignacion = (cantidad: number, asignada: number): EstadoDonacion => {
  const c = Math.round(cantidad * 100);
  const a = Math.round(asignada * 100);
  if (a <= 0) return 'REGISTRADA';
  return a < c ? 'ASIGNADA_PARCIAL' : 'ASIGNADA_TOTAL';
};

const formato = (n: number): string =>
  n.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const unidadDe = (d: DonacionNormalizada, cat: CatalogosDonacion): string =>
  d.tipo_donacion === 'ECONOMICO'
    ? d.moneda_codigo ?? ''
    : cat.unidades.find((u) => u.id_unidad === d.unidad_medida_id)?.codigo ?? '';

const resumenDe = (d: DonacionNormalizada, cat: CatalogosDonacion): string => {
  const tipo = { ALIMENTO: 'Alimento', MATERIAL: 'Material', ECONOMICO: 'Económica' }[d.tipo_donacion];
  return `${tipo}: ${formato(d.cantidad)} ${unidadDe(d, cat)}`.trim();
};

const asegurarCuentaActiva = async (actor: ActorDonacion): Promise<void> => {
  const u = await repo.obtenerUsuario(actor.id_usuario);
  if (!u || u.estado !== 'Activo') {
    throw new AppError('Tu cuenta no está activa. No puedes realizar esta operación.', 403);
  }
};

const validarCampana = async (idCampana: number | null): Promise<void> => {
  if (idCampana === null) return;
  if (!(await campanasIntegracion.estaActiva(idCampana))) {
    throw new DonacionValidationError([
      'La campaña seleccionada no existe o ya no está activa. Elige otra o continúa sin campaña.',
    ]);
  }
};

/** Oculta a cada rol lo que no necesita ver (privacidad del donante). */
const aplicarPrivacidadLista = (actor: ActorDonacion, i: DonacionListaItem): DonacionListaItem => {
  if (actor.rol !== 'Beneficiario') return i;
  return {
    ...i,
    cantidad: i.cantidad_beneficiario ?? 0,
    descripcion: null,
    donante_usuario_id: null,
    donante_nombre: null,
    voluntario_usuario_id: null,
    cantidad_asignada: null,
    cantidad_recibida: 0,
    saldo: null,
  };
};

const aplicarPrivacidadDetalle = (actor: ActorDonacion, d: DonacionDetalle): DonacionDetalle => {
  if (actor.rol !== 'Beneficiario') return d;
  return {
    ...(aplicarPrivacidadLista(actor, d) as DonacionDetalle),
    registrado_por_usuario_id: null,
    registrado_por_nombre: null,
    voluntario_nombre: null,
    motivo_anulacion: null,
    nombre_item: d.nombre_item,
    monto: null,
    metodo_pago: null,
    referencia_pago: null,
    comprobante: null,
  };
};

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------
export const donacionService = {
  async listarFotos(actor: ActorDonacion, id: unknown) {
    const donacion = await this.obtener(actor, id);
    return repo.listarFotos(donacion.id_donacion);
  },

  async foto(actor: ActorDonacion, id: unknown, fotoId: unknown) {
    const donacion = await this.obtener(actor, id);
    const foto = await repo.obtenerFoto(donacion.id_donacion, validarIdPositivo(fotoId, 'foto'));
    if (!foto) throw new AppError('La fotografía no existe.', 404);
    return foto;
  },

  async registrarFotos(actor: ActorDonacion, id: unknown, files: Express.Multer.File[]) {
    await asegurarCuentaActiva(actor);
    const donacion = await this.obtener(actor, id);
    if (!files.length) throw new AppError('Selecciona al menos una fotografía.', 400);
    if (files.length > 5) throw new AppError('Puedes adjuntar hasta 5 fotografías por operación.', 400);
    const fs = await import('fs/promises');
    const path = await import('path');
    const crypto = await import('crypto');
    const base = path.resolve(process.cwd(), 'storage', 'donaciones');
    await fs.mkdir(base, { recursive: true });
    const guardadas: Array<{ nombre_original: string; mime_type: string; tamanio_bytes: number; url: string }> = [];
    for (const file of files) {
      const firma = file.buffer;
      const jpegReal = firma.length >= 3 && firma[0] === 0xff && firma[1] === 0xd8 && firma[2] === 0xff;
      const pngReal = firma.length >= 8 && firma.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const webpReal = firma.length >= 12 && firma.toString('ascii',0,4) === 'RIFF' && firma.toString('ascii',8,12) === 'WEBP';
      const mimeReal = jpegReal ? 'image/jpeg' : pngReal ? 'image/png' : webpReal ? 'image/webp' : '';
      if (!mimeReal || mimeReal !== file.mimetype || file.size > 5 * 1024 * 1024) {
        throw new AppError('Solo se permiten imágenes JPG, PNG o WEBP válidas de hasta 5 MB.', 400);
      }
      const extension = mimeReal === 'image/jpeg' ? '.jpg' : mimeReal === 'image/png' ? '.png' : '.webp';
      const key = `${crypto.randomUUID()}${extension}`;
      await fs.writeFile(path.join(base, key), file.buffer, { flag: 'wx' });
      const row = await repo.insertarFoto({ id_donacion: donacion.id_donacion, nombre_original: file.originalname.slice(0,255), clave_almacenamiento: key, mime_type: file.mimetype, tamanio_bytes: file.size, usuario_id: actor.id_usuario });
      guardadas.push({ ...row, url: `/api/donaciones/${donacion.id_donacion}/fotos/${row.id_foto}` });
    }
    return guardadas;
  },

  // Inventario central: solo lectura desde Gestión de Donaciones.
  listarInventario: () => repo.listarInventario(),

  // ============================ Catálogos ================================
  catalogos: (): Promise<CatalogosDonacion> => repo.catalogos(),

  campanasActivas: () => campanasIntegracion.listarActivas(),

  async buscarDonantes(q: unknown) {
    const texto = String(q ?? '').trim();
    if (texto.length < 3) throw new AppError('Ingresa al menos 3 caracteres para buscar un donante.', 400);
    return repo.buscarDonantes(texto.slice(0, 80));
  },

  beneficiariosAsignables: () => repo.beneficiariosAsignables(),

  // ============================ Registro =================================
  /** CU "Registrar donación": el donante autenticado dona a su nombre. */
  async registrarPropia(actor: ActorDonacion, body: unknown) {
    await asegurarCuentaActiva(actor);
    return this.registrar({
      actor,
      body: cuerpo(body),
      modalidad: 'ONLINE',
      donanteId: actor.id_usuario,
      voluntarioId: null,
    });
  },

  /** CU "Registrar donación presencial": Voluntario (o Administrador) registra por un donante. */
  async registrarPresencial(actor: ActorDonacion, body: unknown) {
    const b = cuerpo(body);
    await asegurarCuentaActiva(actor);

    if (actor.rol === 'Voluntario') {
      if (!(await repo.existeVoluntario(actor.id_usuario))) {
        throw new AppError('Tu cuenta no tiene perfil de voluntario.', 403);
      }
    } else if (actor.rol === 'Administrador') {
      if (!(await repo.existeAdministrador(actor.id_usuario))) {
        throw new AppError('Tu cuenta no tiene perfil de administrador.', 403);
      }
    }

    const donanteId = validarIdPositivo(b.donante_usuario_id, 'donante');
    const donante = await repo.obtenerDonante(donanteId);
    if (!donante) {
      throw new AppError(
        'El donante no se encuentra registrado. Solicita su alta a un administrador desde Gestión de usuarios.',
        404
      );
    }
    if (donante.estado !== 'Activo') {
      throw new AppError('La cuenta del donante se encuentra inactiva. No se puede continuar con el registro.', 400);
    }

    return this.registrar({
      actor,
      body: b,
      modalidad: 'PRESENCIAL',
      donanteId,
      voluntarioId: actor.rol === 'Voluntario' ? actor.id_usuario : null,
    });
  },

  async registrar(p: {
    actor: ActorDonacion;
    body: Cuerpo;
    modalidad: Modalidad;
    donanteId: number;
    voluntarioId: number | null;
  }) {
    const catalogos = await repo.catalogos();
    const datos = validarDonacion(p.body, catalogos); // lanza TODOS los errores juntos
    await validarCampana(datos.campana_id);

    const creada = await conTransaccion(async (c) => {
      if (p.modalidad === 'ONLINE') {
        await c.query(
          `INSERT INTO donante (id_usuario) VALUES ($1) ON CONFLICT (id_usuario) DO NOTHING`,
          [p.donanteId]
        );
      }
      const { id_donacion, codigo } = await repo.insertarDonacion(c, {
        donante_usuario_id: p.donanteId,
        registrado_por_usuario_id: p.actor.id_usuario,
        voluntario_usuario_id: p.voluntarioId,
        modalidad: p.modalidad,
        datos,
      });
      await repo.insertarDetalle(c, id_donacion, datos);
      const comprobante = await repo.insertarComprobante(c, id_donacion, p.actor.id_usuario);
      await repo.registrarAuditoria(c, {
        donacion_id: id_donacion,
        entidad_tipo: 'DONACION',
        entidad_id: id_donacion,
        usuario_id: p.actor.id_usuario,
        accion: 'REGISTRAR',
        datos_nuevos: await repo.snapshot(c, id_donacion),
      });
      return { id_donacion, codigo, comprobante };
    });

    // Notificación posterior al commit (no bloquea ni revierte).
    const donante = await repo.obtenerDonante(p.donanteId);
    if (donante) {
      donacionNotificador.registrada({
        codigo: creada.codigo,
        resumen: resumenDe(datos, catalogos),
        numeroComprobante: creada.comprobante.numero_comprobante,
        donanteNombre: `${donante.nombre} ${donante.apellido}`,
        donanteCorreo: donante.correo,
        adminCorreos: await repo.correosAdministradores(),
      });
    }

    return {
      mensaje: 'Donación registrada con éxito',
      donacion: { id_donacion: creada.id_donacion, codigo: creada.codigo },
      comprobante: creada.comprobante,
    };
  },

  // ============================ Consulta =================================
  async listar(actor: ActorDonacion, query: unknown): Promise<Paginado<DonacionListaItem>> {
    const filtros = validarFiltrosDonacion(cuerpo(query));
    const res = await repo.listar(actor, filtros);
    return { ...res, items: res.items.map((i) => aplicarPrivacidadLista(actor, i)) };
  },

  async obtener(actor: ActorDonacion, id: unknown): Promise<DonacionDetalle> {
    const idDonacion = validarIdPositivo(id, 'la donación');
    const detalle = await repo.obtenerDetalle(actor, idDonacion);
    // 404 tanto si no existe como si no le pertenece: no se revela existencia.
    if (!detalle) throw new AppError('Donación no encontrada.', 404);
    return aplicarPrivacidadDetalle(actor, detalle);
  },

  async auditoria(id: unknown) {
    const idDonacion = validarIdPositivo(id, 'la donación');
    if (!(await repo.existeDonacion(idDonacion))) throw new AppError('Donación no encontrada.', 404);
    return repo.auditoria(idDonacion);
  },

  // ============================ Modificar ================================
  async modificar(actor: ActorDonacion, id: unknown, body: unknown) {
    const b = cuerpo(body);
    const idDonacion = validarIdPositivo(id, 'la donación');
    await asegurarCuentaActiva(actor);

    const versionEsperada = Number(b.version);
    if (!Number.isInteger(versionEsperada)) {
      throw new AppError('Falta la versión de la donación. Recarga los datos e inténtalo de nuevo.', 400);
    }
    const catalogos = await repo.catalogos();

    const res = await conTransaccion(async (c) => {
      const actual = await repo.bloquearDonacion(c, idDonacion);
      if (!actual) throw new AppError('Donación no encontrada.', 404);
      if (actual.estado === 'ANULADA') {
        throw new AppError('La donación está anulada y no puede modificarse.', 409);
      }
      if (actual.estado === 'ASIGNADA_TOTAL') {
        throw new AppError('La donación está totalmente asignada y no puede modificarse.', 409);
      }
      if (actual.version !== versionEsperada) {
        throw new AppError(
          'Otro administrador modificó esta donación mientras la editabas. Recarga los datos e inténtalo de nuevo.',
          409
        );
      }

      const vencPrevio = actual.tipo_donacion === 'ALIMENTO' ? await repo.fechaVencimiento(c, idDonacion) : undefined;
      const datos = validarDonacion({ tipo_donacion: actual.tipo_donacion, ...b }, catalogos, {
        tipoFijo: actual.tipo_donacion,
        vencimientoPrevio: vencPrevio,
      });
      if (datos.campana_id !== actual.campana_id) await validarCampana(datos.campana_id);

      const asignada = await repo.sumaAsignadaActiva(c, idDonacion);
      if (Math.round(datos.cantidad * 100) < Math.round(Math.max(asignada, actual.cantidad_recibida) * 100)) {
        throw new AppError(
          `La nueva cantidad no puede ser menor a lo recibido o asignado. Cantidad mínima permitida: ${formato(Math.max(asignada, actual.cantidad_recibida))}.`,
          400
        );
      }

      const antes = await repo.snapshot(c, idDonacion);
      if (asignada > 0 && antes) {
        const unidadCambio =
          datos.unidad_medida_id !== undefined && Number(antes.unidad_medida_id) !== datos.unidad_medida_id;
        const monedaCambio =
          datos.moneda_codigo !== undefined && String(antes.moneda_codigo ?? '').trim() !== datos.moneda_codigo;
        if (unidadCambio || monedaCambio) {
          throw new AppError(
            'No se puede cambiar la unidad o la moneda de una donación con asignaciones activas.',
            400
          );
        }
      }

      await repo.actualizarDonacion(c, idDonacion, {
        cantidad: datos.cantidad,
        descripcion: datos.descripcion,
        campana_id: datos.campana_id,
        estado: estadoSegunAsignacion(datos.cantidad, asignada),
      });
      await repo.actualizarDetalle(c, idDonacion, datos);

      await repo.registrarAuditoria(c, {
        donacion_id: idDonacion,
        entidad_tipo: 'DONACION',
        entidad_id: idDonacion,
        usuario_id: actor.id_usuario,
        accion: 'MODIFICAR',
        datos_anteriores: antes,
        datos_nuevos: await repo.snapshot(c, idDonacion),
      });

      return { codigo: actual.codigo, donanteId: actual.donante_usuario_id, datos };
    });

    const donante = await repo.obtenerDonante(res.donanteId);
    if (donante) {
      donacionNotificador.modificada({
        codigo: res.codigo,
        resumen: resumenDe(res.datos, catalogos),
        donanteNombre: `${donante.nombre} ${donante.apellido}`,
        donanteCorreo: donante.correo,
      });
    }
    return { mensaje: 'Donación actualizada con éxito' };
  },

  // ============================ Anular ===================================
  async anular(actor: ActorDonacion, id: unknown, body: unknown) {
    const idDonacion = validarIdPositivo(id, 'la donación');
    const motivo = validarMotivo(cuerpo(body).motivo, 'motivo de anulación');
    await asegurarCuentaActiva(actor);

    const res = await conTransaccion(async (c) => {
      const actual = await repo.bloquearDonacion(c, idDonacion);
      if (!actual) throw new AppError('Donación no encontrada.', 404);
      if (actual.estado === 'ANULADA') throw new AppError('La donación ya fue anulada.', 409);
      if ((await repo.sumaAsignadaActiva(c, idDonacion)) > 0) {
        throw new AppError(
          'La donación tiene asignaciones activas y no puede anularse. Cancela primero las asignaciones.',
          409
        );
      }
      if (actual.cantidad_recibida > 0) {
        throw new AppError(
          'La donación ya tiene recursos recibidos. Antes de anularla debe existir un proceso de devolución o disposición de inventario.',
          409
        );
      }

      const antes = await repo.snapshot(c, idDonacion);
      await repo.anularDonacion(c, idDonacion, motivo, actor.id_usuario);
      await repo.anularComprobantes(c, idDonacion);
      await repo.registrarAuditoria(c, {
        donacion_id: idDonacion,
        entidad_tipo: 'DONACION',
        entidad_id: idDonacion,
        usuario_id: actor.id_usuario,
        accion: 'ANULAR',
        datos_anteriores: antes,
        datos_nuevos: await repo.snapshot(c, idDonacion),
        motivo,
      });
      return { codigo: actual.codigo, donanteId: actual.donante_usuario_id };
    });

    const donante = await repo.obtenerDonante(res.donanteId);
    if (donante) {
      donacionNotificador.anulada({
        codigo: res.codigo,
        resumen: '',
        motivo,
        donanteNombre: `${donante.nombre} ${donante.apellido}`,
        donanteCorreo: donante.correo,
      });
    }
    return { mensaje: 'Donación anulada con éxito' };
  },

  // ============================ Asignaciones =============================
  /** Donaciones con saldo disponible y no vencidas (para el panel de asignación). */
  async asignables(query: unknown, actor: ActorDonacion): Promise<Paginado<DonacionListaItem>> {
    const filtros = validarFiltrosDonacion(cuerpo(query));
    return repo.listar(actor, { ...filtros, asignables: true, hoy: fechaHoyBolivia() });
  },

  /** Registra la recepción verificada. Solo la cantidad aceptada pasa a estar disponible. */
  async registrarRecepcion(actor: ActorDonacion, id: unknown, body: unknown) {
    if (actor.rol !== 'Administrador') throw new AppError('Solo un administrador puede confirmar recepciones en esta versión.', 403);
    const idDonacion = validarIdPositivo(id, 'la donación');
    await asegurarCuentaActiva(actor);
    const b = cuerpo(body);
    const declarada = Number(b.cantidad_declarada);
    const aceptada = Number(b.cantidad_aceptada);
    if (!Number.isFinite(declarada) || declarada <= 0 || !Number.isFinite(aceptada) || aceptada < 0 || aceptada > declarada) {
      throw new AppError('La cantidad declarada debe ser positiva y la aceptada debe estar entre cero y la declarada.', 400);
    }
    const observaciones = typeof b.observaciones === 'string' ? b.observaciones.trim().slice(0,1000) : null;
    const motivo = typeof b.motivo_rechazo === 'string' ? b.motivo_rechazo.trim().slice(0,500) : null;
    if (aceptada < declarada && !motivo) throw new AppError('Indica el motivo del rechazo parcial o total.', 400);
    const metodo = typeof b.metodo_pago === 'string' ? b.metodo_pago : null;
    const referencia = typeof b.referencia === 'string' ? b.referencia.trim().slice(0,120) : null;

    const resultado = await conTransaccion(async (c) => {
      const don = await repo.bloquearDonacion(c, idDonacion);
      if (!don) throw new AppError('Donación no encontrada.', 404);
      if (don.estado === 'ANULADA') throw new AppError('No se puede recibir una donación anulada.', 409);
      const tipo = don.tipo_donacion === 'ECONOMICO' ? 'DINERO' : 'BIEN';
      if (tipo === 'DINERO' && (!metodo || !['EFECTIVO','TRANSFERENCIA','DEPOSITO','QR'].includes(metodo))) {
        throw new AppError('Selecciona un método de pago válido para confirmar el dinero recibido.', 400);
      }
      if (tipo === 'BIEN' && metodo) throw new AppError('No corresponde un método de pago para una recepción de bienes.', 400);
      if (tipo === 'BIEN' && (!Number.isInteger(declarada) || !Number.isInteger(aceptada)) && !(await repo.permiteDecimales(c, idDonacion))) {
        throw new AppError('La unidad de medida de esta donación no admite cantidades decimales.', 400);
      }
      if (tipo === 'DINERO' && metodo !== 'EFECTIVO' && !referencia) throw new AppError('Para transferencias, depósitos o QR debes registrar una referencia de pago.', 400);
      const pendienteCompromiso = redondear2(don.cantidad - don.cantidad_recibida);
      if (Math.round(declarada * 100) > Math.round(pendienteCompromiso * 100) || Math.round((don.cantidad_recibida + aceptada) * 100) > Math.round(don.cantidad * 100)) {
        throw new AppError(`La cantidad declarada supera el compromiso pendiente (${formato(pendienteCompromiso)}).`, 409);
      }
      const estado = aceptada === 0 ? 'RECHAZADA' : aceptada < declarada ? 'PARCIAL' : 'ACEPTADA';
      const idRecepcion = await repo.insertarRecepcion(c, {
        donacion_id: idDonacion, tipo_recepcion: tipo, cantidad_declarada: declarada, cantidad_aceptada: aceptada,
        metodo_pago: metodo, referencia, usuario_id: actor.id_usuario, estado, observaciones, motivo_rechazo: motivo,
      });
      if (aceptada > 0) await repo.incrementarCantidadRecibida(c, idDonacion, aceptada);
      await repo.registrarAuditoria(c, {
        donacion_id: idDonacion, entidad_tipo: 'RECEPCION', entidad_id: idRecepcion, usuario_id: actor.id_usuario,
        accion: estado, datos_anteriores: { cantidad_recibida: don.cantidad_recibida },
        datos_nuevos: { cantidad_declarada: declarada, cantidad_aceptada: aceptada, cantidad_recibida: redondear2(don.cantidad_recibida + aceptada), estado, motivo_rechazo: motivo }, motivo: motivo,
      });
      return { id_recepcion: idRecepcion, cantidad_recibida: redondear2(don.cantidad_recibida + aceptada), cantidad_disponible: redondear2(don.cantidad_recibida + aceptada - await repo.sumaAsignadaActiva(c, idDonacion)), estado };
    });
    return { mensaje: resultado.estado === 'RECHAZADA' ? 'Recepción rechazada; no se agregó saldo.' : 'Recepción registrada y verificada.', ...resultado };
  },

  async asignar(actor: ActorDonacion, id: unknown, body: unknown) {
    const idDonacion = validarIdPositivo(id, 'la donación');
    const datos = validarAsignacion(cuerpo(body));
    await asegurarCuentaActiva(actor);
    if (!(await repo.existeAdministrador(actor.id_usuario))) {
      throw new AppError('Tu cuenta no tiene perfil de administrador.', 403);
    }

    if (datos.solicitud_ayuda_id !== null && !(await solicitudesIntegracion.estaAprobada(datos.solicitud_ayuda_id))) {
      throw new AppError(
        'No se puede asignar: la solicitud de ayuda indicada no existe o no está aprobada.',
        400
      );
    }

    const benef = await repo.obtenerBeneficiario(datos.beneficiario_usuario_id);
    if (!benef) throw new AppError('El beneficiario seleccionado no existe.', 404);
    if (benef.estado_cuenta !== 'Activo') {
      throw new AppError('La cuenta del beneficiario no está activa.', 400);
    }
    if (benef.estado_beneficiario !== 'Verificado') {
      throw new AppError('El beneficiario aún no está verificado. Solo se asigna a beneficiarios verificados.', 400);
    }

    const res = await conTransaccion(async (c) => {
      const don = await repo.bloquearDonacion(c, idDonacion);
      if (!don) throw new AppError('Donación no encontrada.', 404);
      if (don.estado === 'ANULADA') throw new AppError('La donación está anulada y no puede asignarse.', 409);

      if (don.tipo_donacion === 'ALIMENTO') {
        const venc = await repo.fechaVencimiento(c, idDonacion);
        if (venc && venc < fechaHoyBolivia()) {
          throw new AppError('El alimento está vencido y no puede asignarse.', 400);
        }
      }

      const asignada = await repo.sumaAsignadaActiva(c, idDonacion);
      const saldo = redondear2(don.cantidad_recibida - asignada);
      if (saldo <= 0) throw new AppError('La donación no tiene saldo disponible.', 409);

      if (!Number.isInteger(datos.cantidad) && !(await repo.permiteDecimales(c, idDonacion))) {
        throw new AppError('La unidad de medida de esta donación no admite cantidades decimales.', 400);
      }
      if (Math.round(datos.cantidad * 100) > Math.round(saldo * 100)) {
        throw new AppError(
          `La cantidad excede el saldo disponible (${formato(saldo)}). Actualiza la lista e inténtalo de nuevo.`,
          409
        );
      }

      const idAsignacion = await repo.insertarAsignacion(c, {
        donacion_id: idDonacion,
        beneficiario_usuario_id: datos.beneficiario_usuario_id,
        solicitud_ayuda_id: datos.solicitud_ayuda_id,
        cantidad: datos.cantidad,
        administrador_usuario_id: actor.id_usuario,
        observaciones: datos.observaciones,
      });
      const nuevoEstado = estadoSegunAsignacion(don.cantidad, redondear2(asignada + datos.cantidad));
      await repo.actualizarEstado(c, idDonacion, nuevoEstado);

      await repo.registrarAuditoria(c, {
        donacion_id: idDonacion,
        entidad_tipo: 'ASIGNACION',
        entidad_id: idAsignacion,
        usuario_id: actor.id_usuario,
        accion: 'ASIGNAR',
        datos_anteriores: { estado: don.estado, saldo },
        datos_nuevos: {
          estado: nuevoEstado,
          saldo: redondear2(saldo - datos.cantidad),
          cantidad: datos.cantidad,
          beneficiario_usuario_id: datos.beneficiario_usuario_id,
          solicitud_ayuda_id: datos.solicitud_ayuda_id,
        },
      });

      return { idAsignacion, don, nuevoEstado, saldoRestante: redondear2(saldo - datos.cantidad) };
    });

    const donante = await repo.obtenerDonante(res.don.donante_usuario_id);
    if (donante) {
      donacionNotificador.asignada({
        codigo: res.don.codigo,
        resumen: '',
        cantidadAsignada: formato(datos.cantidad),
        donanteNombre: `${donante.nombre} ${donante.apellido}`,
        donanteCorreo: donante.correo,
        beneficiarioNombre: `${benef.nombre} ${benef.apellido}`,
        beneficiarioCorreo: benef.correo,
      });
    }

    return {
      mensaje: 'Donación asignada con éxito',
      asignacion: { id_asignacion: res.idAsignacion },
      estado_donacion: res.nuevoEstado,
      saldo_restante: res.saldoRestante,
    };
  },

  async cancelarAsignacion(actor: ActorDonacion, idAsignacion: unknown, body: unknown) {
    const id = validarIdPositivo(idAsignacion, 'la asignación');
    const motivo = validarMotivo(cuerpo(body).motivo, 'motivo de cancelación');
    await asegurarCuentaActiva(actor);

    return conTransaccion(async (c) => {
      // Orden de bloqueo fijo (donación → asignación) para evitar interbloqueos.
      const donacionId = await repo.donacionDeAsignacion(c, id);
      if (donacionId === null) throw new AppError('Asignación no encontrada.', 404);
      const don = await repo.bloquearDonacion(c, donacionId);
      if (!don) throw new AppError('Donación no encontrada.', 404);
      const asig = await repo.bloquearAsignacion(c, id);
      if (!asig) throw new AppError('Asignación no encontrada.', 404);
      if (asig.estado === 'CANCELADA') throw new AppError('La asignación ya fue cancelada.', 409);
      const entregado = await repo.cantidadEntregadaAsignacion(c, id);
      if (entregado > 0) {
        throw new AppError('No se puede cancelar una asignación que ya tiene entregas registradas. Primero debe anularse cada salida correspondiente.', 409);
      }

      await repo.cancelarAsignacion(c, id, motivo, actor.id_usuario);
      const asignada = await repo.sumaAsignadaActiva(c, donacionId);
      const nuevoEstado = estadoSegunAsignacion(don.cantidad, asignada);
      await repo.actualizarEstado(c, donacionId, nuevoEstado);

      await repo.registrarAuditoria(c, {
        donacion_id: donacionId,
        entidad_tipo: 'ASIGNACION',
        entidad_id: id,
        usuario_id: actor.id_usuario,
        accion: 'CANCELAR_ASIGNACION',
        datos_anteriores: { estado: asig.estado, cantidad: asig.cantidad, estado_donacion: don.estado },
        datos_nuevos: { estado: 'CANCELADA', estado_donacion: nuevoEstado },
        motivo,
      });

      return { mensaje: 'Asignación cancelada. El saldo volvió a estar disponible.', estado_donacion: nuevoEstado };
    });
  },

  async listarAsignaciones(query: unknown): Promise<Paginado<AsignacionItem>> {
    return repo.listarAsignaciones(validarFiltrosAsignacion(cuerpo(query)));
  },

  async entregasPendientes(): Promise<EntregaPendienteItem[]> {
    return repo.listarEntregasPendientes();
  },

  async historialEntregas() {
    return repo.listarHistorialEntregas();
  },

  async registrarEntrega(actor: ActorDonacion, body: unknown) {
    await asegurarCuentaActiva(actor);
    if (actor.rol !== 'Administrador' || !(await repo.existeAdministrador(actor.id_usuario))) {
      throw new AppError('Solo un administrador puede registrar entregas.', 403);
    }

    const b = cuerpo(body);
    const idAsignacion = validarIdPositivo(b.id_asignacion, 'la asignación');
    const cantidad = redondear2(Number(b.cantidad));
    const lugar = typeof b.lugar_entrega === 'string' ? b.lugar_entrega.trim() : '';
    const observaciones = typeof b.observaciones === 'string' ? b.observaciones.trim() : '';

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new AppError('La cantidad entregada debe ser mayor que cero.', 400);
    }
    if (!lugar || lugar.length > 180) {
      throw new AppError('Indica un lugar de entrega válido (máximo 180 caracteres).', 400);
    }
    if (observaciones.length > 2000) {
      throw new AppError('Las observaciones no pueden superar 2000 caracteres.', 400);
    }

    try {
      const idEntrega = await conTransaccion(async (c) =>
        repo.registrarEntrega(c, {
          id_asignacion: idAsignacion,
          cantidad,
          lugar_entrega: lugar,
          observaciones: observaciones || null,
          usuario_id: actor.id_usuario,
        })
      );
      return { mensaje: 'Entrega registrada correctamente.', id_entrega: idEntrega };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        error instanceof Error ? error.message : 'No se pudo registrar la entrega.',
        409
      );
    }
  },

  // ============================ Reportes =================================
  async reporte(actor: ActorDonacion, query: unknown): Promise<ReporteDonaciones> {
    const filtros = { ...validarFiltrosDonacion(cuerpo(query)), incluirAnuladas: false };
    const res = await repo.listar(actor, filtros, { maxFilas: MAX_FILAS_REPORTE });
    return {
      filas: res.items,
      resumen: construirResumen(res.items),
      truncado: res.total > MAX_FILAS_REPORTE,
      generado_en: new Date().toISOString(),
    };
  },
};

// ---------------------------------------------------------------------------
// Resumen del reporte. NUNCA se suman monedas ni unidades distintas.
// ---------------------------------------------------------------------------
const construirResumen = (filas: DonacionListaItem[]): ResumenReporte => {
  const porTipo = new Map<string, number>();
  const porEstado = new Map<string, number>();
  const eco = new Map<string, { registrado: number; asignado: number; saldo: number }>();
  const bienes = new Map<string, { tipo: 'ALIMENTO' | 'MATERIAL'; unidad: string; registrado: number; asignado: number; saldo: number }>();

  for (const f of filas) {
    porTipo.set(f.tipo_donacion, (porTipo.get(f.tipo_donacion) ?? 0) + 1);
    porEstado.set(f.estado, (porEstado.get(f.estado) ?? 0) + 1);

    const asignado = f.cantidad_asignada ?? 0;
    const saldo = f.saldo ?? f.cantidad - asignado;

    if (f.tipo_donacion === 'ECONOMICO') {
      const k = (f.unidad ?? 'BOB').trim();
      const acc = eco.get(k) ?? { registrado: 0, asignado: 0, saldo: 0 };
      acc.registrado += f.cantidad;
      acc.asignado += asignado;
      acc.saldo += saldo;
      eco.set(k, acc);
    } else {
      const unidad = f.unidad ?? '';
      const k = `${f.tipo_donacion}|${unidad}`;
      const acc = bienes.get(k) ?? {
        tipo: f.tipo_donacion as 'ALIMENTO' | 'MATERIAL',
        unidad,
        registrado: 0,
        asignado: 0,
        saldo: 0,
      };
      acc.registrado += f.cantidad;
      acc.asignado += asignado;
      acc.saldo += saldo;
      bienes.set(k, acc);
    }
  }

  return {
    total_donaciones: filas.length,
    por_tipo: [...porTipo].map(([tipo, n]) => ({ tipo: tipo as ResumenReporte['por_tipo'][number]['tipo'], cantidad_donaciones: n })),
    por_estado: [...porEstado].map(([estado, n]) => ({ estado: estado as EstadoDonacion, cantidad_donaciones: n })),
    economico: [...eco].map(([moneda, v]) => ({
      moneda,
      registrado: redondear2(v.registrado),
      asignado: redondear2(v.asignado),
      saldo: redondear2(v.saldo),
    })),
    bienes: [...bienes.values()].map((v) => ({
      ...v,
      registrado: redondear2(v.registrado),
      asignado: redondear2(v.asignado),
      saldo: redondear2(v.saldo),
    })),
  };
};
