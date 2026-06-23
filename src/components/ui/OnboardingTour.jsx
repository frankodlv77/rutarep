import { useState } from 'react'

const SLIDES = [
  {
    icon: '📋',
    title: 'Armá tu ruta del día',
    desc: 'Seleccioná los clientes que vas a visitar hoy. Podés ordenarlos por GPS con un toque o arrastrarlos a mano.',
  },
  {
    icon: '📦',
    title: 'Registrá cada entrega',
    desc: 'Marcá entregas, cobros parciales, devoluciones y cancelaciones. Las fotos de comprobante quedan guardadas.',
  },
  {
    icon: '📊',
    title: 'Tu historial siempre a mano',
    desc: 'Al finalizar el día todo queda en el historial. Revisá montos cobrados, comisiones y deudas de clientes.',
  },
]

export default function OnboardingTour({ onDone }) {
  const [slide, setSlide] = useState(0)

  const isLast = slide === SLIDES.length - 1
  const s = SLIDES[slide]

  return (
    <div className="fixed inset-0 z-[999] bg-[#0b1320]/95 backdrop-blur-sm flex flex-col items-center justify-center px-8">
      {/* Card */}
      <div className="w-full max-w-[320px] bg-[#131e2e] border border-white/7 rounded-3xl p-8 flex flex-col items-center text-center">
        <div className="w-[72px] h-[72px] bg-amber-400/10 rounded-2xl flex items-center justify-center text-[40px] mb-5">
          {s.icon}
        </div>
        <h2 className="font-heading font-extrabold text-[20px] text-[#f0f4f8] mb-3 leading-snug">{s.title}</h2>
        <p className="text-[13px] text-[#6b85a0] leading-relaxed mb-8">{s.desc}</p>

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
          className="w-full bg-amber-400 text-[#0b1320] font-heading font-bold text-[14px] py-[14px] rounded-xl active:scale-[.98] transition-transform"
        >
          {isLast ? 'Empezar' : 'Siguiente'}
        </button>

        {!isLast && (
          <button
            onClick={onDone}
            className="mt-3 text-[12px] text-[#6b85a0] hover:text-amber-400 transition-colors"
          >
            Saltar tour
          </button>
        )}
      </div>
    </div>
  )
}
