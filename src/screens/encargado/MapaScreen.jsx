import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

function tiempoAtras(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return `hace ${Math.floor(diff / 3600)} h`
}

function isReciente(iso) {
  return Date.now() - new Date(iso) < 5 * 60 * 1000
}

export default function MapaScreen() {
  const perfil = useStore(s => s.perfil)

  const [ubicaciones, setUbicaciones] = useState([])
  const [perfiles,    setPerfiles]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [equipoId,    setEquipoId]    = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    init()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  const init = async () => {
    const { data: equipo } = await supabase
      .from('equipos').select('id').eq('owner_id', perfil.id).maybeSingle()
    if (!equipo) { setLoading(false); return }
    setEquipoId(equipo.id)
    await fetchData(equipo.id)
    suscribirse(equipo.id)
    setLoading(false)
  }

  const fetchData = async (eId) => {
    const { data: ubs } = await supabase
      .from('ubicaciones').select('user_id, lat, lng, updated_at').eq('equipo_id', eId)
    if (!ubs?.length) { setUbicaciones([]); return }
    setUbicaciones(ubs)
    const ids = ubs.map(u => u.user_id)
    const { data: perfs } = await supabase.from('profiles').select('id, negocio, nombre, rol').in('id', ids)
    setPerfiles(Object.fromEntries((perfs || []).map(p => [p.id, p])))
  }

  const suscribirse = (eId) => {
    const ch = supabase.channel(`mapa-${eId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ubicaciones', filter: `equipo_id=eq.${eId}` },
        (payload) => {
          const u = payload.new
          if (!u) return
          setUbicaciones(prev => [...prev.filter(x => x.user_id !== u.user_id), u])
          setPerfiles(prev => {
            if (!prev[u.user_id]) {
              supabase.from('profiles').select('id, negocio, nombre, rol').eq('id', u.user_id).maybeSingle()
                .then(({ data }) => { if (data) setPerfiles(p => ({ ...p, [data.id]: data })) })
            }
            return prev
          })
        })
      .subscribe()
    channelRef.current = ch
  }

  const abrirEnMaps = (lat, lng, nombre) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    window.open(url, '_blank')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-[13px] text-muted">Cargando...</p>
    </div>
  )

  if (!equipoId) return (
    <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center">
      <div className="text-[48px] mb-3 opacity-40">🗺️</div>
      <p className="text-[15px] font-bold text-textc mb-2">Sin equipo</p>
      <p className="text-[11px] text-muted">Creá un equipo e invitá repartidores primero.</p>
    </div>
  )

  const activos = ubicaciones.filter(u => isReciente(u.updated_at))

  return (
    <div className="p-4">
      {/* Header stats */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-[6px]">
          <span className="w-[8px] h-[8px] rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[12px] font-semibold text-muted">En vivo</span>
        </div>
        <div className="w-px h-4 bg-[var(--c-border)]" />
        <span className="text-[12px] text-muted">
          <span className="font-bold text-textc">{activos.length}</span> activos ·{' '}
          <span className="font-bold text-textc">{ubicaciones.length}</span> total
        </span>
        <button
          onClick={() => equipoId && fetchData(equipoId)}
          className="ml-auto text-[11px] text-amber-400 font-semibold"
        >🔄 Actualizar</button>
      </div>

      {ubicaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-[48px] mb-3 opacity-40">📍</div>
          <p className="text-[14px] font-bold text-textc mb-1">Sin ubicaciones todavía</p>
          <p className="text-[11px] text-muted leading-relaxed">
            Los repartidores aparecen acá cuando abren la app con GPS activo.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ubicaciones
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .map(u => {
              const prof    = perfiles[u.user_id]
              const nombre  = prof?.negocio || prof?.nombre || 'Repartidor'
              const inicial = nombre.charAt(0).toUpperCase()
              const reciente = isReciente(u.updated_at)

              return (
                <div key={u.user_id}
                  className="bg-surface border border-[var(--c-border)] rounded-2xl p-4 flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center text-[18px] font-bold flex-shrink-0 ${
                    reciente
                      ? 'bg-amber-400/15 border-2 border-amber-400/40 text-amber-400'
                      : 'bg-surface2 border-2 border-[var(--c-border)] text-muted'
                  }`}>
                    {inicial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-textc truncate">{nombre}</span>
                      <span className={`text-[9px] font-bold px-[6px] py-[2px] rounded-full uppercase tracking-[.4px] ${
                        reciente ? 'bg-emerald-400/15 text-emerald-400' : 'bg-surface2 text-muted'
                      }`}>
                        {reciente ? 'activo' : 'inactivo'}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted mt-[2px]">
                      📍 {u.lat.toFixed(5)}, {u.lng.toFixed(5)}
                    </div>
                    <div className="text-[10px] text-muted2 mt-[1px]">
                      Actualizado {tiempoAtras(u.updated_at)}
                    </div>
                  </div>

                  <button
                    onClick={() => abrirEnMaps(u.lat, u.lng, nombre)}
                    className="flex-shrink-0 bg-amber-400 text-[#1a1a28] text-[11px] font-bold px-3 py-[8px] rounded-xl active:scale-95 transition-transform"
                  >
                    🗺️ Ver
                  </button>
                </div>
              )
            })}
        </div>
      )}

      <div className="h-20" />
    </div>
  )
}
