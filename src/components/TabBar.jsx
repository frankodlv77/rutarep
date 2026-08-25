import useStore from '../store/useStore'

const TABS = [
  {
    id: 'hoy',
    label: 'Hoy',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect x="5" y="3" width="14" height="18" rx="2"/>
        <path d="M9 8h6M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'ruta',
    label: 'Ruta',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <circle cx="5" cy="19" r="2"/>
        <circle cx="19" cy="5" r="2"/>
        <path d="M5 17V9a7 7 0 017-7h7"/>
        <path d="M17 3l2 2-2 2"/>
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: 'hist',
    label: 'Historial',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <polyline points="21 8 21 21 3 21 3 8"/>
        <rect x="1" y="3" width="22" height="5" rx="1"/>
        <line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'perfil',
    label: 'Perfil',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function TabBar() {
  const activeTab = useStore(s => s.activeTab)
  const setTab    = useStore(s => s.setTab)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
      style={{
        background: '#0C0C0E',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map(t => {
        const active = activeTab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 flex flex-col items-center justify-center gap-[3px] py-[10px] transition-colors duration-150"
            style={{ color: active ? '#D4962A' : '#3A3A3C' }}
          >
            {t.svg}
            <span style={{
              fontSize: 9,
              fontWeight: active ? 600 : 400,
              letterSpacing: '0.3px',
              fontFamily: "'General Sans', sans-serif",
              lineHeight: 1,
            }}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
