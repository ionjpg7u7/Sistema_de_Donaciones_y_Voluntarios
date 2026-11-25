import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ayudaApi, { leerErrorAyuda } from '../../api/ayuda.api';
import { nombreCompleto, urlPerfil } from '../../utils/ayudaFormat';
import type { BeneficiarioAyuda } from '../../types/ayuda.types';
import { btnPrimario, btnSecundario, claseEtiqueta, claseInput, tarjeta } from './estilos';

const BeneficiariosTab = () => {
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioAyuda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargar = useCallback(async (): Promise<void> => {
    setCargando(true);
    setError('');
    try {
      setBeneficiarios(await ayudaApi.listarBeneficiarios(busqueda));
    } catch (err) {
      setError(leerErrorAyuda(err).mensaje);
      setBeneficiarios([]);
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const buscar = (event: FormEvent): void => {
    event.preventDefault();
    setBusqueda(borrador.trim());
  };

  const limpiar = (): void => {
    setBorrador('');
    setBusqueda('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-text md:text-2xl">
            Directorio de beneficiarios verificados
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Solo las cuentas verificadas y activas aparecen aquí. La verificación se realiza desde Gestión de Usuarios.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-success/30 bg-success-soft px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-success">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {beneficiarios.length} verificados
        </span>
      </div>

      <form className={`${tarjeta} p-4 sm:p-5`} onSubmit={buscar} aria-label="Buscar beneficiarios">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="ay-beneficiario-q" className={claseEtiqueta}>
              Buscar por nombre, documento o necesidad
            </label>
            <input
              id="ay-beneficiario-q"
              type="search"
              value={borrador}
              onChange={(event) => setBorrador(event.target.value)}
              placeholder="Ej. Rosa, 4567890, alimentos"
              className={claseInput}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimario}>
              Buscar
            </button>
            <button type="button" className={btnSecundario} onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error"
        >
          <span>{error}</span>
          <button type="button" className={btnSecundario} onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
          Cargando beneficiarios…
        </p>
      ) : beneficiarios.length === 0 ? (
        <div className={`${tarjeta} px-4 py-12 text-center`}>
          <p className="font-display text-lg font-bold text-text">No hay beneficiarios verificados</p>
          <p className="mt-1 text-sm text-text-muted">
            {busqueda
              ? 'Ningún beneficiario coincide con la búsqueda.'
              : 'Verifica las cuentas pendientes desde Gestión de Usuarios para que aparezcan aquí.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {beneficiarios.map((beneficiario) => (
            <article key={beneficiario.id_usuario} className={`${tarjeta} flex flex-col gap-4 p-5`}>
              <div className="flex items-start gap-3">
                {urlPerfil(beneficiario.foto_url) && (
                  <img
                    src={urlPerfil(beneficiario.foto_url) || ""}
                    alt={`Foto de ${nombreCompleto(beneficiario.nombre, beneficiario.apellido)}`}
                    className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-bold text-text">
                    {nombreCompleto(beneficiario.nombre, beneficiario.apellido)}
                  </h3>
                  <p className="mt-0.5 break-all text-xs text-text-muted">{beneficiario.correo}</p>
                  {beneficiario.telefono && (
                    <p className="mt-0.5 text-xs text-text-muted">Tel. {beneficiario.telefono}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                  {beneficiario.tipo_beneficiario}
                </span>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Documento</dt>
                  <dd className="mt-0.5 text-text">{beneficiario.documento}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Dirección</dt>
                  <dd className="mt-0.5 text-text">{beneficiario.direccion}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Necesidad registrada</dt>
                  <dd className="mt-0.5 text-text">{beneficiario.necesidad}</dd>
                </div>
              </dl>

              {beneficiario.descripcion && (
                <p className="line-clamp-3 text-sm text-text-muted">{beneficiario.descripcion}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default BeneficiariosTab;
