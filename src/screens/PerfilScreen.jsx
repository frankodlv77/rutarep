import { useState } from 'react'
import useStore from '../store/useStore'
import TerminosScreen from './TerminosScreen'

export default function PerfilScreen() {
  const perfil         = useStore(s => s.perfil)
  const updateNegocio  = useStore(s => s.updateNegocio)
  const deleteAccount  = useStore(s => s.deleteAccount)
  const logout         = useStore(s => s.logout)
  const openModal      = useStore(s => s.openModal)

  const [negocio, setNegocio]         = useState(perfil?.negocio || '')
  const [saving, setSaving]           = useState(false)
  const [showTerms, setShowTerms]     = useState(false)
  const [deleting, setDeleting]       = useState(false)

  if (showTerms) return <TerminosScreen onBack={() => setShowTerms(false)} />

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
      <div className="bg-[#131e2e] border border-white/7 rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.5px] mb-3">Tu negocio</p>

        <div className="mb-3">
          <label className="text-[11px] font-bold text-[#6b85a0] uppercase tracking-[.5px] mb-1 block">
            Nombre del negocio o empresa
          </label>
          <input
            type="text"
            placeholder="Ej: Distribuidora Rodríguez"
            value={negocio}
            onChange={e => setNegocio(e.target.value)}
            className="w-full bg-[#0b1320] border border-white/10 rounded-xl px-4 py-[12px] text-[#f0f4f8] text-[14px] outline-none focus:border-amber-400 placeholder:text-[#3a4f68] transition-colors"
          />
          <p className="text-[11px] text-[#4a6080] mt-1">Aparece en el encabezado de la app.</p>
        </div>

        <button
          onClick={handleSaveNegocio}
          disabled={saving || negocio.trim() === (perfil?.negocio || '')}
          className="w-full bg-amber-400 text-[#0b1320] font-heading font-bold text-[13px] py-[12px] rounded-xl disabled:opacity-40 active:scale-[.98] transition-transform"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Sección: Cuenta */}
      <div className="bg-[#131e2e] border border-white/7 rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.5px] mb-3">Cuenta</p>

        <div className="mb-4">
          <label className="text-[11px] font-bold text-[#6b85a0] uppercase tracking-[.5px] mb-1 block">
            Correo electrónico
          </label>
          <div className="bg-[#0b1320] border border-white/7 rounded-xl px-4 py-[12px] text-[#6b85a0] text-[14px] select-none">
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

      {/* Sección: Legal */}
      <div className="bg-[#131e2e] border border-white/7 rounded-2xl p-4 mb-3">
        <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.5px] mb-3">Legal</p>
        <button
          onClick={() => setShowTerms(true)}
          className="w-full flex items-center justify-between py-2 text-[13px] text-[#a0b4c8] hover:text-amber-400 transition-colors"
        >
          <span>Términos y Condiciones</span>
          <span className="text-[16px]">→</span>
        </button>
      </div>

      {/* Zona de peligro */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
        <p className="text-[10px] font-bold text-red-400 uppercase tracking-[.5px] mb-3">Zona de peligro</p>
        <p className="text-[12px] text-[#6b85a0] mb-3 leading-relaxed">
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
