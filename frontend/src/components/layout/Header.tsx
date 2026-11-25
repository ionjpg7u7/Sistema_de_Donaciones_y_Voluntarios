import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFotoPerfil } from '../../hooks/useFotoPerfil';
import ThemeToggle from '../ui/ThemeToggle';

interface HeaderProps {
  onAbrirMenu?: () => void;
}

const Header = ({ onAbrirMenu }: HeaderProps) => {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fotoUrl = useFotoPerfil();

  const [menuAbierto, setMenuAbierto] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const iniciales = usuario?.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U';
  const rolActual = usuario?.roles?.join(' · ') || usuario?.rol || 'Usuario';

  const handleLogout = (): void => {
    void logout();
    void navigate('/login');
  };

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickFuera = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  const titulosPorRuta: Record<string, string> = {
    '/dashboard': 'Inicio',
    '/usuarios': 'Gestión de Usuarios',
    '/ayudas': 'Gestión de Beneficiarios y Ayudas',
    '/reportes': 'Reportes y Estadísticas',
    '/perfil': 'Mi Perfil',
    '/mi-disponibilidad': 'Mi Disponibilidad',
    '/voluntarios/mi-disponibilidad': 'Mi Disponibilidad',
  };

  const tituloActual = titulosPorRuta[location.pathname] || 'Donaciones y Voluntariados';

  return (
    <header className="sticky top-[max(0.75rem,env(safe-area-inset-top,0px))] z-30 mx-3 mt-[max(0.75rem,env(safe-area-inset-top,0px))] flex min-h-[72px] items-center justify-between gap-3 rounded-[20px] border border-border bg-surface-elevated/90 px-4 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] shadow-lift backdrop-blur-xl md:gap-4 md:pl-[max(2rem,env(safe-area-inset-left,0px))] md:pr-[max(2rem,env(safe-area-inset-right,0px))]">

      {/* Izquierda: hamburguesa + título */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onAbrirMenu}
          className="press rounded-xl border border-border bg-surface p-2.5 text-text-muted hover:border-accent/50 hover:text-text md:hidden"
          aria-label="Abrir menú"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="min-w-0">
          <p className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-text-subtle sm:block">
            Panel de gestión
          </p>
          <h1 className="truncate font-display text-base font-bold tracking-[-0.02em] text-text md:text-lg">
            {tituloActual}
          </h1>
        </div>
      </div>

      {/* Derecha: rol + home + theme + avatar */}
      <div className="flex items-center gap-2 md:gap-3">

        <div className="mr-1 hidden items-center gap-2 border-r border-border pr-4 lg:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
            {rolActual}
          </p>
        </div>

        <Link
          to="/"
          title="Ir al Home (Sitio Web público)"
          className="press hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11.5px] font-bold text-text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-text sm:flex"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Ver sitio</span>
        </Link>

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuAbierto(!menuAbierto)}
            aria-expanded={menuAbierto}
            aria-haspopup="menu"
            className="press flex items-center gap-2 rounded-xl border border-transparent p-1 hover:border-border hover:bg-surface md:gap-2.5 md:pr-2.5"
          >
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-primary font-display text-sm font-bold text-on-primary ring-1 ring-primary/20 md:h-10 md:w-10">
              {fotoUrl ? (
                <img src={fotoUrl} alt="Perfil" className="h-full w-full object-cover" />
              ) : (
                iniciales
              )}
            </span>
            <span className="hidden items-center gap-1.5 md:flex">
              <span className="max-w-[120px] truncate text-[12.5px] font-semibold text-text">
                {usuario?.nombre || 'Perfil'}
              </span>
              <svg
                className={`h-3.5 w-3.5 text-text-subtle transition-transform duration-200 ease-out-soft ${menuAbierto ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          {menuAbierto && (
            <div
              role="menu"
              className="anim-scale absolute right-0 z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface-elevated py-1.5 shadow-lift"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-[12.5px] font-bold text-text">
                  {usuario?.nombre || 'Usuario'}
                </p>
                <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-accent-text">
                  {rolActual}
                </p>
              </div>

              <Link
                to="/"
                onClick={() => setMenuAbierto(false)}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-text"
              >
                <svg className="h-4 w-4 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Ir al Home
              </Link>
              <Link
                to="/perfil"
                onClick={() => setMenuAbierto(false)}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-text"
              >
                <svg className="h-4 w-4 text-text-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi perfil
              </Link>

              <span aria-hidden="true" className="my-1 block h-px bg-border" />

              <button
                onClick={handleLogout}
                role="menuitem"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold text-error transition-colors duration-150 hover:bg-error-soft"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
