/**
 * ============================================================================
 * ARCHIVO: donacion.types.ts
 * TIPOS COMPARTIDOS del módulo Gestión de Donaciones (espejo del backend).
 * ============================================================================
 */

export type TipoDonacion = 'ALIMENTO' | 'MATERIAL' | 'ECONOMICO';
export type EstadoDonacion = 'REGISTRADA' | 'ASIGNADA_PARCIAL' | 'ASIGNADA_TOTAL' | 'ANULADA';
export type EstadoMaterial = 'NUEVO' | 'USADO_BUEN_ESTADO' | 'REPARABLE';
export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'QR';
export type Moneda = 'BOB' | 'USD';
export type Modalidad = 'ONLINE' | 'PRESENCIAL';
export type EstadoAsignacion = 'ACTIVA' | 'CANCELADA';

/** Roles canónicos (idénticos a los del JWT). */
export type RolDonaciones = 'Administrador' | 'Donante' | 'Voluntario' | 'Beneficiario';

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
  monedas: Moneda[];
  metodos_pago: MetodoPago[];
  estados_material: EstadoMaterial[];
  tipos_donacion: TipoDonacion[];
  estados_donacion: EstadoDonacion[];
}

export interface CampanaResumen {
  id_campana: number;
  nombre: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface DonacionListaItem {
  id_donacion: number;
  codigo: string;
  tipo_donacion: TipoDonacion;
  modalidad: Modalidad;
  cantidad: number;
  cantidad_recibida: number;
  unidad: string | null;
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
  categoria_id: number | null;
  nombre_item: string | null;
  unidad_medida_id: number | null;
  unidad_nombre: string | null;
  fecha_vencimiento: string | null;
  estado_material: EstadoMaterial | null;
  monto: number | null;
  moneda_codigo: Moneda | null;
  metodo_pago: MetodoPago | null;
  referencia_pago: string | null;
  asignaciones: AsignacionItem[];
  comprobante: ComprobanteItem | null;
}

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface FiltrosDonacion {
  desde: string;
  hasta: string;
  tipo: TipoDonacion | '';
  estado: EstadoDonacion | '';
  campana_id: string;
  donante_id?: string;
  voluntario_id?: string;
  q: string;
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
  datos_anteriores: Record<string, unknown> | null;
  datos_nuevos: Record<string, unknown> | null;
  motivo: string | null;
  fecha_hora: string;
}

export interface ResumenReporte {
  total_donaciones: number;
  por_tipo: { tipo: TipoDonacion; cantidad_donaciones: number }[];
  por_estado: { estado: EstadoDonacion; cantidad_donaciones: number }[];
  economico: { moneda: string; registrado: number; asignado: number; saldo: number }[];
  bienes: { tipo: 'ALIMENTO' | 'MATERIAL'; unidad: string; registrado: number; asignado: number; saldo: number }[];
}

export interface ReporteDonaciones {
  filas: DonacionListaItem[];
  resumen: ResumenReporte;
  truncado: boolean;
  generado_en: string;
}

/** Datos del formulario (todo como texto: se validan y convierten al enviar). */
export interface DonacionFormValores {
  tipo_donacion: TipoDonacion | '';
  cantidad: string;
  descripcion: string;
  campana_id: string;
  categoria_id: string;
  unidad_medida_id: string;
  nombre_item: string;
  fecha_vencimiento: string;
  estado_material: EstadoMaterial | '';
  monto: string;
  moneda_codigo: Moneda;
  metodo_pago: MetodoPago | '';
  referencia_pago: string;
}


/** Asignación con saldo pendiente de entrega física. */
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


export interface EntregaHistorialItem {
  id_entrega: number;
  fecha_entrega: string;
  beneficiario_nombre: string;
  lugar_entrega: string;
  responsable_nombre: string;
  productos: string;
  cantidad_total: number;
  estado: string;
  observaciones: string | null;
}
