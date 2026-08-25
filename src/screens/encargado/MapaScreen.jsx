import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

const ALERTA_LS_KEY = 'rr_alerta_demora_min'
const MENDOZA = [-32.89, -68.83]

function tiempoAtras(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return 'ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return `hace ${Math.floor(diff / 3600)} h`
}

function minutosAtras(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 60000)
}

function isReciente(iso) {
  return Date.now() - new Date(iso) < 5 * 60 * 1000
}

function pinHtml(inicial, activo, alerta) {
  const bg = alerta ? '#ef4444' : activo ? '#fbbf24' : '#6b7280'
  const border = alerta ? '#dc2626' : activo ? '#f59e0b' : '#4b5563'
  return `<div style="
    width:36px;height:36px;border-radius:50%;
    background:${bg};border:2.5px solid ${border};
    display:flex;align-items:center;justify-content:center;
    font-size:15px;font-weight:700;color:#1a1a28;
    box-shadow:0 2px 8px rgba(0,0,0,.5);
  ">${inicial}</div>`
}

export default function MapaScreen() {
  const perfil = useStore(s => s.perfil)

  const [ubicaciones, setUbicaciones] = useState([])
  const [perfiles,    setPerfiles]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [equipoId,    setEquipoId]    = useState(null)
  const [mapReady,    setMapReady]    = useState(false)
  const [alertaMin,   setAlertaMin]   = useState(
    () => parseInt(localStorage.getItem(ALERTA_LS_KEY) || '0') || 0
  )

  const channelRef  = useRef(null)
  const mapRef      = useRef(null)
  const mapInst     = useRef(null)
  const markersRef  = useRef({})

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  // Auto-refresh cada 20 s (Realtime con filtros a veces no dispara)
  useEffect(() => {
    if (!equipoId) return
    const interval = setInterval(() => fetchData(equipoId), 20_000)
    return () => clearInterval(interval)
  }, [equipoId])

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
    const { data: perfs } = await supabase
      .from('profiles').select('id, negocio, nombre, rol').in('id', ids)
    setPerfiles(Object.fromEntries((perfs || []).map(p => [p.id, p])))
  }

  const suscribirse = (eId) => {
    const ch = supabase.channel(`mapa-enc-${eId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ubicaciones', filter: `equipo_id=eq.${eId}` },
        ({ new: u }) => {
          if (!u) return
          setUbicaciones(prev => [...prev.filter(x => x.user_id !== u.user_id), u])
          setPerfiles(prev => {
            if (!prev[u.user_id]) {
              supabase.from('profiles').select('id, negocio, nombre, rol')
                .eq('id', u.user_id).maybeSingle()
                .then(({ data }) => { if (data) setPerfiles(p => ({ ...p, [data.id]: data })) })
            }
            return prev
          })
        })
      .subscribe()
    channelRef.current = ch
  }

  // ── Crear mapa una sola vez ──────────────────────────────────────
  useEffect(() => {
    if (loading || !equipoId || !mapRef.current || mapInst.current) return

    const map = L.map(mapRef.current, { zoomControl: true }).setView(MENDOZA, 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map)
    mapInst.current = map
    setMapReady(true)
  }, [loading, equipoId])

  // ── Actualizar markers ───────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    if (!map) return

    Object.values(markersRef.current).forEach(m => map.removeLayer(m))
    markersRef.current = {}

    ubicaciones.forEach(u => {
      const prof    = perfiles[u.user_id]
      const nombre  = prof?.negocio || prof?.nombre || 'Rep.'
      const inicial = nombre.charAt(0).toUpperCase()
      const activo  = isReciente(u.updated_at)
      const mins    = minutosAtras(u.updated_at)
      const alerta  = alertaMin > 0 && mins >= alertaMin

      const icon = L.divIcon({ html: pinHtml(inicial, activo, alerta), className: '', iconAnchor: [18, 18] })

      const popup = `
        <div style="font-family:sans-serif;min-width:150px;padding:4px">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${nombre}</div>
          <div style="font-size:11px;color:${activo ? '#22c55e' : '#9ca3af'};font-weight:600;margin-bottom:3px">
            ${activo ? '● Activo' : '○ Inactivo'}
          </div>
          <div style="font-size:10px;color:#9ca3af">Actualizado ${tiempoAtras(u.updated_at)}</div>
          ${alerta ? `<div style="font-size:11px;color:#ef4444;font-weight:700;margin-top:4px">⚠️ Sin movimiento ${mins} min</div>` : ''}
        </div>`

      const marker = L.marker([u.lat, u.lng], { icon }).addTo(map).bindPopup(popup)
      markersRef.current[u.user_id] = marker
    })

    if (ubicaciones.length > 1) {
      map.fitBounds(L.latLngBounds(ubicaciones.map(u => [u.lat, u.lng])), { padding: [50, 50] })
    } else if (ubicaciones.length === 1) {
      map.setView([ubicaciones[0].lat, ubicaciones[0].lng], 15)
    }
  }, [mapReady, ubicaciones, perfiles, alertaMin])

  // ── Render guards ────────────────────────────────────────────────
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

  const activos   = ubicaciones.filter(u => isReciente(u.updated_at))
  const demorados = alertaMin > 0
    ? ubicaciones.filter(u => minutosAtras(u.updated_at) >= alertaMin)
    : []

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 115px)', padding: '12px 12px 0' }}>

      {/* Alerta banner */}
      {demorados.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 mb-2 flex-shrink-0 flex items-center gap-2">
          <span className="text-[14px]">⚠️</span>
          <p className="text-[11px] text-red-400 font-semibold">
            {demorados.length === 1
              ? `${perfiles[demorados[0].user_id]?.negocio || 'Repartidor'} sin movimiento hace ${minutosAtras(demorados[0].updated_at)} min`
              : `${demorados.length} repartidores sin movimiento +${alertaMin} min`
            }
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2 flex-shrink-0">
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
        >🔄</button>
      </div>

      {/* Mapa */}
      {ubicaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
          <div className="text-[48px] mb-3 opacity-40">📍</div>
          <p className="text-[14px] font-bold text-textc mb-2">Sin ubicaciones todavía</p>
          <div className="bg-surface border border-[var(--c-border)] rounded-xl p-4 text-left w-full max-w-xs">
            <p className="text-[11px] font-bold text-muted uppercase tracking-[.5px] mb-2">Para que aparezcan:</p>
            <div className="space-y-[6px]">
              <p className="text-[11px] text-muted leading-snug">1. El repartidor debe haber <span className="text-textc font-semibold">aceptado tu link de invitación</span></p>
              <p className="text-[11px] text-muted leading-snug">2. Debe tener la app <span className="text-textc font-semibold">abierta con GPS activado</span></p>
              <p className="text-[11px] text-muted leading-snug">3. El mapa se actualiza solo cada 20 segundos</p>
            </div>
          </div>
          <button
            onClick={() => equipoId && fetchData(equipoId)}
            className="mt-4 text-[12px] text-amber-400 font-semibold"
          >
            🔄 Actualizar ahora
          </button>
        </div>
      ) : (
        <div ref={mapRef} className="flex-1 rounded-xl overflow-hidden border border-[var(--c-border2)] mb-2" />
      )}

      {/* Lista compacta */}
      {ubicaciones.length > 0 && (
        <div className="flex-shrink-0 space-y-[5px] max-h-[150px] overflow-y-auto pb-1">
          {[...ubicaciones]
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            .map(u => {
              const prof    = perfiles[u.user_id]
              const nombre  = prof?.negocio || prof?.nombre || 'Repartidor'
              const reciente = isReciente(u.updated_at)
              const mins    = minutosAtras(u.updated_at)
              const alerta  = alertaMin > 0 && mins >= alertaMin

              return (
                <div key={u.user_id}
                  className={`flex items-center gap-2 rounded-xl px-3 py-[8px] border ${
                    alerta
                      ? 'bg-red-500/8 border-red-500/25'
                      : 'bg-surface border-[var(--c-border)]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    alerta ? 'bg-red-400' : reciente ? 'bg-emerald-400' : 'bg-gray-500'
                  }`} />
                  <span className="text-[12px] font-semibold text-textc flex-1 truncate">{nombre}</span>
                  <span className={`text-[10px] flex-shrink-0 ${alerta ? 'text-red-400 font-bold' : 'text-muted'}`}>
                    {alerta ? `⚠️ ${mins}m` : tiempoAtras(u.updated_at)}
                  </span>
                  <button
                    onClick={() => {
                      const m = markersRef.current[u.user_id]
                      if (m && mapInst.current) {
                        mapInst.current.setView([u.lat, u.lng], 16)
                        m.openPopup()
                      }
                    }}
                    className="text-[10px] text-amber-400 font-bold flex-shrink-0 px-1"
                  >
                    Ver
                  </button>
                </div>
              )
            })}
        </div>
      )}

      <div className="h-16" />
    </div>
  )
}
