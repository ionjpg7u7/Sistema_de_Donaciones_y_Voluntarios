/**
 * ============================================================================
 * ARCHIVO: Home.tsx
 * PÁGINA: Página Principal (Landing Page)
 * RUTA: /
 * NOTA: El chrome (LandingNavbar + Footer) lo provee PublicLayout.
 *       Esta página solo compone las secciones de la landing.
 * ============================================================================
 */

import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { ServicesShowcase } from '../components/landing/ServicesShowcase';
import { CampanasSection } from '../components/landing/CampanasSection';
import { VoluntariadoSection } from '../components/landing/VoluntariadoSection';
import { SolicitudesAyudaSection } from '../components/landing/SolicitudesAyudaSection';
import { InventarioDonacionesSection } from '../components/landing/InventarioDonacionesSection';

export default function Home() {
  return (
    <>
      {/* 1. Sección Hero con métricas y bienvenida */}
      <Hero />

      {/* 2. Campañas Solidarias Activas (Sprint 3) */}
      <CampanasSection />

      {/* 3. Actividades de Voluntariado Abiertas (Sprint 3) */}
      <VoluntariadoSection />

      {/* 4. Solicitudes de Ayuda Comunitaria (Sprint 3) */}
      <SolicitudesAyudaSection />

      {/* 5. Donaciones Presenciales al Inventario Central (Sprint 3) */}
      <InventarioDonacionesSection />

      {/* 6. ¿Cómo funciona el flujo completo? */}
      <HowItWorks />

      {/* 7. Comodidades y Servicios */}
      <ServicesShowcase />
    </>
  );
}
