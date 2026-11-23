import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { campanaApi } from '../api/campana.api';
import api from '../api/client';
import type {
  Campana,
  CampanaFormDTO,
  Actividad,
  ActividadFormDTO,
  ParticipacionItem,
  EstadoCampana,
  TipoActividad,
} from '../types/campana.types';
import { useNavigate } from 'react-router-dom';

interface DonacionHistorial {
  id_donacion: number;
  codigo: string;
  tipo_donacion: string;
  modalidad: string;
  cantidad: number;
  cantidad_recibida: number;
  unidad: string;
  categoria: string;
  descripcion: string;
  fecha_donacion: string;
  campana_id: number | null;
  campana_nombre?: string;
  estado: string;
}

export default function CampanasPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const rol = (usuario?.rol || '').toLowerCase();
  const rolesArray: string[] = Array.isArray(usuario?.roles)
    ? usuario.roles.map((r: string) => r.toLowerCase())
    : [rol];
  const esAdmin = rol === 'admin' || rol === 'administrador' || rolesArray.includes('administrador');
  const esCoordinador = Boolean(usuario?.es_coordinador) || rol === 'coordinador' || esAdmin || rolesArray.includes('coordinador');
  const esVoluntario = rol === 'voluntario' || usuario?.estado_voluntario === 'Aprobado' || rolesArray.includes('voluntario');
  const esDonante = rol === 'donante' || rol === 'cliente' || rolesArray.includes('donante') || esAdmin;

  // Estados de datos
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [misParticipaciones, setMisParticipaciones] = useState<ParticipacionItem[]>([]);
  const [misDonaciones, setMisDonaciones] = useState<DonacionHistorial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Pestañas dinámicas según el rol (soporta multi-rol)
  const tabs = esAdmin
    ? ['campanas', 'actividades', 'mis-actividades', ...(misDonaciones.length > 0 ? ['mis-donaciones'] : [])]
    : esVoluntario && !esDonante && misDonaciones.length === 0
    ? ['actividades', 'mis-actividades', 'campanas']
    : ['campanas', 'mis-donaciones', 'actividades', 'mis-actividades'];

  const [pestaña, setPestaña] = useState<string>(tabs[0]);

  // Filtros
  const [filtroTipoActividad, setFiltroTipoActividad] = useState<string>('TODAS');
  const [campanaFiltroActividades, setCampanaFiltroActividades] = useState<number | null>(null);

  // Modales
  const [modalCampanaAbierto, setModalCampanaAbierto] = useState(false);
  const [campanaEditando, setCampanaEditando] = useState<Campana | null>(null);
  const [formCampana, setFormCampana] = useState<CampanaFormDTO>({
    nombre: '',
    descripcion: '',
    portada_url: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    objetivo_recaudacion: '',
    estado: 'Planificada',
  });

  const [modalActividadAbierto, setModalActividadAbierto] = useState(false);
  const [actividadEditando, setActividadEditando] = useState<Actividad | null>(null);
  const [formActividad, setFormActividad] = useState<ActividadFormDTO>({
    nombre: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: '09:00',
    hora_fin: '13:00',
    lugar: '',
    max_voluntarios: 10,
    tipo_actividad: 'CAMPANA',
    id_campana: '',
    estado: 'Planificada',
  });

  // Modal de Asistencia
  const [modalAsistenciaActividad, setModalAsistenciaActividad] = useState<Actividad | null>(null);
  const [voluntariosActividad, setVoluntariosActividad] = useState<ParticipacionItem[]>([]);
  const [cargandoVoluntarios, setCargandoVoluntarios] = useState(false);

  // Cargar datos
  const cargarTodo = async () => {
    setCargando(true);
    setError(null);
    try {
      const [camps, acts, misActs] = await Promise.all([
        campanaApi.listar().catch(() => []),
        campanaApi.listarActividades().catch(() => []),
        campanaApi.listarMisActividades().catch(() => []),
      ]);

      setCampanas(Array.isArray(camps) ? camps : []);
      setActividades(Array.isArray(acts) ? acts : []);
      setMisParticipaciones(Array.isArray(misActs) ? misActs : []);

      // Cargar donaciones del usuario autenticado (siempre con items de la respuesta paginada)
      try {
        const donRes = await api.get('/donaciones?limit=100');
        const raw = donRes.data;
        const donacionesData = Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];
        setMisDonaciones(donacionesData);
      } catch (err) {
        console.warn('No se pudieron cargar donaciones en campanas:', err);
        setMisDonaciones([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar los datos del módulo.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const notificar = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 3500);
  };

  // --- Campañas ---
  const abrirCrearCampana = () => {
    setCampanaEditando(null);
    setFormCampana({
      nombre: '',
      descripcion: '',
      portada_url: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      objetivo_recaudacion: '',
      estado: 'Planificada',
    });
    setModalCampanaAbierto(true);
  };

  const abrirEditarCampana = (c: Campana) => {
    setCampanaEditando(c);
    setFormCampana({
      nombre: c.nombre,
      descripcion: c.descripcion || '',
      portada_url: c.portada_url || '',
      fecha_inicio: c.fecha_inicio,
      fecha_fin: c.fecha_fin || '',
      objetivo_recaudacion: c.objetivo_recaudacion ?? '',
      estado: c.estado,
    });
    setModalCampanaAbierto(true);
  };

  const guardarCampana = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: CampanaFormDTO = {
        ...formCampana,
        objetivo_recaudacion: formCampana.objetivo_recaudacion === '' ? undefined : Number(formCampana.objetivo_recaudacion),
        fecha_fin: formCampana.fecha_fin || undefined,
      };

      if (campanaEditando) {
        await campanaApi.actualizar(campanaEditando.id_campana, payload);
        notificar('Campaña actualizada exitosamente.');
      } else {
        await campanaApi.crear(payload);
        notificar('Campaña creada exitosamente.');
      }
      setModalCampanaAbierto(false);
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar la campaña');
    }
  };

  const eliminarCampana = async (id: number) => {
    if (!window.confirm('¿Seguro que deseas cancelar esta campaña? Quedará marcada como "Cancelada" y dejará de aparecer en la lista.')) return;
    try {
      await campanaApi.eliminar(id);
      notificar('Campaña cancelada/archivada exitosamente.');
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al cancelar la campaña');
    }
  };

  // --- Actividades ---
  const abrirCrearActividad = (idCampanaPrevia?: number) => {
    setActividadEditando(null);
    setFormActividad({
      nombre: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      hora_inicio: '09:00',
      hora_fin: '13:00',
      lugar: '',
      max_voluntarios: 10,
      tipo_actividad: idCampanaPrevia ? 'CAMPANA' : 'CAMPANA',
      id_campana: idCampanaPrevia ?? (campanas.length > 0 ? campanas[0].id_campana : ''),
      estado: 'Planificada',
    });
    setModalActividadAbierto(true);
  };

  const abrirEditarActividad = (act: Actividad) => {
    setActividadEditando(act);
    setFormActividad({
      nombre: act.nombre,
      descripcion: act.descripcion || '',
      fecha: act.fecha,
      hora_inicio: act.hora_inicio,
      hora_fin: act.hora_fin,
      lugar: act.lugar,
      max_voluntarios: act.max_voluntarios,
      tipo_actividad: act.tipo_actividad,
      id_campana: act.campanas_asociadas && act.campanas_asociadas.length > 0 ? act.campanas_asociadas[0].id_campana : '',
      estado: act.estado,
    });
    setModalActividadAbierto(true);
  };

  const guardarActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: ActividadFormDTO = {
        ...formActividad,
        max_voluntarios: Number(formActividad.max_voluntarios),
        id_campana: formActividad.id_campana === '' ? undefined : Number(formActividad.id_campana),
      };

      if (actividadEditando) {
        await campanaApi.actualizarActividad(actividadEditando.id_actividad, payload);
        notificar('Actividad actualizada exitosamente.');
      } else {
        await campanaApi.crearActividad(payload);
        notificar('Actividad creada exitosamente.');
      }
      setModalActividadAbierto(false);
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al guardar la actividad');
    }
  };

  const eliminarActividad = async (id: number) => {
    if (!window.confirm('¿Seguro que deseas cancelar esta actividad? Quedará marcada como "Cancelada" y no aparecerá en la lista.')) return;
    try {
      await campanaApi.eliminarActividad(id);
      notificar('Actividad cancelada exitosamente.');
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al cancelar actividad');
    }
  };

  // --- Voluntariado / Participaciones ---
  const inscribirmeActividad = async (idActividad: number) => {
    try {
      await campanaApi.inscribirse(idActividad);
      notificar('¡Te has inscrito exitosamente a esta actividad!');
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo completar la inscripción');
    }
  };

  const cancelarInscripcion = async (idActividad: number) => {
    if (!window.confirm('¿Deseas cancelar tu inscripción a esta actividad?')) return;
    try {
      await campanaApi.desinscribirse(idActividad);
      notificar('Inscripción cancelada.');
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo cancelar');
    }
  };

  // --- Gestión de Asistencia ---
  const abrirAsistencia = async (act: Actividad) => {
    setModalAsistenciaActividad(act);
    setCargandoVoluntarios(true);
    try {
      const vols = await campanaApi.listarVoluntariosActividad(act.id_actividad);
      setVoluntariosActividad(vols);
    } catch (err: any) {
      alert('Error al cargar la lista de voluntarios de la actividad');
    } finally {
      setCargandoVoluntarios(false);
    }
  };

  const marcarAsistenciaVoluntario = async (part: ParticipacionItem, asistio: boolean) => {
    try {
      await campanaApi.registrarAsistencia(part.id_participacion, {
        asistio,
        horas_acreditadas: asistio ? (part.horas_acreditadas > 0 ? part.horas_acreditadas : 3) : 0,
        observaciones: asistio ? 'Asistencia cumplida satisfactoriamente' : 'No asistió a la convocatoria',
      });
      notificar(`Asistencia registrada. Voluntario ${asistio ? 'acreditado y aprobado' : 'marcado como no asistió'}.`);
      if (modalAsistenciaActividad) {
        const vols = await campanaApi.listarVoluntariosActividad(modalAsistenciaActividad.id_actividad);
        setVoluntariosActividad(vols);
      }
      cargarTodo();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al registrar asistencia');
    }
  };

  // Filtrado de Actividades
  const actividadesFiltradas = actividades.filter((act) => {
    if (campanaFiltroActividades && !act.campanas_asociadas?.some((c) => c.id_campana === campanaFiltroActividades)) {
      return false;
    }
    if (filtroTipoActividad !== 'TODAS' && act.tipo_actividad !== filtroTipoActividad) {
      return false;
    }
    return true;
  });

  // Métricas de Donante separadas por los 3 tipos de donación
  const donacionesCampanas = misDonaciones.filter((d) => Boolean(d.campana_id));
  const donacionesInventario = misDonaciones.filter((d) => !d.campana_id && d.modalidad === 'PRESENCIAL');
  const donacionesSolicitudes = misDonaciones.filter((d) => !d.campana_id && d.modalidad !== 'PRESENCIAL');

  const totalHorasAcreditadas = misParticipaciones
    .filter((p) => p.asistio)
    .reduce((sum, p) => sum + Number(p.horas_acreditadas || 0), 0);

  return (
    <div className="space-y-6 pb-12 text-neutral-900 dark:text-neutral-100">
      {/* Encabezado Principal adaptado a modo claro/oscuro */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface dark:bg-neutral-900 p-6 rounded-2xl border border-border dark:border-neutral-800 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Sprint 3 · Gestión Operativa Integral
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-50 tracking-tight mt-1">
            Gestión de Campañas y Actividades
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            {esAdmin
              ? 'Administra campañas, coordina cuadrillas de voluntarios y gestiona el impacto social.'
              : esDonante
              ? 'Explora las campañas activas y revisa el impacto de todas tus donaciones.'
              : 'Descubre actividades abiertas, inscríbete y acumula horas de voluntariado certificadas.'}
          </p>
        </div>

        {esAdmin && (
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={abrirCrearCampana}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <span>+</span> Nueva Campaña
            </button>
            <button
              onClick={() => abrirCrearActividad()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <span>+</span> Nueva Actividad
            </button>
          </div>
        )}
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl text-sm font-semibold flex items-center justify-between">
          <span>✓ {mensajeExito}</span>
          <button onClick={() => setMensajeExito(null)} className="text-emerald-700 dark:text-emerald-400 font-bold">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-2xl text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Pestañas de Navegación */}
      <div className="flex border-b border-border dark:border-neutral-800 gap-2 overflow-x-auto">
        {tabs.includes('campanas') && (
          <button
            onClick={() => {
              setPestaña('campanas');
              setCampanaFiltroActividades(null);
            }}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              pestaña === 'campanas'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <span>📢</span>
            Campañas ({campanas.length})
          </button>
        )}

        {tabs.includes('mis-donaciones') && (
          <button
            onClick={() => setPestaña('mis-donaciones')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              pestaña === 'mis-donaciones'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <span>🎁</span>
            Mi Historial de Donaciones ({misDonaciones.length})
          </button>
        )}

        {tabs.includes('actividades') && (
          <button
            onClick={() => setPestaña('actividades')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
              pestaña === 'actividades'
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <span>🏃</span>
            Actividades ({actividades.length})
            {campanaFiltroActividades && (
              <span className="ml-1 text-[11px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                Filtradas por campaña
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setPestaña('mis-actividades')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            pestaña === 'mis-actividades'
              ? 'border-amber-600 text-amber-700 dark:text-amber-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <span>⭐</span>
          Mis Participaciones ({misParticipaciones.length})
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400" />
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* PESTAÑA 1: GESTIÓN DE CAMPAÑAS */}
          {/* ================================================================= */}
          {pestaña === 'campanas' && (
            <div className="space-y-6">
              {campanas.length === 0 ? (
                <div className="text-center py-16 bg-surface dark:bg-neutral-900 rounded-2xl border border-dashed border-border dark:border-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">No se encontraron campañas registradas.</p>
                  {esAdmin && (
                    <button
                      onClick={abrirCrearCampana}
                      className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold"
                    >
                      Crear primera campaña
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {campanas.map((c) => {
                    const meta = c.objetivo_recaudacion || 0;
                    const recaudado = c.total_recaudado || 0;
                    const porcentaje = meta > 0 ? Math.min(Math.round((recaudado / meta) * 100), 100) : 0;

                    return (
                      <div
                        key={c.id_campana}
                        className="bg-surface dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xs overflow-hidden flex flex-col justify-between"
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                c.estado === 'Activa'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : c.estado === 'Planificada'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                  : c.estado === 'Finalizada'
                                  ? 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                              }`}
                            >
                              {c.estado}
                            </span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                              📅 {c.fecha_inicio} {c.fecha_fin ? `al ${c.fecha_fin}` : ''}
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">{c.nombre}</h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-3 mb-6">
                            {c.descripcion || 'Sin descripción detallada.'}
                          </p>

                          {/* Métricas clave de la campaña */}
                          <div className="grid grid-cols-3 gap-3 p-4 bg-surface-sunken dark:bg-neutral-950/60 rounded-xl border border-border dark:border-neutral-800 mb-4">
                            <div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Recaudado</p>
                              <p className="text-base font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">
                                Bs. {recaudado.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Actividades</p>
                              <p className="text-base font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">
                                {c.total_actividades || 0}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Voluntarios</p>
                              <p className="text-base font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">
                                {c.total_voluntarios || 0}
                              </p>
                            </div>
                          </div>

                          {meta > 0 && (
                            <div>
                              <div className="flex justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                                <span>Meta: Bs. {meta.toLocaleString()}</span>
                                <span>{porcentaje}%</span>
                              </div>
                              <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-600 dark:bg-emerald-500 h-2 rounded-full transition-all"
                                  style={{ width: `${porcentaje}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Botones de acción */}
                        <div className="px-6 py-4 bg-surface-sunken dark:bg-neutral-950/80 border-t border-border dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => navigate(`/donaciones?campanaId=${c.id_campana}`)}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <span>❤️</span> Donar a esta Campaña
                            </button>

                            <button
                              onClick={() => {
                                setCampanaFiltroActividades(c.id_campana);
                                setPestaña('actividades');
                              }}
                              className="px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <span>📋</span> Ver Actividades ({c.total_actividades || 0})
                            </button>
                          </div>

                          {esAdmin && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => abrirCrearActividad(c.id_campana)}
                                title="Crear actividad para esta campaña"
                                className="px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold transition"
                              >
                                + Actividad
                              </button>
                              <button
                                onClick={() => abrirEditarCampana(c)}
                                className="px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold transition"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => eliminarCampana(c.id_campana)}
                                className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold transition"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* PESTAÑA: HISTORIAL CONSOLIDADO DE DONACIONES (Para Donantes) */}
          {/* ================================================================= */}
          {pestaña === 'mis-donaciones' && (
            <div className="space-y-6">
              {/* Tarjetas de Resumen por los 3 Tipos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    1. A Campañas Solidarias
                  </span>
                  <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                    {donacionesCampanas.length} donaciones
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Destinadas a causas específicas (incendios, invierno, comedores).
                  </p>
                </div>

                <div className="bg-surface dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    2. A Solicitudes de Ayuda
                  </span>
                  <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                    {donacionesSolicitudes.length} donaciones
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Entregadas directamente a familias e instituciones necesitadas.
                  </p>
                </div>

                <div className="bg-surface dark:bg-neutral-900 border border-border dark:border-neutral-800 rounded-2xl p-5 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    3. Al Inventario General
                  </span>
                  <p className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                    {donacionesInventario.length} entregas físicas
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Bienes recibidos presencialmente en almacén central por el equipo.
                  </p>
                </div>
              </div>

              {/* Lista Detallada */}
              {misDonaciones.length === 0 ? (
                <div className="text-center py-16 bg-surface dark:bg-neutral-900 rounded-2xl border border-dashed border-border dark:border-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">Aún no has registrado donaciones en tu cuenta.</p>
                  <button
                    onClick={() => setPestaña('campanas')}
                    className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold"
                  >
                    Ver campañas para donar
                  </button>
                </div>
              ) : (
                <div className="bg-surface dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xs overflow-hidden">
                  <div className="p-4 bg-surface-sunken dark:bg-neutral-950/60 border-b border-border dark:border-neutral-800 font-bold text-sm text-neutral-800 dark:text-neutral-200">
                    Desglose Completo de Donaciones Realizadas
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-surface-sunken dark:bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold border-b border-border dark:border-neutral-800">
                        <tr>
                          <th className="p-4">Código</th>
                          <th className="p-4">Tipo & Destino</th>
                          <th className="p-4">Cantidad / Monto</th>
                          <th className="p-4">Modalidad</th>
                          <th className="p-4">Fecha</th>
                          <th className="p-4">Estado</th>
                          <th className="p-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border dark:divide-neutral-800">
                        {misDonaciones.map((d) => {
                          const esDeCampana = Boolean(d.campana_id);
                          const esPresencialInventario = !d.campana_id && d.modalidad === 'PRESENCIAL';
                          const fechaTexto = d.fecha_donacion ? d.fecha_donacion.split('T')[0] : '—';
                          const cantidadTexto =
                            d.tipo_donacion === 'ECONOMICO'
                              ? `Bs. ${Number(d.cantidad).toLocaleString()}`
                              : `${d.cantidad} ${d.unidad || ''}`;

                          return (
                            <tr key={d.id_donacion} className="hover:bg-surface-sunken/40 dark:hover:bg-neutral-800/40 transition">
                              <td className="p-4 font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100">
                                {d.codigo}
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-neutral-900 dark:text-neutral-100">
                                  {d.tipo_donacion} ({d.categoria || 'General'})
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {esDeCampana ? (
                                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                      🎯 {d.campana_nombre ? `Campaña "${d.campana_nombre}"` : `Campaña #${d.campana_id}`}
                                    </span>
                                  ) : esPresencialInventario ? (
                                    <span className="text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1">
                                      📦 Inventario Central (Presencial en Sede)
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                                      🤝 Solicitud de Ayuda Directa
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 font-extrabold text-neutral-900 dark:text-neutral-100 tabular-nums">
                                {cantidadTexto}
                              </td>
                              <td className="p-4 text-xs font-semibold">
                                <span className={d.modalidad === 'PRESENCIAL' ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-600 dark:text-neutral-300'}>
                                  {d.modalidad}
                                </span>
                              </td>
                              <td className="p-4 text-xs text-neutral-500 dark:text-neutral-400">
                                {fechaTexto}
                              </td>
                              <td className="p-4">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  {d.estado}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => navigate('/donaciones')}
                                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                  title="Ver en Gestión de Donaciones"
                                >
                                  Ver detalle →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* PESTAÑA 2: GESTIÓN DE ACTIVIDADES */}
          {/* ================================================================= */}
          {pestaña === 'actividades' && (
            <div className="space-y-6">
              {/* Barra de Filtros por Tipo y Campaña */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mr-1">
                    Origen:
                  </span>
                  {[
                    { id: 'TODAS', label: 'Todas' },
                    { id: 'CAMPANA', label: 'Campañas' },
                    { id: 'SOLICITUD_AYUDA', label: 'Solicitudes de Ayuda' },
                    { id: 'INVENTARIO', label: 'Almacén / Inventario' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setFiltroTipoActividad(btn.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        filtroTipoActividad === btn.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                {campanaFiltroActividades && (
                  <div className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 px-3 py-1.5 rounded-xl">
                    <span>Filtrando por Campaña #{campanaFiltroActividades}</span>
                    <button
                      onClick={() => setCampanaFiltroActividades(null)}
                      className="font-bold hover:underline"
                    >
                      ✕ Quitar filtro
                    </button>
                  </div>
                )}
              </div>

              {actividadesFiltradas.length === 0 ? (
                <div className="text-center py-16 bg-surface dark:bg-neutral-900 rounded-2xl border border-dashed border-border dark:border-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">No se encontraron actividades con los filtros seleccionados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {actividadesFiltradas.map((act) => {
                    const cupos = act.cupos_disponibles ?? act.max_voluntarios;
                    const sinCupos = cupos <= 0;
                    const yaInscrito = act.mi_participacion && act.mi_participacion.estado !== 'Cancelado';

                    return (
                      <div
                        key={act.id_actividad}
                        className="bg-surface dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xs p-6 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                                act.tipo_actividad === 'CAMPANA'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : act.tipo_actividad === 'SOLICITUD_AYUDA'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                              }`}
                            >
                              {act.tipo_actividad}
                            </span>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                sinCupos
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              }`}
                            >
                              {act.voluntarios_inscritos || 0} / {act.max_voluntarios} inscritos
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1">{act.nombre}</h3>
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2 mb-4">
                            {act.descripcion || 'Sin descripción detallada.'}
                          </p>

                          <div className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-300 bg-surface-sunken dark:bg-neutral-950/60 p-3 rounded-xl mb-4 border border-border dark:border-neutral-800">
                            <div>📅 <strong>{act.fecha}</strong></div>
                            <div>⏰ <strong>{act.hora_inicio} - {act.hora_fin}</strong></div>
                            <div className="truncate">📍 <strong>{act.lugar}</strong></div>
                            {act.campanas_asociadas && act.campanas_asociadas.length > 0 && (
                              <div className="text-emerald-700 dark:text-emerald-400 font-semibold truncate">
                                📢 Campaña: {act.campanas_asociadas.map((c) => c.nombre).join(', ')}
                              </div>
                            )}
                            {act.tipo_actividad === 'SOLICITUD_AYUDA' && (
                              <div className="text-amber-700 dark:text-amber-400 font-semibold truncate">
                                🤝 Apoyo a Solicitud de Ayuda #{act.solicitud_ayuda_id || 1}
                              </div>
                            )}
                            {act.tipo_actividad === 'INVENTARIO' && (
                              <div className="text-blue-700 dark:text-blue-400 font-semibold truncate">
                                📦 Almacén Central de Inventario
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border dark:border-neutral-800">
                          {/* Botón de inscripción para el usuario */}
                          {yaInscrito ? (
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl">
                              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">✓ Estás inscrito</span>
                              <button
                                onClick={() => cancelarInscripcion(act.id_actividad)}
                                className="text-xs text-rose-700 dark:text-rose-400 hover:underline font-semibold"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={sinCupos}
                              onClick={() => inscribirmeActividad(act.id_actividad)}
                              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition text-center ${
                                sinCupos
                                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {sinCupos ? 'Cupos Agotados' : 'Inscribirme como Voluntario'}
                            </button>
                          )}

                          {/* Acciones de administración / coordinación */}
                          {esCoordinador && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => abrirAsistencia(act)}
                                className="py-2 px-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg text-xs font-bold transition text-center col-span-2 border border-border dark:border-neutral-700"
                              >
                                👥 Gestionar Voluntarios ({act.voluntarios_inscritos || 0})
                              </button>

                              {esAdmin && (
                                <>
                                  <button
                                    onClick={() => abrirEditarActividad(act)}
                                    className="py-1.5 px-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg text-xs font-medium text-center"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => eliminarActividad(act.id_actividad)}
                                    className="py-1.5 px-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-medium text-center"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* PESTAÑA 3: MIS PARTICIPACIONES (Historial del Voluntario) */}
          {/* ================================================================= */}
          {pestaña === 'mis-actividades' && (
            <div className="space-y-6">
              {/* Tarjeta de Resumen de Horas */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-amber-100">
                    Historial y Certificación de Voluntariado
                  </span>
                  <h3 className="text-2xl font-black mt-1">
                    {totalHorasAcreditadas} Horas de Voluntariado Acreditadas
                  </h3>
                  <p className="text-xs text-amber-100 mt-1">
                    Cada hora registrada representa vidas impactadas y apoyo directo en terreno.
                  </p>
                </div>
                <div className="px-4 py-2 bg-white/20 rounded-xl backdrop-blur-xs font-bold text-sm">
                  {misParticipaciones.filter((p) => p.asistio).length} actividades completadas
                </div>
              </div>

              {misParticipaciones.length === 0 ? (
                <div className="text-center py-16 bg-surface dark:bg-neutral-900 rounded-2xl border border-dashed border-border dark:border-neutral-800">
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">Aún no te has inscrito a ninguna actividad de voluntariado.</p>
                  <button
                    onClick={() => setPestaña('actividades')}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-indigo-700 transition"
                  >
                    Ver actividades disponibles
                  </button>
                </div>
              ) : (
                <div className="bg-surface dark:bg-neutral-900 rounded-2xl border border-border dark:border-neutral-800 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-600 dark:text-neutral-300">
                      <thead className="bg-surface-sunken dark:bg-neutral-950 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold border-b border-border dark:border-neutral-800">
                        <tr>
                          <th className="p-4">Actividad</th>
                          <th className="p-4">Fecha & Lugar</th>
                          <th className="p-4">Estado</th>
                          <th className="p-4">Horas</th>
                          <th className="p-4">Observaciones</th>
                          <th className="p-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border dark:divide-neutral-800">
                        {misParticipaciones.map((p) => (
                          <tr key={p.id_participacion} className="hover:bg-surface-sunken/40 dark:hover:bg-neutral-800/40 transition">
                            <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{p.actividad_nombre}</td>
                            <td className="p-4 text-xs">
                              <div>📅 {p.actividad_fecha}</div>
                              <div className="text-neutral-400 truncate max-w-xs">{p.actividad_lugar}</div>
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                  p.asistio
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : p.estado === 'Cancelado'
                                    ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                                }`}
                              >
                                {p.asistio ? 'Asistió' : p.estado}
                              </span>
                            </td>
                            <td className="p-4 font-extrabold text-neutral-900 dark:text-neutral-100">
                              {p.asistio ? `${p.horas_acreditadas} hrs` : '-'}
                            </td>
                            <td className="p-4 text-xs text-neutral-500 dark:text-neutral-400 italic max-w-xs truncate">
                              {p.observaciones || 'Sin observaciones'}
                            </td>
                            <td className="p-4 text-right">
                              {!p.asistio && p.estado !== 'Cancelado' && (
                                <button
                                  onClick={() => cancelarInscripcion(p.id_actividad)}
                                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold"
                                >
                                  Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREAR / EDITAR CAMPAÑA */}
      {/* ===================================================================== */}
      {modalCampanaAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-surface dark:bg-neutral-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border dark:border-neutral-800 max-h-[90vh] overflow-y-auto text-neutral-900 dark:text-neutral-100">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {campanaEditando ? 'Editar Campaña' : 'Nueva Campaña Solidaria'}
            </h3>

            <form onSubmit={guardarCampana} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Nombre de la Campaña *</label>
                <input
                  type="text"
                  required
                  value={formCampana.nombre}
                  onChange={(e) => setFormCampana({ ...formCampana, nombre: e.target.value })}
                  placeholder="Ej. Campaña Solidaria Incendios 2026"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={formCampana.descripcion}
                  onChange={(e) => setFormCampana({ ...formCampana, descripcion: e.target.value })}
                  placeholder="Objetivo, necesidades prioritarias y contexto de la campaña..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">URL de Portada (Imagen)</label>
                <input
                  type="url"
                  value={formCampana.portada_url}
                  onChange={(e) => setFormCampana({ ...formCampana, portada_url: e.target.value })}
                  placeholder="https://ejemplo.com/foto.jpg"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Fecha de Inicio *</label>
                  <input
                    type="date"
                    required
                    value={formCampana.fecha_inicio}
                    onChange={(e) => setFormCampana({ ...formCampana, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Fecha de Fin (Opcional)</label>
                  <input
                    type="date"
                    value={formCampana.fecha_fin}
                    onChange={(e) => setFormCampana({ ...formCampana, fecha_fin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Meta Económica (Bs.)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formCampana.objetivo_recaudacion}
                    onChange={(e) => setFormCampana({ ...formCampana, objetivo_recaudacion: e.target.value === '' ? '' : Number(e.target.value) })}
                    placeholder="Ej. 50000"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Estado</label>
                  <select
                    value={formCampana.estado}
                    onChange={(e) => setFormCampana({ ...formCampana, estado: e.target.value as EstadoCampana })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="Planificada">Planificada</option>
                    <option value="Activa">Activa</option>
                    <option value="Pausada">Pausada</option>
                    <option value="Finalizada">Finalizada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalCampanaAbierto(false)}
                  className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Guardar Campaña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CREAR / EDITAR ACTIVIDAD */}
      {/* ===================================================================== */}
      {modalActividadAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-surface dark:bg-neutral-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border dark:border-neutral-800 max-h-[90vh] overflow-y-auto text-neutral-900 dark:text-neutral-100">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              {actividadEditando ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>

            <form onSubmit={guardarActividad} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Nombre de la Actividad *</label>
                <input
                  type="text"
                  required
                  value={formActividad.nombre}
                  onChange={(e) => setFormActividad({ ...formActividad, nombre: e.target.value })}
                  placeholder="Ej. Clasificación y empaque de víveres"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formActividad.descripcion}
                  onChange={(e) => setFormActividad({ ...formActividad, descripcion: e.target.value })}
                  placeholder="Instrucciones para los voluntarios..."
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formActividad.fecha}
                    onChange={(e) => setFormActividad({ ...formActividad, fecha: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Hora Inicio *</label>
                  <input
                    type="time"
                    required
                    value={formActividad.hora_inicio}
                    onChange={(e) => setFormActividad({ ...formActividad, hora_inicio: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Hora Fin *</label>
                  <input
                    type="time"
                    required
                    value={formActividad.hora_fin}
                    onChange={(e) => setFormActividad({ ...formActividad, hora_fin: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Lugar de Encuentro *</label>
                <input
                  type="text"
                  required
                  value={formActividad.lugar}
                  onChange={(e) => setFormActividad({ ...formActividad, lugar: e.target.value })}
                  placeholder="Ej. Sede Central Miraflores / Plaza San Francisco"
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Cupo de Voluntarios *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formActividad.max_voluntarios}
                    onChange={(e) => setFormActividad({ ...formActividad, max_voluntarios: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Tipo de Actividad</label>
                  <select
                    value={formActividad.tipo_actividad}
                    onChange={(e) => setFormActividad({ ...formActividad, tipo_actividad: e.target.value as TipoActividad })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="CAMPANA">Campaña</option>
                    <option value="INVENTARIO">Inventario / Almacén Central</option>
                    <option value="SOLICITUD_AYUDA">Solicitud de Ayuda</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
              </div>

              {formActividad.tipo_actividad === 'CAMPANA' && (
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">Vincular a Campaña</label>
                  <select
                    value={formActividad.id_campana}
                    onChange={(e) => setFormActividad({ ...formActividad, id_campana: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="">-- Sin campaña asociada --</option>
                    {campanas.map((c) => (
                      <option key={c.id_campana} value={c.id_campana}>
                        {c.nombre} ({c.estado})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalActividadAbierto(false)}
                  className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm"
                >
                  Guardar Actividad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CONTROL Y MODIFICACIÓN DE ASISTENCIA DE VOLUNTARIOS */}
      {/* ===================================================================== */}
      {modalAsistenciaActividad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-surface dark:bg-neutral-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-border dark:border-neutral-800 max-h-[90vh] overflow-y-auto text-neutral-900 dark:text-neutral-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Control & Acreditación de Voluntarios
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{modalAsistenciaActividad.nombre}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  📅 {modalAsistenciaActividad.fecha} • ⏰ {modalAsistenciaActividad.hora_inicio} a {modalAsistenciaActividad.hora_fin} • 📍 {modalAsistenciaActividad.lugar}
                </p>
              </div>
              <button
                onClick={() => setModalAsistenciaActividad(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {cargandoVoluntarios ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400" />
              </div>
            ) : voluntariosActividad.length === 0 ? (
              <div className="text-center py-12 bg-surface-sunken dark:bg-neutral-950/60 rounded-xl text-neutral-500 dark:text-neutral-400 text-sm">
                No hay voluntarios inscritos en esta actividad.
              </div>
            ) : (
              <div className="divide-y divide-border dark:divide-neutral-800">
                {voluntariosActividad.map((v) => (
                  <div key={v.id_participacion} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">{v.voluntario_nombre}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{v.voluntario_correo} • Tel: {v.voluntario_telefono || 'No registrado'}</p>
                      {v.observaciones && <p className="text-xs text-neutral-600 dark:text-neutral-300 italic mt-0.5">"{v.observaciones}"</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {v.asistio ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                            ✓ Asistió ({v.horas_acreditadas} hrs)
                          </span>
                          <button
                            onClick={() => marcarAsistenciaVoluntario(v, false)}
                            className="px-2 py-1 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                            title="Desmarcar o rectificar asistencia"
                          >
                            Modificar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => marcarAsistenciaVoluntario(v, true)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                          >
                            Marcar Asistió
                          </button>
                          <button
                            onClick={() => marcarAsistenciaVoluntario(v, false)}
                            className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold transition"
                          >
                            No Asistió
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-border dark:border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>* Al confirmar asistencia, la base de datos promueve automáticamente al usuario a Voluntario Aprobado.</span>
              <button
                onClick={() => setModalAsistenciaActividad(null)}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
