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
    <nav className="flex bg-[#131e2e] border-b border-white/7 flex-shrink-0">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`flex-1 flex flex-col items-center py-[9px] gap-[2px] border-b-2 transition-all text-[9px] font-heading font-bold uppercase tracking-[.4px] ${
            activeTab === t.id
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-[#6b85a0]'
          }`}
        >
          <span className="text-[16px] leading-none">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
