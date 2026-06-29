import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'
import HoyMapView from '../components/ui/HoyMapView'
import { useGeolocation } from '../hooks/useGeolocation'
import { useFreemium } from '../hooks/useFreemium'

const ZONAS = ['Centro', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras', 'Luján', 'Otro']

function RutaItem({ cliente, entrega, idx, total, onSubir, onBajar }) {
  const done = !!entrega
  return (
    <div className={`flex items-center gap-2 rounded-[14px] p-[11px_12px] mb-2 border transition-all ${
      done ? 'opacity-50 bg-surface border-[var(--c-border)]' : 'bg-surface border-[var(--c-border)]'
    }`}>
      {/* Botones reordenar */}
      <div className="flex flex-col gap-[2px] flex-shrink-0">
        <button
          onClick={onSubir}
          disabled={idx === 0}
          className="w-[22px] h-[22px] rounded-lg bg-surface2 border border-[var(--c-border)] text-muted text-[11px] flex items-center justify-center disabled:opacity-20 active:bg-amber-400/20"
        >▲</button>
        <button
          onClick={onBajar}
          disabled={idx === total - 1}
          className="w-[22px] h-[22px] rounded-lg bg-surface2 border border-[var(--c-border)] text-muted text-[11px] flex items-center justify-center disabled:opacity-20 active:bg-amber-400/20"
        >▼</button>
      </div>

      <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[11px] flex-shrink-0 ${
        done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--c-border2)]'
      }`}>
        {done ? '✓' : <span className="text-[9px] text-muted">{idx + 1}</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-[13px] text-textc truncate">{cliente.nombre}</div>
          {cliente.codigo && (
            <span className="flex-shrink-0 text-[10px] text-muted font-mono bg-surface2 px-[5px] py-[1px] rounded">
              #{cliente.codigo}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted truncate">{cliente.direccion || 'Sin dirección'}</div>
        <div className="flex items-center gap-2 mt-[2px]">
          <ZoneBadge zona={cliente.zona} />
          {done && entrega?.monto > 0 && (
            <span className="text-[10px] text-emerald-400 font-semibold">
              ${Number(entrega.monto).toLocaleString('es-AR')}
            </span>
          )}
        </div>
      </div>

      {done && <span className="text-[10px] text-emerald-400 font-semibold flex-shrink-0">✓ listo</span>}
    </div>
  )
}

export default function HoyScreen() {
  const clientes        = useStore(s => s.clientes)
  const hoy             = useStore(s => s.hoy)
  const entregas        = useStore(s => s.entregas)
  const toggleHoy       = useStore(s => s.toggleHoy)
  const deselAll        = useStore(s => s.deselAll)
  const setTab          = useStore(s => s.setTab)
  const ordenarPorGPS   = useStore(s => s.ordenarPorGPS)
  const reordenarHoy    = useStore(s => s.reordenarHoy)
  const cargarRutaEnHoy = useStore(s => s.cargarRutaEnHoy)
  const rutas           = useStore(s => s.rutas)
  const showToast       = useStore(s => s.showToast)

  const [q, setQ]       = useState('')
  const [zona, setZona] = useState('Todos')
  const [vista, setVista] = useState('lista')
  const { pos, loading: gpsLoading, error: gpsErr, getPos } = useGeolocation()
  const [pendingAction, setPendingAction] = useState(null)
  const { isLimited }   = useFreemium()

  const entCount = Object.keys(entregas).filter(id => hoy.includes(id)).length

  const zonasFiltro = ['Todos', ...ZONAS.filter(z => clientes.some(c => c.zona === z))]

  // Clientes en ruta de hoy (en orden)
  const rutaClientes = hoy.map(id => clientes.find(c => c.id === id)).filter(Boolean)
  const hoyConGPS    = rutaClientes.filter(c => c.lat && c.lon)
  const sinGPS       = rutaClientes.filter(c => !c.lat || !c.lon)
  const puedeOrdenar = hoyConGPS.length >= 2

  // Clientes disponibles para agregar (no están en hoy)
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
      {/* Stats + toggle vista */}
      <div className="flex gap-2 mb-3 items-start">
        <div className="flex gap-2 flex-1">
          {[
            { n: hoy.length,            color: 'text-amber-400',   label: 'En ruta' },
            { n: entCount,              color: 'text-emerald-400', label: 'Entregados' },
            { n: hoy.length - entCount, color: 'text-muted',   label: 'Pendientes' },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
              <div className={`font-heading text-[22px] font-extrabold ${s.color}`}>{s.n}</div>
              <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setVista('lista')}
            className={`px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all ${
              vista === 'lista' ? 'bg-amber-400 text-[#1a1a28]' : 'bg-surface border border-[var(--c-border2)] text-muted'
            }`}
          >📋 Lista</button>
          <button
            onClick={() => setVista('mapa')}
            className={`px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all ${
              vista === 'mapa' ? 'bg-amber-400 text-[#1a1a28]' : 'bg-surface border border-[var(--c-border2)] text-muted'
            }`}
          >🗺️ Mapa</button>
        </div>
      </div>

      {/* Banner error GPS */}
      {gpsErr && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-3">
          {gpsErr.code === 1 ? (
            <>
              <p className="text-[13px] text-red-400 font-bold mb-1">📵 El navegador no tiene permiso de ubicación</p>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                <strong>iPhone:</strong> Ajustes → Privacidad → Localización → Safari → "Al usar la app"
              </p>
              <p className="text-[11px] text-red-300/80 leading-relaxed mt-1">
                <strong>Android:</strong> Tocá el candado en Chrome → Permisos → Ubicación → Permitir
              </p>
            </>
          ) : (
            <p className="text-[13px] text-red-400 font-bold">❌ GPS no disponible — activá la ubicación del celular</p>
          )}
        </div>
      )}

      {/* Banner acción ruta */}
      {hoy.length > 0 && (
        <div className="sticky top-0 z-40 bg-amber-400 text-[#1a1a28] px-4 py-[10px] rounded-xl mb-3 font-heading text-[13px] font-bold flex items-center justify-between">
          <span>{hoy.length} cliente{hoy.length > 1 ? 's' : ''} en ruta</span>
          <div className="flex gap-2">
            <button
              className="bg-bg text-amber-400 text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
              onClick={handleIrARuta}
              disabled={waiting}
            >
              {waiting && pendingAction === 'ir' ? '📍 Localizando...' : '▶ Ir a ruta'}
            </button>
            {puedeOrdenar && !isLimited && (
              <button
                className="bg-black/20 text-[#1a1a28] text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
                onClick={handleOrdenar}
                disabled={waiting}
              >
                {waiting && pendingAction === 'ordenar' ? '📍...' : '🧭 Ordenar'}
              </button>
            )}
            {puedeOrdenar && isLimited && (
              <button
                className="bg-black/20 text-[#1a1a28] text-[10px] font-bold px-3 py-[6px] rounded-lg opacity-80"
                onClick={() => setTab('planes')}
              >
                🔒 Ordenar
              </button>
            )}
            <button
              className="bg-black/20 text-[#1a1a28] text-[10px] font-bold px-2 py-[6px] rounded-lg"
              onClick={deselAll}
            >✕</button>
          </div>
        </div>
      )}

      {/* Aviso clientes sin GPS */}
      {sinGPS.length > 0 && hoy.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3 mb-3">
          <p className="text-[12px] text-orange-400 font-semibold">⚠️ {sinGPS.length} cliente{sinGPS.length > 1 ? 's' : ''} sin ubicación GPS</p>
          <p className="text-[11px] text-orange-300/70 mt-[2px]">
            {sinGPS.map(c => c.nombre).join(', ')} — editá cada uno y buscá la dirección.
          </p>
        </div>
      )}

      {/* Cargar ruta guardada */}
      {rutas.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">Cargar ruta guardada</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {rutas.map(r => (
              <button
                key={r.id}
                onClick={() => cargarRutaEnHoy(r.id)}
                className="flex-shrink-0 bg-surface2 border border-[var(--c-border)] rounded-xl px-3 py-2 text-left"
              >
                <div className="text-[12px] font-semibold text-textc whitespace-nowrap">{r.nombre}</div>
                <div className="text-[10px] text-muted">{r.clienteIds?.length || 0} clientes</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vista mapa */}
      {vista === 'mapa' && (
        <HoyMapView hoy={hoy} clientes={clientes} entregas={entregas} />
      )}

      {/* Vista lista */}
      {vista === 'lista' && (
        <>
          {/* ── Ruta de hoy ──────────────────────────────────────── */}
          {rutaClientes.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">Ruta de hoy</p>
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

          {/* ── Agregar clientes ─────────────────────────────────── */}
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">
            {hoy.length > 0 ? 'Agregar más clientes' : 'Seleccioná los clientes de hoy'}
          </p>

          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full bg-surface border border-[var(--c-border)] rounded-xl pl-9 pr-4 py-[11px] text-textc text-sm outline-none focus:border-amber-400 placeholder:text-muted"
            />
          </div>

          {/* Zone filter */}
          <div className="flex gap-[7px] overflow-x-auto hide-scrollbar pb-1 mb-3">
            {zonasFiltro.map(z => (
              <button
                key={z}
                onClick={() => setZona(z)}
                className={`flex-shrink-0 px-3 py-[6px] rounded-full border text-[11px] font-heading font-semibold transition-all ${
                  zona === z
                    ? 'bg-amber-400 text-[#1a1a28] border-amber-400'
                    : 'bg-surface border-[var(--c-border)] text-muted'
                }`}
              >{z}</button>
            ))}
          </div>

          {/* Lista disponibles */}
          {clientes.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <div className="text-[44px] mb-2 opacity-40">👥</div>
              <div className="text-[13px] leading-relaxed">No hay clientes aún.<br />Andá a la pestaña Clientes para agregar.</div>
            </div>
          ) : disponibles.length === 0 && hoy.length > 0 ? (
            <div className="text-center py-6 text-muted text-[13px]">
              {q || zona !== 'Todos' ? 'Sin resultados' : 'Todos los clientes están en la ruta 👆'}
            </div>
          ) : disponibles.map(c => {
            const tieneGPS = !!(c.lat && c.lon)
            return (
              <div
                key={c.id}
                onClick={() => toggleHoy(c.id)}
                className="flex items-center gap-3 rounded-[14px] p-[13px_14px] mb-2 border border-[var(--c-border)] bg-surface cursor-pointer active:bg-amber-400/5 active:border-amber-400/30 transition-all animate-fadeUp"
              >
                <div className="w-[26px] h-[26px] rounded-full border-2 border-white/15 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[14px] text-textc truncate">{c.nombre}</div>
                    {c.codigo && <span className="flex-shrink-0 text-[10px] text-muted font-mono bg-surface2 px-[5px] py-[1px] rounded">#{c.codigo}</span>}
                  </div>
                  <div className="text-[11px] text-muted truncate mt-[2px]">{c.direccion || 'Sin dirección'}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <ZoneBadge zona={c.zona} />
                    {tieneGPS
                      ? <span className="text-[9px] text-emerald-400 font-medium">📍 GPS ✓</span>
                      : <span className="text-[9px] text-orange-400 font-medium">⚠️ Sin GPS</span>
                    }
                    {c.notas && <span className="text-[10px] text-amber-400 truncate">📝 {c.notas}</span>}
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
