/**
 * ============================================================================
 * ARCHIVO: DonacionDetalleModal.tsx
 * COMPONENTE: Detalle de una donación (CU Consultar historial: paso "detalle").
 * Para el Administrador habilita Modificar, Anular y Asignar, además de la
 * cancelación de asignaciones y el historial de auditoría.
 * ============================================================================
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import ModalBase from './ModalBase';
import MotivoModal from './MotivoModal';
import AsignarModal from './AsignarModal';
import RecepcionModal from './RecepcionModal';
import DonacionFormModal from './DonacionFormModal';
import { EstadoAsignacionBadge, EstadoBadge } from './EstadoBadge';
import { useToast } from '../../context/ToastContext';
import donacionApi, { leerError } from '../../api/donacion.api';
import api from '../../api/client';
import { descargarComprobante } from '../../utils/comprobantePdf';
import {
  ETIQUETA_ACCION,
  ETIQUETA_ESTADO_MATERIAL,
  ETIQUETA_METODO_PAGO,
  ETIQUETA_TIPO,
  formatoCantidad,
  formatoFecha,
  formatoFechaHora,
} from '../../utils/donacionFormat';
import type { AuditoriaItem, DonacionDetalle, RolDonaciones } from '../../types/donacion.types';
import { btnPeligroSuave, btnPrimario, btnSecundario, claseTituloSeccion } from './estilos';

interface Props {
  donacionId: number | null;
  rol: RolDonaciones;
  onClose: () => void;
  /** Avisa al listado que algo cambió para que se refresque. */
  onCambio: () => void;
}

const Dato = ({ etiqueta, children }: { etiqueta: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{etiqueta}</dt>
    <dd className="mt-0.5 break-words text-sm text-text">{children}</dd>
  </div>
);

const DonacionDetalleModal = ({ donacionId, rol, onClose, onCambio }: Props) => {
  const { exito, error: toastError } = useToast();
  const [detalle, setDetalle] = useState<DonacionDetalle | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [editando, setEditando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [recibiendo, setRecibiendo] = useState(false);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');
  const [descargando, setDescargando] = useState(false);

  const [auditoria, setAuditoria] = useState<AuditoriaItem[] | null>(null);
  const [cargandoAud, setCargandoAud] = useState(false);
  const [fotos, setFotos] = useState<Array<{ id_foto: number; nombre_original: string; src: string }>>([]);

  const esAdmin = rol === 'Administrador';
  const esBeneficiario = rol === 'Beneficiario';
  const hijoAbierto = editando || anulando || asignando || recibiendo || cancelando !== null;

  const cargar = useCallback(async (): Promise<void> => {
    if (donacionId === null) return;
    setCargando(true);
    setError('');
    try {
      setDetalle(await donacionApi.obtener(donacionId));
    } catch (e) {
      setError(leerError(e).mensaje);
    } finally {
      setCargando(false);
    }
  }, [donacionId]);

  const cargarFotos = useCallback(async (): Promise<void> => {
    if (donacionId === null) {
      setFotos([]);
      return;
    }
    try {
      const lista = await donacionApi.fotos(donacionId) as Array<{ id_foto: number; nombre_original: string }>;
      const imagenes = await Promise.all(lista.map(async f => {
        const r = await api.get(`/donaciones/${donacionId}/fotos/${f.id_foto}`, { responseType: 'blob' });
        return { id_foto: f.id_foto, nombre_original: f.nombre_original, src: URL.createObjectURL(r.data) };
      }));
      setFotos(imagenes);
    } catch {
      setFotos([]);
    }
  }, [donacionId]);

  useEffect(() => {
    setDetalle(null);
    setAuditoria(null);
    setErrorAccion('');
    setFotos([]);
    if (donacionId !== null) {
      void cargar();
      void cargarFotos();
    }
  }, [donacionId, cargar, cargarFotos]);

  const trasCambio = (): void => {
    setAuditoria(null);
    void cargar();
    void cargarFotos();
    onCambio();
  };

  const verAuditoria = async (): Promise<void> => {
    if (!detalle) return;
    setCargandoAud(true);
    try {
      setAuditoria(await donacionApi.auditoria(detalle.id_donacion));
    } catch (e) {
      toastError(leerError(e).mensaje, 'No se pudo cargar el historial');
    } finally {
      setCargandoAud(false);
    }
  };

  const confirmarAnulacion = async (motivo: string): Promise<void> => {
    if (!detalle) return;
    setProcesando(true);
    setErrorAccion('');
    try {
      const r = await donacionApi.anular(detalle.id_donacion, motivo);
      exito(r.mensaje, 'Donación anulada');
      setAnulando(false);
      trasCambio();
    } catch (e) {
      setErrorAccion(leerError(e).mensaje);
    } finally {
      setProcesando(false);
    }
  };

  const confirmarCancelacion = async (motivo: string): Promise<void> => {
    if (cancelando === null) return;
    setProcesando(true);
    setErrorAccion('');
    try {
      const r = await donacionApi.cancelarAsignacion(cancelando, motivo);
      exito(r.mensaje, 'Asignación cancelada');
      setCancelando(null);
      trasCambio();
    } catch (e) {
      setErrorAccion(leerError(e).mensaje);
    } finally {
      setProcesando(false);
    }
  };

  const bajarComprobante = async (): Promise<void> => {
    if (!detalle) return;
    setDescargando(true);
    try {
      await descargarComprobante(detalle, !esBeneficiario);
    } catch {
      toastError('No se pudo generar el comprobante.', 'Error');
    } finally {
      setDescargando(false);
    }
  };

  // Reglas de habilitación de acciones (espejo de las del servidor)
  const asignacionesActivas = detalle?.asignaciones.filter((a) => a.estado === 'ACTIVA') ?? [];
  const cantidadPendienteRecepcion = detalle ? Math.max(0, detalle.cantidad - detalle.cantidad_recibida) : 0;
  const saldoDisponible = detalle?.saldo ?? 0;
  const cantidadAsignada = detalle?.cantidad_asignada ?? 0;
  const motivoNoAnular =
    detalle?.estado === 'ANULADA'
      ? 'Esta donación ya fue anulada.'
      : asignacionesActivas.length > 0
        ? `Primero cancela las ${asignacionesActivas.length} asignación(es) activa(s).`
        : (detalle?.cantidad_recibida ?? 0) > 0
          ? 'No se puede anular porque ya se recibieron recursos. Este módulo todavía no tiene un proceso de devolución o disposición; registra primero ese movimiento cuando esté disponible.'
          : '';
  const motivoNoRecepcion =
    detalle?.estado === 'ANULADA'
      ? 'No se puede recibir una donación anulada.'
      : cantidadPendienteRecepcion <= 0
        ? 'La recepción está completa: ya se recibió toda la cantidad comprometida.'
        : '';
  const motivoNoModificar =
    detalle?.estado === 'ANULADA'
      ? 'Una donación anulada no se puede modificar.'
      : detalle?.estado === 'ASIGNADA_TOTAL'
        ? 'Toda la cantidad comprometida ya está asignada. Cancela una asignación antes de modificarla.'
        : '';
  const puedeAsignar = detalle ? detalle.estado !== 'ANULADA' && saldoDisponible > 0 : false;

  const unidad = detalle?.tipo_donacion === 'ECONOMICO' ? detalle.moneda_codigo : detalle?.unidad;
  const explicacionEstado = detalle ? ({
    REGISTRADA: 'La donación está registrada. La cantidad comprometida todavía debe recibirse y verificarse antes de poder asignarla.',
    ASIGNADA_PARCIAL: 'Una parte de la cantidad comprometida ya fue asignada. Revisa el saldo disponible y la cantidad que aún falta recibir.',
    ASIGNADA_TOTAL: 'Toda la cantidad comprometida ya tiene beneficiario asignado. Esto no significa que la entrega física o económica ya se haya completado.',
    ANULADA: 'La donación fue anulada y ya no admite nuevas operaciones.',
  } as const)[detalle.estado] : '';

  return (
    <>
      <ModalBase
        isOpen={donacionId !== null}
        titulo={detalle ? `Donación ${detalle.codigo}` : 'Detalle de la donación'}
        subtitulo={detalle ? `${ETIQUETA_TIPO[detalle.tipo_donacion]} · ${formatoFechaHora(detalle.fecha_donacion)}` : undefined}
        ancho="xl"
        bloqueado={hijoAbierto}
        onClose={onClose}
        pie={
          detalle && esAdmin ? (
            <>
              <button type="button" className={btnSecundario} onClick={onClose}>
                Cerrar
              </button>
              <button type="button" className={btnPeligroSuave} disabled={Boolean(motivoNoAnular)} aria-describedby={motivoNoAnular ? 'ayuda-anular-donacion' : undefined} title={motivoNoAnular || 'Anular esta donación'} onClick={() => setAnulando(true)}>
                Anular
              </button>
              <button type="button" className={btnSecundario} disabled={Boolean(motivoNoRecepcion)} aria-describedby={motivoNoRecepcion ? 'ayuda-recepcion-donacion' : undefined} title={motivoNoRecepcion || 'Registrar una recepción verificada'} onClick={() => setRecibiendo(true)}>
                Registrar recepción
              </button>
              <button type="button" className={btnSecundario} disabled={!puedeAsignar} aria-describedby={!puedeAsignar ? 'ayuda-asignar-donacion' : undefined} title={!puedeAsignar ? (detalle.estado === 'ANULADA' ? 'La donación está anulada.' : 'No hay saldo recibido disponible para asignar.') : 'Reservar recursos para un beneficiario'} onClick={() => setAsignando(true)}>
                Asignar a beneficiario
              </button>
              <button type="button" className={btnPrimario} disabled={Boolean(motivoNoModificar)} aria-describedby={motivoNoModificar ? 'ayuda-modificar-donacion' : undefined} title={motivoNoModificar || 'Editar los datos de la donación'} onClick={() => setEditando(true)}>
                Modificar
              </button>
            </>
          ) : undefined
        }
      >
        {cargando && !detalle ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 animate-pulse rounded-full bg-surface-sunken" />
            ))}
            <span className="sr-only">Cargando donación…</span>
          </div>
        ) : error ? (
          <p className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-medium text-error">{error}</p>
        ) : detalle ? (
          <div className="space-y-7">
            {errorAccion && !hijoAbierto && (
              <p role="alert" className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-medium text-error">
                {errorAccion}
              </p>
            )}

            {/* Estado y motivos */}
            <div className="flex flex-wrap items-center gap-2">
              <EstadoBadge estado={detalle.estado} />
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-text-muted">
                {detalle.modalidad === 'PRESENCIAL' ? 'Presencial' : 'En línea'}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-sm font-semibold text-text">¿Qué significa este estado?</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">{explicacionEstado}</p>
              {esAdmin && (
                <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-2">
                  {motivoNoAnular && <p id="ayuda-anular-donacion"><strong className="text-text">Anular:</strong> {motivoNoAnular}</p>}
                  {motivoNoRecepcion && <p id="ayuda-recepcion-donacion"><strong className="text-text">Recepción:</strong> {motivoNoRecepcion}</p>}
                  {!puedeAsignar && <p id="ayuda-asignar-donacion"><strong className="text-text">Asignar:</strong> {detalle.estado === 'ANULADA' ? 'La donación está anulada.' : 'No hay saldo recibido disponible. Registra primero una recepción.'}</p>}
                  {motivoNoModificar && <p id="ayuda-modificar-donacion"><strong className="text-text">Modificar:</strong> {motivoNoModificar}</p>}
                </div>
              )}
            </div>

            {detalle.estado === 'ANULADA' && (
              <div className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
                <p className="font-bold">Donación anulada{detalle.fecha_anulacion ? ` el ${formatoFechaHora(detalle.fecha_anulacion)}` : ''}</p>
                {detalle.motivo_anulacion && <p className="mt-1">Motivo: {detalle.motivo_anulacion}</p>}
              </div>
            )}

            {fotos.length > 0 && (
              <section>
                <h3 className={claseTituloSeccion}>Fotografías de la donación</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {fotos.map(f => <figure key={f.id_foto} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <img src={f.src} alt={f.nombre_original} className="h-36 w-full object-cover" />
                    <figcaption className="truncate px-3 py-2 text-xs text-text-muted">{f.nombre_original}</figcaption>
                  </figure>)}
                </div>
              </section>
            )}

            {/* Datos */}
            <section>
              <h3 className={claseTituloSeccion}>Datos de la donación</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <Dato etiqueta="Tipo">{ETIQUETA_TIPO[detalle.tipo_donacion]}</Dato>
                {detalle.categoria && (
                  <Dato etiqueta={detalle.tipo_donacion === 'ALIMENTO' ? 'Tipo de alimento' : 'Tipo de material'}>{detalle.categoria}</Dato>
                )}
                {detalle.nombre_item && <Dato etiqueta="Artículo">{detalle.nombre_item}</Dato>}
                <Dato etiqueta={detalle.tipo_donacion === 'ECONOMICO' ? 'Monto' : 'Cantidad'}>
                  <strong className="tabular-nums">{formatoCantidad(esBeneficiario ? detalle.cantidad : detalle.cantidad, unidad)}</strong>
                  {esBeneficiario && <span className="ml-1 text-xs text-text-muted">(asignado a ti)</span>}
                </Dato>
                {detalle.unidad_nombre && <Dato etiqueta="Unidad">{detalle.unidad_nombre}</Dato>}
                {detalle.fecha_vencimiento && <Dato etiqueta="Vence">{formatoFecha(detalle.fecha_vencimiento)}</Dato>}
                {detalle.estado_material && <Dato etiqueta="Estado del material">{ETIQUETA_ESTADO_MATERIAL[detalle.estado_material]}</Dato>}
                {detalle.metodo_pago && <Dato etiqueta="Método de pago">{ETIQUETA_METODO_PAGO[detalle.metodo_pago]}</Dato>}
                {detalle.referencia_pago && <Dato etiqueta="Referencia">{detalle.referencia_pago}</Dato>}
                <Dato etiqueta="Destino">
                  {detalle.campana_id ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      🎯 {detalle.campana_nombre ? `Campaña "${detalle.campana_nombre}"` : `Campaña n.º ${detalle.campana_id}`}
                    </span>
                  ) : (
                    <span className="text-text-muted">📦 Inventario General (almacén central)</span>
                  )}
                </Dato>
                {detalle.descripcion && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Dato etiqueta="Descripción">{detalle.descripcion}</Dato>
                  </div>
                )}
              </dl>
            </section>

            {/* Personas */}
            {!esBeneficiario && (
              <section>
                <h3 className={claseTituloSeccion}>Personas</h3>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <Dato etiqueta="Donante">{detalle.donante_nombre ?? '—'}</Dato>
                  <Dato etiqueta="Registrada por">{detalle.registrado_por_nombre ?? '—'}</Dato>
                  {detalle.voluntario_nombre && <Dato etiqueta="Voluntario que recibió">{detalle.voluntario_nombre}</Dato>}
                </dl>
              </section>
            )}

            {/* Saldo y asignaciones */}
            <section>
              <h3 className={claseTituloSeccion}>{esBeneficiario ? 'Asignaciones a tu favor' : 'Saldo y asignaciones'}</h3>
              {!esBeneficiario && <p className="mt-1 text-xs text-text-muted">Asignar significa reservar recursos para un beneficiario; no confirma que ya se hayan entregado.</p>}
              {!esBeneficiario && (
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    ['Comprometido', detalle.cantidad, 'Cantidad prometida o registrada.'],
                    ['Recibido', detalle.cantidad_recibida, 'Cantidad aceptada y verificada.'],
                    ['Pendiente de recibir', cantidadPendienteRecepcion, 'Comprometido menos recibido.'],
                    ['Asignado', cantidadAsignada, 'Cantidad reservada para beneficiarios.'],
                    ['Disponible', saldoDisponible, 'Recibido menos asignaciones activas.'],
                  ].map(([k, v, ayuda]) => (
                    <div key={k as string} title={ayuda as string} className="rounded-2xl border border-border bg-surface px-3 py-3">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{k as string}</dt>
                      <dd className="mt-1 font-display text-lg font-extrabold tabular-nums text-text sm:text-xl">{formatoCantidad(v as number, unidad)}</dd>
                      <dd className="mt-1 text-[10px] leading-snug text-text-subtle">{ayuda as string}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {detalle.asignaciones.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">Esta donación aún no tiene asignaciones.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {detalle.asignaciones.map((a) => (
                    <li key={a.id_asignacion} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">
                          {esBeneficiario ? 'Asignación' : a.beneficiario_nombre} · {formatoCantidad(a.cantidad, unidad)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatoFechaHora(a.fecha_asignacion)}
                          {a.observaciones ? ` · ${a.observaciones}` : ''}
                        </p>
                        {a.estado === 'ACTIVA' && <p className="mt-0.5 text-xs text-text-subtle">Recurso reservado; entrega aún no confirmada.</p>}
                        {a.estado === 'CANCELADA' && a.motivo_cancelacion && (
                          <p className="mt-0.5 text-xs text-text-subtle">Cancelada: {a.motivo_cancelacion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <EstadoAsignacionBadge estado={a.estado} />
                        {esAdmin && a.estado === 'ACTIVA' && (
                          <button type="button" className={btnPeligroSuave} onClick={() => setCancelando(a.id_asignacion)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Comprobante */}
            {detalle.comprobante && (
              <section>
                <h3 className={claseTituloSeccion}>Comprobante</h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-text">{detalle.comprobante.numero_comprobante}</p>
                    <p className="text-xs text-text-muted">
                      Emitido {formatoFechaHora(detalle.comprobante.fecha_emision)} ·{' '}
                      {detalle.comprobante.estado === 'ANULADO' ? 'Anulado' : 'Vigente'}
                    </p>
                  </div>
                  <button type="button" className={btnSecundario} onClick={() => void bajarComprobante()} disabled={descargando}>
                    {descargando ? 'Generando…' : 'Descargar PDF'}
                  </button>
                </div>
              </section>
            )}

            {/* Auditoría (solo administrador) */}
            {esAdmin && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className={claseTituloSeccion}>Historial de cambios</h3>
                  {auditoria === null && (
                    <button type="button" className={btnSecundario} onClick={() => void verAuditoria()} disabled={cargandoAud}>
                      {cargandoAud ? 'Cargando…' : 'Ver historial'}
                    </button>
                  )}
                </div>
                {auditoria && (
                  <ol className="mt-3 space-y-2">
                    {auditoria.map((a) => (
                      <li key={a.id_auditoria} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
                        <p className="font-semibold text-text">
                          {ETIQUETA_ACCION[a.accion] ?? a.accion}{' '}
                          <span className="font-normal text-text-muted">· {a.usuario_nombre}</span>
                        </p>
                        <p className="text-xs text-text-muted">{formatoFechaHora(a.fecha_hora)}</p>
                        {a.motivo && <p className="mt-0.5 text-xs text-text-subtle">Motivo: {a.motivo}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        ) : null}
      </ModalBase>

      {/* Modales hijos */}
      <DonacionFormModal
        isOpen={editando}
        modo="editar"
        donacion={detalle}
        onClose={() => setEditando(false)}
        onGuardado={trasCambio}
      />

      <MotivoModal
        isOpen={anulando}
        titulo="Anular donación"
        mensaje={`La donación ${detalle?.codigo ?? ''} se marcará como anulada y dejará de admitir nuevas operaciones. Solo puedes continuar si no hay asignaciones activas ni recursos recibidos. Esta acción no se puede deshacer.`}
        etiqueta="Motivo de anulación"
        textoConfirmar="Anular donación"
        cargando={procesando}
        errorServidor={errorAccion}
        onConfirm={(m) => void confirmarAnulacion(m)}
        onCancel={() => {
          setAnulando(false);
          setErrorAccion('');
        }}
      />

      <MotivoModal
        isOpen={cancelando !== null}
        titulo="Cancelar asignación"
        mensaje="La cantidad reservada volverá al saldo disponible de la donación. Esto cancela la reserva, no registra una entrega ni una devolución al donante."
        etiqueta="Motivo de cancelación"
        textoConfirmar="Cancelar asignación"
        cargando={procesando}
        errorServidor={errorAccion}
        onConfirm={(m) => void confirmarCancelacion(m)}
        onCancel={() => {
          setCancelando(null);
          setErrorAccion('');
        }}
      />

      <AsignarModal isOpen={asignando} donacion={detalle} onClose={() => setAsignando(false)} onAsignado={trasCambio} />
      {detalle && <RecepcionModal isOpen={recibiendo} donacionId={detalle.id_donacion} tipo={detalle.tipo_donacion} pendiente={cantidadPendienteRecepcion} unidad={unidad ?? null} onClose={() => setRecibiendo(false)} onSuccess={trasCambio} />}
    </>
  );
};

export default DonacionDetalleModal;
