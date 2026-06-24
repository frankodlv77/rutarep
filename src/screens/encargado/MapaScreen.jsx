import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

// Fix Leaflet default icon en Vite
delete L.Icon.Default.prototype._getIconUrl

function makeIcon(inicial, reciente) {
  const color = reciente ? '#f59e0b' : '#9ca3af'
  const bg    = reciente ? 'rgba(245,158,11,0.15)' : 'rgba(156,163,175,0.1)'
  const html  = `
    <div style="
      width:40px;height:40px;border-radius:50%;
      background:${bg};
      border:2.5px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:15px;color:${color};
      font-family:Inter,sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
    ">${inicial}</div>
  `
  return L.divIcon({ className: '', html, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -22] })
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (!positions.length) return
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else {
      map.fitBounds(positions, { padding: [48, 48] })
    }
  }, [positions.length])
  return null
}

function tiempoAtras(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)  return 'ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return `hace ${Math.floor(diff / 3600)} h`
}

function isReciente(iso) {
  return Date.now() - new Date(iso) < 5 * 60 * 1000 // últimos 5 min
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
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
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
      .from('ubicaciones')
      .select('user_id, lat, lng, updated_at')
      .eq('equipo_id', eId)

    if (!ubs?.length) { setUbicaciones([]); return }
    setUbicaciones(ubs)

    const ids = ubs.map(u => u.user_id)
    const { data: perfs } = await supabase
      .from('profiles').select('id, negocio, nombre, rol').in('id', ids)
    setPerfiles(Object.fromEntries((perfs || []).map(p => [p.id, p])))
  }

  const suscribirse = (eId) => {
    const ch = supabase.channel(`mapa-${eId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ubicaciones',
        filter: `equipo_id=eq.${eId}`,
      }, (payload) => {
        const u = payload.new
        if (!u) return
        setUbicaciones(prev => {
          const others = prev.filter(x => x.user_id !== u.user_id)
          return [...others, u]
        })
        // Fetch profile if new
        setPerfiles(prev => {
          if (!prev[u.user_id]) {
            supabase.from('profiles').select('id, negocio, nombre, rol')
              .eq('id', u.user_id).maybeSingle()
              .then(({ data }) => {
                if (data) setPerfiles(p => ({ ...p, [data.id]: data }))
              })
          }
          return prev
        })
      })
      .subscribe()
    channelRef.current = ch
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-[13px] text-muted">Cargando mapa...</p>
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
  const posiciones = ubicaciones.map(u => [u.lat, u.lng])
  const centro = posiciones.length
    ? posiciones.reduce(([la, lo], [a, b]) => [la + a / posiciones.length, lo + b / posiciones.length], [0, 0])
    : [-34.6, -58.4] // Buenos Aires default

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-[10px] border-b border-[var(--c-border)]"
        style={{ background: 'var(--c-surface)' }}>
        <div className="flex items-center gap-[6px]">
          <span className="w-[8px] h-[8px] rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold text-muted">En vivo</span>
        </div>
        <div className="w-px h-4 bg-[var(--c-border)]" />
        <span className="text-[11px] text-muted">
          <span className="font-bold text-textc">{activos.length}</span> activos ahora
        </span>
        <span className="text-[11px] text-muted">·</span>
        <span className="text-[11px] text-muted">
          <span className="font-bold text-textc">{ubicaciones.length}</span> total
        </span>
        <button
          onClick={() => equipoId && fetchData(equipoId)}
          className="ml-auto text-[10px] text-amber-400 font-semibold"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        {ubicaciones.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <div className="text-[48px] mb-3 opacity-40">📍</div>
            <p className="text-[14px] font-bold text-textc mb-1">Sin ubicaciones todavía</p>
            <p className="text-[11px] text-muted leading-relaxed">
              Los repartidores van a aparecer acá cuando abran la app y tengan GPS activo.
            </p>
          </div>
        ) : (
          <MapContainer
            center={centro}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
            />
            <FitBounds positions={posiciones} />
            {ubicaciones.map(u => {
              const prof   = perfiles[u.user_id]
              const nombre = prof?.negocio || prof?.nombre || 'Repartidor'
              const inicial = nombre.charAt(0).toUpperCase()
              const reciente = isReciente(u.updated_at)
              return (
                <Marker
                  key={u.user_id}
                  position={[u.lat, u.lng]}
                  icon={makeIcon(inicial, reciente)}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '130px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>
                        🚚 {nombre}
                      </div>
                      <div style={{ fontSize: '11px', color: reciente ? '#10b981' : '#9ca3af' }}>
                        {tiempoAtras(u.updated_at)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>

      {/* Lista de repartidores */}
      <div
        className="flex-shrink-0 border-t border-[var(--c-border)] px-3 py-2 flex gap-2 overflow-x-auto hide-scrollbar"
        style={{ background: 'var(--c-surface)' }}
      >
        {ubicaciones.length === 0 ? (
          <p className="text-[11px] text-muted py-1">Sin repartidores activos</p>
        ) : (
          ubicaciones.map(u => {
            const prof    = perfiles[u.user_id]
            const nombre  = prof?.negocio || prof?.nombre || 'Repartidor'
            const reciente = isReciente(u.updated_at)
            return (
              <div key={u.user_id}
                className="flex items-center gap-[6px] bg-surface2 border border-[var(--c-border)] rounded-xl px-3 py-[6px] flex-shrink-0">
                <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${reciente ? 'bg-emerald-400' : 'bg-muted2'}`} />
                <span className="text-[11px] font-semibold text-textc">{nombre}</span>
                <span className="text-[9px] text-muted">{tiempoAtras(u.updated_at)}</span>
              </div>
            )
          })
        )}
        <div className="pb-[72px]" />
      </div>
    </div>
  )
}
