import useStore from '../store/useStore'

export default function PlanesScreen() {
  const setTab = useStore(s => s.setTab)

  return (
    <div className="p-4 flex flex-col items-center pt-16 text-center">
      <div className="text-[48px] mb-4 opacity-40">🚀</div>
      <h2 className="font-heading font-extrabold text-[22px] text-textc mb-2 leading-tight">
        Planes próximamente
      </h2>
      <p className="text-[13px] leading-relaxed mb-8" style={{ color: 'var(--c-muted)' }}>
        Estamos terminando de configurar los planes de suscripción.
        Por ahora la app es completamente gratuita.
      </p>
      <button
        onClick={() => setTab('perfil')}
        className="font-heading font-bold text-[13px] px-6 py-3 rounded-xl active:scale-95 transition-transform"
        style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
      >
        ← Volver
      </button>
    </div>
  )
}
