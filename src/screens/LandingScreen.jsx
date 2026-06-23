const features = [
  { icon: '🧭', title: 'Rutas por GPS',          desc: 'Ordená paradas por cercanía con un toque' },
  { icon: '📦', title: 'Entregas y cobros',       desc: 'Marcá entregas, parciales y cancelaciones' },
  { icon: '📊', title: 'Historial y métricas',    desc: 'Comisiones, deudas y resumen del día'      },
]

export default function LandingScreen({ onRegister, onLogin }) {
  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center px-5">

      {/* Logo + headline — compacto */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-[44px] h-[44px] rounded-[13px] flex items-center justify-center text-[22px] flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            boxShadow: '0 0 16px rgba(251,191,36,0.35)',
          }}
        >
          🚚
        </div>
        <h1 className="font-heading text-[26px] font-extrabold text-textc tracking-tight">
          RutaRep
        </h1>
      </div>

      <p className="text-[13px] text-muted text-center mb-6">
        Organizá repartos, cobrá más, trabajá mejor
      </p>

      {/* Features — horizontal compacto */}
      <div className="w-full max-w-[340px] flex flex-col gap-[8px] mb-6">
        {features.map(f => (
          <div
            key={f.icon}
            className="flex items-center gap-3 rounded-xl px-3 py-[10px]"
            style={{
              background: '#131e2e',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div className="w-[34px] h-[34px] bg-amber-400/10 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0">
              {f.icon}
            </div>
            <div>
              <p className="text-[12px] font-bold text-textc leading-tight">{f.title}</p>
              <p className="text-[11px] text-muted leading-snug">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="w-full max-w-[340px] flex flex-col gap-[10px]">
        <button
          onClick={onRegister}
          className="w-full btn-shimmer font-heading font-bold text-[15px] py-[14px] rounded-xl active:scale-[.98] transition-transform"
          style={{ boxShadow: '0 4px 16px rgba(251,191,36,0.25)' }}
        >
          Empezar gratis
        </button>
        <button
          onClick={onLogin}
          className="w-full font-heading font-bold text-[14px] py-[13px] rounded-xl text-textc active:scale-[.98] transition-transform"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          Ya tengo cuenta
        </button>
      </div>

      <p className="text-[10px] text-muted2 mt-5">Gratis para siempre · Sin tarjeta</p>
    </div>
  )
}
