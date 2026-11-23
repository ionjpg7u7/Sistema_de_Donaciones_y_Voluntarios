import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { campanaApi } from '../../api/campana.api';
import type { Campana } from '../../types/campana.types';
import { useAuth } from '../../context/AuthContext';

export function CampanasSection() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();
  const { usuario } = useAuth();

  useEffect(() => {
    campanaApi
      .listarPublicas()
      .then((data) => setCampanas(data))
      .catch((err) => console.error('Error al cargar campañas públicas:', err))
      .finally(() => setCargando(false));
  }, []);

  const handleApoyar = (campana: Campana) => {
    if (!usuario) {
      navigate('/login', { state: { returnTo: `/donaciones?campanaId=${campana.id_campana}` } });
    } else {
      navigate(`/donaciones?campanaId=${campana.id_campana}`);
    }
  };

  return (
    <section id="campanas" className="py-20 bg-surface dark:bg-neutral-900 border-b border-border dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider mb-4">
            Iniciativas de Alto Impacto
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Campañas Solidarias Activas
          </h2>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
            Únete a nuestras causas colectivas para brindar apoyo inmediato ante emergencias climáticas, salud y apoyo alimentario.
          </p>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400" />
          </div>
        ) : campanas.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated dark:bg-neutral-850 rounded-2xl border border-dashed border-border dark:border-neutral-800">
            <p className="text-neutral-500 dark:text-neutral-400 font-medium">
              Actualmente no hay campañas públicas activas. ¡Pronto anunciaremos nuevas convocatorias!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {campanas.map((c) => {
              const meta = c.objetivo_recaudacion || 0;
              const recaudado = c.total_recaudado || 0;
              const porcentaje = meta > 0 ? Math.min(Math.round((recaudado / meta) * 100), 100) : 0;

              return (
                <div
                  key={c.id_campana}
                  className="group bg-surface-elevated dark:bg-neutral-850 rounded-2xl border border-border dark:border-neutral-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden"
                >
                  {/* Portada */}
                  <div className="relative h-48 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={c.portada_url || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800'}
                      alt={c.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm bg-emerald-600 text-white">
                        {c.estado}
                      </span>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
                        <span>📅 Inicio: {c.fecha_inicio}</span>
                        {c.fecha_fin && <span>• Fin: {c.fecha_fin}</span>}
                      </div>

                      <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {c.nombre}
                      </h3>

                      <p className="mt-2.5 text-sm text-neutral-600 dark:text-neutral-300 line-clamp-3 leading-relaxed">
                        {c.descripcion || 'Sin descripción adicional para esta campaña.'}
                      </p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-border dark:border-neutral-800">
                      {meta > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                            <span>Recaudado: Bs. {recaudado.toLocaleString()}</span>
                            <span>{porcentaje}% de Bs. {meta.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 dark:bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleApoyar(c)}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow text-center flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          Donar
                        </button>

                        <a
                          href="#voluntariado"
                          className="w-full py-2.5 px-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-sm font-semibold transition-all text-center flex items-center justify-center gap-1"
                        >
                          Voluntariado
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
