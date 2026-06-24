import { useState } from 'react'
import useStore from '../store/useStore'

function getTheme() {
  return localStorage.getItem('rr_theme') || 'light'
}
function setTheme(t) {
  localStorage.setItem('rr_theme', t)
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export default function PerfilScreen() {
  const perfil         = useStore(s => s.perfil)
  const updateNegocio  = useStore(s => s.updateNegocio)
  const deleteAccount  = useStore(s => s.deleteAccount)
  const logout         = useStore(s => s.logout)
  const openModal      = useStore(s => s.openModal)

  const [negocio, setNegocio]   = useState(perfil?.negocio || '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [theme, setThemeState]  = useState(getTheme)

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
          msg: '¿Estás completamente seguro? Esta acción NO se puede deshacer.',
          onConfirm: async () => {
            setDeleting(true)
            await deleteAccount()
          },
        })
      },
    })
  }

  return (
    <div className="p-4 max-w-[480px] mx-auto">

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

      {/* Sección: Cuenta */}
      <div className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-muted uppercase tracking-[.5px] mb-3">Cuenta</p>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-muted uppercase tracking-[.5px] mb-1 block">
            Correo electrónico
          </label>
          <div className="bg-bg border border-[var(--c-border)] rounded-xl px-4 py-[12px] text-muted text-[14px] select-none">
            {perfil?.nombre || '—'}
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full bg-red-500/10 border border-red-500/25 text-red-400 font-heading font-bold text-[13px] py-[12px] rounded-xl active:scale-[.98] transition-transform"
        >
          Cerrar sesión
        </button>
      </div>

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
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}`} />
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
