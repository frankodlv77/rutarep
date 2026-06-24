import { useState } from 'react'
import { supabase } from '../lib/supabase'
import TerminosScreen from './TerminosScreen'

export default function LoginScreen({ initialMode = 'login', onBack }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [negocio, setNegocio]     = useState('')
  const [rol, setRol]             = useState('repartidor')
  const [termsAccepted, setTerms] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [mode, setMode]           = useState(initialMode) // 'login' | 'register' | 'reset'
  const [showTerms, setShowTerms] = useState(false)

  const clearErrors = () => { setError(''); setSuccess('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    clearErrors()

    if (mode === 'reset') {
      if (!email.trim()) { setLoading(false); return }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })
      if (err) setError('No se pudo enviar el email. Verificá la dirección.')
      else setSuccess('Revisá tu email — te enviamos el link para restablecer tu contraseña.')
      setLoading(false)
      return
    }

    if (!email.trim() || !password) { setLoading(false); return }

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError('Correo o contraseña incorrectos')
    } else {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres')
        setLoading(false)
        return
      }
      if (!termsAccepted) {
        setError('Debés aceptar los Términos y Condiciones para registrarte')
        setLoading(false)
        return
      }
      const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password })
      if (err) {
        setError(err.message === 'User already registered'
          ? 'El correo ya está registrado'
          : 'Error al registrarse. Intentá de nuevo.')
      } else if (data.session) {
        // Guardar perfil con rol y negocio
        await supabase.from('profiles').upsert(
          { id: data.user.id, rol, negocio: negocio.trim() || null },
          { onConflict: 'id' }
        )
        // Si es encargado, crear equipo automáticamente
        if (rol === 'encargado' && negocio.trim()) {
          await supabase.rpc('create_equipo', { p_nombre: negocio.trim() })
        }
        setSuccess('Si el correo no está registrado, recibirás un email de confirmación.')
      } else {
        setSuccess('Si el correo no está registrado, recibirás un email de confirmación.')
      }
    }
    setLoading(false)
  }

  const switchMode = (next) => { setMode(next); clearErrors() }

  if (showTerms) return <TerminosScreen onBack={() => setShowTerms(false)} />

  const isReset    = mode === 'reset'
  const isRegister = mode === 'register'

  return (
    <div className="relative h-full bg-bg flex flex-col items-center justify-start px-5 pt-12 pb-6 overflow-y-auto">
      {/* Volver */}
      {(onBack && !isReset) && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 text-[13px] text-muted hover:text-amber-400 transition-colors"
        >
          ← Volver
        </button>
      )}
      {isReset && (
        <button
          onClick={() => switchMode('login')}
          className="absolute top-4 left-4 text-[13px] text-muted hover:text-amber-400 transition-colors"
        >
          ← Volver
        </button>
      )}

      {/* Logo compacto */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center text-[18px] flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', boxShadow: '0 0 12px rgba(251,191,36,0.3)' }}
        >🚚</div>
        <h1 className="font-heading text-[22px] font-extrabold text-textc">RutaRep</h1>
      </div>
      <p className="text-[12px] text-muted mb-5">
        {isReset ? 'Recuperar contraseña' : isRegister ? 'Creá tu cuenta gratuita' : 'Ingresá para continuar'}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col gap-[10px]">

        {/* Selector de rol — solo en registro */}
        {isRegister && (
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-[.6px] mb-[6px]">¿Cuál es tu rol?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'repartidor', icon: '🚚', label: 'Repartidor', desc: 'Hago las entregas' },
                { key: 'encargado',  icon: '📊', label: 'Encargado',  desc: 'Gestiono el equipo' },
              ].map(r => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRol(r.key)}
                  className={`rounded-xl border-2 px-3 py-[9px] text-left flex items-center gap-2 transition-all ${
                    rol === r.key ? 'border-amber-400 bg-amber-400/10' : 'border-[var(--c-border2)] bg-surface'
                  }`}
                >
                  <span className="text-[18px]">{r.icon}</span>
                  <div>
                    <div className={`text-[12px] font-bold leading-tight ${rol === r.key ? 'text-amber-400' : 'text-textc'}`}>{r.label}</div>
                    <div className="text-[10px] text-muted">{r.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-[.6px] mb-1 block">
            Correo electrónico
          </label>
          <input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clearErrors() }}
            autoComplete="email"
            className="w-full bg-surface border border-[var(--c-border2)] rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
          />
        </div>

        {/* Contraseña */}
        {!isReset && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-muted uppercase tracking-[.6px]">
                Contraseña
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="text-[11px] text-muted hover:text-amber-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); clearErrors() }}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="w-full bg-surface border border-[var(--c-border2)] rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
            />
          </div>
        )}

        {/* Negocio — solo en registro, requerido para encargado */}
        {isRegister && (
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[.6px] mb-1 block">
              {rol === 'encargado'
                ? 'Nombre de tu negocio o empresa'
                : <>Nombre de tu negocio <span className="normal-case font-normal">(opcional)</span></>
              }
            </label>
            <input
              type="text"
              placeholder={rol === 'encargado' ? 'Ej: Distribuidora Rodríguez' : 'Ej: Distribuidora Rodríguez'}
              value={negocio}
              onChange={e => setNegocio(e.target.value)}
              autoComplete="organization"
              className="w-full bg-surface border border-[var(--c-border2)] rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <p className="text-[13px] text-red-400 text-center">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            <p className="text-[13px] text-green-400 text-center">{success}</p>
          </div>
        )}

        {/* Checkbox términos */}
        {isRegister && (
          <div className="flex items-start gap-3 mt-1">
            <button
              type="button"
              onClick={() => setTerms(v => !v)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-[1px] transition-colors ${
                termsAccepted ? 'bg-amber-400 border-amber-400' : 'bg-surface border-white/20'
              }`}
            >
              {termsAccepted && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7L10 1" stroke="#0b1320" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <span className="text-[12px] text-muted leading-snug">
              Acepto los{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-amber-400 underline underline-offset-2"
              >
                Términos y Condiciones
              </button>
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !email ||
            (!isReset && !password) ||
            (isRegister && !termsAccepted) ||
            (isRegister && rol === 'encargado' && !negocio.trim())
          }
          className="w-full btn-shimmer font-heading font-bold text-[14px] py-[14px] rounded-xl mt-1 disabled:opacity-50 active:scale-[.98] transition-transform"
        >
          {loading
            ? '...'
            : isReset ? 'Enviar email de recuperación'
            : isRegister ? 'Crear cuenta'
            : 'Ingresar'}
        </button>

        {!isReset && (
          <button
            type="button"
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
            className="text-[13px] text-muted text-center py-2 hover:text-amber-400 transition-colors"
          >
            {isRegister ? '¿Ya tenés cuenta? Ingresá' : '¿No tenés cuenta? Registrate gratis'}
          </button>
        )}
      </form>
    </div>
  )
}
