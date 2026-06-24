import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PasswordResetScreen({ onDone }) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError('No se pudo actualizar. Pedí un nuevo link de recuperación.')
    } else {
      setSuccess(true)
      setTimeout(onDone, 2000)
    }
    setLoading(false)
  }

  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center px-5">
      <div
        className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center text-[18px] mb-3"
        style={{ background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}
      >🔑</div>
      <h2 className="font-heading text-[20px] font-extrabold text-textc mb-1">Nueva contraseña</h2>
      <p className="text-[12px] text-muted mb-6 text-center">Elegí una contraseña segura para tu cuenta</p>

      {success ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 text-center">
          <p className="text-[14px] text-green-400 font-semibold">¡Contraseña actualizada!</p>
          <p className="text-[12px] text-muted mt-1">Redirigiendo...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-[340px] flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[.6px] mb-1 block">
              Nueva contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoComplete="new-password"
              className="w-full bg-surface border border-[var(--c-border2)] rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-[.6px] mb-1 block">
              Repetir contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              autoComplete="new-password"
              className="w-full bg-surface border border-[var(--c-border2)] rounded-xl px-4 py-[11px] text-textc text-[14px] outline-none focus:border-amber-400 placeholder:text-muted2 transition-colors"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-[13px] text-red-400 text-center">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full btn-shimmer font-heading font-bold text-[14px] py-[14px] rounded-xl mt-1 disabled:opacity-50"
          >
            {loading ? '...' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
