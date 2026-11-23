/**
 * ============================================================================
 * ARCHIVO: DonacionesTab.tsx
 * PESTAÑA 1 · Donaciones: historial según rol (CU Consultar historial), con
 * filtros, paginación de servidor, registro (online/presencial) y detalle.
 *   - Administrador → todas · Donante → propias · Voluntario → las que registró
 *   - Beneficiario  → las asignadas a él (sin datos del donante)
 * ============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import DonacionFormModal, { type ModoFormulario } from './DonacionFormModal';
import DonacionDetalleModal from './DonacionDetalleModal';
import { EstadoBadge } from './EstadoBadge';
import donacionApi, { leerError } from '../../api/donacion.api';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  formatoCantidad,
  formatoFecha,
} from '../../utils/donacionFormat';
import type {
  CampanaResumen,
  DonacionListaItem,
  EstadoDonacion,
  FiltrosDonacion,
  Paginado,
  RolDonaciones,
  TipoDonacion,
} from '../../types/donacion.types';
import { btnPrimario, btnSecundario, claseInput, tarjeta } from './estilos';

interface Props {
  rol: RolDonaciones;
  /** Sprint 3: ID de campaña pre-seleccionada cuando se viene desde /campanas */
  campanaIdInicial?: number;
  /** Se invoca una vez que el campanaIdInicial fue consumido */
  onCampanaIdConsumido?: () => void;
}

const FILTROS_VACIOS: FiltrosDonacion = {
  desde: '',
  hasta: '',
  tipo: '',
  estado: '',
  campana_id: '',
  q: '',
  page: 1,
  limit: 10,
};

const TITULOS: Record<RolDonaciones, { titulo: string; subtitulo: string }> = {
  Administrador: { titulo: 'Todas las donaciones', subtitulo: 'Registra, corrige, asigna y anula donaciones.' },
  Donante: { titulo: 'Mis donaciones', subtitulo: 'Tu historial de aportes y sus comprobantes.' },
  Voluntario: { titulo: 'Donaciones que registré', subtitulo: 'Donaciones recibidas en persona y registradas por ti.' },
  Beneficiario: { titulo: 'Donaciones asignadas a mí', subtitulo: 'Ayuda que se te asignó. Los datos del donante se mantienen en reserva.' },
};

const TIPOS: TipoDonacion[] = ['ALIMENTO', 'MATERIAL', 'ECONOMICO'];
const ESTADOS: EstadoDonacion[] = ['REGISTRADA', 'ASIGNADA_PARCIAL', 'ASIGNADA_TOTAL', 'ANULADA'];

const unidadMostrada = (d: DonacionListaItem): string | null => d.unidad;

const DonacionesTab = ({ rol, campanaIdInicial, onCampanaIdConsumido }: Props) => {
  const [borrador, setBorrador] = useState<FiltrosDonacion>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<FiltrosDonacion>(FILTROS_VACIOS);
  const [datos, setDatos] = useState<Paginado<DonacionListaItem> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [errorFiltro, setErrorFiltro] = useState('');
  const [campanas, setCampanas] = useState<CampanaResumen[]>([]);

  const [formulario, setFormulario] = useState<ModoFormulario | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  // campanaIdInicial consumido: estado local para pasarlo al modal
  const [campanaIdModalInicial, setCampanaIdModalInicial] = useState<number | undefined>(campanaIdInicial);

  const { usuario } = useAuth();
  const puedeDonar = rol === 'Donante' || Boolean(usuario?.roles?.includes('Donante'));
  const puedePresencial = rol === 'Voluntario' || rol === 'Administrador';
  const veDonante = rol === 'Administrador' || rol === 'Voluntario';
  const { titulo, subtitulo } = TITULOS[rol] ?? TITULOS.Donante;

  // Sprint 3: si llegamos con campanaIdInicial, abrimos el modal de donar automáticamente
  useEffect(() => {
    if (campanaIdInicial && puedeDonar) {
      setCampanaIdModalInicial(campanaIdInicial);
      setFormulario('propia');
      onCampanaIdConsumido?.();
    }
  }, [campanaIdInicial, puedeDonar]);

  const cargar = useCallback(async (): Promise<void> => {
    setCargando(true);
    setError('');
    try {
      setDatos(await donacionApi.listar(aplicados));
    } catch (e) {
      setError(leerError(e).mensaje);
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Campañas activas para el filtro (si existen). El Beneficiario no las usa.
  useEffect(() => {
    if (rol === 'Beneficiario') return;
    donacionApi
      .campanasActivas()
      .then(setCampanas)
      .catch(() => setCampanas([]));
  }, [rol]);

  const filtrar = (): void => {
    if (borrador.desde && borrador.hasta && borrador.desde > borrador.hasta) {
      setErrorFiltro('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }
    setErrorFiltro('');
    setAplicados({ ...borrador, page: 1 });
  };

  const limpiar = (): void => {
    setErrorFiltro('');
    setBorrador(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
  };

  const hayFiltros = Boolean(
    aplicados.desde || aplicados.hasta || aplicados.tipo || aplicados.estado || aplicados.campana_id || aplicados.q
  );

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.limit)) : 1;
  const irAPagina = (p: number): void => setAplicados((a) => ({ ...a, page: Math.min(Math.max(1, p), totalPaginas) }));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-text md:text-2xl">{titulo}</h2>
          <p className="mt-1 text-sm text-text-muted">{subtitulo}</p>
          {rol === 'Administrador' && <p className="mt-2 max-w-3xl text-xs leading-relaxed text-text-subtle">Comprometido = lo prometido; recibido = lo verificado; disponible = lo recibido menos lo reservado. Una asignación todavía no significa que el beneficiario recibió la ayuda.</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {puedeDonar && (
            <button type="button" className={btnPrimario} onClick={() => setFormulario('propia')}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Donar
            </button>
          )}
          {puedePresencial && (
            <button type="button" className={btnPrimario} onClick={() => setFormulario('presencial')}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Registrar donación presencial
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <form
        className={`${tarjeta} p-4 sm:p-5`}
        onSubmit={(ev) => {
          ev.preventDefault();
          filtrar();
        }}
        aria-label="Filtros de donaciones"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="flt-q" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Buscar
            </label>
            <input
              id="flt-q"
              type="search"
              value={borrador.q}
              onChange={(e) => setBorrador({ ...borrador, q: e.target.value })}
              placeholder={veDonante ? 'Código, donante o descripción' : 'Código o descripción'}
              className={claseInput}
            />
          </div>
          <div>
            <label htmlFor="flt-tipo" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Tipo
            </label>
            <select id="flt-tipo" value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as FiltrosDonacion['tipo'] })} className={claseInput}>
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flt-estado" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Estado
            </label>
            <select id="flt-estado" value={borrador.estado} onChange={(e) => setBorrador({ ...borrador, estado: e.target.value as FiltrosDonacion['estado'] })} className={claseInput}>
              <option value="">Todos</option>
              {ESTADOS.map((s) => (
                <option key={s} value={s}>
                  {ETIQUETA_ESTADO[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="flt-desde" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Desde
            </label>
            <input id="flt-desde" type="date" value={borrador.desde} max={borrador.hasta || undefined} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} className={claseInput} />
          </div>
          <div>
            <label htmlFor="flt-hasta" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
              Hasta
            </label>
            <input id="flt-hasta" type="date" value={borrador.hasta} min={borrador.desde || undefined} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} className={claseInput} />
          </div>
          {campanas.length > 0 && (
            <div className="lg:col-span-2">
              <label htmlFor="flt-campana" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Campaña
              </label>
              <select id="flt-campana" value={borrador.campana_id} onChange={(e) => setBorrador({ ...borrador, campana_id: e.target.value })} className={claseInput}>
                <option value="">Todas</option>
                {campanas.map((c) => (
                  <option key={c.id_campana} value={c.id_campana}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {errorFiltro && (
          <p role="alert" className="mt-3 text-xs font-semibold text-error">
            {errorFiltro}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecundario} onClick={limpiar} disabled={!hayFiltros && !borrador.q && !borrador.tipo && !borrador.estado && !borrador.desde && !borrador.hasta}>
            Limpiar filtros
          </button>
          <button type="submit" className={btnPrimario}>
            Filtrar
          </button>
        </div>
      </form>

      {/* Resultados */}
      <div className={`${tarjeta} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <p className="text-xs text-text-muted" aria-live="polite">
            {datos ? (
              <>
                <span className="font-semibold text-text">{datos.total}</span> {datos.total === 1 ? 'donación' : 'donaciones'}
              </>
            ) : (
              'Cargando…'
            )}
          </p>
          <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-text-muted">
            Por página
            <select
              value={aplicados.limit}
              onChange={(e) => {
                const limit = Number(e.target.value);
                setBorrador((b) => ({ ...b, limit }));
                setAplicados((a) => ({ ...a, limit, page: 1 }));
              }}
              className="rounded-lg border border-border bg-surface-elevated px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        {cargando && !datos ? (
          <div className="space-y-3 px-4 py-6 sm:px-6" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-5 animate-pulse rounded-full bg-surface-sunken" />
            ))}
            <span className="sr-only">Cargando donaciones…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 px-6 py-8">
            <p className="font-medium text-error">{error}</p>
            <button type="button" className={btnSecundario} onClick={() => void cargar()}>
              Reintentar
            </button>
          </div>
        ) : datos && datos.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-text-subtle">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </span>
            <p className="text-sm text-text-muted">{hayFiltros ? 'Ninguna donación coincide con los filtros aplicados.' : 'No se encontraron donaciones.'}</p>
            {hayFiltros && (
              <button type="button" className={btnSecundario} onClick={limpiar}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : datos ? (
          <>
            {/* Tabla (escritorio) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <caption className="sr-only">Listado de donaciones</caption>
                <thead>
                  <tr className="border-b border-border bg-surface text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                    <th scope="col" className="px-6 py-3">Código</th>
                    <th scope="col" className="px-3 py-3">Fecha</th>
                    <th scope="col" className="px-3 py-3">Tipo</th>
                    <th scope="col" className="px-3 py-3">Destino</th>
                    <th scope="col" className="px-3 py-3 text-right">{rol === 'Beneficiario' ? 'Asignado' : 'Comprometido'}</th>
                    {rol === 'Administrador' && <><th scope="col" className="px-3 py-3 text-right">Recibido</th><th scope="col" className="px-3 py-3 text-right">Pendiente recibir</th><th scope="col" className="px-3 py-3 text-right">Disponible</th></>}
                    {veDonante && <th scope="col" className="px-3 py-3">Donante</th>}
                    <th scope="col" className="px-3 py-3">Estado</th>
                    <th scope="col" className="px-6 py-3 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {datos.items.map((d) => (
                    <tr key={d.id_donacion} className="text-sm text-text hover:bg-surface/60">
                      <td className="px-6 py-3 font-semibold tabular-nums">{d.codigo}</td>
                      <td className="px-3 py-3 text-text-muted">{formatoFecha(d.fecha_donacion)}</td>
                      <td className="px-3 py-3">
                        {ETIQUETA_TIPO[d.tipo_donacion]}
                        {d.categoria && <span className="block text-xs text-text-muted">{d.categoria}</span>}
                      </td>
                      <td className="px-3 py-3">
                        {d.campana_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title={`Campaña: ${d.campana_nombre || `#${d.campana_id}`}`}>
                            🎯 {d.campana_nombre || `Campaña #${d.campana_id}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2.5 py-0.5 text-xs font-semibold text-text-muted border border-border" title="Donación al Inventario Central">
                            📦 Inventario
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatoCantidad(d.cantidad, unidadMostrada(d))}</td>
                      {rol === 'Administrador' && (
                        <>
                          <td className="px-3 py-3 text-right tabular-nums text-text-muted">{formatoCantidad(d.cantidad_recibida, unidadMostrada(d))}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-muted">{d.estado === 'ANULADA' ? '—' : formatoCantidad(Math.max(0, d.cantidad - d.cantidad_recibida), unidadMostrada(d))}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-text-muted">{d.estado === 'ANULADA' ? '—' : formatoCantidad(d.saldo, unidadMostrada(d))}</td>
                        </>
                      )}
                      {veDonante && <td className="max-w-[200px] truncate px-3 py-3 text-text-muted">{d.donante_nombre ?? '—'}</td>}
                      <td className="px-3 py-3">
                        <EstadoBadge estado={d.estado} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button type="button" className={btnSecundario} onClick={() => setDetalleId(d.id_donacion)} aria-label={`Ver detalle de la donación ${d.codigo}`}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas (móvil) */}
            <ul className="divide-y divide-border md:hidden">
              {datos.items.map((d) => (
                <li key={d.id_donacion} className="space-y-2 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold tabular-nums text-text">{d.codigo}</p>
                        {d.campana_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            🎯 {d.campana_nombre || `Campaña #${d.campana_id}`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-bold text-text-muted">
                            📦 Inventario
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        {formatoFecha(d.fecha_donacion)} · {ETIQUETA_TIPO[d.tipo_donacion]}
                        {d.categoria ? ` · ${d.categoria}` : ''}
                      </p>
                    </div>
                    <EstadoBadge estado={d.estado} />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-extrabold tabular-nums text-text">{formatoCantidad(d.cantidad, unidadMostrada(d))}</p>
                      {rol === 'Administrador' && <p className="text-xs text-text-muted">Recibido {formatoCantidad(d.cantidad_recibida, unidadMostrada(d))} · Pendiente {formatoCantidad(Math.max(0, d.cantidad - d.cantidad_recibida), unidadMostrada(d))} · Disponible {formatoCantidad(d.saldo, unidadMostrada(d))}</p>}
                      {veDonante && d.donante_nombre && <p className="truncate text-xs text-text-muted">{d.donante_nombre}</p>}
                    </div>
                    <button type="button" className={btnSecundario} onClick={() => setDetalleId(d.id_donacion)} aria-label={`Ver detalle de la donación ${d.codigo}`}>
                      Ver
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <nav className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 sm:px-6" aria-label="Paginación">
                <button type="button" className={btnSecundario} onClick={() => irAPagina(aplicados.page - 1)} disabled={aplicados.page <= 1 || cargando}>
                  Anterior
                </button>
                <p className="text-xs text-text-muted">
                  Página <span className="font-semibold text-text">{aplicados.page}</span> de {totalPaginas}
                </p>
                <button type="button" className={btnSecundario} onClick={() => irAPagina(aplicados.page + 1)} disabled={aplicados.page >= totalPaginas || cargando}>
                  Siguiente
                </button>
              </nav>
            )}
          </>
        ) : null}
      </div>

      <DonacionFormModal
        isOpen={formulario !== null}
        modo={formulario ?? 'propia'}
        campanaIdInicial={campanaIdModalInicial}
        onClose={() => { setFormulario(null); setCampanaIdModalInicial(undefined); }}
        onGuardado={() => void cargar()}
      />

      <DonacionDetalleModal
        donacionId={detalleId}
        rol={rol}
        onClose={() => setDetalleId(null)}
        onCambio={() => void cargar()}
      />
    </div>
  );
};

export default DonacionesTab;
