import { useEffect, useState, type ReactNode } from 'react';
import ModalBase from '../donaciones/ModalBase';
import { useToast } from '../../context/ToastContext';
import ayudaApi, {
  asignarDonacion,
  leerErrorAyuda,
  oportunidadesAsignacion,
} from '../../api/ayuda.api';
import { EstadoSolicitudBadge, PrioridadBadge } from './EstadoSolicitudBadge';
import {
  ETIQUETA_TIPO_AYUDA,
  formatoFechaHora,
  formatoNumero,
  urlPerfil,
} from '../../utils/ayudaFormat';
import type {
  AsignarDonacionPayload,
  OportunidadAsignacion,
  SolicitudAyuda,
  SolicitudAyudaDetalle,
} from '../../types/ayuda.types';
import { btnPeligroSuave, btnPrimario, btnSecundario, claseEtiqueta, claseInput } from './estilos';

interface Props {
  isOpen: boolean;
  solicitud: SolicitudAyudaDetalle | null;
  esAdmin: boolean;
  cargando?: boolean;
  onClose: () => void;
  onActualizada: (solicitud: SolicitudAyuda) => void;
}

type Accion = 'poner_en_evaluacion' | 'aprobar' | 'rechazar' | 'atender' | 'cancelar' | 'cancelar_solicitante' | 'asignar' | null;

const Dato = ({ etiqueta, children }: { etiqueta: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{etiqueta}</dt>
    <dd className="mt-0.5 break-words text-sm text-text">{children}</dd>
  </div>
);

const SolicitudDetalleModal = ({
  isOpen,
  solicitud,
  esAdmin,
  cargando = false,
  onClose,
  onActualizada,
}: Props) => {
  const { exito, error: toastError } = useToast();
  const [accion, setAccion] = useState<Accion>(null);
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [oportunidades, setOportunidades] = useState<OportunidadAsignacion[]>([]);
  const [cantAsignar, setCantAsignar] = useState('');
  const [donOport, setDonOport] = useState('');
  const [obsAsignar, setObsAsignar] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const id = solicitud?.id_solicitud_ayuda;
    if (id) {
      oportunidadesAsignacion(id)
        .then((lista) => {
          setOportunidades(lista);
          setDonOport((actual) => actual || String(lista[0]?.id_donacion ?? ''));
        })
        .catch(() => setOportunidades([]));
    }
    setAccion(null);
    setMotivo('');
    setCantAsignar('');
    setObsAsignar('');
    setErrorAccion('');
    setProcesando(false);
  }, [isOpen, solicitud?.id_solicitud_ayuda]);

  const ejecutar = async (): Promise<void> => {
    if (!solicitud || !accion) return;
    setErrorAccion('');

    if ((accion === 'rechazar' || accion === 'cancelar' || accion === 'cancelar_solicitante') && motivo.trim().length < 5) {
      setErrorAccion('Indica un motivo de al menos 5 caracteres.');
      return;
    }

    setProcesando(true);
    try {
      if (accion === 'poner_en_evaluacion') {
        const respuesta = await ayudaApi.iniciarEvaluacion(solicitud.id_solicitud_ayuda);
        exito(respuesta.mensaje, 'Solicitud actualizada');
        onActualizada(respuesta.solicitud);
      } else if (accion === 'cancelar_solicitante') {
        const respuesta = await ayudaApi.cancelarSolicitante(solicitud.id_solicitud_ayuda, motivo.trim());
        exito(respuesta.mensaje, 'Solicitud actualizada');
        onActualizada(respuesta.solicitud);
      } else if (accion === 'aprobar' || accion === 'rechazar') {
        const respuesta = await ayudaApi.revisarSolicitud(solicitud.id_solicitud_ayuda, {
          estado: accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA',
          motivo_rechazo: accion === 'rechazar' ? motivo.trim() : undefined,
        });
        exito(respuesta.mensaje, 'Solicitud actualizada');
        onActualizada(respuesta.solicitud);
      } else if (accion === 'asignar') {
        const num = Number(cantAsignar);
        if (!Number.isFinite(num) || num <= 0) {
          setErrorAccion('La cantidad debe ser un número mayor a cero.');
          return;
        }
        const oport = oportunidades.find((item) => item.id_donacion === Number(donOport)) || oportunidades[0];
        if (!oport) {
          setErrorAccion('No hay donación asignable para esta solicitud.');
          return;
        }
        const payload: AsignarDonacionPayload = {
          donacion_id: oport.id_donacion,
          cantidad: Math.round(num * 100) / 100,
          observaciones: obsAsignar.trim() || undefined,
        };
        const respuesta = await asignarDonacion(solicitud.id_solicitud_ayuda, payload);
        exito(respuesta.mensaje, 'Donación asignada');
        onActualizada(respuesta.asignacion);
      } else {
        const respuesta = await ayudaApi.cerrarSolicitud(solicitud.id_solicitud_ayuda, {
          estado: accion === 'atender' ? 'ATENDIDA' : 'CANCELADA',
          motivo_cancelacion: accion === 'cancelar' ? motivo.trim() : undefined,
        });
        exito(respuesta.mensaje, 'Solicitud actualizada');
        onActualizada(respuesta.solicitud);
      }
      setAccion(null);
      setMotivo('');
      setCantAsignar('');
      setObsAsignar('');
    } catch (error) {
      const info = leerErrorAyuda(error);
      setErrorAccion(info.mensaje);
      toastError(info.mensaje, 'No se pudo actualizar');
    } finally {
      setProcesando(false);
    }
  };

  const puedeEvaluar = Boolean(solicitud && ['PENDIENTE', 'EN_EVALUACION'].includes(solicitud.estado));
  const puedeCerrar = Boolean(solicitud?.estado === 'APROBADA');
  const puedeAsignar = Boolean(esAdmin && puedeCerrar);

  const oportSeleccionada = oportunidades.find((item) => item.id_donacion === Number(donOport)) || oportunidades[0];
  const oportGrid = oportSeleccionada && {
    codigo: oportSeleccionada.codigo,
    donante: oportSeleccionada.donante_nombre,
    fecha: oportSeleccionada.fecha_donacion.slice(0, 10),
    tipo: oportSeleccionada.tipo_donacion,
    cantidad: oportSeleccionada.cantidad,
    disponible: oportSeleccionada.saldo_disponible,
  };
  const etiquetaAccion: Record<Exclude<Accion, null>, string> = {
    aprobar: 'Confirmar aprobación',
    rechazar: 'Confirmar rechazo',
    atender: 'Marcar como atendida',
    cancelar: 'Confirmar cancelación',
    asignar: 'Confirmar asignación',
    poner_en_evaluacion: 'Iniciar evaluación',
    cancelar_solicitante: 'Confirmar cancelación',
  };

  const urlFoto = urlPerfil(solicitud?.foto_url || solicitud?.beneficiaries_foto_url);

  return (
    <ModalBase
      isOpen={isOpen}
      titulo={solicitud ? `Solicitud #${solicitud.id_solicitud_ayuda}` : 'Solicitud de ayuda'}
      subtitulo={solicitud ? solicitud.necesidad : 'Cargando detalle…'}
      ancho="xl"
      bloqueado={procesando}
      onClose={onClose}
      pie={
        <button type="button" className={btnSecundario} onClick={onClose} disabled={procesando}>
          Cerrar
        </button>
      }
    >
      {cargando || !solicitud ? (
        <p className="py-10 text-center text-sm text-text-muted">Cargando solicitud…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <EstadoSolicitudBadge estado={solicitud.estado} />
            <PrioridadBadge prioridad={solicitud.prioridad} />
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-muted">
              {ETIQUETA_TIPO_AYUDA[solicitud.tipo_ayuda]}
            </span>
          </div>

          {errorAccion && (
            <div role="alert" className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-medium text-error">
              {errorAccion}
            </div>
          )}

          <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3 flex items-start gap-4">
              {urlFoto && (
                <img
                  src={urlFoto}
                  alt={`Foto de ${solicitud.beneficiario_nombre}`}
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
              )}
              <Dato etiqueta="Beneficiario">{solicitud.beneficiario_nombre}</Dato>
            </div>
            <Dato etiqueta="Correo">{solicitud.beneficiario_correo}</Dato>
            <Dato etiqueta="Registrada">{formatoFechaHora(solicitud.fecha_creacion)}</Dato>
            <Dato etiqueta="Creada por">{solicitud.creado_por_nombre}</Dato>
            <Dato etiqueta="Cantidad solicitada">
              {solicitud.cantidad_solicitada === null ? 'No especificada' : formatoNumero(solicitud.cantidad_solicitada)}
            </Dato>
            <Dato etiqueta="Asignaciones activas">
              {solicitud.asignaciones_activas} · {formatoNumero(solicitud.cantidad_asignada)} en total
            </Dato>
            {solicitud.evaluado_por_nombre && <Dato etiqueta="Evaluada por">{solicitud.evaluado_por_nombre}</Dato>}
            {solicitud.fecha_evaluacion && <Dato etiqueta="Fecha de evaluación">{formatoFechaHora(solicitud.fecha_evaluacion)}</Dato>}
            {solicitud.fecha_cierre && <Dato etiqueta="Fecha de cierre">{formatoFechaHora(solicitud.fecha_cierre)}</Dato>}
          </dl>

          <div>
            <h3 className="font-display text-sm font-bold text-text">Necesidad</h3>
            <p className="mt-1 text-sm text-text-muted">{solicitud.necesidad}</p>
            {solicitud.descripcion && <p className="mt-2 whitespace-pre-line text-sm text-text">{solicitud.descripcion}</p>}
          </div>

          {solicitud.motivo_rechazo && (
            <div className="rounded-xl border border-error/30 bg-error-soft px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-error">Motivo de rechazo</p>
              <p className="mt-1 text-sm text-error">{solicitud.motivo_rechazo}</p>
            </div>
          )}
          {solicitud.motivo_cancelacion && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Motivo de cancelación</p>
              <p className="mt-1 text-sm text-text">{solicitud.motivo_cancelacion}</p>
            </div>
          )}

          <div>
            <h3 className="font-display text-sm font-bold text-text">Donaciones asignadas</h3>
            {solicitud.asignaciones.length === 0 ? (
              <p className="mt-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
                Todavía no hay donaciones asignadas a esta solicitud.
              </p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-[10px] uppercase tracking-[0.12em] text-text-muted">
                    <tr>
                      <th className="px-3 py-2">Donación</th>
                      <th className="px-3 py-2">Cantidad</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitud.asignaciones.map((asignacion) => (
                      <tr key={asignacion.id_asignacion} className="border-t border-border">
                        <td className="px-3 py-2">
                          <span className="font-semibold text-text">{asignacion.donacion_codigo}</span>
                          <span className="block text-xs text-text-muted">{asignacion.tipo_donacion}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-text">{formatoNumero(asignacion.cantidad)}</td>
                        <td className="px-3 py-2 text-text-muted">{formatoFechaHora(asignacion.fecha_asignacion)}</td>
                        <td className="px-3 py-2 text-text-muted">{asignacion.estado === 'ACTIVA' ? 'Activa' : 'Cancelada'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {esAdmin && (puedeEvaluar || puedeCerrar) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-sm font-bold text-text">Acciones de administración</h3>
              {accion === null ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {solicitud.estado === 'PENDIENTE' && (
                    <button type="button" className={btnSecundario} onClick={() => setAccion('poner_en_evaluacion')}>
                      Iniciar evaluación
                    </button>
                  )}
                  {puedeEvaluar && (
                    <>
                      <button type="button" className={btnPrimario} onClick={() => setAccion('aprobar')}>
                        Aprobar
                      </button>
                      <button type="button" className={btnPeligroSuave} onClick={() => setAccion('rechazar')}>
                        Rechazar
                      </button>
                    </>
                  )}
                  {puedeAsignar && (
                    <button type="button" className={btnPrimario} onClick={() => setAccion('asignar')}>
                      Asignar donación
                    </button>
                  )}
                  {puedeCerrar && (
                    <>
                      <button type="button" className={btnSecundario} onClick={() => setAccion('atender')}>
                        Marcar atendida
                      </button>
                      <button type="button" className={btnPeligroSuave} onClick={() => setAccion('cancelar')}>
                        Cancelar solicitud
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {accion === 'asignar' && oportunidades.length > 0 && oportGrid && (
                    <div className="space-y-2">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label htmlFor="ay-don-asignar" className={claseEtiqueta}>Donación *</label>
                          <select
                            id="ay-don-asignar"
                            value={donOport || String(oportunidades[0]?.id_donacion ?? '')}
                            onChange={(event) => setDonOport(event.target.value)}
                            className={claseInput}
                          >
                            {oportunidades.map((item) => (
                              <option key={item.id_donacion} value={item.id_donacion}>
                                {item.codigo} · {item.donante_nombre} · {item.tipo_donacion} · {item.fecha_donacion.slice(0, 10)} · Disponible {formatoNumero(item.saldo_disponible)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="ay-cant-asignar" className={claseEtiqueta}>Cantidad *</label>
                          <input
                            id="ay-cant-asignar"
                            type="number"
                            min={0.01}
                            step={0.01}
                            inputMode="decimal"
                            value={cantAsignar}
                            onChange={(event) => setCantAsignar(event.target.value)}
                            className={claseInput}
                            placeholder="Ej. 10"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="ay-obs-asignar" className={claseEtiqueta}>Observaciones</label>
                        <textarea
                          id="ay-obs-asignar"
                          rows={3}
                          value={obsAsignar}
                          onChange={(event) => setObsAsignar(event.target.value)}
                          className={claseInput}
                          placeholder="Ej. prioridad media, para familia de 3."
                        />
                      </div>
                      <div className="rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
                        Donación {oportGrid.codigo} · {oportGrid.tipo} · {formatoNumero(oportGrid.cantidad)} disponibles de {formatoNumero(oportGrid.disponible)}
                      </div>
                    </div>
                  )}
                  {(accion === 'rechazar' || accion === 'cancelar') && (
                    <div>
                      <label htmlFor="ay-motivo" className={claseEtiqueta}>
                        Motivo *
                      </label>
                      <textarea
                        id="ay-motivo"
                        rows={3}
                        value={motivo}
                        onChange={(event) => setMotivo(event.target.value)}
                        className={claseInput}
                        placeholder="Explica brevemente el motivo."
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnPrimario} onClick={() => void ejecutar()} disabled={procesando}>
                      {procesando ? 'Guardando…' : etiquetaAccion[accion]}
                    </button>
                    <button
                      type="button"
                      className={btnSecundario}
                      onClick={() => {
                        setAccion(null);
                        setMotivo('');
                        setErrorAccion('');
                      }}
                      disabled={procesando}
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!esAdmin && ['PENDIENTE', 'EN_EVALUACION'].includes(solicitud.estado) && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="font-display text-sm font-bold text-text">Acciones de la solicitud</h3>
              {accion === null ? (
                <button type="button" className={btnPeligroSuave} onClick={() => setAccion('cancelar_solicitante')}>
                  Cancelar solicitud
                </button>
              ) : accion === 'cancelar_solicitante' ? (
                <div className="mt-3 space-y-3">
                  <label htmlFor="ay-motivo-solicitante" className={claseEtiqueta}>Motivo *</label>
                  <textarea id="ay-motivo-solicitante" rows={3} value={motivo} onChange={(event) => setMotivo(event.target.value)} className={claseInput} placeholder="Explica por qué ya no necesitas esta ayuda." />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnPrimario} onClick={() => void ejecutar()} disabled={procesando}>{procesando ? 'Guardando…' : 'Confirmar cancelación'}</button>
                    <button type="button" className={btnSecundario} onClick={() => { setAccion(null); setMotivo(''); setErrorAccion(''); }} disabled={procesando}>Volver</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </ModalBase>
  );
};

export default SolicitudDetalleModal;
