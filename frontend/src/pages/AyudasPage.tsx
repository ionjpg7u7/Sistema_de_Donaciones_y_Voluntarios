/**
 * ============================================================================
 * ARCHIVO: AyudasPage.tsx
 * PÁGINA: Gestión de Beneficiarios y Ayudas (/ayudas).
 *
 * - Administrador: bandeja de solicitudes + directorio de beneficiarios.
 * - Beneficiario: únicamente sus propias solicitudes de ayuda.
 * - Otros roles: mensaje de acceso restringido (la ruta se mantiene privada).
 *
 * Soporta /ayudas?nueva=1 para abrir directamente el formulario de solicitud.
 * ============================================================================
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import SolicitudesTab from '../components/ayudas/SolicitudesTab';
import BeneficiariosTab from '../components/ayudas/BeneficiariosTab';

type Pestana = 'solicitudes' | 'beneficiarios';

const normalizar = (valor: unknown): string => String(valor ?? '').trim().toLowerCase();

const AyudasPage = () => {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>('solicitudes');

  const roles = [
    ...(Array.isArray(usuario?.roles) ? usuario.roles : []),
    usuario?.rol,
  ]
    .filter((rol): rol is string => typeof rol === 'string' && rol.trim() !== '')
    .map(normalizar);

  const esAdmin = roles.some((rol) => rol === 'administrador' || rol === 'admin');
  const esBeneficiario = roles.includes('beneficiario');
  const tieneAcceso = esAdmin || esBeneficiario;

  const abrirNueva = searchParams.get('nueva') === '1' && tieneAcceso;

  const consumirNueva = (): void => {
    const siguientes = new URLSearchParams(searchParams);
    siguientes.delete('nueva');
    setSearchParams(siguientes, { replace: true });
  };

  if (!tieneAcceso) {
    return (
      <div className="space-y-6 pb-12">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-text-subtle">Módulo restringido</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.03em] text-text">
            Gestión de Beneficiarios y Ayudas
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
            Este módulo está disponible para administradores y para beneficiarios registrados. Si consideras que deberías
            tener acceso, solicita la verificación de tu cuenta desde tu perfil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-success">
            Módulo 5 · Beneficiarios y Ayudas
          </span>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-[-0.03em] text-text md:text-3xl">
            {esAdmin ? 'Gestión de Beneficiarios y Ayudas' : 'Mis solicitudes de ayuda'}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            {esAdmin
              ? 'Recibe solicitudes de beneficiarios verificados, evalúalas y coordina con el módulo de Donaciones la entrega de recursos.'
              : 'Registra tus necesidades y sigue el estado de cada solicitud hasta que la ayuda sea entregada.'}
          </p>
        </div>
        {esAdmin && (
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-success/30 bg-success-soft px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-success">
            <span aria-hidden="true" className="motion-safe:animate-pulse-dot h-1.5 w-1.5 rounded-full bg-current" />
            Administración
          </span>
        )}
      </div>

      {esAdmin && (
        <div className="flex gap-2 overflow-x-auto border-b border-border" role="tablist" aria-label="Secciones de ayudas">
          {(
            [
              { id: 'solicitudes', etiqueta: 'Solicitudes de ayuda' },
              { id: 'beneficiarios', etiqueta: 'Beneficiarios verificados' },
            ] as const
          ).map((item) => {
            const activa = pestana === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => {
                  if (item.id === 'beneficiarios' && abrirNueva) consumirNueva();
                  setPestana(item.id);
                }}
                className={`whitespace-nowrap border-b-2 px-4 pb-3 text-sm font-bold transition-colors ${
                  activa
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                {item.etiqueta}
              </button>
            );
          })}
        </div>
      )}

      {pestana === 'beneficiarios' && esAdmin ? (
        <BeneficiariosTab />
      ) : (
        <SolicitudesTab
          esAdmin={esAdmin}
          abrirNueva={abrirNueva}
          onNuevaConsumida={consumirNueva}
        />
      )}
    </div>
  );
};

export default AyudasPage;
