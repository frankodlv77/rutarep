import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'

function useInstallState() {
  const ua = navigator.userAgent
  const isIOS       = /iPhone|iPad|iPod/.test(ua)
  const isAndroid   = /Android/.test(ua)
  const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua)
  const isIOSChrome = isIOS && /CriOS/.test(ua)
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return { isIOS, isAndroid, isIOSSafari, isIOSChrome, isStandalone }
}

function InstallSection() {
  const { isIOS, isAndroid, isIOSSafari, isIOSChrome, isStandalone } = useInstallState()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone || installed) {
    return (
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,199,89,0.1)' }}>
          <span className="text-[18px]">✅</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-textc">App instalada</p>
          <p className="text-[11px] text-muted">Ya estás usando VoraRep como app nativa</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Instalar la app</p>

      {isIOSChrome && (
        <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
          <p className="text-[12px] font-bold mb-1" style={{ color: '#FF9500' }}>Abrí esta página en Safari</p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Chrome en iPhone no puede instalar apps. Copiá la URL y pegala en Safari.
          </p>
        </div>
      )}

      {isIOSSafari && (
        <div className="flex flex-col gap-[10px]">
          {[
            { n: '1', icon: '↑', text: 'Tocá el botón compartir (cuadrado con flecha) en la barra de Safari' },
            { n: '2', icon: '⊞', text: 'Deslizá y tocá "Añadir a pantalla de inicio"' },
            { n: '3', icon: '✓', text: 'Tocá "Añadir" — la app aparece como ícono en tu pantalla' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(212,150,42,0.15)', color: '#D4962A' }}>{s.n}</div>
              <p className="text-[12px] leading-relaxed text-textc pt-[4px]">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {isAndroid && deferredPrompt && (
        <button
          onClick={async () => {
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') setInstalled(true)
            setDeferredPrompt(null)
          }}
          className="w-full font-heading font-bold text-[14px] py-[13px] rounded-2xl active:scale-[.98] transition-transform"
          style={{ background: '#D4962A', color: '#0C0C0E' }}
        >
          Instalar VoraRep →
        </button>
      )}

      {isAndroid && !deferredPrompt && (
        <div className="flex flex-col gap-[10px]">
          {[
            { n: '1', text: 'Tocá los tres puntos ⋮ en la esquina superior derecha de Chrome' },
            { n: '2', text: '"Añadir a pantalla de inicio" o "Instalar app"' },
            { n: '3', text: 'Confirmá — la app queda instalada sin barra del navegador' },
          ].map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(212,150,42,0.15)', color: '#D4962A' }}>{s.n}</div>
              <p className="text-[12px] leading-relaxed text-textc pt-[4px]">{s.text}</p>
            </div>
          ))}
        </div>
      )}

      {!isIOS && !isAndroid && (
        <p className="text-[12px] leading-relaxed text-muted">
          Desde el celular podés instalar la app directamente desde el navegador. Abrí <strong className="text-textc">app.vora-system.com</strong> en tu celular y seguí las instrucciones.
        </p>
      )}
    </div>
  )
}

const ALERTA_LS_KEY = 'rr_alerta_demora_min'

const DIAS = [
  { dia: 1, label: 'Lunes'    },
  { dia: 2, label: 'Martes'   },
  { dia: 3, label: 'Miércoles'},
  { dia: 4, label: 'Jueves'   },
  { dia: 5, label: 'Viernes'  },
  { dia: 6, label: 'Sábado'   },
  { dia: 0, label: 'Domingo'  },
]

function SemanaConfig({ perfil }) {
  const [diaInicio, setDiaInicio] = useState(1)
  const [diaFin,    setDiaFin]    = useState(5)
  const [equipoId,  setEquipoId]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    supabase.from('equipos')
      .select('id, dia_inicio_semana, dia_fin_semana')
      .eq('owner_id', perfil.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEquipoId(data.id)
          setDiaInicio(data.dia_inicio_semana ?? 1)
          setDiaFin(data.dia_fin_semana ?? 5)
        }
      })
  }, [perfil.id])

  const confirmar = async () => {
    if (!equipoId) return
    setSaving(true)
    await supabase.from('equipos')
      .update({ dia_inicio_semana: diaInicio, dia_fin_semana: diaFin })
      .eq('id', equipoId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const labelInicio = DIAS.find(d => d.dia === diaInicio)?.label || '—'
  const labelFin    = DIAS.find(d => d.dia === diaFin)?.label    || '—'

  return (
    <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-1">Semana de reparto</p>
      <p className="text-[11px] text-muted mb-4 leading-relaxed">
        Configurá qué días cubre tu semana. Afecta el resumen semanal y la comparativa del dashboard.
      </p>

      <div className="mb-4">
        <p className="text-[11px] font-bold text-textc mb-2">¿Qué día empieza tu semana?</p>
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map(({ dia, label }) => (
            <button
              key={dia}
              onClick={() => setDiaInicio(dia)}
              className={`py-[9px] rounded-lg text-[10px] font-bold transition-all ${
                diaInicio === dia
                  ? 'bg-amber-400 text-[#1a1a28]'
                  : 'bg-surface2 border border-[var(--c-border)] text-muted'
              }`}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-[11px] font-bold text-textc mb-2">¿Qué día termina?</p>
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map(({ dia, label }) => (
            <button
              key={dia}
              onClick={() => setDiaFin(dia)}
              className={`py-[9px] rounded-lg text-[10px] font-bold transition-all ${
                diaFin === dia
                  ? 'bg-amber-400 text-[#1a1a28]'
                  : 'bg-surface2 border border-[var(--c-border)] text-muted'
              }`}
            >
              {label.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg border border-[var(--c-border)] rounded-xl px-4 py-3 mb-4 text-center">
        <p className="text-[12px] text-muted">
          Tu semana:{' '}
          <span className="font-bold text-textc">{labelInicio}</span>
          {' → '}
          <span className="font-bold text-textc">{labelFin}</span>
        </p>
      </div>

      <button
        onClick={confirmar}
        disabled={saving || !equipoId}
        className={`w-full font-heading font-bold text-[13px] py-[12px] rounded-xl disabled:opacity-40 active:scale-[.98] transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-[#1a1a28]'
        }`}
      >
        {saving ? 'Guardando...' : saved ? 'Guardado' : 'Confirmar'}
      </button>
    </div>
  )
}

const PLAN_LABELS = {
  free:          'Período de prueba',
  solo:          'Repartidor Solo',
  'equipo-chico': 'Equipo Chico',
  'equipo-grande': 'Equipo Grande',
}


function getTheme() {
  return localStorage.getItem('rr_theme') || 'light'
}
function setTheme(t) {
  localStorage.setItem('rr_theme', t)
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export default function PerfilScreen() {
  const perfil         = useStore(s => s.perfil)
  const userEmail      = useStore(s => s.userEmail)
  const updateNegocio          = useStore(s => s.updateNegocio)
  const updateRecordatorioDias = useStore(s => s.updateRecordatorioDias)
  const deleteAccount          = useStore(s => s.deleteAccount)
  const logout                 = useStore(s => s.logout)
  const openModal              = useStore(s => s.openModal)
  const setTab                 = useStore(s => s.setTab)

  const [negocio, setNegocio]     = useState(perfil?.negocio || '')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [theme, setThemeState]    = useState(getTheme)
  const [alertaMin, setAlertaMin] = useState(
    () => parseInt(localStorage.getItem(ALERTA_LS_KEY) || '0') || 0
  )

  const handleAlerta = (min) => {
    setAlertaMin(min)
    localStorage.setItem(ALERTA_LS_KEY, String(min))
  }

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    setThemeState(next)
  }

  const handleSaveNegocio = async () => {
    setSaving(true)
    await updateNegocio(negocio.trim())
    setSaving(false)
  }

  const handleDeleteAccount = () => {
    openModal('confirm', {
      title: '¿Eliminar tu cuenta?',
      msg: 'Esta acción es irreversible. Se eliminarán todos tus clientes, rutas, historial y entregas.',
      onConfirm: () => {
        openModal('confirm', {
          title: 'Última confirmación',
          msg: 'Esta acción es irreversible. Se borrarán permanentemente tu cuenta, clientes, rutas e historial.',
          confirmText: 'BORRAR',
          onConfirm: async () => {
            setDeleting(true)
            await deleteAccount()
          },
        })
      },
    })
  }

  const initials = (perfil?.negocio || userEmail || 'U')
    .trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || 'U'

  return (
    <div className="p-4 max-w-[480px] mx-auto">

      {/* User card */}
      <div className="flex items-center gap-4 mb-4 rounded-[14px] p-4" style={{ background: '#16161A' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#1E1A14', border: '1px solid rgba(212,150,42,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 500, color: '#D4962A' }}>{initials}</span>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#F2F2F7', marginBottom: 2 }}>{perfil?.negocio || 'Mi negocio'}</div>
          <div style={{ fontSize: 12, color: '#4A4A4E' }}>{userEmail || ''}</div>
        </div>
      </div>

      {/* Sección: Negocio */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Tu negocio</p>

        <div className="mb-3">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[.5px] mb-1 block">
            Nombre del negocio o empresa
          </label>
          <input
            type="text"
            placeholder="Ej: Distribuidora Rodríguez"
            value={negocio}
            onChange={e => setNegocio(e.target.value)}
            className="w-full bg-bg border border-[var(--c-border2)] rounded-xl px-4 py-[12px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
          />
          <p className="text-[11px] text-muted2 mt-1">Aparece en el encabezado de la app.</p>
        </div>

        <button
          onClick={handleSaveNegocio}
          disabled={saving || negocio.trim() === (perfil?.negocio || '')}
          className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[13px] py-[12px] rounded-xl disabled:opacity-40 active:scale-[.98] transition-transform"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Sección: Mi Plan */}
      <div className="rounded-[12px] p-[12px_14px] flex items-center justify-between mb-3" style={{ background: 'rgba(212,150,42,0.07)', border: '1px solid rgba(212,150,42,0.18)' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#D4962A', textTransform: 'uppercase', letterSpacing: 1 }}>
            {PLAN_LABELS[perfil?.plan || 'free'] || 'Período de prueba'}
          </div>
          <div style={{ fontSize: 12, color: '#4A4A4E', marginTop: 2 }}>
            {(!perfil?.plan || perfil?.plan === 'free') ? 'Prueba gratuita activa' : 'Suscripción activa'}
          </div>
        </div>
        <button
          onClick={() => setTab('planes')}
          style={{ background: '#D4962A', borderRadius: 8, padding: '6px 12px' }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#0C0C0E' }}>
            {(!perfil?.plan || perfil?.plan === 'free') ? 'Ver planes' : 'Activo'}
          </span>
        </button>
      </div>

      {/* Sección: Cuenta */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Cuenta</p>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[.5px] mb-1 block">
            Correo electrónico
          </label>
          <div className="bg-bg border border-[var(--c-border)] rounded-xl px-4 py-[12px] text-muted text-[14px] select-none">
            {userEmail || '—'}
          </div>
        </div>

        <button
          onClick={logout}
          style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.14)', color: '#FF453A', fontFamily: "'General Sans', sans-serif" }}
          className="w-full font-bold text-[14px] py-[14px] rounded-xl active:scale-[.98] transition-transform"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Sección: Recordatorio de deuda */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-1">Recordatorio de deuda</p>
        <p className="text-[11px] text-muted mb-3 leading-relaxed">
          Te avisamos en Clientes cuando un cliente debe hace más de este tiempo.
        </p>
        <div className="flex gap-2">
          {[0, 1, 3, 5, 10].map(dias => {
            const activo = (perfil?.recordatorio_deuda_dias ?? 3) === dias
            return (
              <button
                key={dias}
                onClick={() => updateRecordatorioDias(dias)}
                className={`flex-1 py-[10px] rounded-xl text-[12px] font-heading font-bold border transition-all active:scale-95 ${
                  activo
                    ? 'bg-amber-400 text-[#1a1a28] border-amber-400'
                    : 'bg-surface2 border-[var(--c-border)] text-muted'
                }`}
              >
                {dias === 0 ? 'Off' : `${dias}d`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sección: Semana de reparto (solo encargado) */}
      {perfil?.rol === 'encargado' && <SemanaConfig perfil={perfil} />}

      {/* Sección: Alerta de demora (solo encargado) */}
      {perfil?.rol === 'encargado' && (
        <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-1">Alerta de demora — Mapa</p>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            Te avisamos en el Mapa cuando un repartidor lleva más de este tiempo sin moverse.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[0, 10, 20, 30, 40, 60].map(min => {
              const activo = alertaMin === min
              return (
                <button
                  key={min}
                  onClick={() => handleAlerta(min)}
                  className={`flex-1 min-w-[48px] py-[10px] rounded-xl text-[12px] font-heading font-bold border transition-all active:scale-95 ${
                    activo
                      ? 'bg-amber-400 text-[#1a1a28] border-amber-400'
                      : 'bg-surface2 border-[var(--c-border)] text-muted'
                  }`}
                >
                  {min === 0 ? 'Off' : `${min}m`}
                </button>
              )
            })}
          </div>
          {alertaMin > 0 && (
            <p className="text-[10px] text-amber-400 mt-2">
              ⚠️ Alerta activa: repartidor sin moverse {alertaMin} min → badge rojo en el mapa
            </p>
          )}
        </div>
      )}

      {/* Sección: Apariencia */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Apariencia</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-textc">{theme === 'dark' ? '🌙 Modo oscuro' : '☀️ Modo claro'}</p>
            <p className="text-[11px] text-muted">Cambia la apariencia de la app</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${theme === 'dark' ? 'bg-amber-400' : 'bg-surface3'}`}
          >
            <span className={`absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <InstallSection />

      {/* Sección: Tutorial */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-textc">Tutorial de la app</p>
            <p className="text-[11px] text-muted">Ver los pasos para empezar a usar VoraRep</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('rr_onboarding_done')
              window.location.reload()
            }}
            className="flex-shrink-0 text-[12px] font-bold px-3 py-[7px] rounded-xl active:scale-95 transition-transform"
            style={{ background: 'rgba(212,150,42,0.1)', border: '1px solid rgba(212,150,42,0.2)', color: '#D4962A' }}
          >
            Ver tutorial
          </button>
        </div>
      </div>

      {/* Sección: Legal */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Legal</p>
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between py-2 text-[13px] text-muted hover:text-amber-400 transition-colors"
        >
          <span>Términos y Condiciones</span>
          <span className="text-[16px]">→</span>
        </a>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between py-2 text-[13px] text-muted hover:text-amber-400 transition-colors border-t border-[var(--c-border)] mt-1 pt-3"
        >
          <span>Política de Privacidad</span>
          <span className="text-[16px]">→</span>
        </a>
      </div>

      {/* Zona de peligro */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
        <p className="text-[10px] font-bold text-red-400 uppercase tracking-[.5px] mb-3">Zona de peligro</p>
        <p className="text-[12px] text-muted mb-3 leading-relaxed">
          Eliminar tu cuenta borra permanentemente todos tus clientes, rutas, historial y entregas. Esta acción no se puede deshacer.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="w-full bg-red-600/20 border border-red-600/40 text-red-400 font-heading font-bold text-[13px] py-[12px] rounded-xl active:scale-[.98] transition-transform disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Eliminar mi cuenta y todos mis datos'}
        </button>
      </div>

      <div className="h-20" />
    </div>
  )
}
