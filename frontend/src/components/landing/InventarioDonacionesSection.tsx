export function InventarioDonacionesSection() {
  return (
    <section id="inventario" className="py-20 bg-surface dark:bg-neutral-900 border-b border-border dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden">
          {/* Fondo sutil */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 text-emerald-300 border border-white/20 uppercase tracking-wider mb-5">
              📦 Almacén Central de la Asociación
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Donaciones Directas al Inventario
            </h2>
            <p className="mt-4 text-base sm:text-lg text-neutral-300 leading-relaxed">
              ¿Tienes ropa, calzado, frazadas o alimentos no perecederos en buen estado? Puedes entregarlos directamente a nuestro inventario general para que sean clasificados y resguardados hasta ser canalizados ante futuras emergencias o solicitudes urgentes.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🏢</span>
                  <h4 className="font-bold text-white">Modalidad Exclusivamente Presencial</h4>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Para garantizar la calidad e higiene de los bienes, estas donaciones se reciben <strong>únicamente de manera física en nuestra sucursal central</strong>.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xs">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">✍️</span>
                  <h4 className="font-bold text-white">Registro y Trazabilidad Oficial</h4>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Un <strong>administrador autorizado</strong> inspecciona los artículos, genera el comprobante digital y lo asocia formalmente a tu cuenta de donante en el sistema.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Centro de Acopio e Inventario General</p>
                <p className="text-sm font-bold text-white mt-1">Av. Busch esq. Villalobos #1200, Miraflores, La Paz</p>
                <p className="text-xs text-emerald-400 mt-0.5">Horario de atención: Lunes a Viernes de 08:30 a 17:30</p>
              </div>

              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-sm transition-all shadow-lg hover:shadow-emerald-500/25 shrink-0"
              >
                Ver Ubicación en Mapa ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
