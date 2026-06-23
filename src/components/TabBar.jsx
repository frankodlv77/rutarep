import useStore from '../store/useStore'

const TABS = [
  { id: 'hoy',      icon: '📋', label: 'Hoy'      },
  { id: 'ruta',     icon: '🗺️',  label: 'Ruta'     },
  { id: 'clientes', icon: '👥', label: 'Clientes'  },
  { id: 'chat',     icon: '💬', label: 'Chat'      },
  { id: 'hist',     icon: '📦', label: 'Historial' },
  { id: 'perfil',   icon: '👤', label: 'Perfil'    },
]

export default function TabBar() {
  const activeTab   = useStore(s => s.activeTab)
  const setTab      = useStore(s => s.setTab)
  const chatUnread  = useStore(s => s.chatUnread)

  return (
    <nav
      className="fixed bottom-3 left-3 right-3 z-50 flex items-center px-1 py-1 rounded-2xl border border-[var(--c-border)]"
      style={{
        background: 'var(--tabbar-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--tabbar-shadow)',
      }}
    >
      {TABS.map(t => {
        const active = activeTab === t.id
        const badge  = t.id === 'chat' && chatUnread > 0
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center py-[8px] gap-[3px] rounded-xl transition-all duration-200 relative ${
              active ? 'bg-amber-400/12' : ''
            }`}
          >
            <span className={`leading-none transition-all duration-200 ${active ? 'text-[20px]' : 'text-[17px]'}`}>
              {t.icon}
            </span>
            <span className={`text-[8px] font-heading font-bold uppercase tracking-[.5px] transition-colors duration-200 ${
              active ? 'text-amber-400' : 'text-muted2'
            }`}>
              {t.label}
            </span>
            {badge && (
              <span className="absolute top-[6px] right-[calc(50%-8px)] w-[8px] h-[8px] rounded-full bg-red-500 border border-[var(--c-bg)]" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
