import { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'
import HoyMapView from '../components/ui/HoyMapView'
import { useGeolocation } from '../hooks/useGeolocation'
import { useFreemium } from '../hooks/useFreemium'
import { supabase } from '../lib/supabase'

const ZONAS = ['Centro', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras', 'Luján', 'Otro']

/* ── Today's date subtitle ─────────────────────────────────────────── */
function todayLabel() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase())
}

/* ── Initials from name ─────────────────────────────────────────────── */
function getInitials(nombre = '') {
  const parts = nombre.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return nombre.slice(0, 2).toUpperCase()
}

function RutaItem({ cliente, entrega, idx, total, onSubir, onBajar }) {
  const done   = !!entrega
  const isNext = !done && idx === 0
  return (
    <div className={`flex items-center gap-2 rounded-[14px] p-[11px_12px] mb-2 border transition-all ${
      done ? 'opacity-40 bg-surface border-[var(--c-border)]' : 'bg-surface border-[var(--c-border)]'
    }`} style={isNext ? { borderColor: '#D4962A' } : {}}>
      {/* Reorder buttons */}
      <div className="flex flex-col gap-[2px] flex-shrink-0">
        <button
          onClick={onSubir}
          disabled={idx === 0}
          className="w-[22px] h-[22px] rounded-lg bg-surface2 border border-[var(--c-border)] text-[11px] flex items-center justify-center disabled:opacity-20"
          style={{ color: 'var(--c-muted)' }}
        >▲</button>
        <button
          onClick={onBajar}
          disabled={idx === total - 1}
          className="w-[22px] h-[22px] rounded-lg bg-surface2 border border-[var(--c-border)] text-[11px] flex items-center justify-center disabled:opacity-20"
          style={{ color: 'var(--c-muted)' }}
        >▼</button>
      </div>

      {/* Status circle */}
      <div
        className="w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={
          done
            ? { background: '#34C759', borderColor: '#34C759', color: '#fff' }
            : isNext
            ? { background: '#D4962A', borderColor: '#D4962A', color: '#0C0C0E' }
            : { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--c-muted)' }
        }
      >
        {done ? '✓' : <span className="text-[9px]">{idx + 1}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-[13px] text-textc truncate">{cliente.nombre}</div>
          {cliente.codigo && (
            <span className="flex-shrink-0 text-[10px] text-muted font-mono bg-surface2 px-[5px] py-[1px] rounded">
              #{cliente.codigo}
            </span>
          )}
          {isNext && (
            <span className="flex-shrink-0 text-[9px] font-bold px-[6px] py-[2px] rounded-full" style={{ background: 'rgba(212,150,42,0.15)', color: '#D4962A' }}>
              Sig.
            </span>
          )}
        </div>
        <div className="text-[11px] truncate" style={{ color: 'var(--c-muted2)' }}>{cliente.direccion || 'Sin dirección'}</div>
        <div className="flex items-center gap-2 mt-[2px]">
          <ZoneBadge zona={cliente.zona} />
          {done && entrega?.monto > 0 && (
            <span className="text-[10px] font-medium" style={{ color: '#34C759', fontFamily: "'IBM Plex Mono', monospace" }}>
              ${Number(entrega.monto).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      </div>

      {done && (
        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: '#34C759' }}>✓ listo</span>
      )}
    </div>
  )
}

export default function HoyScreen() {
  const clientes              = useStore(s => s.clientes)
  const hoy                   = useStore(s => s.hoy)
  const entregas              = useStore(s => s.entregas)
  const toggleHoy             = useStore(s => s.toggleHoy)
  const deselAll              = useStore(s => s.deselAll)
  const setTab                = useStore(s => s.setTab)
  const ordenarPorGPS         = useStore(s => s.ordenarPorGPS)
  const reordenarHoy          = useStore(s => s.reordenarHoy)
  const cargarRutaEnHoy       = useStore(s => s.cargarRutaEnHoy)
  const rutas                 = useStore(s => s.rutas)
  const showToast             = useStore(s => s.showToast)
  const perfil                = useStore(s => s.perfil)
  const compartirUbicacion    = useStore(s => s.compartirUbicacion)
  const setCompartirUbicacion = useStore(s => s.setCompartirUbicacion)

  const [q, setQ]       = useState('')
  const [zona, setZona] = useState('Todos')
  const [vista, setVista] = useState('lista')
  const { pos, loading: gpsLoading, error: gpsErr, getPos } = useGeolocation()
  const [pendingAction, setPendingAction] = useState(null)
  const { isLimited }   = useFreemium()

  const [notifs, setNotifs] = useState([])
  const seenRef = useRef(new Set())

  useEffect(() => {
    if (!perfil?.id) return
    const channel = supabase
      .channel('hoy_notifs_' + perfil.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `user_id=eq.${perfil.id}`,
      }, payload => {
        const n = payload.new
        if (seenRef.current.has(n.id)) return
        seenRef.current.add(n.id)
        setNotifs(prev => [n, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [perfil?.id])

  const dismissNotif = async (id) => {
    setNotifs(prev => prev.filter(n => n.id !== id))
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
  }

  const entCount = Object.keys(entregas).filter(id => hoy.includes(id)).length

  const zonasFiltro = ['Todos', ...ZONAS.filter(z => clientes.some(c => c.zona === z))]

  const rutaClientes = hoy.map(id => clientes.find(c => c.id === id)).filter(Boolean)
  const hoyConGPS    = rutaClientes.filter(c => c.lat && c.lon)
  const sinGPS       = rutaClientes.filter(c => !c.lat || !c.lon)
  const puedeOrdenar = hoyConGPS.length >= 2

  const disponibles = clientes.filter(c => !hoy.includes(c.id) && (() => {
    const mQ = !q || c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.direccion || '').toLowerCase().includes(q.toLowerCase())
    const mZ = zona === 'Todos' || c.zona === zona
    return mQ && mZ
  })()).sort((a, b) => a.nombre.localeCompare(b.nombre))

  useEffect(() => {
    if (!pos || !pendingAction) return
    ordenarPorGPS(pos.lat, pos.lon)
    if (pendingAction === 'ir') setTab('ruta')
    setPendingAction(null)
  }, [pos])

  useEffect(() => {
    if (!gpsErr || !pendingAction) return
    if (pendingAction === 'ir') setTab('ruta')
    setPendingAction(null)
  }, [gpsErr])

  const mover = (id, dir) => {
    const idx = hoy.indexOf(id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= hoy.length) return
    const next = [...hoy]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    reordenarHoy(next)
  }

  const handleOrdenar = () => {
    if (!puedeOrdenar) { showToast('⚠️ Los clientes necesitan GPS para ordenarse'); return }
    if (pos) { ordenarPorGPS(pos.lat, pos.lon); return }
    setPendingAction('ordenar'); getPos()
  }

  const handleIrARuta = () => {
    if (hoy.length === 0) return
    if (!isLimited && puedeOrdenar) {
      if (pos) { ordenarPorGPS(pos.lat, pos.lon); setTab('ruta') }
      else { setPendingAction('ir'); getPos() }
    } else {
      setTab('ruta')
    }
  }

  const waiting = !!pendingAction && gpsLoading

  return (
    <div className="p-4">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontFamily: "'General Sans', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: 'var(--c-text)', lineHeight: 1.1 }}>
            Hoy
          </h1>
          <p style={{ fontSize: 11, color: 'var(--c-muted2)', marginTop: 3 }}>{todayLabel()}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVista('lista')}
            className="px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all"
            style={vista === 'lista' ? { background: '#D4962A', color: '#0C0C0E' } : { background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
          >Lista</button>
          <button
            onClick={() => setVista('mapa')}
            className="px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all"
            style={vista === 'mapa' ? { background: '#D4962A', color: '#0C0C0E' } : { background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
          >Mapa</button>
        </div>
      </div>

      {/* ── Notificaciones del encargado ─────────────────────────────── */}
      {notifs.map(n => (
        <div key={n.id} className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-400 mb-[2px]">{n.titulo}</p>
            <p className="text-[12px] text-textc leading-snug">{n.mensaje}</p>
          </div>
          <button
            onClick={() => dismissNotif(n.id)}
            className="text-[16px] text-muted hover:text-textc flex-shrink-0 leading-none mt-[1px]"
          >×</button>
        </div>
      ))}

      {/* ── GPS sharing toggle (solo repartidor en equipo) ───────────── */}
      {perfil?.rol === 'repartidor' && (
        <button
          onClick={() => setCompartirUbicacion(!compartirUbicacion)}
          className="w-full flex items-center justify-between mb-3 px-4 py-[10px] rounded-xl transition-all active:scale-[.98]"
          style={{
            background: compartirUbicacion ? 'rgba(52,199,89,0.08)' : 'var(--c-surface)',
            border: `1px solid ${compartirUbicacion ? 'rgba(52,199,89,0.25)' : 'var(--c-border)'}`,
          }}
        >
          <div className="flex items-center gap-[10px]">
            <span className="text-[16px]">{compartirUbicacion ? '📍' : '📵'}</span>
            <div className="text-left">
              <p className="text-[12px] font-semibold" style={{ color: compartirUbicacion ? '#34C759' : 'var(--c-text)' }}>
                {compartirUbicacion ? 'Compartiendo ubicación' : 'Ubicación no compartida'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                {compartirUbicacion ? 'El encargado puede verte en el mapa' : 'Activá para que el encargado te vea'}
              </p>
            </div>
          </div>
          <div
            className="w-11 h-6 rounded-full relative flex-shrink-0 transition-colors duration-200"
            style={{ background: compartirUbicacion ? '#34C759' : 'var(--c-surface3, #3A3A3C)' }}
          >
            <span
              className="absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: compartirUbicacion ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </div>
        </button>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="flex mb-3" style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        {[
          { n: hoy.length,            color: '#D4962A',  label: 'En ruta'    },
          { n: entCount,              color: '#34C759',  label: 'Listos'     },
          { n: hoy.length - entCount, color: '#636366',  label: 'Pendientes' },
        ].map((s, i) => (
          <div key={s.label} className="flex-1 text-center py-3" style={i > 0 ? { borderLeft: '0.5px solid var(--c-border)' } : {}}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.n}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--c-muted3)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── GPS error banner ─────────────────────────────────────────── */}
      {gpsErr && (
        <div className="rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
          {gpsErr.code === 1 ? (
            <>
              <p className="text-[13px] font-bold mb-1" style={{ color: '#FF453A' }}>Sin permiso de ubicación</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,69,58,0.7)' }}>
                <strong>iPhone:</strong> Ajustes → Privacidad → Localización → Safari → "Al usar la app"
              </p>
              <p className="text-[11px] leading-relaxed mt-1" style={{ color: 'rgba(255,69,58,0.7)' }}>
                <strong>Android:</strong> Tocá el candado en Chrome → Permisos → Ubicación → Permitir
              </p>
            </>
          ) : (
            <p className="text-[13px] font-bold" style={{ color: '#FF453A' }}>GPS no disponible — activá la ubicación del celular</p>
          )}
        </div>
      )}

      {/* ── Active route banner ───────────────────────────────────────── */}
      {hoy.length > 0 && (
        <div
          className="sticky top-0 z-40 px-4 py-[10px] rounded-xl mb-3 text-[13px] font-bold flex items-center justify-between"
          style={{ background: '#D4962A', color: '#0C0C0E' }}
        >
          <span>{hoy.length} cliente{hoy.length > 1 ? 's' : ''} en ruta</span>
          <div className="flex gap-2">
            <button
              className="text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
              style={{ background: 'rgba(0,0,0,0.2)', color: '#0C0C0E' }}
              onClick={handleIrARuta}
              disabled={waiting}
            >
              {waiting && pendingAction === 'ir' ? 'Localizando...' : '▶ Ir a ruta'}
            </button>
            {puedeOrdenar && !isLimited && (
              <button
                className="text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
                style={{ background: 'rgba(0,0,0,0.2)', color: '#0C0C0E' }}
                onClick={handleOrdenar}
                disabled={waiting}
              >
                {waiting && pendingAction === 'ordenar' ? '...' : '🧭 Ordenar'}
              </button>
            )}
            {puedeOrdenar && isLimited && (
              <button
                className="text-[10px] font-bold px-3 py-[6px] rounded-lg"
                style={{ background: 'rgba(0,0,0,0.2)', color: '#0C0C0E' }}
                onClick={() => setTab('planes')}
              >
                🔒 Ordenar
              </button>
            )}
            <button
              className="text-[10px] font-bold px-2 py-[6px] rounded-lg"
              style={{ background: 'rgba(0,0,0,0.2)', color: '#0C0C0E' }}
              onClick={deselAll}
            >✕</button>
          </div>
        </div>
      )}

      {/* ── Clientes sin GPS warning ──────────────────────────────────── */}
      {sinGPS.length > 0 && hoy.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.2)' }}>
          <p className="text-[12px] font-semibold" style={{ color: '#FF9500' }}>⚠️ {sinGPS.length} cliente{sinGPS.length > 1 ? 's' : ''} sin ubicación GPS</p>
          <p className="text-[11px] mt-[2px]" style={{ color: 'rgba(255,149,0,0.6)' }}>
            {sinGPS.map(c => c.nombre).join(', ')} — editá cada uno y buscá la dirección.
          </p>
        </div>
      )}

      {/* ── Saved routes ──────────────────────────────────────────────── */}
      {rutas.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--c-muted3)', letterSpacing: '1.8px' }}>Cargar ruta guardada</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {rutas.map(r => (
              <button
                key={r.id}
                onClick={() => cargarRutaEnHoy(r.id)}
                className="flex-shrink-0 rounded-xl px-3 py-2 text-left"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <div className="text-[12px] font-semibold text-textc whitespace-nowrap">{r.nombre}</div>
                <div className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{r.clienteIds?.length || 0} clientes</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Map view ──────────────────────────────────────────────────── */}
      {vista === 'mapa' && (
        <HoyMapView hoy={hoy} clientes={clientes} entregas={entregas} />
      )}

      {/* ── List view ─────────────────────────────────────────────────── */}
      {vista === 'lista' && (
        <>
          {/* Today's route */}
          {rutaClientes.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--c-muted3)', letterSpacing: '1.8px' }}>Ruta de hoy</p>
              {rutaClientes.map((c, idx) => (
                <RutaItem
                  key={c.id}
                  cliente={c}
                  entrega={entregas[c.id]}
                  idx={idx}
                  total={rutaClientes.length}
                  onSubir={() => mover(c.id, -1)}
                  onBajar={() => mover(c.id, 1)}
                />
              ))}
            </div>
          )}

          {/* Add clients */}
          {clientes.length > 0 && (
          <p className="text-[13px] font-semibold mb-2" style={{ color: '#636366' }}>
            {hoy.length > 0 ? 'Agregar más clientes' : 'Seleccioná los clientes de hoy'}
          </p>
          )}

          {/* Search */}
          {clientes.length > 0 && <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--c-muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full rounded-xl pl-9 pr-4 py-[11px] text-textc text-sm outline-none placeholder:text-muted2"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                caretColor: '#D4962A',
              }}
            />
          </div>}

          {/* Zone filter */}
          {clientes.length > 0 && <div className="flex gap-[7px] overflow-x-auto hide-scrollbar pb-1 mb-3">
            {zonasFiltro.map(z => (
              <button
                key={z}
                onClick={() => setZona(z)}
                className="flex-shrink-0 px-3 py-[6px] rounded-full text-[11px] font-bold transition-all"
                style={zona === z
                  ? { background: '#D4962A', color: '#0C0C0E', border: '1px solid #D4962A' }
                  : { background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }
                }
              >{z}</button>
            ))}
          </div>}

          {/* Available clients list */}
          {clientes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-[52px] mb-3 opacity-40">👥</div>
              <div className="font-heading font-extrabold text-[18px] mb-2" style={{ color: 'var(--c-text)' }}>
                Todavía no tenés clientes
              </div>
              <div className="text-[13px] leading-relaxed mb-6" style={{ color: '#636366' }}>
                Primero cargá los negocios que visitás.<br/>Después armás la ruta del día desde acá.
              </div>
              <button
                onClick={() => setTab('clientes')}
                className="w-full font-heading font-bold text-[14px] py-[13px] rounded-2xl active:scale-[.98] transition-transform"
                style={{ background: '#D4962A', color: '#0C0C0E' }}
              >
                Agregar primer cliente →
              </button>
            </div>
          ) : disponibles.length === 0 && hoy.length > 0 ? (
            <div className="text-center py-6 text-[13px]" style={{ color: 'var(--c-muted)' }}>
              {q || zona !== 'Todos' ? 'Sin resultados' : 'Todos los clientes están en la ruta 👆'}
            </div>
          ) : disponibles.map(c => {
            const tieneGPS = !!(c.lat && c.lon)
            const initials = getInitials(c.nombre)
            return (
              <div
                key={c.id}
                onClick={() => toggleHoy(c.id)}
                className="flex items-center gap-3 rounded-[14px] p-[12px_14px] mb-2 cursor-pointer animate-fadeUp transition-all"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold flex-shrink-0"
                  style={{ background: '#1A1A1F', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-[14px] text-textc truncate">{c.nombre}</div>
                    {c.codigo && <span className="flex-shrink-0 text-[10px] font-mono bg-surface2 px-[5px] py-[1px] rounded" style={{ color: 'var(--c-muted)' }}>#{c.codigo}</span>}
                  </div>
                  <div className="text-[11px] truncate mt-[2px]" style={{ color: 'var(--c-muted2)' }}>{c.direccion || 'Sin dirección'}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <ZoneBadge zona={c.zona} />
                    {!tieneGPS && <span className="text-[9px] font-medium" style={{ color: '#FF9500' }}>Sin GPS</span>}
                    {c.notas && <span className="text-[10px] truncate" style={{ color: '#D4962A' }}>📝 {c.notas}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}

      <div className="h-16" />
    </div>
  )
}
