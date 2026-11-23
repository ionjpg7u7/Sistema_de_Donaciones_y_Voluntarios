/**
 * ============================================================================
 * ARCHIVO: DonacionesPage.tsx
 * PÁGINA: Gestión de Donaciones (/donaciones). Una sola pantalla con pestañas
 * según el rol: el Administrador ve Donaciones · Inventario y asignaciones · Reportes; el
 * resto de roles ve únicamente su historial.
 *
 * SPRINT 3 — Integración: si se llega desde /campanas con ?campanaId=X el modal
 * de nueva donación se abre automáticamente con esa campaña pre-seleccionada.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import DonacionesTab from '../components/donaciones/DonacionesTab';
import AsignacionesTab from '../components/donaciones/AsignacionesTab';
import ReportesTab from '../components/donaciones/ReportesTab';
import InventarioTab from '../components/donaciones/InventarioTab';
import EntregasTab from '../components/donaciones/EntregasTab';
import type { RolDonaciones } from '../types/donacion.types';

type Pestana = 'donaciones' | 'inventario' | 'reportes';

const ROLES_VALIDOS: RolDonaciones[] = ['Administrador', 'Donante', 'Voluntario', 'Beneficiario'];

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'donaciones', etiqueta: 'Donaciones' },
  { id: 'inventario', etiqueta: 'Inventario y asignaciones' },
  { id: 'reportes', etiqueta: 'Reportes' },
];

const DonacionesPage = () => {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>('donaciones');

  // campanaId pasado desde /campanas al presionar "Donar a esta Campaña"
  const campanaIdDesdeUrl = searchParams.get('campanaId');
  const [campanaIdInicial, setCampanaIdInicial] = useState<number | undefined>(
    campanaIdDesdeUrl ? Number(campanaIdDesdeUrl) : undefined
  );

  // Limpiar el query param una vez consumido para que no persista al navegar
  useEffect(() => {
    if (campanaIdDesdeUrl) {
      setSearchParams({}, { replace: true });
    }
  }, []);

  const rol = usuario?.rol as RolDonaciones | undefined;
  if (!rol || !ROLES_VALIDOS.includes(rol)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold text-text">Sin acceso</h1>
        <p className="mt-2 text-sm text-text-muted">Tu rol no tiene acceso a la Gestión de donaciones.</p>
      </div>
    );
  }

  const esAdmin = rol === 'Administrador';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 md:py-10">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Módulo</p>
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.04em] text-text md:text-3xl">Gestión de donaciones</h1>
      </header>

      {esAdmin && (
        <div role="tablist" aria-label="Secciones de donaciones" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1">
          {PESTANAS.map((p) => {
            const activa = pestana === p.id;
            return (
              <button
                key={p.id}
                role="tab"
                id={`tab-${p.id}`}
                aria-selected={activa}
                aria-controls={`panel-${p.id}`}
                type="button"
                onClick={() => setPestana(p.id)}
                className={`press flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors ${
                  activa ? 'bg-primary text-on-primary shadow-soft' : 'text-text-muted hover:bg-surface-elevated hover:text-text'
                }`}
              >
                {p.etiqueta}
              </button>
            );
          })}
        </div>
      )}

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={esAdmin ? `tab-${pestana}` : undefined}>
        {pestana === 'donaciones' && <DonacionesTab rol={rol} campanaIdInicial={campanaIdInicial} onCampanaIdConsumido={() => setCampanaIdInicial(undefined)} />}
        {esAdmin && pestana === 'inventario' && (
          <div className="space-y-8">
            <InventarioTab />
            <div className="border-t border-border pt-7">
              <h2 className="mb-4 font-display text-xl font-extrabold text-text">Asignaciones registradas</h2>
              <AsignacionesTab />
            </div>
            <EntregasTab />
          </div>
        )}
        {esAdmin && pestana === 'reportes' && <ReportesTab />}
      </div>
    </div>
  );
};

export default DonacionesPage;
