import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

export default function EquipoScreen() {
  const perfil = useStore(s => s.perfil)

  const [miembros,    setMiembros]    = useState([])
  const [invToken,    setInvToken]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [genLoading,  setGenLoading]  = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => { fetchMiembros() }, [])

  const fetchMiembros = async () => {
    setLoading(true)

    // Paso 1: traer miembros del equipo
    const { data: miembrosData, error } = await supabase
      .from('equipo_miembros')
      .select('user_id, rol, joined_at')
      .order('joined_at', { ascending: true })

    if (error || !miembrosData?.length) {
      setMiembros([])
      setLoading(false)
      return
    }

    // Paso 2: traer perfiles de esos user_ids
    const userIds = miembrosData.map(m => m.user_id)
    const { data: perfilesData } = await supabase
      .from('profiles')
      .select('id, negocio, nombre')
      .in('id', userIds)

    const perfilesMap = Object.fromEntries((perfilesData || []).map(p => [p.id, p]))

    const merged = miembrosData.map(m => ({
      ...m,
      profiles: perfilesMap[m.user_id] || null,
    }))

    setMiembros(merged)
    setLoading(false)
  }

  const generarInvitacion = async () => {
    setGenLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('create_invitation', { p_max_uses: 10 })
    if (err || !data?.ok) {
      setError(data?.error || 'Error al generar invitación')
    } else {
      setInvToken(data.token)
    }
    setGenLoading(false)
  }

  const inviteURL = invToken
    ? `${window.location.origin}/unirse?token=${invToken}`
    : null

  const copiar = () => {
    if (!inviteURL) return
    navigator.clipboard.writeText(inviteURL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  const expulsarMiembro = async (userId) => {
    const { data: equipo } = await supabase
      .from('equipos').select('id').eq('owner_id', perfil.id).maybeSingle()
    if (!equipo) return
    await supabase.from('equipo_miembros')
      .delete()
      .eq('equipo_id', equipo.id)
      .eq('user_id', userId)
    fetchMiembros()
  }

  const repartidores = miembros.filter(m => m.rol === 'repartidor')

  return (
    <div className="p-4">
      <h2 className="font-heading text-[18px] font-extrabold text-[#f0f4f8] mb-1">Mi equipo</h2>
      <p className="text-[12px] text-[#6b85a0] mb-4">{perfil?.negocio || 'Tu distribuidora'}</p>

      {/* Stats */}
      <div className="bg-[#131e2e] border border-white/7 rounded-xl p-4 mb-4 flex items-center gap-4">
        <div className="text-center flex-1">
          <div className="font-heading text-[28px] font-extrabold text-amber-400">{repartidores.length}</div>
          <div className="text-[10px] text-[#6b85a0] uppercase tracking-[.6px] mt-[2px]">Repartidores</div>
        </div>
        <div className="w-px h-12 bg-white/7" />
        <div className="flex-1 text-center">
          <div className="font-heading text-[28px] font-extrabold text-emerald-400">
            {miembros.filter(m => m.rol === 'repartidor').length}
          </div>
          <div className="text-[10px] text-[#6b85a0] uppercase tracking-[.6px] mt-[2px]">Activos</div>
        </div>
      </div>

      {/* Generar link de invitación */}
      <div className="bg-[#131e2e] border border-amber-400/20 rounded-xl p-4 mb-4">
        <p className="text-[13px] font-bold text-[#f0f4f8] mb-1">Agregar repartidor</p>
        <p className="text-[11px] text-[#6b85a0] mb-3 leading-relaxed">
          Generá un link de invitación y mandalo por WhatsApp. El repartidor lo abre, se registra y queda en tu equipo.
        </p>

        {inviteURL ? (
          <div className="flex flex-col gap-2">
            <div className="bg-[#0b1320] border border-white/10 rounded-lg px-3 py-[10px] text-[11px] text-[#6b85a0] font-mono break-all">
              {inviteURL}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copiar}
                className={`flex-1 py-[10px] rounded-xl font-heading font-bold text-[13px] transition-all ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-400 text-[#0b1320]'
                }`}
              >
                {copied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <button
                onClick={() => { setInvToken(null) }}
                className="px-4 py-[10px] rounded-xl bg-[#1a2840] border border-white/7 text-[#6b85a0] text-[12px]"
              >
                Nuevo
              </button>
            </div>
            <p className="text-[10px] text-[#6b85a0]">⏳ El link expira en 7 días · Hasta 10 usos</p>
          </div>
        ) : (
          <button
            onClick={generarInvitacion}
            disabled={genLoading}
            className="w-full bg-amber-400 text-[#0b1320] font-heading font-bold text-[13px] py-[11px] rounded-xl disabled:opacity-50"
          >
            {genLoading ? 'Generando...' : '🔗 Generar link de invitación'}
          </button>
        )}

        {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
      </div>

      {/* Lista de miembros */}
      <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">
        Repartidores ({repartidores.length})
      </p>

      {loading ? (
        <div className="text-center py-8 text-[#6b85a0] text-[13px]">Cargando...</div>
      ) : repartidores.length === 0 ? (
        <div className="text-center py-10 text-[#6b85a0]">
          <div className="text-[44px] mb-2 opacity-40">👥</div>
          <div className="text-[13px]">Todavía no hay repartidores en el equipo.</div>
          <div className="text-[11px] mt-1">Generá un link arriba y mandalo por WhatsApp.</div>
        </div>
      ) : (
        repartidores.map(m => {
          const isOwner = m.user_id === perfil?.id
          const nombre  = m.profiles?.negocio || m.profiles?.nombre || m.user_id.slice(0, 8) + '…'
          return (
            <div
              key={m.user_id}
              className="flex items-center gap-3 bg-[#131e2e] border border-white/7 rounded-xl px-4 py-3 mb-2"
            >
              <div className="w-[36px] h-[36px] rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[16px] flex-shrink-0">
                🚚
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#f0f4f8] truncate">{nombre}</div>
                <div className="text-[10px] text-[#6b85a0]">
                  Desde {new Date(m.joined_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              {!isOwner && (
                <button
                  onClick={() => expulsarMiembro(m.user_id)}
                  className="text-[10px] text-red-400/60 hover:text-red-400 underline flex-shrink-0"
                >
                  Quitar
                </button>
              )}
            </div>
          )
        })
      )}

      <div className="h-16" />
    </div>
  )
}
