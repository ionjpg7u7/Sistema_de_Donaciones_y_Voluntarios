import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { campanaApi } from '../../api/campana.api';
import type { Actividad } from '../../types/campana.types';
import { useAuth } from '../../context/AuthContext';

export function VoluntariadoSection() {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<Actividad | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { usuario } = useAuth();

  useEffect(() => {
    campanaApi
      .listarActividadesPublicas()
      .then((data) => setActividades(data))
      .catch((err) => console.error('Error al cargar actividades públicas:', err))
      .finally(() => setCargando(false));
  }, []);

  const handleInscribirseClick = (act: Actividad) => {
    if (!usuario) {
      navigate('/login', { state: { returnTo: '/#voluntariado' } });
      return;
    }
    setActividadSeleccionada(act);
    setObservaciones('');
    setError(null);
    setMensajeExito(null);
  };

  const handleConfirmarInscripcion = async () => {
    if (!actividadSeleccionada) return;
    setEnviando(true);
    setError(null);
    try {
      await campanaApi.inscribirse(actividadSeleccionada.id_actividad, observaciones);
      setMensajeExito('¡Te has inscrito exitosamente como voluntario a esta actividad! Te esperamos.');
      setActividades((prev) =>
        prev.map((a) =>
          a.id_actividad === actividadSeleccionada.id_actividad
            ? {
                ...a,
                voluntarios_inscritos: (a.voluntarios_inscritos || 0) + 1,
                cupos_disponibles: Math.max((a.cupos_disponibles || 1) - 1, 0),
              }
            : a
        )
      );
      setTimeout(() => {
        setActividadSeleccionada(null);
        setMensajeExito(null);
      }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo completar la inscripción.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id="voluntariado" className="py-20 bg-surface dark:bg-neutral-900 border-b border-border dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase tracking-wider mb-4">
            Participa en Terreno
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Actividades de Voluntariado Abiertas
          </h2>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
            Pon tus manos y corazón al servicio. Elige una actividad, inscríbete y colabora en acopio, logística o distribución.
          </p>
        </div>

        {cargando ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400" />
          </div>
        ) : actividades.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated dark:bg-neutral-850 rounded-2xl border border-dashed border-border dark:border-neutral-800">
            <p className="text-neutral-500 dark:text-neutral-400 font-medium">No hay actividades con cupos abiertos por el momento. ¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {actividades.map((act) => {
              const cupos = act.cupos_disponibles ?? act.max_voluntarios;
              const sinCupos = cupos <= 0;

              return (
                <div
                  key={act.id_actividad}
                  className="bg-surface-elevated dark:bg-neutral-850 rounded-2xl border border-border dark:border-neutral-800 p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300">
                        {act.tipo_actividad}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          sinCupos
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {sinCupos ? 'Cupos agotados' : `${cupos} cupos libres`}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{act.nombre}</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 line-clamp-2">
                      {act.descripcion || 'Sin descripción detallada.'}
                    </p>

                    <div className="space-y-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-surface dark:bg-neutral-900 p-3.5 rounded-xl border border-border dark:border-neutral-800 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">📅</span>
                        <span>Fecha: <strong className="text-neutral-900 dark:text-neutral-100">{act.fecha}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">⏰</span>
                        <span>Horario: <strong className="text-neutral-900 dark:text-neutral-100">{act.hora_inicio} - {act.hora_fin}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">📍</span>
                        <span className="truncate">Lugar: <strong className="text-neutral-900 dark:text-neutral-100">{act.lugar}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={sinCupos}
                    onClick={() => handleInscribirseClick(act)}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-bold shadow-sm transition-all text-center flex items-center justify-center gap-2 ${
                      sinCupos
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    {sinCupos ? 'Sin cupos disponibles' : 'Inscribirme como Voluntario'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de Inscripción */}
        {actividadSeleccionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="bg-surface dark:bg-neutral-900 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-border dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Confirmar Participación</span>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mt-1">{actividadSeleccionada.nombre}</h3>
                </div>
                <button
                  onClick={() => setActividadSeleccionada(null)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {mensajeExito ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-sm font-medium">
                  {mensajeExito}
                </div>
              ) : (
                <>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                    Al inscribirte, asumes el compromiso de asistir puntualmente. Al completar la actividad y marcar tu asistencia, tu perfil será acreditado automáticamente como Voluntario Aprobado.
                  </p>

                  {error && (
                    <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-sm">
                      {error}
                    </div>
                  )}

                  <div className="mb-5">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2">
                      Observaciones o disponibilidad especial (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej. Cuento con vehículo propio para apoyo, experiencia en primeros auxilios..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setActividadSeleccionada(null)}
                      className="px-4 py-2.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={handleConfirmarInscripcion}
                      className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      {enviando ? 'Inscribiendo...' : 'Confirmar Inscripción'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
