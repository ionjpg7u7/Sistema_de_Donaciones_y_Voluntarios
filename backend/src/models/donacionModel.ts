// src/models/donacionModel.ts
// ============================================================================
// CAPA: Modelo. Solo tipos e interfaces del módulo Gestión de Donaciones.
// ============================================================================

export const TIPOS_DONACION = ['ALIMENTO', 'MATERIAL', 'ECONOMICO'] as const;
export type TipoDonacion = (typeof TIPOS_DONACION)[number];

export const ESTADOS_DONACION = ['REGISTRADA', 'ASIGNADA_PARCIAL', 'ASIGNADA_TOTAL', 'ANULADA'] as const;
export type EstadoDonacion = (typeof ESTADOS_DONACION)[number];

export const ESTADOS_MATERIAL = ['NUEVO', 'USADO_BUEN_ESTADO', 'REPARABLE'] as const;
export type EstadoMaterial = (typeof ESTADOS_MATERIAL)[number];

export const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'QR'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const MONEDAS = ['BOB', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export type Modalidad = 'ONLINE' | 'PRESENCIAL';
export type EstadoAsignacion = 'ACTIVA' | 'CANCELADA';

/** Nombres canónicos de rol (idénticos a los del JWT). No se crean alias. */
export type RolCanonico = 'Administrador' | 'Donante' | 'Voluntario' | 'Beneficiario';

/** Usuario autenticado, tomado SIEMPRE del JWT (nunca del body). */
export interface ActorDonacion {
  id_usuario: number;
  rol: RolCanonico;
  nombre: string;
  roles?: string[];
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------
export interface UnidadMedida {
  id_unidad: number;
  codigo: string;
  nombre: string;
  permite_decimales: boolean;
}

export interface CategoriaDonacion {
  id_categoria: number;
  nombre: string;
  tipo: 'ALIMENTO' | 'MATERIAL';
}

export interface CatalogosDonacion {
  categorias: CategoriaDonacion[];
  unidades: UnidadMedida[];
  monedas: readonly Moneda[];
  metodos_pago: readonly MetodoPago[];
  estados_material: readonly EstadoMaterial[];
  tipos_donacion: readonly TipoDonacion[];
  estados_donacion: readonly EstadoDonacion[];
}

// ---------------------------------------------------------------------------
// Entrada (lo que llega por HTTP, ya normalizado por el validador)
// ---------------------------------------------------------------------------
export interface DonacionNormalizada {
  tipo_donacion: TipoDonacion;
  cantidad: number;
  descripcion: string | null;
  campana_id: number | null;
  // ALIMENTO / MATERIAL
  categoria_id?: number;
  unidad_medida_id?: number;
  nombre_item?: string | null; // nombre_producto | nombre_material
  fecha_vencimiento?: string; // YYYY-MM-DD (alimento)
  estado_material?: EstadoMaterial;
  // ECONOMICO
  monto?: number;
  moneda_codigo?: Moneda;
  metodo_pago?: MetodoPago;
  referencia_pago?: string | null;
}

export interface FiltrosDonacion {
  desde?: string;
  hasta?: string;
  tipo?: TipoDonacion;
  estado?: EstadoDonacion;
  campana_id?: number;
  donante_id?: number;
  voluntario_id?: number;
  q?: string;
  page?: number;
  limit?: number;
  /** Solo donaciones con saldo > 0 y no vencidas (para asignar). */
  asignables?: boolean;
  /** false = excluir ANULADA cuando no se filtra por estado (reportes). */
  incluirAnuladas?: boolean;
  /** Fecha de hoy (AAAA-MM-DD, hora Bolivia); la fija el servicio. */
  hoy?: string;
}

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
export interface DonacionListaItem {
  id_donacion: number;
  codigo: string;
  tipo_donacion: TipoDonacion;
  modalidad: Modalidad;
  cantidad: number;
  cantidad_recibida: number;
  unidad: string | null; // código de unidad o moneda
  categoria: string | null;
  descripcion: string | null;
  fecha_donacion: string;
  campana_id: number | null;
  campana_nombre?: string | null;
  estado: EstadoDonacion;
  version: number;
  donante_usuario_id: number | null;
  donante_nombre: string | null;
  voluntario_usuario_id: number | null;
  cantidad_asignada: number | null;
  saldo: number | null;
  /** Solo para el rol Beneficiario: lo asignado a él. */
  cantidad_beneficiario: number | null;
}

export interface AsignacionItem {
  id_asignacion: number;
  donacion_id: number;
  donacion_codigo: string;
  tipo_donacion: TipoDonacion;
  unidad: string | null;
  beneficiario_usuario_id: number;
  beneficiario_nombre: string;
  solicitud_ayuda_id: number | null;
  cantidad: number;
  fecha_asignacion: string;
  estado: EstadoAsignacion;
  observaciones: string | null;
  motivo_cancelacion: string | null;
  fecha_cancelacion: string | null;
}

export interface ComprobanteItem {
  id_comprobante: number;
  numero_comprobante: string;
  tipo: string;
  fecha_emision: string;
  estado: 'EMITIDO' | 'ANULADO';
}

export interface DonacionDetalle extends DonacionListaItem {
  registrado_por_usuario_id: number | null;
  registrado_por_nombre: string | null;
  voluntario_nombre: string | null;
  motivo_anulacion: string | null;
  fecha_anulacion: string | null;
  // alimento / material
  categoria_id: number | null;
  nombre_item: string | null;
  unidad_medida_id: number | null;
  unidad_nombre: string | null;
  fecha_vencimiento: string | null;
  estado_material: EstadoMaterial | null;
  // economico
  monto: number | null;
  moneda_codigo: Moneda | null;
  metodo_pago: MetodoPago | null;
  referencia_pago: string | null;
  asignaciones: AsignacionItem[];
  comprobante: ComprobanteItem | null;
}

export interface FiltrosAsignacion {
  estado?: EstadoAsignacion;
  q?: string;
  page?: number;
  limit?: number;
}

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DonanteBusqueda {
  id_usuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string | null;
  estado: string;
}

export interface BeneficiarioAsignable {
  id_usuario: number;
  nombre: string;
  apellido: string;
  tipo_beneficiario: string;
  necesidad: string;
}

export interface AuditoriaItem {
  id_auditoria: number;
  entidad_tipo: string;
  entidad_id: number;
  usuario_id: number;
  usuario_nombre: string;
  accion: string;
  datos_anteriores: unknown;
  datos_nuevos: unknown;
  motivo: string | null;
  fecha_hora: string;
}

export interface ResumenReporte {
  total_donaciones: number;
  por_tipo: { tipo: TipoDonacion; cantidad_donaciones: number }[];
  por_estado: { estado: EstadoDonacion; cantidad_donaciones: number }[];
  /** Montos por moneda; NUNCA se suman monedas distintas. */
  economico: { moneda: string; registrado: number; asignado: number; saldo: number }[];
  /** Bienes por unidad de medida (alimentos y materiales). */
  bienes: { tipo: 'ALIMENTO' | 'MATERIAL'; unidad: string; registrado: number; asignado: number; saldo: number }[];
}

export interface ReporteDonaciones {
  filas: DonacionListaItem[];
  resumen: ResumenReporte;
  truncado: boolean;
  generado_en: string;
}


/** Asignación de bienes con saldo pendiente de entrega física. */
export interface EntregaPendienteItem {
  id_asignacion: number;
  donacion_id: number;
  donacion_codigo: string;
  beneficiario_usuario_id: number;
  beneficiario_nombre: string;
  tipo_donacion: 'ALIMENTO' | 'MATERIAL';
  nombre_item: string | null;
  cantidad_asignada: number;
  cantidad_entregada: number;
  cantidad_pendiente: number;
  cantidad_disponible: number;
  unidad: string;
}
