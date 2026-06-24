import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import LoginScreen from './LoginScreen'

const LS_KEY = 'rr_pending_invite'

export default function UnirseScreen({ token, onDone }) {
  const [status, setStatus] = useState('loading') // loading | ok | error | auth
  const [equipoNombre, setEquipoNombre] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMsg('Link inválido.'); return }
    // Guardar token por si el usuario necesita registrarse primero
    localStorage.setItem(LS_KEY, token)
    tryAccept()
  }, [token])

  const tryAccept = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setStatus('auth'); return }
    accept(token)
  }

  const accept = async (t) => {
    setStatus('loading')
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: t })
    if (error || !data?.ok) {
      setStatus('error')
      setMsg(data?.error || 'Error al unirse al equipo.')
    } else {
      localStorage.removeItem(LS_KEY)
      setEquipoNombre(data.equipo_nombre || 'el equipo')
      setStatus('ok')
    }
  }

  // Si estaba en modo auth y logró ingresar, acepta automáticamente
  const handleAuthSuccess = () => {
    accept(token)
  }

  if (status === 'auth') {
    return (
      <div>
        {/* Banner de contexto sobre LoginScreen */}
        <div className="bg-amber-400 px-4 py-3 flex items-center gap-2">
          <span className="text-[18px]">🔗</span>
          <p className="text-[12px] font-bold text-[#1a1a28]">
            Tenés una invitación pendiente. Ingresá o registrate para aceptarla.
          </p>
        </div>
        <LoginScreen
          initialMode="register"
          onBack={null}
        />
        {/* Escuchar cambio de sesión para aceptar la invitación */}
        <AuthWatcher onAuth={handleAuthSuccess} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-[64px] h-[64px] bg-amber-400 rounded-[18px] flex items-center justify-center text-[32px] mb-5">
        🚚
      </div>
      <h1 className="font-heading text-[22px] font-extrabold text-textc mb-2">VoraRep</h1>

      {status === 'loading' && (
        <p className="text-[13px] text-muted animate-pulse">Procesando invitación...</p>
      )}

      {status === 'ok' && (
        <div className="w-full max-w-[320px] text-center mt-4">
          <div className="text-[56px] mb-3">🎉</div>
          <p className="text-[17px] font-heading font-extrabold text-textc mb-2">¡Te uniste al equipo!</p>
          <p className="text-[13px] text-muted mb-6 leading-relaxed">
            Ahora sos parte de <strong className="text-amber-400">{equipoNombre}</strong>.
          </p>
          <button
            onClick={onDone}
            className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[14px] py-[14px] rounded-xl"
          >
            Ir a la app →
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="w-full max-w-[320px] text-center mt-4">
          <div className="text-[48px] mb-3">⚠️</div>
          <p className="text-[14px] font-bold text-textc mb-2">Link inválido o expirado</p>
          <p className="text-[12px] text-muted mb-6">{msg}</p>
          <button
            onClick={onDone}
            className="w-full bg-surface border border-[var(--c-border2)] text-muted font-heading font-bold text-[14px] py-[13px] rounded-xl"
          >
            Ir a la app
          </button>
        </div>
      )}
    </div>
  )
}

// Componente invisible que escucha login y dispara callback
function AuthWatcher({ onAuth }) {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuth()
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}

// Helper exportado: al hacer loadAll después de login, verificar si hay invite pendiente
export async function checkPendingInvite() {
  const token = localStorage.getItem(LS_KEY)
  if (!token) return null
  const { data } = await supabase.rpc('accept_invitation', { p_token: token })
  if (data?.ok) {
    localStorage.removeItem(LS_KEY)
    return data.equipo_nombre
  }
  localStorage.removeItem(LS_KEY)
  return null
}
