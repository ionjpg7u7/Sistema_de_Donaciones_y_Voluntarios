import type { EstadoSolicitud, PrioridadAyuda } from '../../types/ayuda.types';
import {
  DESCRIPCION_ESTADO,
  ETIQUETA_ESTADO_SOLICITUD,
  ETIQUETA_PRIORIDAD,
} from '../../utils/ayudaFormat';

const estilosEstado: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'border-warning/30 bg-warning-soft text-warning',
  EN_EVALUACION: 'border-info/30 bg-info-soft text-info',
  APROBADA: 'border-success/30 bg-success-soft text-success',
  RECHAZADA: 'border-error/30 bg-error-soft text-error',
  ATENDIDA: 'border-primary/30 bg-primary-soft text-primary',
  CANCELADA: 'border-border bg-surface text-text-muted',
};

const estilosPrioridad: Record<PrioridadAyuda, string> = {
  BAJA: 'border-border bg-surface text-text-muted',
  MEDIA: 'border-warning/30 bg-warning-soft text-warning',
  ALTA: 'border-error/30 bg-error-soft text-error',
};

const base =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]';

export const EstadoSolicitudBadge = ({ estado }: { estado: EstadoSolicitud }) => (
  <span
    title={DESCRIPCION_ESTADO[estado]}
    aria-label={`${ETIQUETA_ESTADO_SOLICITUD[estado]}. ${DESCRIPCION_ESTADO[estado]}`}
    className={`${base} ${estilosEstado[estado]}`}
  >
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
    {ETIQUETA_ESTADO_SOLICITUD[estado]}
  </span>
);

export const PrioridadBadge = ({ prioridad }: { prioridad: PrioridadAyuda }) => (
  <span className={`${base} ${estilosPrioridad[prioridad]}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
    Prioridad {ETIQUETA_PRIORIDAD[prioridad]}
  </span>
);
