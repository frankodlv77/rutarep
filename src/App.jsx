import { useEffect, useState } from 'react'
import useStore from './store/useStore'
import { supabase, isConfigured } from './lib/supabase'
import { useOffline } from './hooks/useOffline'

import Header        from './components/Header'
import TabBar        from './components/TabBar'
import Toast         from './components/ui/Toast'

import HoyScreen      from './screens/HoyScreen'
import RutaScreen     from './screens/RutaScreen'
import ClientesScreen from './screens/ClientesScreen'
import RutasScreen    from './screens/RutasScreen'
import HistorialScreen from './screens/HistorialScreen'
import PerfilScreen    from './screens/PerfilScreen'
import LoginScreen    from './screens/LoginScreen'
import LandingScreen  from './screens/LandingScreen'
import UnirseScreen, { checkPendingInvite } from './screens/UnirseScreen'
import OnboardingTour from './components/ui/OnboardingTour'

import ChatScreen          from './screens/ChatScreen'
import PasswordResetScreen from './screens/PasswordResetScreen'
import PlanesScreen        from './screens/PlanesScreen'

// Encargado
import DashboardScreen from './screens/encargado/DashboardScreen'
import EquipoScreen    from './screens/encargado/EquipoScreen'
import MapaScreen      from './screens/encargado/MapaScreen'

import { useLocationTracker } from './hooks/useLocationTracker'
import { usePWABadge }        from './hooks/usePWABadge'

import ClienteModal  from './modals/ClienteModal'
import EntregaModal  from './modals/EntregaModal'
import RutaModal     from './modals/RutaModal'
import ConfirmModal  from './modals/ConfirmModal'

const SCREENS_REPARTIDOR = {
  hoy:      HoyScreen,
  ruta:     RutaScreen,
  clientes: ClientesScreen,
  rutas:    RutasScreen,
  chat:     ChatScreen,
  hist:     HistorialScreen,
  perfil:   PerfilScreen,
  planes:   PlanesScreen,
}

const SCREENS_ENCARGADO = {
  dashboard: DashboardScreen,
  equipo:    EquipoScreen,
  mapa:      MapaScreen,
  chat:      ChatScreen,
  hist:      HistorialScreen,
  perfil:    PerfilScreen,
  planes:    PlanesScreen,
}

const TABS_ENCARGADO = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'equipo',    icon: '👥', label: 'Equipo'    },
  { id: 'mapa',      icon: '🗺️',  label: 'Mapa'      },
  { id: 'chat',      icon: '💬', label: 'Chat'      },
  { id: 'perfil',    icon: '👤', label: 'Perfil'    },
]

// Lee el token de invitación de la URL si existe
function getInviteToken() {
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

export default function App() {
  const activeTab   = useStore(s => s.activeTab)
  const setTab      = useStore(s => s.setTab)
  const chatUnread  = useStore(s => s.chatUnread)
  const loadAll     = useStore(s => s.loadAll)
  const perfil      = useStore(s => s.perfil)
  const offline     = useOffline()

  useLocationTracker(perfil)
  usePWABadge()

  const [user, setUser]               = useState(undefined)
  const [authMode, setAuthMode]       = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [inviteToken, setInviteToken] = useState(getInviteToken)
  const [isRecovery, setIsRecovery]   = useState(false)

  const INACTIVITY_MS = 14 * 60 * 60 * 1000

  useEffect(() => {
    const last = parseInt(localStorage.getItem('rr_last_activity') || '0')
    if (last && Date.now() - last > INACTIVITY_MS) {
      supabase.auth.signOut()
    }
    const touch = () => localStorage.setItem('rr_last_activity', Date.now().toString())
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    touch()
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadAll()
        if (!localStorage.getItem('rr_onboarding_done')) {
          localStorage.setItem('rr_onboarding_done', '1')
          setShowOnboarding(true)
        }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setUser(session?.user ?? null)
        return
      }
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadAll()
        checkPendingInvite()
        if (!localStorage.getItem('rr_onboarding_done')) {
          localStorage.setItem('rr_onboarding_done', '1')
          setShowOnboarding(true)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Si el token de invitación existe en URL, limpiar la URL para que no quede feo
  useEffect(() => {
    if (inviteToken) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [inviteToken])

  // ── Recuperación de contraseña ───────────────────────────────────
  if (isRecovery) {
    return (
      <PasswordResetScreen onDone={() => {
        setIsRecovery(false)
        supabase.auth.signOut()
      }} />
    )
  }

  // ── Pantalla de invitación ───────────────────────────────────────
  if (inviteToken) {
    return (
      <UnirseScreen
        token={inviteToken}
        onDone={() => {
          setInviteToken(null)
          // Si ya está logueado, recarga datos; si no, va a landing
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) loadAll()
          })
        }}
      />
    )
  }

  // ── Cargando sesión ──────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="text-[48px] mb-3">🚚</div>
          <p className="text-[13px] text-muted">Cargando...</p>
        </div>
      </div>
    )
  }

  // ── No logueado ──────────────────────────────────────────────────
  if (!user) {
    if (!authMode) {
      return (
        <LandingScreen
          onRegister={() => setAuthMode('register')}
          onLogin={() => setAuthMode('login')}
        />
      )
    }
    return (
      <LoginScreen
        initialMode={authMode}
        onBack={() => setAuthMode(null)}
      />
    )
  }

  // ── Rol del usuario ──────────────────────────────────────────────
  const esEncargado = perfil?.rol === 'encargado'

  const trialExpired = perfil &&
    (!perfil.plan || perfil.plan === 'free') &&
    perfil.trial_start &&
    (Date.now() - new Date(perfil.trial_start).getTime()) > 30 * 24 * 60 * 60 * 1000

  // Tab activo por defecto según rol
  const defaultTab = esEncargado ? 'dashboard' : 'hoy'
  const tab = esEncargado
    ? (SCREENS_ENCARGADO[activeTab] ? activeTab : defaultTab)
    : (SCREENS_REPARTIDOR[activeTab] ? activeTab : defaultTab)

  const Screen = esEncargado ? SCREENS_ENCARGADO[tab] : SCREENS_REPARTIDOR[tab]

  // ── App logueado ─────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
      <Header user={user} />

      {/* TabBar repartidor — flotante */}
      {!esEncargado && <TabBar />}

      {/* TabBar encargado — mismo estilo flotante */}
      {esEncargado && (
        <nav
          className="fixed bottom-3 left-3 right-3 z-50 flex items-center px-1 py-1 rounded-2xl border border-[var(--c-border)]"
          style={{
            background: 'var(--tabbar-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'var(--tabbar-shadow)',
          }}
        >
          {TABS_ENCARGADO.map(t => {
            const active = tab === t.id
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
      )}

      {offline && (
        <div className="bg-orange-500/15 border-b border-orange-500/30 px-4 py-[9px] flex-shrink-0 flex items-center gap-2">
          <span className="text-[14px]">📵</span>
          <p className="text-[11px] text-orange-300 font-medium leading-snug">
            Sin conexión — las entregas se guardan igual. El historial se sincroniza cuando vuelva internet.
          </p>
        </div>
      )}

      {trialExpired && (
        <div className="bg-amber-400/20 border-b border-amber-400/40 px-4 py-[9px] flex-shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">⚠️</span>
            <p className="text-[11px] text-amber-300 font-medium leading-snug">
              Tu período de prueba terminó. Suscribite para continuar.
            </p>
          </div>
          <button
            onClick={() => setTab('planes')}
            className="flex-shrink-0 text-[10px] font-bold text-amber-400 border border-amber-400/50 px-2 py-[3px] rounded-lg active:scale-95 transition-transform"
          >
            Ver planes
          </button>
        </div>
      )}

      <div className="scroll-area">
        {Screen ? <Screen /> : null}
      </div>

      <ClienteModal />
      <EntregaModal />
      <RutaModal />
      <ConfirmModal />
      <Toast />

      {showOnboarding && !esEncargado && (
        <OnboardingTour onDone={() => {
          localStorage.setItem('rr_onboarding_done', '1')
          setShowOnboarding(false)
        }} />
      )}
    </div>
  )
}
