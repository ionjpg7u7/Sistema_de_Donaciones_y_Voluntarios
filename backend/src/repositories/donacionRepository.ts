// src/repositories/donacionRepository.ts
// ============================================================================
// CAPA: Acceso a datos (PostgreSQL · SQL puro, parametrizado).
// Único lugar donde se ejecuta SQL del módulo Gestión de Donaciones.
// De las tablas de Usuarios solo se hacen SELECT (nunca INSERT/UPDATE/DELETE).
// ============================================================================
import type { PoolClient } from 'pg';
import { pool } from '../config/database';
import { ESTADOS_MATERIAL, METODOS_PAGO, MONEDAS, TIPOS_DONACION, ESTADOS_DONACION } from '../models/donacionModel';
import type {
  ActorDonacion,
  AsignacionItem,
  AuditoriaItem,
  BeneficiarioAsignable,
  CatalogosDonacion,
  ComprobanteItem,
  DonacionDetalle,
  DonacionListaItem,
  DonacionNormalizada,
  EntregaPendienteItem,
  DonanteBusqueda,
  EstadoDonacion,
  FiltrosAsignacion,
  FiltrosDonacion,
  Modalidad,
  Paginado,
  TipoDonacion,
} from '../models/donacionModel';

type Db = Pick<PoolClient, 'query'>;
const db = (client?: Db): Db => client ?? pool;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Hora de Bolivia como timestamp sin zona (convención de todo el módulo). */
const AHORA = `(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')`;
/** Timestamp sin zona → texto ISO local (evita que Node lo reinterprete). */
const TS = (col: string): string => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS')`;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const numReq = (v: unknown): number => Number(v ?? 0);

export const conTransaccion = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('⚠️  Error en ROLLBACK de donaciones:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Fragmentos SQL compartidos
// ---------------------------------------------------------------------------
const FROM_BASE = `
  FROM donacion d
  JOIN usuario ud ON ud.id_usuario = d.donante_usuario_id
  LEFT JOIN detalle_alimento  da  ON da.id_donacion = d.id_donacion
  LEFT JOIN detalle_material  dm  ON dm.id_donacion = d.id_donacion
  LEFT JOIN detalle_economico de  ON de.id_donacion = d.id_donacion
  LEFT JOIN donacion_categoria cat ON cat.id_categoria = COALESCE(da.categoria_id, dm.categoria_id)
  LEFT JOIN unidad_medida um       ON um.id_unidad     = COALESCE(da.unidad_medida_id, dm.unidad_medida_id)
  LEFT JOIN campana c              ON c.id_campana     = d.campana_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(a.cantidad), 0) AS asignada
      FROM asignacion_donacion a
     WHERE a.donacion_id = d.id_donacion AND a.estado = 'ACTIVA'
  ) asg ON TRUE
`;

// $1 es SIEMPRE el id del actor autenticado.
const COLS_LISTA = `
  d.id_donacion, d.codigo, d.tipo_donacion, d.modalidad, d.cantidad, d.cantidad_recibida,
  COALESCE(um.codigo, de.moneda_codigo) AS unidad,
  cat.nombre AS categoria,
  d.descripcion, ${TS('d.fecha_donacion')} AS fecha_donacion,
  d.campana_id, c.nombre AS campana_nombre, d.estado, d.version,
  d.donante_usuario_id, (ud.nombre || ' ' || ud.apellido) AS donante_nombre,
  d.voluntario_usuario_id,
  asg.asignada AS cantidad_asignada,
  (d.cantidad_recibida - asg.asignada) AS saldo,
  (SELECT SUM(x.cantidad) FROM asignacion_donacion x
    WHERE x.donacion_id = d.id_donacion AND x.beneficiario_usuario_id = $1 AND x.estado = 'ACTIVA') AS cantidad_beneficiario
`;

const FROM_DETALLE = `
  ${FROM_BASE}
  LEFT JOIN usuario ur ON ur.id_usuario = d.registrado_por_usuario_id
  LEFT JOIN usuario uv ON uv.id_usuario = d.voluntario_usuario_id
`;

const COLS_DETALLE = `
  ${COLS_LISTA},
  d.registrado_por_usuario_id, (ur.nombre || ' ' || ur.apellido) AS registrado_por_nombre,
  (uv.nombre || ' ' || uv.apellido) AS voluntario_nombre,
  d.motivo_anulacion, ${TS('d.fecha_anulacion')} AS fecha_anulacion,
  COALESCE(da.categoria_id, dm.categoria_id) AS categoria_id,
  COALESCE(da.nombre_producto, dm.nombre_material) AS nombre_item,
  COALESCE(da.unidad_medida_id, dm.unidad_medida_id) AS unidad_medida_id,
  um.nombre AS unidad_nombre,
  to_char(da.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
  dm.estado_material,
  de.monto, de.moneda_codigo, de.metodo_pago, de.referencia_pago
`;

/** Restringe lo que cada rol puede ver. Usa $1 = id del actor. */
const condicionAlcance = (rol: ActorDonacion['rol']): string | null => {
  switch (rol) {
    case 'Administrador':
      return null;
    case 'Donante':
      return 'd.donante_usuario_id = $1';
    case 'Voluntario':
      return 'd.voluntario_usuario_id = $1';
    case 'Beneficiario':
      return `EXISTS (SELECT 1 FROM asignacion_donacion s
                       WHERE s.donacion_id = d.id_donacion
                         AND s.beneficiario_usuario_id = $1 AND s.estado = 'ACTIVA')`;
    default:
      return 'FALSE';
  }
};

const construirWhere = (actor: ActorDonacion, f: FiltrosDonacion): { where: string; params: unknown[] } => {
  const params: unknown[] = [actor.id_usuario];
  const cond: string[] = [];
  const add = (v: unknown): string => {
    params.push(v);
    return `$${params.length}`;
  };

  const alcance = condicionAlcance(actor.rol);
  if (alcance) cond.push(alcance);

  if (f.desde) cond.push(`d.fecha_donacion >= ${add(f.desde)}::date`);
  if (f.hasta) cond.push(`d.fecha_donacion < (${add(f.hasta)}::date + INTERVAL '1 day')`);
  if (f.tipo) cond.push(`d.tipo_donacion = ${add(f.tipo)}`);
  if (f.campana_id) cond.push(`d.campana_id = ${add(f.campana_id)}`);
  if (f.donante_id) cond.push(`d.donante_usuario_id = ${add(f.donante_id)}`);
  if (f.voluntario_id) cond.push(`d.voluntario_usuario_id = ${add(f.voluntario_id)}`);

  if (f.estado) cond.push(`d.estado = ${add(f.estado)}`);
  else if (f.incluirAnuladas === false) cond.push(`d.estado <> 'ANULADA'`);

  if (f.asignables) {
    cond.push(`d.estado IN ('REGISTRADA', 'ASIGNADA_PARCIAL')`);
    cond.push(`(d.cantidad_recibida - asg.asignada) > 0`);
    if (f.hoy) cond.push(`(da.id_donacion IS NULL OR da.fecha_vencimiento >= ${add(f.hoy)}::date)`);
  }

  if (f.q) {
    const p = add(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
    if (actor.rol === 'Administrador' || actor.rol === 'Voluntario') {
      cond.push(`(d.codigo ILIKE ${p} OR d.descripcion ILIKE ${p} OR ud.nombre ILIKE ${p}
                  OR ud.apellido ILIKE ${p} OR (ud.nombre || ' ' || ud.apellido) ILIKE ${p} OR ud.correo ILIKE ${p})`);
    } else if (actor.rol === 'Donante') {
      cond.push(`(d.codigo ILIKE ${p} OR d.descripcion ILIKE ${p})`);
    } else {
      cond.push(`d.codigo ILIKE ${p}`);
    }
  }

  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
};

// ---------------------------------------------------------------------------
// Mapeo de filas
// ---------------------------------------------------------------------------
type Fila = Record<string, unknown>;

const mapearLista = (r: Fila): DonacionListaItem => ({
  id_donacion: Number(r.id_donacion),
  codigo: String(r.codigo),
  tipo_donacion: r.tipo_donacion as TipoDonacion,
  modalidad: r.modalidad as Modalidad,
  cantidad: numReq(r.cantidad),
  cantidad_recibida: numReq(r.cantidad_recibida),
  unidad: (r.unidad as string | null) ?? null,
  categoria: (r.categoria as string | null) ?? null,
  descripcion: (r.descripcion as string | null) ?? null,
  fecha_donacion: String(r.fecha_donacion),
  campana_id: num(r.campana_id),
  estado: r.estado as EstadoDonacion,
  version: Number(r.version),
  donante_usuario_id: num(r.donante_usuario_id),
  donante_nombre: (r.donante_nombre as string | null) ?? null,
  voluntario_usuario_id: num(r.voluntario_usuario_id),
  cantidad_asignada: num(r.cantidad_asignada),
  saldo: num(r.saldo),
  cantidad_beneficiario: num(r.cantidad_beneficiario),
});

const mapearAsignacion = (r: Fila): AsignacionItem => ({
  id_asignacion: Number(r.id_asignacion),
  donacion_id: Number(r.donacion_id),
  donacion_codigo: String(r.donacion_codigo),
  tipo_donacion: r.tipo_donacion as TipoDonacion,
  unidad: (r.unidad as string | null) ?? null,
  beneficiario_usuario_id: Number(r.beneficiario_usuario_id),
  beneficiario_nombre: String(r.beneficiario_nombre),
  solicitud_ayuda_id: num(r.solicitud_ayuda_id),
  cantidad: numReq(r.cantidad),
  fecha_asignacion: String(r.fecha_asignacion),
  estado: r.estado as AsignacionItem['estado'],
  observaciones: (r.observaciones as string | null) ?? null,
  motivo_cancelacion: (r.motivo_cancelacion as string | null) ?? null,
  fecha_cancelacion: (r.fecha_cancelacion as string | null) ?? null,
});

// ---------------------------------------------------------------------------
// Repositorio
// ---------------------------------------------------------------------------
export const donacionRepository = {
  // ========================= Catálogos / lookups =========================
  async catalogos(): Promise<CatalogosDonacion> {
    const [cats, unis] = await Promise.all([
      pool.query(
        `SELECT id_categoria, nombre, tipo FROM donacion_categoria WHERE activa ORDER BY tipo, nombre`
      ),
      pool.query(
        `SELECT id_unidad, codigo, nombre, permite_decimales FROM unidad_medida WHERE activa ORDER BY id_unidad`
      ),
    ]);
    return {
      categorias: cats.rows,
      unidades: unis.rows,
      monedas: MONEDAS,
      metodos_pago: METODOS_PAGO,
      estados_material: ESTADOS_MATERIAL,
      tipos_donacion: TIPOS_DONACION,
      estados_donacion: ESTADOS_DONACION,
    };
  },

  async obtenerUsuario(
    id: number,
    client?: Db
  ): Promise<{ estado: string; nombre: string; apellido: string; correo: string } | null> {
    const r = await db(client).query(
      `SELECT estado, nombre, apellido, correo FROM usuario WHERE id_usuario = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  async obtenerDonante(id: number, client?: Db): Promise<DonanteBusqueda | null> {
    const r = await db(client).query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.estado
         FROM donante dn JOIN usuario u ON u.id_usuario = dn.id_usuario
        WHERE dn.id_usuario = $1 AND u.estado <> 'Eliminado'`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  async buscarDonantes(q: string): Promise<DonanteBusqueda[]> {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const r = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.estado
         FROM donante dn JOIN usuario u ON u.id_usuario = dn.id_usuario
        WHERE u.estado <> 'Eliminado'
          AND (u.correo ILIKE $1 OR u.nombre ILIKE $1 OR u.apellido ILIKE $1
               OR (u.nombre || ' ' || u.apellido) ILIKE $1 OR u.telefono = $2)
        ORDER BY u.nombre, u.apellido
        LIMIT 10`,
      [like, q]
    );
    return r.rows;
  },

  async existeAdministrador(id: number, client?: Db): Promise<boolean> {
    const r = await db(client).query(`SELECT 1 FROM administrador WHERE id_usuario = $1`, [id]);
    return r.rowCount === 1;
  },

  async existeVoluntario(id: number, client?: Db): Promise<boolean> {
    const r = await db(client).query(`SELECT 1 FROM voluntario WHERE id_usuario = $1`, [id]);
    return r.rowCount === 1;
  },

  async obtenerBeneficiario(
    id: number,
    client?: Db
  ): Promise<{
    id_usuario: number;
    nombre: string;
    apellido: string;
    correo: string;
    estado_cuenta: string;
    estado_beneficiario: string;
  } | null> {
    const r = await db(client).query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.estado AS estado_cuenta,
              b.estado AS estado_beneficiario
         FROM beneficiario b JOIN usuario u ON u.id_usuario = b.id_usuario
        WHERE b.id_usuario = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  },

  async beneficiariosAsignables(): Promise<BeneficiarioAsignable[]> {
    const r = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, b.tipo_beneficiario, b.necesidad
         FROM beneficiario b JOIN usuario u ON u.id_usuario = b.id_usuario
        WHERE b.estado = 'Verificado' AND u.estado = 'Activo'
        ORDER BY u.nombre, u.apellido`
    );
    return r.rows;
  },

  async correosAdministradores(): Promise<string[]> {
    const r = await pool.query(
      `SELECT u.correo FROM administrador a JOIN usuario u ON u.id_usuario = a.id_usuario
        WHERE u.estado = 'Activo'`
    );
    return r.rows.map((x: { correo: string }) => x.correo);
  },

  // ========================= Consultas de donaciones =====================
  async listar(
    actor: ActorDonacion,
    filtros: FiltrosDonacion,
    opciones: { maxFilas?: number } = {}
  ): Promise<Paginado<DonacionListaItem>> {
    const { where, params } = construirWhere(actor, filtros);
    const limit = opciones.maxFilas ?? filtros.limit ?? 10;
    const page = opciones.maxFilas ? 1 : filtros.page ?? 1;
    params.push(limit, (page - 1) * limit);

    const r = await pool.query(
      `SELECT ${COLS_LISTA}, COUNT(*) OVER() AS total_filas
         ${FROM_BASE}
         ${where}
        ORDER BY d.fecha_donacion DESC, d.id_donacion DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      items: r.rows.map(mapearLista),
      total: r.rows.length ? Number(r.rows[0].total_filas) : 0,
      page,
      limit,
    };
  },

  /** Detalle con alcance por rol: si el actor no lo puede ver, devuelve null (404). */
  async obtenerDetalle(actor: ActorDonacion, id: number): Promise<DonacionDetalle | null> {
    const alcance = condicionAlcance(actor.rol);
    const r = await pool.query(
      `SELECT ${COLS_DETALLE}
         ${FROM_DETALLE}
        WHERE d.id_donacion = $2 ${alcance ? `AND ${alcance}` : ''}`,
      [actor.id_usuario, id]
    );
    if (r.rowCount === 0) return null;
    const f = r.rows[0] as Fila;

    const [asig, comp] = await Promise.all([
      this.asignacionesDeDonacion(id, actor.rol === 'Beneficiario' ? actor.id_usuario : undefined),
      this.comprobanteDeDonacion(id),
    ]);

    return {
      ...mapearLista(f),
      registrado_por_usuario_id: num(f.registrado_por_usuario_id),
      registrado_por_nombre: (f.registrado_por_nombre as string | null) ?? null,
      voluntario_nombre: (f.voluntario_nombre as string | null) ?? null,
      motivo_anulacion: (f.motivo_anulacion as string | null) ?? null,
      fecha_anulacion: (f.fecha_anulacion as string | null) ?? null,
      categoria_id: num(f.categoria_id),
      nombre_item: (f.nombre_item as string | null) ?? null,
      unidad_medida_id: num(f.unidad_medida_id),
      unidad_nombre: (f.unidad_nombre as string | null) ?? null,
      fecha_vencimiento: (f.fecha_vencimiento as string | null) ?? null,
      estado_material: (f.estado_material as DonacionDetalle['estado_material']) ?? null,
      monto: num(f.monto),
      moneda_codigo: ((f.moneda_codigo as string | null)?.trim() as DonacionDetalle['moneda_codigo']) ?? null,
      metodo_pago: (f.metodo_pago as DonacionDetalle['metodo_pago']) ?? null,
      referencia_pago: (f.referencia_pago as string | null) ?? null,
      asignaciones: asig,
      comprobante: comp,
    };
  },

  async asignacionesDeDonacion(donacionId: number, soloBeneficiarioId?: number): Promise<AsignacionItem[]> {
    const params: unknown[] = [donacionId];
    let extra = '';
    if (soloBeneficiarioId) {
      params.push(soloBeneficiarioId);
      extra = 'AND a.beneficiario_usuario_id = $2 AND a.estado = \'ACTIVA\'';
    }
    const r = await pool.query(
      `${SELECT_ASIGNACION} WHERE a.donacion_id = $1 ${extra}
        ORDER BY a.fecha_asignacion DESC, a.id_asignacion DESC`,
      params
    );
    return r.rows.map(mapearAsignacion);
  },

  async comprobanteDeDonacion(donacionId: number): Promise<ComprobanteItem | null> {
    const r = await pool.query(
      `SELECT id_comprobante, numero_comprobante, tipo, ${TS('fecha_emision')} AS fecha_emision, estado
         FROM comprobante_donacion WHERE donacion_id = $1 ORDER BY id_comprobante DESC LIMIT 1`,
      [donacionId]
    );
    return r.rows[0] ?? null;
  },

  async auditoria(donacionId: number): Promise<AuditoriaItem[]> {
    const r = await pool.query(
      `SELECT x.id_auditoria, x.entidad_tipo, x.entidad_id, x.usuario_id,
              (u.nombre || ' ' || u.apellido) AS usuario_nombre, x.accion,
              x.datos_anteriores, x.datos_nuevos, x.motivo, ${TS('x.fecha_hora')} AS fecha_hora
         FROM auditoria_donacion x JOIN usuario u ON u.id_usuario = x.usuario_id
        WHERE x.donacion_id = $1
        ORDER BY x.fecha_hora DESC, x.id_auditoria DESC`,
      [donacionId]
    );
    return r.rows.map((x: Fila) => ({
      ...(x as unknown as AuditoriaItem),
      id_auditoria: Number(x.id_auditoria),
    }));
  },

  async existeDonacion(id: number): Promise<boolean> {
    const r = await pool.query(`SELECT 1 FROM donacion WHERE id_donacion = $1`, [id]);
    return r.rowCount === 1;
  },

  // ========================= Asignaciones (consulta) =====================
  async listarAsignaciones(f: FiltrosAsignacion): Promise<Paginado<AsignacionItem>> {
    const params: unknown[] = [];
    const cond: string[] = [];
    const add = (v: unknown): string => {
      params.push(v);
      return `$${params.length}`;
    };
    if (f.estado) cond.push(`a.estado = ${add(f.estado)}`);
    if (f.q) {
      const p = add(`%${f.q.replace(/[\\%_]/g, '\\$&')}%`);
      cond.push(`(d.codigo ILIKE ${p} OR (ub.nombre || ' ' || ub.apellido) ILIKE ${p})`);
    }
    const limit = f.limit ?? 10;
    const page = f.page ?? 1;
    params.push(limit, (page - 1) * limit);

    const r = await pool.query(
      `${SELECT_ASIGNACION.replace('FROM asignacion_donacion a', ', COUNT(*) OVER() AS total_filas FROM asignacion_donacion a')}
        ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
        ORDER BY a.fecha_asignacion DESC, a.id_asignacion DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      items: r.rows.map(mapearAsignacion),
      total: r.rows.length ? Number(r.rows[0].total_filas) : 0,
      page,
      limit,
    };
  },

  // ========================= Escrituras (siempre con client) =============
  async bloquearDonacion(
    client: Db,
    id: number
  ): Promise<{
    id_donacion: number;
    codigo: string;
    estado: EstadoDonacion;
    cantidad: number;
    cantidad_recibida: number;
    version: number;
    tipo_donacion: TipoDonacion;
    donante_usuario_id: number;
    campana_id: number | null;
  } | null> {
    const r = await client.query(
      `SELECT id_donacion, codigo, estado, cantidad, cantidad_recibida, version, tipo_donacion, donante_usuario_id, campana_id
         FROM donacion WHERE id_donacion = $1 FOR UPDATE`,
      [id]
    );
    if (r.rowCount === 0) return null;
    const f = r.rows[0] as Fila;
    return {
      id_donacion: Number(f.id_donacion),
      codigo: String(f.codigo),
      estado: f.estado as EstadoDonacion,
      cantidad: numReq(f.cantidad),
      cantidad_recibida: numReq(f.cantidad_recibida),
      version: Number(f.version),
      tipo_donacion: f.tipo_donacion as TipoDonacion,
      donante_usuario_id: Number(f.donante_usuario_id),
      campana_id: num(f.campana_id),
    };
  },

  async insertarRecepcion(
    client: Db,
    p: { donacion_id: number; tipo_recepcion: 'DINERO' | 'BIEN'; cantidad_declarada: number; cantidad_aceptada: number; metodo_pago: string | null; referencia: string | null; usuario_id: number; estado: 'ACEPTADA' | 'PARCIAL' | 'RECHAZADA'; observaciones: string | null; motivo_rechazo: string | null }
  ): Promise<number> {
    const r = await client.query(
      `INSERT INTO donacion_recepciones
        (donacion_id, tipo_recepcion, cantidad_declarada, cantidad_aceptada, metodo_pago, referencia, recibido_por_usuario_id, estado, observaciones, motivo_rechazo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_recepcion`,
      [p.donacion_id,p.tipo_recepcion,p.cantidad_declarada,p.cantidad_aceptada,p.metodo_pago,p.referencia,p.usuario_id,p.estado,p.observaciones,p.motivo_rechazo]
    );
    return Number(r.rows[0].id_recepcion);
  },

  async incrementarCantidadRecibida(client: Db, donacionId: number, cantidad: number): Promise<void> {
    await client.query(
      `UPDATE donacion SET cantidad_recibida = cantidad_recibida + $2, version = version + 1, fecha_actualizacion = ${AHORA} WHERE id_donacion = $1`,
      [donacionId, cantidad]
    );
  },

  async sumaAsignadaActiva(client: Db, donacionId: number): Promise<number> {
    const r = await client.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
         FROM asignacion_donacion WHERE donacion_id = $1 AND estado = 'ACTIVA'`,
      [donacionId]
    );
    return numReq(r.rows[0].total);
  },

  async fechaVencimiento(client: Db, donacionId: number): Promise<string | null> {
    const r = await client.query(
      `SELECT to_char(fecha_vencimiento, 'YYYY-MM-DD') AS v FROM detalle_alimento WHERE id_donacion = $1`,
      [donacionId]
    );
    return r.rows[0]?.v ?? null;
  },

  /** ¿La unidad de la donación admite decimales? (económicas: siempre sí). */
  async permiteDecimales(client: Db, donacionId: number): Promise<boolean> {
    const r = await client.query(
      `SELECT COALESCE(um.permite_decimales, TRUE) AS ok
         FROM donacion d
         LEFT JOIN detalle_alimento da ON da.id_donacion = d.id_donacion
         LEFT JOIN detalle_material dm ON dm.id_donacion = d.id_donacion
         LEFT JOIN unidad_medida um ON um.id_unidad = COALESCE(da.unidad_medida_id, dm.unidad_medida_id)
        WHERE d.id_donacion = $1`,
      [donacionId]
    );
    return r.rows[0]?.ok === true;
  },

  async insertarDonacion(
    client: Db,
    p: {
      donante_usuario_id: number;
      registrado_por_usuario_id: number;
      voluntario_usuario_id: number | null;
      modalidad: Modalidad;
      datos: DonacionNormalizada;
    }
  ): Promise<{ id_donacion: number; codigo: string }> {
    const r = await client.query(
      `INSERT INTO donacion
         (codigo, donante_usuario_id, registrado_por_usuario_id, voluntario_usuario_id,
          tipo_donacion, modalidad, cantidad, descripcion, campana_id)
       VALUES (
         'DON-' || to_char(${AHORA}, 'YYYY') || '-' || lpad(nextval('donacion_codigo_seq')::text, 6, '0'),
         $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id_donacion, codigo`,
      [
        p.donante_usuario_id,
        p.registrado_por_usuario_id,
        p.voluntario_usuario_id,
        p.datos.tipo_donacion,
        p.modalidad,
        p.datos.cantidad,
        p.datos.descripcion,
        p.datos.campana_id,
      ]
    );
    return { id_donacion: Number(r.rows[0].id_donacion), codigo: String(r.rows[0].codigo) };
  },

  async insertarDetalle(client: Db, id: number, d: DonacionNormalizada): Promise<void> {
    if (d.tipo_donacion === 'ALIMENTO') {
      await client.query(
        `INSERT INTO detalle_alimento
           (id_donacion, categoria_id, nombre_producto, unidad_medida_id, fecha_vencimiento)
         VALUES ($1, $2, $3, $4, $5::date)`,
        [id, d.categoria_id, d.nombre_item, d.unidad_medida_id, d.fecha_vencimiento]
      );
    } else if (d.tipo_donacion === 'MATERIAL') {
      await client.query(
        `INSERT INTO detalle_material
           (id_donacion, categoria_id, nombre_material, estado_material, unidad_medida_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, d.categoria_id, d.nombre_item, d.estado_material, d.unidad_medida_id]
      );
    } else {
      await client.query(
        `INSERT INTO detalle_economico (id_donacion, monto, moneda_codigo, metodo_pago, referencia_pago)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, d.monto, d.moneda_codigo, d.metodo_pago, d.referencia_pago]
      );
    }
  },

  async actualizarDetalle(client: Db, id: number, d: DonacionNormalizada): Promise<void> {
    if (d.tipo_donacion === 'ALIMENTO') {
      await client.query(
        `UPDATE detalle_alimento
            SET categoria_id = $2, nombre_producto = $3, unidad_medida_id = $4, fecha_vencimiento = $5::date
          WHERE id_donacion = $1`,
        [id, d.categoria_id, d.nombre_item, d.unidad_medida_id, d.fecha_vencimiento]
      );
    } else if (d.tipo_donacion === 'MATERIAL') {
      await client.query(
        `UPDATE detalle_material
            SET categoria_id = $2, nombre_material = $3, estado_material = $4, unidad_medida_id = $5
          WHERE id_donacion = $1`,
        [id, d.categoria_id, d.nombre_item, d.estado_material, d.unidad_medida_id]
      );
    } else {
      await client.query(
        `UPDATE detalle_economico
            SET monto = $2, moneda_codigo = $3, metodo_pago = $4, referencia_pago = $5
          WHERE id_donacion = $1`,
        [id, d.monto, d.moneda_codigo, d.metodo_pago, d.referencia_pago]
      );
    }
  },

  async actualizarDonacion(
    client: Db,
    id: number,
    p: { cantidad: number; descripcion: string | null; campana_id: number | null; estado: EstadoDonacion }
  ): Promise<void> {
    await client.query(
      `UPDATE donacion
          SET cantidad = $2, descripcion = $3, campana_id = $4, estado = $5,
              version = version + 1, fecha_actualizacion = ${AHORA}
        WHERE id_donacion = $1`,
      [id, p.cantidad, p.descripcion, p.campana_id, p.estado]
    );
  },

  async actualizarEstado(client: Db, id: number, estado: EstadoDonacion): Promise<void> {
    await client.query(
      `UPDATE donacion SET estado = $2, version = version + 1, fecha_actualizacion = ${AHORA}
        WHERE id_donacion = $1`,
      [id, estado]
    );
  },

  async anularDonacion(client: Db, id: number, motivo: string, usuarioId: number): Promise<void> {
    await client.query(
      `UPDATE donacion
          SET estado = 'ANULADA', motivo_anulacion = $2, fecha_anulacion = ${AHORA},
              anulada_por_usuario_id = $3, version = version + 1, fecha_actualizacion = ${AHORA}
        WHERE id_donacion = $1`,
      [id, motivo, usuarioId]
    );
  },

  async insertarComprobante(
    client: Db,
    donacionId: number,
    emisorId: number
  ): Promise<ComprobanteItem> {
    const r = await client.query(
      `INSERT INTO comprobante_donacion (donacion_id, numero_comprobante, emitido_por_usuario_id)
       VALUES ($1,
         'CD-' || to_char(${AHORA}, 'YYYY') || '-' || lpad(nextval('comprobante_donacion_seq')::text, 6, '0'),
         $2)
       RETURNING id_comprobante, numero_comprobante, tipo, ${TS('fecha_emision')} AS fecha_emision, estado`,
      [donacionId, emisorId]
    );
    return r.rows[0];
  },

  async anularComprobantes(client: Db, donacionId: number): Promise<void> {
    await client.query(`UPDATE comprobante_donacion SET estado = 'ANULADO' WHERE donacion_id = $1`, [
      donacionId,
    ]);
  },

  async insertarAsignacion(
    client: Db,
    p: {
      donacion_id: number;
      beneficiario_usuario_id: number;
      solicitud_ayuda_id: number | null;
      cantidad: number;
      administrador_usuario_id: number;
      observaciones: string | null;
    }
  ): Promise<number> {
    const r = await client.query(
      `INSERT INTO asignacion_donacion
         (donacion_id, beneficiario_usuario_id, solicitud_ayuda_id, cantidad, administrador_usuario_id, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_asignacion`,
      [
        p.donacion_id,
        p.beneficiario_usuario_id,
        p.solicitud_ayuda_id,
        p.cantidad,
        p.administrador_usuario_id,
        p.observaciones,
      ]
    );
    return Number(r.rows[0].id_asignacion);
  },

  /** Devuelve el id de la donación dueña de la asignación (sin bloquear). */
  async donacionDeAsignacion(client: Db, idAsignacion: number): Promise<number | null> {
    const r = await client.query(`SELECT donacion_id FROM asignacion_donacion WHERE id_asignacion = $1`, [
      idAsignacion,
    ]);
    return r.rows[0] ? Number(r.rows[0].donacion_id) : null;
  },

  async bloquearAsignacion(
    client: Db,
    idAsignacion: number
  ): Promise<{
    id_asignacion: number;
    donacion_id: number;
    beneficiario_usuario_id: number;
    cantidad: number;
    estado: 'ACTIVA' | 'CANCELADA';
  } | null> {
    const r = await client.query(
      `SELECT id_asignacion, donacion_id, beneficiario_usuario_id, cantidad, estado
         FROM asignacion_donacion WHERE id_asignacion = $1 FOR UPDATE`,
      [idAsignacion]
    );
    if (r.rowCount === 0) return null;
    const f = r.rows[0] as Fila;
    return {
      id_asignacion: Number(f.id_asignacion),
      donacion_id: Number(f.donacion_id),
      beneficiario_usuario_id: Number(f.beneficiario_usuario_id),
      cantidad: numReq(f.cantidad),
      estado: f.estado as 'ACTIVA' | 'CANCELADA',
    };
  },

  // ========================= Entregas a beneficiarios ====================
  async listarEntregasPendientes(): Promise<EntregaPendienteItem[]> {
    const r = await pool.query(`
      SELECT
        a.id_asignacion,
        a.donacion_id,
        d.codigo AS donacion_codigo,
        a.beneficiario_usuario_id,
        (u.nombre || ' ' || u.apellido) AS beneficiario_nombre,
        d.tipo_donacion,
        COALESCE(da.nombre_producto, dm.nombre_material) AS nombre_item,
        a.cantidad AS cantidad_asignada,
        COALESCE(e.entregada, 0) AS cantidad_entregada,
        GREATEST(a.cantidad - COALESCE(e.entregada, 0), 0) AS cantidad_pendiente,
        COALESCE(i.disponible, 0) AS cantidad_disponible,
        COALESCE(um.codigo, '') AS unidad
      FROM asignacion_donacion a
      JOIN donacion d ON d.id_donacion = a.donacion_id
      JOIN usuario u ON u.id_usuario = a.beneficiario_usuario_id
      LEFT JOIN detalle_alimento da ON da.id_donacion = d.id_donacion
      LEFT JOIN detalle_material dm ON dm.id_donacion = d.id_donacion
      LEFT JOIN unidad_medida um
        ON um.id_unidad = COALESCE(da.unidad_medida_id, dm.unidad_medida_id)
      LEFT JOIN LATERAL (
        SELECT SUM(x.cantidad) AS entregada
          FROM inventario_destino x
         WHERE x.id_asignacion = a.id_asignacion
           AND x.estado = 'REGISTRADA'
      ) e ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(inv.cantidad_disponible) AS disponible
          FROM inventario inv
         WHERE inv.id_donacion = d.id_donacion
      ) i ON TRUE
      WHERE a.estado = 'ACTIVA'
        AND d.tipo_donacion IN ('ALIMENTO', 'MATERIAL')
        AND a.cantidad - COALESCE(e.entregada, 0) > 0
      ORDER BY a.fecha_asignacion ASC, a.id_asignacion ASC
    `);

    return r.rows.map((x: Fila) => ({
      id_asignacion: Number(x.id_asignacion),
      donacion_id: Number(x.donacion_id),
      donacion_codigo: String(x.donacion_codigo),
      beneficiario_usuario_id: Number(x.beneficiario_usuario_id),
      beneficiario_nombre: String(x.beneficiario_nombre),
      tipo_donacion: x.tipo_donacion as 'ALIMENTO' | 'MATERIAL',
      nombre_item: (x.nombre_item as string | null) ?? null,
      cantidad_asignada: numReq(x.cantidad_asignada),
      cantidad_entregada: numReq(x.cantidad_entregada),
      cantidad_pendiente: numReq(x.cantidad_pendiente),
      cantidad_disponible: numReq(x.cantidad_disponible),
      unidad: String(x.unidad ?? ''),
    }));
  },

  async listarHistorialEntregas(): Promise<Array<{
    id_entrega: number;
    fecha_entrega: string;
    beneficiario_nombre: string;
    lugar_entrega: string;
    responsable_nombre: string;
    productos: string;
    cantidad_total: number;
    estado: string;
    observaciones: string | null;
  }>> {
    const r = await pool.query(`
      SELECT e.id_entrega,
             ${TS('e.fecha_entrega')} AS fecha_entrega,
             COALESCE(string_agg(DISTINCT (ub.nombre || ' ' || ub.apellido), ', '), '—') AS beneficiario_nombre,
             e.lugar_entrega,
             (ur.nombre || ' ' || ur.apellido) AS responsable_nombre,
             COALESCE(string_agg(DISTINCT COALESCE(i.nombre_item, d.codigo), ', '), '—') AS productos,
             COALESCE(SUM(x.cantidad) FILTER (WHERE x.estado = 'REGISTRADA'), 0) AS cantidad_total,
             e.estado,
             e.observaciones
        FROM entrega_donacion e
        JOIN administrador ad ON ad.id_usuario = e.responsable_usuario_id
        JOIN usuario ur ON ur.id_usuario = ad.id_usuario
        LEFT JOIN inventario_destino x ON x.id_entrega = e.id_entrega
        LEFT JOIN inventario i ON i.id_inventario = x.id_inventario
        LEFT JOIN donacion d ON d.id_donacion = x.id_donacion
        LEFT JOIN asignacion_donacion a ON a.id_asignacion = x.id_asignacion
        LEFT JOIN usuario ub ON ub.id_usuario = a.beneficiario_usuario_id
       GROUP BY e.id_entrega, e.fecha_entrega, e.lugar_entrega,
                ur.nombre, ur.apellido, e.estado, e.observaciones
       ORDER BY e.fecha_entrega DESC, e.id_entrega DESC
       LIMIT 500
    `);
    return r.rows.map((x: Fila) => ({
      id_entrega: Number(x.id_entrega),
      fecha_entrega: String(x.fecha_entrega),
      beneficiario_nombre: String(x.beneficiario_nombre),
      lugar_entrega: String(x.lugar_entrega),
      responsable_nombre: String(x.responsable_nombre),
      productos: String(x.productos),
      cantidad_total: numReq(x.cantidad_total),
      estado: String(x.estado),
      observaciones: (x.observaciones as string | null) ?? null,
    }));
  },

  async cantidadEntregadaAsignacion(client: Db, idAsignacion: number): Promise<number> {
    const r = await client.query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total
         FROM inventario_destino
        WHERE id_asignacion = $1 AND estado = 'REGISTRADA'`,
      [idAsignacion]
    );
    return numReq(r.rows[0]?.total);
  },

  async registrarEntrega(
    client: Db,
    p: {
      id_asignacion: number;
      cantidad: number;
      lugar_entrega: string;
      observaciones: string | null;
      usuario_id: number;
    }
  ): Promise<number> {
    const asignacion = await client.query(
      `SELECT a.id_asignacion, a.donacion_id, a.cantidad, a.estado,
              d.tipo_donacion
         FROM asignacion_donacion a
         JOIN donacion d ON d.id_donacion = a.donacion_id
        WHERE a.id_asignacion = $1
        FOR UPDATE OF a, d`,
      [p.id_asignacion]
    );
    if (!asignacion.rowCount) throw new Error('La asignación no existe.');
    const a = asignacion.rows[0];

    if (a.estado !== 'ACTIVA') throw new Error('La asignación no está activa.');
    if (!['ALIMENTO', 'MATERIAL'].includes(String(a.tipo_donacion))) {
      throw new Error('Solo se pueden entregar bienes físicos.');
    }

    const yaEntregada = await this.cantidadEntregadaAsignacion(client, p.id_asignacion);
    const pendiente = Math.round((Number(a.cantidad) - yaEntregada) * 100) / 100;
    if (p.cantidad > pendiente + 0.00001) {
      throw new Error(`La cantidad supera lo pendiente de entregar (${pendiente}).`);
    }

    const partidas = await client.query(
      `SELECT id_inventario, id_donacion, cantidad_disponible
         FROM inventario
        WHERE id_donacion = $1 AND cantidad_disponible > 0
        ORDER BY fecha_ingreso ASC, id_inventario ASC
        FOR UPDATE`,
      [a.donacion_id]
    );
    const disponible = partidas.rows.reduce(
      (total: number, x: Fila) => total + numReq(x.cantidad_disponible),
      0
    );
    if (p.cantidad > disponible + 0.00001) {
      throw new Error(`Inventario insuficiente. Disponible: ${disponible}.`);
    }

    const cabecera = await client.query(
      `INSERT INTO entrega_donacion
         (lugar_entrega, responsable_usuario_id, observaciones)
       VALUES ($1, $2, $3)
       RETURNING id_entrega`,
      [p.lugar_entrega, p.usuario_id, p.observaciones]
    );
    const idEntrega = Number(cabecera.rows[0].id_entrega);

    let restante = p.cantidad;
    for (const partida of partidas.rows as Fila[]) {
      if (restante <= 0.00001) break;
      const cantidad = Math.min(restante, numReq(partida.cantidad_disponible));
      await client.query(
        `INSERT INTO inventario_destino
           (id_inventario, id_donacion, campana_id, solicitud_ayuda_id,
            id_asignacion, id_entrega, cantidad, registrado_por_usuario_id, observaciones)
         VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, $7)`,
        [partida.id_inventario, partida.id_donacion, p.id_asignacion,
         idEntrega, cantidad, p.usuario_id, p.observaciones]
      );
      restante = Math.round((restante - cantidad) * 100) / 100;
    }

    await this.registrarAuditoria(client, {
      donacion_id: Number(a.donacion_id),
      entidad_tipo: 'ENTREGA',
      entidad_id: idEntrega,
      usuario_id: p.usuario_id,
      accion: 'REGISTRAR_ENTREGA',
      datos_nuevos: {
        id_entrega: idEntrega,
        id_asignacion: p.id_asignacion,
        cantidad: p.cantidad,
        lugar_entrega: p.lugar_entrega,
      },
    });

    return idEntrega;
  },

  async cancelarAsignacion(client: Db, idAsignacion: number, motivo: string, usuarioId: number): Promise<void> {
    await client.query(
      `UPDATE asignacion_donacion
          SET estado = 'CANCELADA', motivo_cancelacion = $2,
              fecha_cancelacion = ${AHORA}, cancelada_por_usuario_id = $3
        WHERE id_asignacion = $1`,
      [idAsignacion, motivo, usuarioId]
    );
  },

  /** Foto completa (donación + detalle) para la bitácora. Sin datos personales. */
  async snapshot(client: Db, donacionId: number): Promise<Record<string, unknown> | null> {
    const r = await client.query(
      `SELECT to_jsonb(d) || COALESCE(to_jsonb(da), '{}'::jsonb)
                          || COALESCE(to_jsonb(dm), '{}'::jsonb)
                          || COALESCE(to_jsonb(de), '{}'::jsonb) AS snap
         FROM donacion d
         LEFT JOIN detalle_alimento  da ON da.id_donacion = d.id_donacion
         LEFT JOIN detalle_material  dm ON dm.id_donacion = d.id_donacion
         LEFT JOIN detalle_economico de ON de.id_donacion = d.id_donacion
        WHERE d.id_donacion = $1`,
      [donacionId]
    );
    return r.rows[0]?.snap ?? null;
  },

  async registrarAuditoria(
    client: Db,
    p: {
      donacion_id: number;
      entidad_tipo: string;
      entidad_id: number;
      usuario_id: number;
      accion: string;
      datos_anteriores?: unknown;
      datos_nuevos?: unknown;
      motivo?: string | null;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO auditoria_donacion
         (donacion_id, entidad_tipo, entidad_id, usuario_id, accion, datos_anteriores, datos_nuevos, motivo)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
      [
        p.donacion_id,
        p.entidad_tipo,
        p.entidad_id,
        p.usuario_id,
        p.accion,
        p.datos_anteriores === undefined ? null : JSON.stringify(p.datos_anteriores),
        p.datos_nuevos === undefined ? null : JSON.stringify(p.datos_nuevos),
        p.motivo ?? null,
      ]
    );
  },

  async insertarFoto(p: { id_donacion: number; nombre_original: string; clave_almacenamiento: string; mime_type: string; tamanio_bytes: number; usuario_id: number }) {
    const r = await pool.query(`INSERT INTO donacion_fotos
      (id_donacion,nombre_original,clave_almacenamiento,mime_type,tamanio_bytes,subido_por_usuario_id)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_foto,nombre_original,mime_type,tamanio_bytes`,
      [p.id_donacion,p.nombre_original,p.clave_almacenamiento,p.mime_type,p.tamanio_bytes,p.usuario_id]);
    return r.rows[0];
  },

  async listarFotos(idDonacion: number) {
    const r = await pool.query(`SELECT id_foto,nombre_original,mime_type,tamanio_bytes,
      to_char(fecha_subida,'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_subida
      FROM donacion_fotos WHERE id_donacion=$1 ORDER BY fecha_subida`, [idDonacion]);
    return r.rows;
  },

  async obtenerFoto(idDonacion: number, idFoto: number) {
    const r = await pool.query(`SELECT clave_almacenamiento,nombre_original,mime_type
      FROM donacion_fotos WHERE id_donacion=$1 AND id_foto=$2`, [idDonacion,idFoto]);
    return r.rows[0] ?? null;
  },

  /** Existencias físicas aceptadas en el almacén central de la asociación. */
  async listarInventario() {
    const r = await pool.query(`
      SELECT i.id_inventario, i.id_donacion, d.codigo AS donacion_codigo,
             i.id_recepcion, i.tipo_item, i.nombre_item,
             i.cantidad_ingresada, i.cantidad_disponible,
             COALESCE(um.codigo, '') AS unidad,
             i.ubicacion, i.estado,
             to_char(i.fecha_ingreso, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_ingreso,
             COALESCE((SELECT SUM(x.cantidad) FROM inventario_destino x
                        WHERE x.id_inventario = i.id_inventario AND x.estado = 'REGISTRADA'), 0) AS destinado
        FROM inventario i
        JOIN donacion d ON d.id_donacion = i.id_donacion
        LEFT JOIN unidad_medida um ON um.id_unidad = i.unidad_medida_id
       ORDER BY i.fecha_ingreso DESC, i.id_inventario DESC
    `);
    return r.rows.map((x: Fila) => ({
      id_inventario: Number(x.id_inventario), id_donacion: Number(x.id_donacion),
      donacion_codigo: String(x.donacion_codigo), id_recepcion: Number(x.id_recepcion),
      tipo_item: String(x.tipo_item), nombre_item: (x.nombre_item as string | null) ?? null,
      cantidad_ingresada: numReq(x.cantidad_ingresada), cantidad_disponible: numReq(x.cantidad_disponible),
      unidad: String(x.unidad ?? ''), ubicacion: String(x.ubicacion), estado: String(x.estado),
      fecha_ingreso: String(x.fecha_ingreso), destinado: numReq(x.destinado),
    }));
  },

};

// ---------------------------------------------------------------------------
// SELECT de asignaciones (definido al final porque usa TS)
// ---------------------------------------------------------------------------
const SELECT_ASIGNACION = `
  SELECT a.id_asignacion, a.donacion_id, d.codigo AS donacion_codigo, d.tipo_donacion,
         COALESCE(um.codigo, de.moneda_codigo) AS unidad,
         a.beneficiario_usuario_id, (ub.nombre || ' ' || ub.apellido) AS beneficiario_nombre,
         a.solicitud_ayuda_id, a.cantidad, ${TS('a.fecha_asignacion')} AS fecha_asignacion,
         a.estado, a.observaciones, a.motivo_cancelacion, ${TS('a.fecha_cancelacion')} AS fecha_cancelacion
    FROM asignacion_donacion a
    JOIN donacion d  ON d.id_donacion = a.donacion_id
    JOIN usuario  ub ON ub.id_usuario = a.beneficiario_usuario_id
    LEFT JOIN detalle_alimento  da ON da.id_donacion = d.id_donacion
    LEFT JOIN detalle_material  dm ON dm.id_donacion = d.id_donacion
    LEFT JOIN detalle_economico de ON de.id_donacion = d.id_donacion
    LEFT JOIN unidad_medida um ON um.id_unidad = COALESCE(da.unidad_medida_id, dm.unidad_medida_id)
`;
