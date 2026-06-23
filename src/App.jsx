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

// Encargado
import DashboardScreen from './screens/encargado/DashboardScreen'
import EquipoScreen    from './screens/encargado/EquipoScreen'

import ClienteModal  from './modals/ClienteModal'
import EntregaModal  from './modals/EntregaModal'
import RutaModal     from './modals/RutaModal'
import ConfirmModal  from './modals/ConfirmModal'

const SCREENS_REPARTIDOR = {
  hoy:      HoyScreen,
  ruta:     RutaScreen,
  clientes: ClientesScreen,
  rutas:    RutasScreen,
  hist:     HistorialScreen,
  perfil:   PerfilScreen,
}

const SCREENS_ENCARGADO = {
  dashboard: DashboardScreen,
  equipo:    EquipoScreen,
  hist:      HistorialScreen,
  perfil:    PerfilScreen,
}

const TABS_ENCARGADO = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'equipo',    icon: '👥', label: 'Equipo'    },
  { id: 'hist',      icon: '📋', label: 'Historial' },
  { id: 'perfil',    icon: '👤', label: 'Perfil'    },
]

// Lee el token de invitación de la URL si existe
function getInviteToken() {
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

export default function App() {
  const activeTab  = useStore(s => s.activeTab)
  const setTab     = useStore(s => s.setTab)
  const loadAll    = useStore(s => s.loadAll)
  const perfil     = useStore(s => s.perfil)
  const offline    = useOffline()

  const [user, setUser]           = useState(undefined)
  const [authMode, setAuthMode]   = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [inviteToken, setInviteToken] = useState(getInviteToken)

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
        if (!localStorage.getItem('rr_onboarding_done')) setShowOnboarding(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadAll()
        checkPendingInvite()
        if (!localStorage.getItem('rr_onboarding_done')) setShowOnboarding(true)
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
      <div className="h-full flex items-center justify-center bg-[#0b1320]">
        <div className="text-center">
          <div className="text-[48px] mb-3">🚚</div>
          <p className="text-[13px] text-[#6b85a0]">Cargando...</p>
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

  // Tab activo por defecto según rol
  const defaultTab = esEncargado ? 'dashboard' : 'hoy'
  const tab = esEncargado
    ? (SCREENS_ENCARGADO[activeTab] ? activeTab : defaultTab)
    : (SCREENS_REPARTIDOR[activeTab] ? activeTab : defaultTab)

  const Screen = esEncargado ? SCREENS_ENCARGADO[tab] : SCREENS_REPARTIDOR[tab]

  // ── App logueado ─────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      <Header user={user} />

      {/* TabBar para encargado es diferente */}
      {esEncargado ? (
        <div className="flex-shrink-0 bg-[#0f1a2e] border-t border-white/7 flex">
          {TABS_ENCARGADO.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center py-[10px] gap-[3px] transition-colors ${
                tab === t.id ? 'text-amber-400' : 'text-[#4a6080]'
              }`}
            >
              <span className="text-[20px]">{t.icon}</span>
              <span className="text-[9px] font-heading font-bold tracking-[.4px]">{t.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <TabBar />
      )}

      {offline && (
        <div className="bg-orange-500/15 border-b border-orange-500/30 px-4 py-[9px] flex-shrink-0 flex items-center gap-2">
          <span className="text-[14px]">📵</span>
          <p className="text-[11px] text-orange-300 font-medium leading-snug">
            Sin conexión — las entregas se guardan igual. El historial se sincroniza cuando vuelva internet.
          </p>
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
