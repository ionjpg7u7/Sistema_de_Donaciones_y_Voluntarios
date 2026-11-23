/**
 * ============================================================================
 * ARCHIVO: DonacionFormModal.tsx
 * COMPONENTE: Formulario de donación en tres modos:
 *   - 'propia'     → Donante registra su donación (CU Registrar donación).
 *   - 'presencial' → Voluntario/Administrador registra por un donante
 *                    (CU Registrar donación presencial: búsqueda + confirmación).
 *   - 'editar'     → Administrador corrige una donación (CU Modificar donación):
 *                    tipo, donante y fecha bloqueados; control de versión.
 * Tras registrar muestra el comprobante para descargar.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import ModalBase from './ModalBase';
import FieldError from '../ui/FieldError';
import { useToast } from '../../context/ToastContext';
import donacionApi, { leerError } from '../../api/donacion.api';
import { descargarComprobante } from '../../utils/comprobantePdf';
import {
  ETIQUETA_ESTADO_MATERIAL,
  ETIQUETA_METODO_PAGO,
  ETIQUETA_TIPO,
  formatoFecha,
  mananaBolivia,
} from '../../utils/donacionFormat';
import {
  construirPayload,
  validarDonacionForm,
  valoresIniciales,
  type ErroresForm,
} from '../../utils/donacionValidaciones';
import type {
  CampanaResumen,
  CatalogosDonacion,
  ComprobanteItem,
  DonacionDetalle,
  DonacionFormValores,
  DonanteBusqueda,
  TipoDonacion,
} from '../../types/donacion.types';
import { btnPrimario, btnSecundario, claseEtiqueta, claseInput, claseInputError, claseTituloSeccion } from './estilos';

export type ModoFormulario = 'propia' | 'presencial' | 'editar';

interface Props {
  isOpen: boolean;
  modo: ModoFormulario;
  /** Solo en modo 'editar'. */
  donacion?: DonacionDetalle | null;
  /**
   * Sprint 3 — ID de campaña pre-seleccionada cuando el usuario viene desde
   * /campanas → "Donar a esta Campaña". Solo aplica en modo 'propia'.
   */
  campanaIdInicial?: number;
  onClose: () => void;
  /** Se invoca tras guardar con éxito (para refrescar listados). */
  onGuardado: () => void;
}

const TIPOS: TipoDonacion[] = ['ALIMENTO', 'MATERIAL', 'ECONOMICO'];

const iconoTipo: Record<TipoDonacion, string> = {
  ALIMENTO: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  MATERIAL: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  ECONOMICO: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const desdeDetalle = (d: DonacionDetalle): DonacionFormValores => ({
  ...valoresIniciales(),
  tipo_donacion: d.tipo_donacion,
  cantidad: d.tipo_donacion === 'ECONOMICO' ? '' : String(d.cantidad),
  descripcion: d.descripcion ?? '',
  campana_id: d.campana_id ? String(d.campana_id) : '',
  categoria_id: d.categoria_id ? String(d.categoria_id) : '',
  unidad_medida_id: d.unidad_medida_id ? String(d.unidad_medida_id) : '',
  nombre_item: d.nombre_item ?? '',
  fecha_vencimiento: d.fecha_vencimiento ?? '',
  estado_material: d.estado_material ?? '',
  monto: d.tipo_donacion === 'ECONOMICO' ? String(d.monto ?? d.cantidad) : '',
  moneda_codigo: d.moneda_codigo ?? 'BOB',
  metodo_pago: d.metodo_pago ?? '',
  referencia_pago: d.referencia_pago ?? '',
});

interface CampoProps {
  campo: keyof DonacionFormValores;
  etiqueta: string;
  errores: ErroresForm;
  intento: boolean;
  requerido?: boolean;
  children: ReactNode;
}

/** Definido FUERA del componente principal: si se declarara adentro, React lo
 *  remontaría en cada tecla y los inputs perderían el foco. */
const Campo = ({ campo, etiqueta, errores, intento, requerido = true, children }: CampoProps) => (
  <div>
    <label htmlFor={`f-${campo}`} className={claseEtiqueta}>
      {etiqueta} {requerido && '*'}
    </label>
    {children}
    <FieldError error={errores[campo]} touched={intento} />
  </div>
);

const DonacionFormModal = ({ isOpen, modo, donacion, campanaIdInicial, onClose, onGuardado }: Props) => {
  const { exito, error: toastError } = useToast();

  const [catalogos, setCatalogos] = useState<CatalogosDonacion | null>(null);
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);
  const [valores, setValores] = useState<DonacionFormValores>(valoresIniciales());
  const [errores, setErrores] = useState<ErroresForm>({});
  const [erroresServidor, setErroresServidor] = useState<string[]>([]);
  const [intento, setIntento] = useState(false);
  const [cargandoCat, setCargandoCat] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');

  // Presencial: búsqueda y selección del donante
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<DonanteBusqueda[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [donante, setDonante] = useState<DonanteBusqueda | null>(null);

  // Resultado del registro (comprobante)
  const [registrada, setRegistrada] = useState<{ id: number; codigo: string; comprobante: ComprobanteItem } | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);

  const edicion = modo === 'editar';

  // --------------------------------------------------------------- carga inicial
  useEffect(() => {
    if (!isOpen) return;
    let vivo = true;

    // Inicializar valores: si hay campanaIdInicial, pre-seleccionarla
    const valoresBase = edicion && donacion ? desdeDetalle(donacion) : valoresIniciales();
    if (campanaIdInicial && !edicion) {
      valoresBase.campana_id = String(campanaIdInicial);
    }
    setValores(valoresBase);

    setErrores({});
    setErroresServidor([]);
    setIntento(false);
    setRegistrada(null);
    setFotos([]);
    setBusqueda('');
    setResultados(null);
    setErrorBusqueda('');
    setDonante(null);
    setErrorCarga('');
    setCargandoCat(true);

    Promise.all([donacionApi.catalogos(), donacionApi.campanasActivas()])
      .then(([cat, camp]) => {
        if (!vivo) return;
        setCatalogos(cat);
        setCampanas(camp);
      })
      .catch((e) => vivo && setErrorCarga(leerError(e).mensaje))
      .finally(() => vivo && setCargandoCat(false));

    return () => {
      vivo = false;
    };
  }, [isOpen, edicion, donacion, campanaIdInicial]);

  const cambiar = useCallback(
    <K extends keyof DonacionFormValores>(campo: K, valor: DonacionFormValores[K]): void => {
      setValores((prev) => {
        const sig = { ...prev, [campo]: valor };
        // Al cambiar de tipo se limpian los campos propios del tipo anterior.
        if (campo === 'tipo_donacion') {
          return {
            ...valoresIniciales(),
            tipo_donacion: valor as DonacionFormValores['tipo_donacion'],
            descripcion: prev.descripcion,
            campana_id: prev.campana_id,
          };
        }
        return sig;
      });
      setErroresServidor([]);
      if (intento && catalogos) {
        // Revalida en vivo después del primer intento de envío
        setErrores((prevE) => {
          const nuevos = validarDonacionForm({ ...valores, [campo]: valor }, catalogos, {
            vencimientoOriginal: donacion?.fecha_vencimiento,
          });
          return { ...prevE, [campo]: nuevos[campo] };
        });
      }
    },
    [intento, catalogos, valores, donacion]
  );

  const categoriasDelTipo = useMemo(
    () => (catalogos && valores.tipo_donacion ? catalogos.categorias.filter((c) => c.tipo === valores.tipo_donacion) : []),
    [catalogos, valores.tipo_donacion]
  );
  const unidadElegida = catalogos?.unidades.find((u) => String(u.id_unidad) === valores.unidad_medida_id);

  // --------------------------------------------------------------- presencial
  const buscarDonante = async (): Promise<void> => {
    setErrorBusqueda('');
    setResultados(null);
    if (busqueda.trim().length < 3) {
      setErrorBusqueda('Ingresa al menos 3 caracteres (nombre, apellido, correo o teléfono).');
      return;
    }
    setBuscando(true);
    try {
      setResultados(await donacionApi.buscarDonantes(busqueda.trim()));
    } catch (e) {
      setErrorBusqueda(leerError(e).mensaje);
    } finally {
      setBuscando(false);
    }
  };

  // --------------------------------------------------------------- envío
  const enviar = async (ev: FormEvent): Promise<void> => {
    ev.preventDefault();
    if (!catalogos || guardando) return;
    setIntento(true);
    setErroresServidor([]);

    const e = validarDonacionForm(valores, catalogos, { vencimientoOriginal: donacion?.fecha_vencimiento });
    setErrores(e);
    if (Object.keys(e).length > 0) return;

    setGuardando(true);
    try {
      const payload = construirPayload(valores);
      if (edicion && donacion) {
        await donacionApi.modificar(donacion.id_donacion, { ...payload, version: donacion.version });
        let errorFotos = false;
        if (fotos.length) {
          try {
            await donacionApi.subirFotos(donacion.id_donacion, fotos);
          } catch (errorFoto) {
            errorFotos = true;
            toastError(leerError(errorFoto).mensaje || 'No se pudieron guardar las fotografías.', 'Fotografías pendientes');
          }
        }
        if (!errorFotos) exito('La donación se actualizó correctamente.', 'Cambios guardados');
        else exito('Los datos se actualizaron; revisa el aviso de fotografías pendientes.', 'Donación actualizada');
        onGuardado();
        onClose();
      } else if (modo === 'presencial' && donante) {
        const r = await donacionApi.registrarPresencial({ ...payload, donante_usuario_id: donante.id_usuario });
        if (fotos.length) { try { await donacionApi.subirFotos(r.donacion.id_donacion, fotos); } catch { toastError('La donación se registró, pero no se pudieron guardar las fotografías. Puedes volver a adjuntarlas desde el detalle.', 'Fotografías pendientes'); } }
        setRegistrada({ id: r.donacion.id_donacion, codigo: r.donacion.codigo, comprobante: r.comprobante });
        exito(`Donación ${r.donacion.codigo} registrada.`, 'Registro exitoso');
        onGuardado();
      } else {
        const r = await donacionApi.registrar(payload);
        if (fotos.length) { try { await donacionApi.subirFotos(r.donacion.id_donacion, fotos); } catch { toastError('La donación se registró, pero no se pudieron guardar las fotografías. Puedes volver a adjuntarlas desde el detalle.', 'Fotografías pendientes'); } }
        setRegistrada({ id: r.donacion.id_donacion, codigo: r.donacion.codigo, comprobante: r.comprobante });
        exito(`Donación ${r.donacion.codigo} registrada. ¡Gracias por tu aporte!`, 'Registro exitoso');
        onGuardado();
      }
    } catch (err) {
      const info = leerError(err);
      if (info.errores.length > 0) setErroresServidor(info.errores);
      else setErroresServidor([info.mensaje]);
      if (info.status === 409) onGuardado(); // conflicto: el listado se refresca
      if (!info.errores.length) toastError(info.mensaje, 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  const bajarComprobante = async (): Promise<void> => {
    if (!registrada) return;
    setDescargando(true);
    try {
      const detalle = await donacionApi.obtener(registrada.id);
      await descargarComprobante(detalle);
    } catch (e) {
      toastError(leerError(e).mensaje, 'No se pudo generar el comprobante');
    } finally {
      setDescargando(false);
    }
  };

  // --------------------------------------------------------------- render
  const titulo =
    modo === 'editar' ? `Modificar donación ${donacion?.codigo ?? ''}` : modo === 'presencial' ? 'Registrar donación presencial' : 'Registrar donación';

  const subtituloContexto = campanaIdInicial && modo === 'propia'
    ? `Donando a la campaña #${campanaIdInicial}. Puedes cambiarlo abajo si lo deseas.`
    : undefined;

  const mostrarFormulario = modo !== 'presencial' || donante !== null;
  const cls = (campo: keyof DonacionFormValores): string => (errores[campo] ? claseInputError : claseInput);

  return (
    <ModalBase
      isOpen={isOpen}
      titulo={titulo}
      subtitulo={
        registrada
          ? undefined
          : edicion
            ? 'El donante, el tipo y la fecha de la donación no se pueden cambiar.'
            : subtituloContexto ?? 'Los campos con * son obligatorios.'
      }
      ancho="lg"
      bloqueado={guardando}
      onClose={onClose}
      pie={
        registrada ? (
          <>
            <button type="button" className={btnSecundario} onClick={onClose}>
              Cerrar
            </button>
            <button type="button" className={btnPrimario} onClick={() => void bajarComprobante()} disabled={descargando}>
              {descargando ? 'Generando…' : 'Descargar comprobante (PDF)'}
            </button>
          </>
        ) : mostrarFormulario ? (
          <>
            <button type="button" className={btnSecundario} onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" form="form-donacion" className={btnPrimario} disabled={guardando || cargandoCat || !catalogos}>
              {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Registrar donación'}
            </button>
          </>
        ) : undefined
      }
    >
      {/* ------------ Éxito: comprobante ------------ */}
      {registrada ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <h3 className="font-display text-xl font-bold text-text">Donación registrada</h3>
          <p className="text-sm text-text-muted">
            Código <strong className="text-text">{registrada.codigo}</strong> · Comprobante{' '}
            <strong className="text-text">{registrada.comprobante.numero_comprobante}</strong>
          </p>
          <p className="max-w-sm text-xs text-text-subtle">
            {modo === 'presencial'
              ? 'Entrega o imprime el comprobante al donante. También se le notificó por correo.'
              : 'Te enviamos una notificación por correo. Puedes descargar el comprobante cuando quieras desde tu historial.'}
          </p>
        </div>
      ) : cargandoCat ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />
          ))}
          <span className="sr-only">Cargando formulario…</span>
        </div>
      ) : errorCarga || !catalogos ? (
        <p className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm font-medium text-error">
          {errorCarga || 'No se pudo cargar el formulario.'}
        </p>
      ) : (
        <>
          {/* ------------ Presencial: paso 1, buscar donante ------------ */}
          {modo === 'presencial' && (
            <section className="mb-6" aria-labelledby="titulo-donante">
              <h3 id="titulo-donante" className={claseTituloSeccion}>
                1. Donante
              </h3>

              {donante ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success-soft px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text">
                      {donante.nombre} {donante.apellido}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {donante.correo}
                      {donante.telefono ? ` · ${donante.telefono}` : ''}
                    </p>
                  </div>
                  <button type="button" className={btnSecundario} onClick={() => setDonante(null)}>
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(ev) => setBusqueda(ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') {
                          ev.preventDefault();
                          void buscarDonante();
                        }
                      }}
                      placeholder="Nombre, apellido, correo o teléfono del donante"
                      aria-label="Buscar donante"
                      className={claseInput}
                    />
                    <button type="button" className={btnPrimario} onClick={() => void buscarDonante()} disabled={buscando}>
                      {buscando ? 'Buscando…' : 'Buscar'}
                    </button>
                  </div>
                  {errorBusqueda && <p className="text-xs font-medium text-error">{errorBusqueda}</p>}

                  {resultados && resultados.length === 0 && (
                    <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-muted">
                      No se encontró ningún donante. Solicita su alta a un administrador desde Gestión de usuarios y vuelve a buscar.
                    </p>
                  )}

                  {resultados && resultados.length > 0 && (
                    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                      {resultados.map((r) => {
                        const inactivo = r.estado !== 'Activo';
                        return (
                          <li key={r.id_usuario} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text">
                                {r.nombre} {r.apellido}
                              </p>
                              <p className="truncate text-xs text-text-muted">
                                {r.correo}
                                {r.telefono ? ` · ${r.telefono}` : ''}
                              </p>
                              {inactivo && (
                                <p className="mt-1 text-xs font-semibold text-warning">Cuenta inactiva: no se puede registrar a su nombre.</p>
                              )}
                            </div>
                            <button type="button" className={btnSecundario} disabled={inactivo} onClick={() => setDonante(r)}>
                              Es esta persona
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ------------ Formulario ------------ */}
          {mostrarFormulario && (
            <form id="form-donacion" onSubmit={(ev) => void enviar(ev)} noValidate className="space-y-6">
              {modo === 'presencial' && <h3 className={claseTituloSeccion}>2. Datos de la donación</h3>}

              {erroresServidor.length > 0 && (
                <div role="alert" className="rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
                  <p className="font-bold">Revisa lo siguiente:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {erroresServidor.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                  <label htmlFor="f-fotos" className={claseEtiqueta}>Fotografías de la donación (opcional)</label>
                  <input id="f-fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple
                    onChange={ev => setFotos(Array.from(ev.target.files ?? []).slice(0,5))}
                    className="block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text" />
                  <p className="text-xs text-text-muted">Hasta 5 imágenes JPG, PNG o WEBP; máximo 5 MB cada una.</p>
                  {fotos.length > 0 && <p className="text-xs font-semibold text-primary">{fotos.length} fotografía(s) seleccionada(s): {fotos.map(f => f.name).join(', ')}</p>}
                </div>

              {/* Tipo */}
              <fieldset disabled={edicion}>
                <legend className={claseEtiqueta}>Tipo de donación *</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {TIPOS.map((t) => {
                    const activo = valores.tipo_donacion === t;
                    return (
                      <label
                        key={t}
                        className={`press flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                          activo ? 'border-primary bg-primary-soft text-text' : 'border-border bg-surface text-text-muted hover:border-border-strong'
                        } ${edicion ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        <input
                          type="radio"
                          name="tipo_donacion"
                          value={t}
                          checked={activo}
                          onChange={() => cambiar('tipo_donacion', t)}
                          className="sr-only"
                        />
                        <svg className={`h-5 w-5 shrink-0 ${activo ? 'text-primary' : 'text-text-subtle'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={iconoTipo[t]} />
                        </svg>
                        {ETIQUETA_TIPO[t]}
                      </label>
                    );
                  })}
                </div>
                <FieldError error={errores.tipo_donacion} touched={intento} />
              </fieldset>

              {valores.tipo_donacion && (
                <>
                  {/* Campos por tipo */}
                  <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {valores.tipo_donacion !== 'ECONOMICO' && (
                      <>
                        <Campo errores={errores} intento={intento} campo="categoria_id" etiqueta={valores.tipo_donacion === 'ALIMENTO' ? 'Tipo de alimento' : 'Tipo de material'}>
                          <select
                            id="f-categoria_id"
                            value={valores.categoria_id}
                            onChange={(ev) => cambiar('categoria_id', ev.target.value)}
                            className={cls('categoria_id')}
                          >
                            <option value="">Selecciona…</option>
                            {categoriasDelTipo.map((c) => (
                              <option key={c.id_categoria} value={c.id_categoria}>
                                {c.nombre}
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo errores={errores} intento={intento} campo="nombre_item" etiqueta={valores.tipo_donacion === 'ALIMENTO' ? 'Producto (opcional)' : 'Artículo (opcional)'} requerido={false}>
                          <input
                            id="f-nombre_item"
                            type="text"
                            maxLength={120}
                            value={valores.nombre_item}
                            onChange={(ev) => cambiar('nombre_item', ev.target.value)}
                            placeholder={valores.tipo_donacion === 'ALIMENTO' ? 'Ej. Arroz, fideo, leche' : 'Ej. Chompas, cuadernos'}
                            className={cls('nombre_item')}
                          />
                        </Campo>

                        <Campo errores={errores} intento={intento} campo="unidad_medida_id" etiqueta="Unidad de medida">
                          <select
                            id="f-unidad_medida_id"
                            value={valores.unidad_medida_id}
                            onChange={(ev) => cambiar('unidad_medida_id', ev.target.value)}
                            className={cls('unidad_medida_id')}
                          >
                            <option value="">Selecciona…</option>
                            {catalogos.unidades.map((u) => (
                              <option key={u.id_unidad} value={u.id_unidad}>
                                {u.nombre} ({u.codigo})
                              </option>
                            ))}
                          </select>
                        </Campo>

                        <Campo errores={errores} intento={intento} campo="cantidad" etiqueta="Cantidad">
                          <input
                            id="f-cantidad"
                            type="number"
                            inputMode="decimal"
                            min={unidadElegida?.permite_decimales ? 0.01 : 1}
                            step={unidadElegida?.permite_decimales ? 0.01 : 1}
                            value={valores.cantidad}
                            onChange={(ev) => cambiar('cantidad', ev.target.value)}
                            className={cls('cantidad')}
                          />
                        </Campo>
                      </>
                    )}

                    {valores.tipo_donacion === 'ALIMENTO' && (
                      <Campo errores={errores} intento={intento} campo="fecha_vencimiento" etiqueta="Fecha de vencimiento">
                        <input
                          id="f-fecha_vencimiento"
                          type="date"
                          min={edicion && donacion?.fecha_vencimiento && donacion.fecha_vencimiento <= mananaBolivia() ? donacion.fecha_vencimiento : mananaBolivia()}
                          value={valores.fecha_vencimiento}
                          onChange={(ev) => cambiar('fecha_vencimiento', ev.target.value)}
                          className={cls('fecha_vencimiento')}
                        />
                      </Campo>
                    )}

                    {valores.tipo_donacion === 'MATERIAL' && (
                      <Campo errores={errores} intento={intento} campo="estado_material" etiqueta="Estado del material">
                        <select
                          id="f-estado_material"
                          value={valores.estado_material}
                          onChange={(ev) => cambiar('estado_material', ev.target.value as DonacionFormValores['estado_material'])}
                          className={cls('estado_material')}
                        >
                          <option value="">Selecciona…</option>
                          {catalogos.estados_material.map((m) => (
                            <option key={m} value={m}>
                              {ETIQUETA_ESTADO_MATERIAL[m]}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    )}

                    {valores.tipo_donacion === 'ECONOMICO' && (
                      <>
                        <Campo errores={errores} intento={intento} campo="monto" etiqueta="Monto">
                          <input
                            id="f-monto"
                            type="number"
                            inputMode="decimal"
                            min={0.01}
                            step={0.01}
                            value={valores.monto}
                            onChange={(ev) => cambiar('monto', ev.target.value)}
                            className={cls('monto')}
                          />
                        </Campo>
                        <Campo errores={errores} intento={intento} campo="moneda_codigo" etiqueta="Moneda">
                          <select
                            id="f-moneda_codigo"
                            value={valores.moneda_codigo}
                            onChange={(ev) => cambiar('moneda_codigo', ev.target.value as DonacionFormValores['moneda_codigo'])}
                            className={cls('moneda_codigo')}
                          >
                            {catalogos.monedas.map((m) => (
                              <option key={m} value={m}>
                                {m === 'BOB' ? 'Bolivianos (BOB)' : 'Dólares (USD)'}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo errores={errores} intento={intento} campo="metodo_pago" etiqueta="Método de pago">
                          <select
                            id="f-metodo_pago"
                            value={valores.metodo_pago}
                            onChange={(ev) => cambiar('metodo_pago', ev.target.value as DonacionFormValores['metodo_pago'])}
                            className={cls('metodo_pago')}
                          >
                            <option value="">Selecciona…</option>
                            {catalogos.metodos_pago.map((m) => (
                              <option key={m} value={m}>
                                {ETIQUETA_METODO_PAGO[m]}
                              </option>
                            ))}
                          </select>
                        </Campo>
                        <Campo errores={errores} intento={intento} campo="referencia_pago" etiqueta="Referencia del pago (opcional)" requerido={false}>
                          <input
                            id="f-referencia_pago"
                            type="text"
                            maxLength={80}
                            value={valores.referencia_pago}
                            onChange={(ev) => cambiar('referencia_pago', ev.target.value)}
                            placeholder="N.º de transferencia o depósito"
                            className={cls('referencia_pago')}
                          />
                        </Campo>
                      </>
                    )}
                  </div>

                  {/* Comunes */}
                  <Campo errores={errores} intento={intento} campo="descripcion" etiqueta="Descripción (opcional)" requerido={false}>
                    <textarea
                      id="f-descripcion"
                      rows={3}
                      maxLength={1000}
                      value={valores.descripcion}
                      onChange={(ev) => cambiar('descripcion', ev.target.value)}
                      placeholder="Detalles que ayuden a identificar o entregar la donación"
                      className={cls('descripcion')}
                    />
                  </Campo>

                  {/* Destino: Campaña o Inventario */}
                  <div>
                    <label htmlFor="f-campana_id" className={claseEtiqueta}>
                      Destino de la donación
                    </label>
                    {/* Sprint 3: banner cuando viene de una campaña específica */}
                    {campanaIdInicial && !edicion && (
                      <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                        <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Tu donación está pre-asignada a la campaña seleccionada. Puedes cambiar el destino si lo deseas.
                      </div>
                    )}
                    {campanas.length === 0 ? (
                      <p className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-muted">
                        No hay campañas activas disponibles. La donación ingresará directamente al inventario general.
                      </p>
                    ) : (
                      <select
                        id="f-campana_id"
                        value={valores.campana_id}
                        onChange={(ev) => cambiar('campana_id', ev.target.value)}
                        className={claseInput}
                      >
                        <option value="">📦 Directo al Inventario General (almacén central)</option>
                        {campanas.map((c) => (
                          <option key={c.id_campana} value={c.id_campana}>
                            🎯 Campaña: {c.nombre} ({formatoFecha(c.fecha_inicio)} – {formatoFecha(c.fecha_fin)})
                          </option>
                        ))}
                      </select>
                    )}
                    {valores.campana_id ? (
                      <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <span>🎯</span> Esta donación se asignará directamente a la campaña seleccionada.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-text-muted flex items-center gap-1.5">
                        <span>📦</span> Esta donación ingresará al inventario general para ser canalizada según las necesidades de la comunidad.
                      </p>
                    )}
                  </div>
                </>
              )}
            </form>
          )}
        </>
      )}
    </ModalBase>
  );
};

export default DonacionFormModal;
