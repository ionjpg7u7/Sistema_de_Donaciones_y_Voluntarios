/**
 * ============================================================================
 * ARCHIVO: App.tsx
 * PROPÓSITO: Configuración central de rutas del Sistema de Donaciones y
 *            Voluntariado.
 * ============================================================================
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';

// Guards de rutas privadas
import RutasProtegidas from './components/guards/RutasProtegidas';
import RutasAdmin from './components/guards/RutasAdmin';

// Páginas
import Home from './pages/Home';
import Login from './pages/Login';
import Registro from './pages/Registro';
import UsuariosPage from './pages/UsuariosPage';
import DonacionesPage from './pages/DonacionesPage';
import CampanasPage from './pages/CampanasPage';
import AyudasPage from './pages/AyudasPage';
import Perfil from './pages/Perfil';
import Dashboard from './pages/Dashboard';
import SolicitarRecuperacion from './pages/SolicitarRecuperacion';
import ResetPassword from './pages/ResetPassword';

import VoluntariosLayout from './components/voluntarios/layout/VoluntariosLayout';
import RutasPorRol from './components/guards/RutasPorRol';

import SolicitudesPage from './pages/voluntarios/SolicitudesPage';
import SeguimientoPage from './pages/voluntarios/SeguimientoPage';
import DisponibilidadEquipoPage from './pages/voluntarios/DisponibilidadEquipoPage';
import AsistenciaPage from './pages/voluntarios/AsistenciaPage';
import MiDisponibilidadPage from './pages/voluntarios/MiDisponibilidadPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. PÚBLICO (LandingNavbar + Footer) */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
        </Route>

        {/* 2. AUTH (pantalla completa, sin chrome) */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/solicitar-recuperacion" element={<SolicitarRecuperacion />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 3. PRIVADO (Navbar sidebar + Header) */}
        <Route element={<RutasProtegidas />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/donaciones" element={<DonacionesPage />} />
            <Route path="/campanas" element={<CampanasPage />} />
            <Route path="/ayudas" element={<AyudasPage />} />

            {/* SECCIÓN 5: MI DISPONIBILIDAD (Voluntario / Coordinador) */}
            <Route element={<RutasPorRol roles={['Voluntario', 'Empleado', 'Coordinador']} />}>
              <Route path="/mi-disponibilidad" element={<MiDisponibilidadPage />} />
            </Route>

            {/* ITERACIÓN 4: GESTIÓN DE VOLUNTARIOS */}
            <Route path="/voluntarios" element={<VoluntariosLayout />}>
              {/* Administrador */}
              <Route element={<RutasPorRol roles={['Administrador']} />}>
                <Route path="solicitudes" element={<SolicitudesPage />} />
                <Route path="seguimiento" element={<SeguimientoPage />} />
              </Route>

              {/* Coordinador */}
              <Route element={<RutasPorRol roles={['Coordinador']} />}>
                <Route
                  path="disponibilidad-equipo"
                  element={<DisponibilidadEquipoPage />}
                />
                <Route path="asistencia" element={<AsistenciaPage />} />
              </Route>

              {/* Voluntario / Coordinador (Sección 5) */}
              <Route element={<RutasPorRol roles={['Voluntario', 'Empleado', 'Coordinador']} />}>
                <Route
                  path="mi-disponibilidad"
                  element={<MiDisponibilidadPage />}
                />
              </Route>
            </Route>

            {/* Solo administradores */}
            <Route element={<RutasAdmin />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
          </Route>
        </Route>

        {/* 4. Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
