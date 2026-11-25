import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import ayudaApi, { leerErrorAyuda } from '../../api/ayuda.api';
import SolicitudFormModal from './SolicitudFormModal';
import SolicitudDetalleModal from './SolicitudDetalleModal';
import { EstadoSolicitudBadge, PrioridadBadge } from './EstadoSolicitudBadge';
import {
  ETIQUETA_TIPO_AYUDA,
  formatoFechaHora,
  formatoNumero,
} from '../../utils/ayudaFormat';
import { ESTADOS_SOLICITUD, TIPOS_AYUDA } from '../../types/ayuda.types';
import type {
  BeneficiarioAyuda,
  FiltrosSolicitud,
  SolicitudAyuda,
  SolicitudAyudaDetalle,
} from '../../types/ayuda.types';
import {
  btnPrimario,
  btnSecundario,
  claseEtiqueta,
  claseInput,
  tarjeta,
} from './estilos';

interface Props {
  esAdmin: boolean;
  abrirNueva?: boolean;
  onNuevaConsumida?: () => void;
}

const FILTROS_VACIOS: FiltrosSolicitud = { estado: '', tipo_ayuda: '', q: '' };

const SolicitudesTab = ({ esAdmin, abrirNueva = false, onNuevaConsumida }: Props) => {
  const { error: toastError } = useToast();
  const [solicitudes, setSolicitudes] = useState<SolicitudAyuda[]>([]);
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioAyuda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState<FiltrosSolicitud>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<FiltrosSolicitud>(FILTROS_VACIOS);
  const [version, setVersion] = useState(0);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<SolicitudAyudaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async (): Promise<void> => {
    setCargando(true);
    setError('');
    try {
      setSolicitudes(await ayudaApi.listarSolicitudes(aplicados));
    } catch (err) {
      setError(leerErrorAyuda(err).mensaje);
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  useEffect(() => {
    if (!esAdmin) return;
    ayudaApi
      .listarBeneficiarios()
      .then(setBeneficiarios)
      .catch(() => setBeneficiarios([]));
  }, [esAdmin]);

  useEffect(() => {
    if (!abrirNueva) return;
    setNuevaAbierta(true);
    onNuevaConsumida?.();
  }, [abrirNueva, onNuevaConsumida]);

  const recargar = (): void => setVersion((v) => v + 1);

  const abrirDetalle = async (id: number): Promise<void> => {
    setDetalleId(id);
    setCargandoDetalle(true);
    setDetalle(null);
    try {
      setDetalle(await ayudaApi.obtenerSolicitud(id));
    } catch (err) {
      toastError(leerErrorAyuda(err).mensaje, 'No se pudo abrir la solicitud');
      setDetalleId(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = (): void => {
    setDetalleId(null);
    setDetalle(null);
  };

  const actualizarDetalle = (actualizada: SolicitudAyuda): void => {
    recargar();
    void ayudaApi
      .obtenerSolicitud(actualizada.id_solicitud_ayuda)
      .then(setDetalle)
      .catch(() => setDetalle(null));
  };

  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length;
  const aprobadas = solicitudes.filter((s) => s.estado === 'APROBADA').length;
  const atendidas = solicitudes.filter((s) => s.estado === 'ATENDIDA').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-text md:text-2xl">
            {esAdmin ? 'Bandeja de solicitudes de ayuda' : 'Mis solicitudes de ayuda'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {esAdmin
              ? 'Evalúa las solicitudes y consulta las donaciones que tiene asignadas cada beneficiario.'
              : 'Registra una nueva solicitud y sigue su estado hasta la entrega.'}
          </p>
        </div>
        <button type="button" className={btnPrimario} onClick={() => setNuevaAbierta(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva solicitud
        </button>
      </div>

      {esAdmin && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { etiqueta: 'Pendientes', valor: pendientes, clase: 'border-warning/30 bg-warning-soft text-warning' },
            { etiqueta: 'Aprobadas', valor: aprobadas, clase: 'border-success/30 bg-success-soft text-success' },
            { etiqueta: 'Atendidas', valor: atendidas, clase: 'border-primary/30 bg-primary-soft text-primary' },
          ].map((item) => (
            <div key={item.etiqueta} className={`rounded-2xl border p-4 ${item.clase}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]">{item.etiqueta}</p>
              <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{item.valor}</p>
            </div>
          ))}
        </div>
      )}

      <form
        className={`${tarjeta} p-4 sm:p-5`}
        onSubmit={(event) => {
          event.preventDefault();
          setAplicados({ ...borrador });
        }}
        aria-label="Filtros de solicitudes de ayuda"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="ay-q" className={claseEtiqueta}>
              Buscar
            </label>
            <input
              id="ay-q"
              type="search"
              value={borrador.q}
              onChange={(event) => setBorrador({ ...borrador, q: event.target.value })}
              placeholder="Necesidad, descripción o beneficiario"
              className={claseInput}
            />
          </div>
          <div>
            <label htmlFor="ay-estado-filtro" className={claseEtiqueta}>
              Estado
            </label>
            <select
              id="ay-estado-filtro"
              value={borrador.estado}
              onChange={(event) => setBorrador({ ...borrador, estado: event.target.value as FiltrosSolicitud['estado'] })}
              className={claseInput}
            >
              <option value="">Todos</option>
              {ESTADOS_SOLICITUD.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ay-tipo-filtro" className={claseEtiqueta}>
              Tipo
            </label>
            <select
              id="ay-tipo-filtro"
              value={borrador.tipo_ayuda}
              onChange={(event) =>
                setBorrador({ ...borrador, tipo_ayuda: event.target.value as FiltrosSolicitud['tipo_ayuda'] })
              }
              className={claseInput}
            >
              <option value="">Todos</option>
              {TIPOS_AYUDA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_AYUDA[tipo]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className={btnPrimario}>
            Filtrar
          </button>
          <button
            type="button"
            className={btnSecundario}
            onClick={() => {
              setBorrador(FILTROS_VACIOS);
              setAplicados(FILTROS_VACIOS);
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
          <span>{error}</span>
          <button type="button" className={btnSecundario} onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
          Cargando solicitudes…
        </p>
      ) : solicitudes.length === 0 ? (
        <div className={`${tarjeta} px-4 py-12 text-center`}>
          <p className="font-display text-lg font-bold text-text">No hay solicitudes para mostrar</p>
          <p className="mt-1 text-sm text-text-muted">
            {esAdmin ? 'Cuando un beneficiario registre una solicitud aparecerá aquí.' : 'Registra tu primera solicitud de ayuda.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {solicitudes.map((solicitud) => (
            <article key={solicitud.id_solicitud_ayuda} className={`${tarjeta} p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <EstadoSolicitudBadge estado={solicitud.estado} />
                    <PrioridadBadge prioridad={solicitud.prioridad} />
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-text-muted">
                      {ETIQUETA_TIPO_AYUDA[solicitud.tipo_ayuda]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-text">{solicitud.necesidad}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      #{solicitud.id_solicitud_ayuda} · {solicitud.beneficiario_nombre}
                      {esAdmin ? ` · ${solicitud.beneficiario_correo}` : ''}
                    </p>
                  </div>
                  {solicitud.descripcion && (
                    <p className="line-clamp-2 max-w-3xl text-sm text-text-muted">{solicitud.descripcion}</p>
                  )}
                  <p className="text-xs text-text-subtle">
                    Registrada {formatoFechaHora(solicitud.fecha_creacion)}
                    {solicitud.cantidad_solicitada !== null
                      ? ` · Solicita ${formatoNumero(solicitud.cantidad_solicitada)}`
                      : ''}
                    {solicitud.asignaciones_activas > 0
                      ? ` · ${solicitud.asignaciones_activas} asignación(es) activa(s)`
                      : ''}
                  </p>
                </div>
                <button type="button" className={btnSecundario} onClick={() => void abrirDetalle(solicitud.id_solicitud_ayuda)}>
                  {esAdmin ? 'Ver y evaluar' : 'Ver detalle'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <SolicitudFormModal
        isOpen={nuevaAbierta}
        esAdmin={esAdmin}
        beneficiarios={beneficiarios}
        onClose={() => setNuevaAbierta(false)}
        onCreada={recargar}
      />

      <SolicitudDetalleModal
        isOpen={detalleId !== null}
        solicitud={detalle}
        esAdmin={esAdmin}
        cargando={cargandoDetalle}
        onClose={cerrarDetalle}
        onActualizada={actualizarDetalle}
      />
    </div>
  );
};

export default SolicitudesTab;
