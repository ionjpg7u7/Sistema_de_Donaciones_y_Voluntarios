import { useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import IconLogo from '../../assets/logo.svg?react';

// =====================================================
// TIPOS
// =====================================================
type Rol = 'Administrador' | 'Coordinador' | 'Voluntario' | 'Beneficiario' | 'Donante' | 'Empleado' | 'Cliente' | 'Usuario';

interface MenuItem {
    path: string;
    name: string;
    icon: string;
    roles: Rol[];
    enDesarrollo?: boolean;
}

interface NavbarProps {
    abierto: boolean;
    onCerrar: () => void;
    colapsado: boolean;
    onAlternarColapsado: () => void;
}

// =====================================================
// COMPONENTE
// =====================================================
const Navbar = ({ abierto, onCerrar, colapsado, onAlternarColapsado }: NavbarProps) => {
    const { usuario } = useAuth();

    // Cerrar el panel móvil con la tecla ESC
    useEffect(() => {
        if (!abierto) return;
        const alPresionar = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCerrar();
        };
        document.addEventListener('keydown', alPresionar);
        return () => document.removeEventListener('keydown', alPresionar);
    }, [abierto, onCerrar]);

    const menuItems: MenuItem[] = [
        { 
            path: '/dashboard', 
            name: 'Inicio', 
            icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', 
            roles: ['Administrador', 'Coordinador', 'Voluntario', 'Beneficiario', 'Donante', 'Empleado', 'Cliente', 'Usuario'] 
        },
        { 
            path: '/usuarios', 
            name: '1. Gestión de Usuarios', 
            icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', 
            roles: ['Administrador'] 
        },
        { 
            path: '/campanas', 
            name: '2. Gestión de Campañas y Actividades', 
            icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', 
            roles: ['Administrador', 'Coordinador', 'Voluntario', 'Beneficiario', 'Donante', 'Empleado', 'Cliente', 'Usuario'],
            enDesarrollo: false
        },
        { 
            path: '/donaciones', 
            name: '3. Gestión de Donaciones', 
            icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', 
            roles: ['Administrador', 'Voluntario', 'Beneficiario', 'Donante'],
            enDesarrollo: false
        },
        { 
            path: '/voluntarios', 
            name: '4. Gestión de Voluntarios', 
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', 
            roles: ['Administrador', 'Coordinador', 'Voluntario', 'Empleado'],
            enDesarrollo: true
        },
        { 
            path: '/beneficios', 
            name: '5. Gestión de Beneficios y Ayuda', 
            icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', 
            roles: ['Administrador', 'Beneficiario', 'Donante', 'Coordinador', 'Voluntario', 'Empleado', 'Cliente', 'Usuario'],
            enDesarrollo: true
        },
        { 
            path: '/reportes', 
            name: '6. Gestión de Reportes y Notificaciones', 
            icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', 
            roles: ['Administrador', 'Coordinador'],
            enDesarrollo: true
        }
    ];

    const rolNormal = (usuario?.rol || 'Usuario').toLowerCase();
    const esCoordinador = Boolean(usuario?.es_coordinador) || rolNormal === 'coordinador';
    const menuFiltrado = menuItems.filter(item => {
        return item.roles.some(r => {
            const rNorm = r.toLowerCase();
            if (rNorm === rolNormal) return true;
            if (esCoordinador && rNorm === 'coordinador') return true;
            if ((rolNormal === 'admin' || rolNormal === 'administrador') && rNorm === 'administrador') return true;
            if ((rolNormal === 'donante' || rolNormal === 'cliente') && (rNorm === 'donante' || rNorm === 'cliente')) return true;
            if ((rolNormal === 'voluntario' || rolNormal === 'empleado') && (rNorm === 'voluntario' || rNorm === 'empleado')) return true;
            return false;
        });
    });

    return (
        <>
            {/* Overlay en móvil */}
            {abierto && (
                <div 
                    className="anim-fade fixed inset-0 z-40 bg-night/70 backdrop-blur-sm md:hidden"
                    onClick={onCerrar}
                    aria-hidden="true"
                />
            )}

            <aside className={`
                fixed z-50 flex w-64 max-w-[85vw] flex-col overflow-hidden
                left-[max(0.75rem,env(safe-area-inset-left,0px))]
                top-[max(0.75rem,env(safe-area-inset-top,0px))]
                bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]
                rounded-[20px]
                border border-black/5 dark:border-white/[0.06]
                bg-surface-elevated dark:bg-surface text-text dark:text-cream
                shadow-lift
                transition-[transform,width] duration-300 ease-out-soft
                ${abierto ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}
                md:translate-x-0 md:max-w-none
                ${colapsado ? 'md:w-[76px]' : 'md:w-64'}
            `}>
                <div aria-hidden="true" className="grid-paper dark:grid-paper-light pointer-events-none absolute inset-0 opacity-30" />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-primary/[0.10] dark:bg-gold/[0.10] blur-[90px]"
                />

                {/* Marca */}
                <Link 
                    to="/" 
                    onClick={onCerrar}
                    className={`press group relative z-10 flex min-h-[4.5rem] items-center gap-3 border-b border-border px-5 dark:border-cream/10 ${colapsado ? 'md:justify-center md:px-0' : ''}`}
                    title="Ir a la página principal / Home"
                >
                    <IconLogo className="h-10 w-10 shrink-0 transition-transform duration-300 ease-out-soft motion-safe:group-hover:rotate-[-4deg]" />
                    <div className={`flex min-w-0 flex-col leading-none ${colapsado ? 'md:hidden' : ''}`}>
                        <span className="font-display text-[12.5px] font-bold tracking-[-0.01em] text-text dark:text-cream">
                            Donaciones
                        </span>
                        <span className="font-display text-[12.5px] font-bold tracking-[-0.01em] text-primary dark:text-gold">&amp; Voluntariados</span>
                    </div>
                </Link>

                {/* Navegación */}
                <nav className="relative z-10 flex-1 overflow-y-auto px-3 py-5">
                    <p className={`mb-3 px-3 text-[9px] font-bold uppercase tracking-[0.28em] text-text-subtle dark:text-cream/35 ${colapsado ? 'md:hidden' : ''}`}>
                        Navegación
                    </p>

                    <ul className="space-y-1">
                        {menuFiltrado.map((item) => (
                            <li key={item.path}>
                                {item.enDesarrollo ? (
                                    <span
                                        className={`flex cursor-not-allowed select-none items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-text-subtle/70 dark:text-cream/30 ${colapsado ? 'md:justify-center md:px-0' : ''}`}
                                        aria-disabled="true"
                                        title={colapsado ? `${item.name} — módulo en desarrollo` : 'Módulo en desarrollo'}
                                    >
                                        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                                        </svg>
                                        <span className={`truncate ${colapsado ? 'md:hidden' : ''}`}>{item.name}</span>
                                        <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-text-subtle/40 dark:bg-cream/20 ${colapsado ? 'md:hidden' : ''}`} />
                                    </span>
                                ) : (
                                    <NavLink 
                                        key={item.path} 
                                        to={item.path} 
                                        onClick={onCerrar}   
                                        title={colapsado ? item.name : undefined}
                                        className={({ isActive }) => `
                                            press group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200
                                            ${colapsado ? 'md:justify-center md:px-0' : ''}
                                            ${isActive 
                                                ? 'bg-primary-soft dark:bg-cream/[0.08] font-semibold text-text dark:text-cream' 
                                                : 'font-medium text-text-muted dark:text-cream/60 hover:bg-surface dark:hover:bg-cream/[0.05] hover:text-text dark:hover:text-cream'
                                            }
                                        `}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <svg
                                                    className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                                                        isActive ? 'text-primary dark:text-gold' : 'text-text-subtle dark:text-cream/45 group-hover:text-primary dark:group-hover:text-gold/80'
                                                    }`}
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                                                </svg>
                                                <span className={`truncate ${colapsado ? 'md:hidden' : ''}`}>{item.name}</span>
                                            </>
                                        )}
                                    </NavLink>
                                )}
                            </li>
                        ))}
                    </ul>

                    <div className={`mt-6 rounded-xl border border-border dark:border-cream/10 bg-surface dark:bg-cream/[0.04] p-3.5 ${colapsado ? 'md:hidden' : ''}`}>
                        <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-text-subtle dark:text-cream/45">
                            <span className="motion-safe:animate-pulse-dot h-1.5 w-1.5 rounded-full bg-primary dark:bg-gold" />
                            Versión en curso
                        </p>
                        <p className="mt-2 text-[11px] leading-relaxed text-text-subtle dark:text-cream/45">
                            Los módulos marcados se habilitarán en la próxima entrega.
                        </p>
                    </div>
                </nav>

                {/* Pie del sidebar */}
                <div className="relative z-10 border-t border-border p-3 dark:border-cream/10">
                    <Link
                        to="/"
                        onClick={onCerrar}
                        title={colapsado ? 'Volver al Home' : undefined}
                        className="press flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong dark:border-cream/15 bg-surface dark:bg-cream/[0.05] px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted dark:text-cream/80 hover:border-primary/50 dark:hover:border-gold/45 hover:text-primary dark:hover:text-gold-bright"
                    >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className={`truncate ${colapsado ? 'md:hidden' : ''}`}>Volver al Home</span>
                    </Link>

                    {/* Botón para expandir / contraer el sidebar (solo escritorio) */}
                    <button
                        type="button"
                        onClick={onAlternarColapsado}
                        aria-expanded={!colapsado}
                        aria-label={colapsado ? 'Expandir menú lateral' : 'Contraer menú lateral'}
                        title={colapsado ? 'Expandir menú' : 'Contraer menú'}
                        className="press mt-2 hidden w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong dark:border-cream/15 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-subtle dark:text-cream/50 hover:border-primary/50 dark:hover:border-gold/45 hover:bg-surface dark:hover:bg-cream/[0.04] hover:text-primary dark:hover:text-gold-bright md:flex"
                    >
                        <svg
                            className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out-soft ${colapsado ? '' : 'rotate-180'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className={colapsado ? 'md:hidden' : ''}>{colapsado ? 'Expandir' : 'Contraer'}</span>
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Navbar;
