import useStore from '../store/useStore'

const TABS = [
  { id: 'hoy',      icon: '📋', label: 'Hoy'      },
  { id: 'ruta',     icon: '🗺️',  label: 'Ruta'     },
  { id: 'clientes', icon: '👥', label: 'Clientes'  },
  { id: 'rutas',    icon: '📍', label: 'Rutas'     },
  { id: 'hist',     icon: '📦', label: 'Historial' },
  { id: 'perfil',   icon: '👤', label: 'Perfil'    },
]

export default function TabBar() {
  const activeTab = useStore(s => s.activeTab)
  const setTab    = useStore(s => s.setTab)

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 z-50 flex items-center px-1 py-1 rounded-2xl border border-white/[0.07]"
      style={{
        background: 'rgba(10, 16, 28, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {TABS.map(t => {
        const active = activeTab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-[8px] gap-[3px] rounded-xl transition-all duration-200 ${
              active ? 'bg-amber-400/12' : ''
            }`}
          >
            <span className={`leading-none transition-all duration-200 ${active ? 'text-[20px]' : 'text-[17px]'}`}>
              {t.icon}
            </span>
            <span className={`text-[8px] font-heading font-bold uppercase tracking-[.5px] transition-colors duration-200 ${
              active ? 'text-amber-400' : 'text-[#3d5470]'
            }`}>
              {t.label}
            </span>
            {active && (
              <span className="w-[4px] h-[4px] rounded-full bg-amber-400 absolute bottom-[5px]" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
