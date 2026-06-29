import useStore from '../store/useStore'

const PLANES = [
  {
    id: 'solo',
    nombre: 'Repartidor Solo',
    precio: '$7.99',
    periodo: '/mes',
    descripcion: 'Para repartidores independientes',
    features: [
      '1 usuario',
      'Rutas ilimitadas',
      'Historial 90 días',
      'GPS y geolocalización',
      'Exportación PDF/CSV',
    ],
    link: 'https://buy.stripe.com/test_3cI4gya8m63A2twg8f63K00',
    highlight: false,
  },
  {
    id: 'equipo-chico',
    nombre: 'Equipo Chico',
    precio: '$19.99',
    periodo: '/mes',
    descripcion: 'Para equipos pequeños',
    features: [
      'Hasta 5 repartidores',
      'Dashboard de encargado',
      'Mapa en tiempo real',
      'Todo de Repartidor Solo',
    ],
    link: 'https://buy.stripe.com/test_bJe7sK1BQ77E0lobRZ63K01',
    highlight: true,
  },
  {
    id: 'equipo-grande',
    nombre: 'Equipo Grande',
    precio: '$39.99',
    periodo: '/mes',
    descripcion: 'Para operaciones grandes',
    features: [
      'Repartidores ilimitados',
      'Todo de Equipo Chico',
      'Soporte prioritario',
      'Estadísticas avanzadas',
      'Facturación por equipo',
    ],
    link: 'https://buy.stripe.com/test_fZu00i1BQ77E0lobRZ63K01',
    highlight: false,
  },
]

export default function PlanesScreen() {
  const setTab = useStore(s => s.setTab)
  const perfil = useStore(s => s.perfil)

  return (
    <div className="min-h-full" style={{ background: '#F0EDE8' }}>
      <div className="max-w-[480px] mx-auto px-4 pt-5 pb-24">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setTab('perfil')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#2a2a2a] transition-colors active:scale-95"
            style={{ background: 'rgba(0,0,0,0.08)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <h2 className="font-heading text-[20px] font-extrabold text-[#1a1a1a] leading-tight">Planes</h2>
            <p className="text-[11px] text-[#6b6b6b]">Elegí el plan que mejor se adapta</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {PLANES.map(plan => (
            <div
              key={plan.id}
              className="rounded-2xl p-4 transition-all"
              style={{
                background: plan.highlight ? '#1a1a28' : '#fff',
                border: plan.highlight ? '2px solid #f59e0b' : '1.5px solid #e5e2dc',
                boxShadow: plan.highlight ? '0 4px 20px rgba(245,158,11,0.15)' : '0 1px 6px rgba(0,0,0,0.06)',
              }}
            >
              {plan.highlight && (
                <div className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-400 text-[9px] font-bold uppercase tracking-[.5px] px-2 py-[3px] rounded-full mb-3">
                  ⭐ Más popular
                </div>
              )}

              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className={`font-heading text-[16px] font-extrabold leading-tight ${plan.highlight ? 'text-white' : 'text-[#1a1a1a]'}`}>
                    {plan.nombre}
                  </h3>
                  <p className={`text-[11px] mt-[2px] ${plan.highlight ? 'text-[#a0a0b0]' : 'text-[#6b6b6b]'}`}>
                    {plan.descripcion}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className={`font-heading text-[22px] font-extrabold ${plan.highlight ? 'text-amber-400' : 'text-[#1a1a1a]'}`}>
                    {plan.precio}
                  </span>
                  <span className={`text-[11px] ${plan.highlight ? 'text-[#a0a0b0]' : 'text-[#6b6b6b]'}`}>
                    {plan.periodo}
                  </span>
                </div>
              </div>

              <ul className="mt-3 mb-4 flex flex-col gap-[6px]">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-amber-400 text-[12px] flex-shrink-0">✓</span>
                    <span className={`text-[12px] ${plan.highlight ? 'text-[#c8c8d8]' : 'text-[#4a4a4a]'}`}>{f}</span>
                  </li>
                ))}
              </ul>

              {perfil?.plan === plan.id ? (
                <div className="w-full py-[11px] rounded-xl text-center text-[12px] font-bold text-amber-500 border border-amber-400/40 bg-amber-400/10">
                  Plan actual
                </div>
              ) : (
                <a
                  href={plan.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-[12px] rounded-xl text-center text-[13px] font-heading font-bold bg-amber-400 text-[#1a1a28] active:scale-[.98] transition-transform"
                >
                  Suscribirme →
                </a>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-[#8a8a8a] mt-5 leading-relaxed">
          Cobro mensual recurrente · Cancelá cuando quieras<br />
          Pagos procesados de forma segura por Stripe
        </p>
      </div>
    </div>
  )
}
