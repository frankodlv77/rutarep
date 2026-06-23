import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { supabase, isConfigured } from '../lib/supabase'

const ROL_LABELS = { repartidor: 'Repartidor', preventista: 'Preventista', encargado: 'Encargado' }
const ROL_COLORS = {
  repartidor:  'bg-blue-500/15 text-blue-400',
  preventista: 'bg-purple-500/15 text-purple-400',
  encargado:   'bg-amber-400/15 text-amber-400',
}

export default function Header({ user }) {
  const hoy    = useStore(s => s.hoy)
  const entregas = useStore(s => s.entregas)
  const perfil = useStore(s => s.perfil)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const entCount = Object.keys(entregas).filter(id => hoy.includes(id)).length
  const subTxt   = hoy.length === 0 ? 'Sin ruta activa' : `${entCount}/${hoy.length} entregados hoy`

  const dateStr = now.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '').replace(/^\w/, c => c.toUpperCase())
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const rol = perfil?.rol || 'repartidor'

  const handleLogout = async () => {
    if (isConfigured) await supabase.auth.signOut()
  }

  return (
    <header className="bg-[#131e2e] border-b border-white/7 px-[18px] pt-[12px] pb-[10px] flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-[10px]">
        <div className="w-[34px] h-[34px] bg-amber-400 rounded-[10px] flex items-center justify-center text-[17px] flex-shrink-0">🚚</div>
        <div>
          <h1 className="font-heading text-[17px] font-extrabold tracking-tight text-[#f0f4f8]">{perfil?.negocio || 'RutaRep'}</h1>
          <div className="flex items-center gap-2 mt-[2px]">
            <p className="text-[11px] text-[#6b85a0]">{subTxt}</p>
            {perfil && (
              <span className={`text-[9px] font-bold px-[6px] py-[2px] rounded-full uppercase tracking-[.4px] ${ROL_COLORS[rol]}`}>
                {ROL_LABELS[rol]}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[11px] text-[#6b85a0] text-right leading-relaxed">
          {dateStr}<br />{timeStr}
        </div>
        {user && (
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-[30px] h-[30px] flex items-center justify-center rounded-lg bg-[#1a2840] border border-white/7 text-[#6b85a0] active:text-red-400 active:border-red-400/30 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
