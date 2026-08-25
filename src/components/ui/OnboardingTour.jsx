import { useState } from 'react'

const SLIDES_REPARTIDOR = [
  {
    step: '01',
    icon: '👥',
    title: 'Primero, sumá tus clientes',
    desc: 'Andá a la pestaña Clientes y cargá los negocios que visitás. Nombre y dirección es todo lo que necesitás para arrancar.',
  },
  {
    step: '02',
    icon: '📋',
    title: 'Armá la ruta del día',
    desc: 'En la pestaña Hoy, tocá los clientes que vas a visitar. Podés ordenarlos por GPS para ir de más cercano a más lejano.',
  },
  {
    step: '03',
    icon: '🚗',
    title: 'Salí a repartir',
    desc: 'En Ruta activás el Modo Conductor: ves un cliente a la vez, navegás, y registrás cada entrega con monto y método de pago.',
  },
]

const SLIDES_ENCARGADO = [
  {
    icon: '📊',
    title: 'Dashboard del equipo',
    desc: 'Mirá en tiempo real cuánto recaudó cada repartidor, cuántas entregas hizo y qué porcentaje completó. Exportá el resumen del día en PDF.',
  },
  {
    icon: '👥',
    title: 'Gestioná tu equipo',
    desc: 'En la pestaña Equipo encontrás los links de invitación para sumar repartidores. Tu plan determina cuántos podés tener activos.',
  },
  {
    icon: '🗺️',
    title: 'Mapa en tiempo real',
    desc: 'Seguí la ubicación de tus repartidores mientras están en la calle. El mapa se actualiza automáticamente durante el día.',
  },
  {
    icon: '🔔',
    title: 'Recordatorios de deuda',
    desc: 'En Perfil → Recordatorio de deuda configurás cada cuántos días te avisamos sobre clientes con deuda pendiente.',
  },
]

export default function OnboardingTour({ onDone, esEncargado = false }) {
  const [slide, setSlide] = useState(0)
  const SLIDES = esEncargado ? SLIDES_ENCARGADO : SLIDES_REPARTIDOR

  const isLast = slide === SLIDES.length - 1
  const s = SLIDES[slide]

  return (
    <div className="fixed inset-0 z-[999] bg-bg/95 backdrop-blur-sm flex flex-col items-center justify-center px-8">
      {/* Card */}
      <div className="w-full max-w-[320px] bg-surface border border-[var(--c-border)] rounded-3xl p-8 flex flex-col items-center text-center">
        {s.step && (
          <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: '#D4962A', fontFamily: "'IBM Plex Mono', monospace" }}>
            Paso {s.step}
          </div>
        )}
        <div className="w-[72px] h-[72px] bg-amber-400/10 rounded-2xl flex items-center justify-center text-[40px] mb-5">
          {s.icon}
        </div>
        <h2 className="font-heading font-extrabold text-[20px] text-textc mb-3 leading-snug">{s.title}</h2>
        <p className="text-[13px] text-muted leading-relaxed mb-8">{s.desc}</p>

        {/* Dots */}
        <div className="flex gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${i === slide ? 'w-5 h-2 bg-amber-400' : 'w-2 h-2 bg-white/15'}`}
            />
          ))}
        </div>

        <button
          onClick={() => isLast ? onDone() : setSlide(s => s + 1)}
          className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[14px] py-[14px] rounded-xl active:scale-[.98] transition-transform"
        >
          {isLast ? 'Empezar' : 'Siguiente'}
        </button>

        {!isLast && (
          <button
            onClick={onDone}
            className="mt-3 text-[12px] text-muted hover:text-amber-400 transition-colors"
          >
            Saltar tour
          </button>
        )}
      </div>
    </div>
  )
}
