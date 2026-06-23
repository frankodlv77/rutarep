export default function LandingScreen({ onRegister, onLogin }) {
  const features = [
    { icon: '🧭', title: 'Rutas optimizadas por GPS', desc: 'Ordená tus paradas por cercanía con un toque' },
    { icon: '📦', title: 'Registro de entregas y cobros', desc: 'Marcá entregas, parciales y cancelaciones al instante' },
    { icon: '📊', title: 'Historial y métricas', desc: 'Revisá tus días, comisiones y deudas de clientes' },
  ]

  return (
    <div className="min-h-screen bg-[#0b1320] flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="w-[72px] h-[72px] bg-amber-400 rounded-[20px] flex items-center justify-center text-[36px] mb-5 shadow-lg shadow-amber-400/20">
        🚚
      </div>

      {/* Headline */}
      <h1 className="font-heading text-[28px] font-extrabold text-[#f0f4f8] text-center mb-2">
        RutaRep
      </h1>
      <p className="text-[15px] text-[#6b85a0] text-center leading-snug max-w-[260px] mb-10">
        Organizá tus repartos, cobrá más, trabajá menos
      </p>

      {/* Features */}
      <div className="w-full max-w-[340px] flex flex-col gap-3 mb-10">
        {features.map(f => (
          <div
            key={f.icon}
            className="bg-[#131e2e] border border-white/8 rounded-2xl px-4 py-4 flex items-start gap-4"
          >
            <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0">
              {f.icon}
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#f0f4f8] mb-[2px]">{f.title}</p>
              <p className="text-[12px] text-[#6b85a0] leading-snug">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-[340px] flex flex-col gap-3">
        <button
          onClick={onRegister}
          className="w-full bg-amber-400 text-[#0b1320] font-heading font-bold text-[14px] py-[15px] rounded-xl active:scale-[.98] transition-transform shadow-lg shadow-amber-400/20"
        >
          Empezar gratis
        </button>
        <button
          onClick={onLogin}
          className="w-full bg-transparent border border-white/15 text-[#f0f4f8] font-heading font-bold text-[14px] py-[14px] rounded-xl active:scale-[.98] transition-transform"
        >
          Ya tengo cuenta
        </button>
      </div>
    </div>
  )
}
