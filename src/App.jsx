import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import useStore from './store/useStore'
import { supabase, isConfigured } from './lib/supabase'
import { useOffline } from './hooks/useOffline'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function registerPushSubscription(userId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return
  if (Notification.permission === 'denied') return
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
      })
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: member } = await supabase
      .from('equipo_miembros').select('equipo_id').eq('user_id', userId).maybeSingle()
    await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ subscription: sub.toJSON(), equipoId: member?.equipo_id || null }),
    })
  } catch (_) {}
}

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

import PasswordResetScreen from './screens/PasswordResetScreen'
import PlanesScreen        from './screens/PlanesScreen'

// Encargado
import DashboardScreen from './screens/encargado/DashboardScreen'
import EquipoScreen    from './screens/encargado/EquipoScreen'
import MapaScreen      from './screens/encargado/MapaScreen'
import MetricasScreen  from './screens/encargado/MetricasScreen'

import { useLocationTracker } from './hooks/useLocationTracker'
import { usePWABadge }        from './hooks/usePWABadge'

import ClienteModal         from './modals/ClienteModal'
import ClienteHistorialModal from './modals/ClienteHistorialModal'
import EntregaModal          from './modals/EntregaModal'
import RutaModal             from './modals/RutaModal'
import ConfirmModal          from './modals/ConfirmModal'

const SCREENS_REPARTIDOR = {
  hoy:      HoyScreen,
  ruta:     RutaScreen,
  clientes: ClientesScreen,
  rutas:    RutasScreen,
  hist:     HistorialScreen,
  perfil:   PerfilScreen,
  planes:   PlanesScreen,
}

const SCREENS_ENCARGADO = {
  dashboard: DashboardScreen,
  equipo:    EquipoScreen,
  mapa:      MapaScreen,
  metricas:  MetricasScreen,
  hist:      HistorialScreen,
  perfil:    PerfilScreen,
  planes:    PlanesScreen,
}

const TABS_ENCARGADO = [
  {
    id: 'dashboard', label: 'Dashboard',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'equipo', label: 'Equipo',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: 'mapa', label: 'Mapa',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    ),
  },
  {
    id: 'metricas', label: 'Métricas',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    id: 'perfil', label: 'Perfil',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

// Lee el token de invitación de la URL si existe
function getInviteToken() {
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

export default function App() {
  const activeTab            = useStore(s => s.activeTab)
  const setTab               = useStore(s => s.setTab)
  const loadAll              = useStore(s => s.loadAll)
  const perfil               = useStore(s => s.perfil)
  const compartirUbicacion   = useStore(s => s.compartirUbicacion)
  const offline              = useOffline()

  useLocationTracker(perfil, compartirUbicacion)
  usePWABadge()

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

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
        registerPushSubscription(session.user.id)
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
        registerPushSubscription(u.id)
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
          // Recargar todo después de aceptar invitación para que el tracker de ubicación arranque con equipo_id correcto
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) loadAll()
          })
          // Forzar re-mount del tracker reiniciando la página (equipo_miembros ya existe)
          setTimeout(() => window.location.reload(), 800)
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

      {/* TabBar encargado */}
      {esEncargado && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
          style={{
            background: '#0C0C0E',
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {TABS_ENCARGADO.map(t => {
            const active = tab === t.id
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
      <ClienteHistorialModal />
      <EntregaModal />
      <RutaModal />
      <ConfirmModal />
      <Toast />

      {/* Banner nueva versión PWA */}
      {needRefresh && (
        <div className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between gap-3 bg-amber-400 px-4 py-[10px]">
          <p className="text-[12px] font-bold text-[#1a1a28] leading-snug">
            Nueva versión disponible
          </p>
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-shrink-0 bg-[#1a1a28] text-amber-400 text-[11px] font-heading font-bold px-3 py-[6px] rounded-lg active:scale-95 transition-transform"
          >
            Actualizar
          </button>
        </div>
      )}

      {showOnboarding && (
        <OnboardingTour
          esEncargado={esEncargado}
          onDone={() => {
            localStorage.setItem('rr_onboarding_done', '1')
            setShowOnboarding(false)
            if (!esEncargado) setTab('clientes')
          }}
        />
      )}
    </div>
  )
}
