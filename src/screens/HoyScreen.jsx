import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'
import HoyMapView from '../components/ui/HoyMapView'
import { useGeolocation } from '../hooks/useGeolocation'

const ZONAS = ['Centro', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras', 'Luján', 'Otro']

// ── Ítem arrastrable ──────────────────────────────────────────────────────────
function SortableItem({ cliente, entrega }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cliente.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const done = !!entrega

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-[14px] p-[11px_12px] mb-2 border transition-all ${
        isDragging ? 'opacity-60 shadow-xl border-amber-400 bg-amber-400/10' :
        done       ? 'opacity-50 bg-[#131e2e] border-white/7' :
                     'bg-[#131e2e] border-white/7'
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing px-1 py-2 text-[#3a4f68] select-none text-[16px] flex-shrink-0"
      >
        ⠿
      </div>

      {/* Status dot */}
      <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[11px] flex-shrink-0 ${
        done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20'
      }`}>
        {done ? '✓' : ''}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-[13px] text-[#f0f4f8] truncate">{cliente.nombre}</div>
          {cliente.codigo && (
            <span className="flex-shrink-0 text-[10px] text-[#6b85a0] font-mono bg-[#1a2840] px-[5px] py-[1px] rounded">
              #{cliente.codigo}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#6b85a0] truncate">{cliente.direccion || 'Sin dirección'}</div>
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
// ─────────────────────────────────────────────────────────────────────────────

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
  const [dragHintDone, setDragHintDone] = useState(
    !!localStorage.getItem('rr_drag_seen')
  )
  const { pos, loading: gpsLoading, error: gpsErr, getPos } = useGeolocation()
  const [pendingAction, setPendingAction] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

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

  // Auto-ocultar hint después de 5s
  useEffect(() => {
    if (dragHintDone || hoy.length === 0) return
    const t = setTimeout(() => {
      localStorage.setItem('rr_drag_seen', '1')
      setDragHintDone(true)
    }, 5000)
    return () => clearTimeout(t)
  }, [dragHintDone, hoy.length])

  const handleOrdenar = () => {
    if (!puedeOrdenar) { showToast('⚠️ Los clientes necesitan GPS para ordenarse'); return }
    if (pos) { ordenarPorGPS(pos.lat, pos.lon); return }
    setPendingAction('ordenar'); getPos()
  }

  const handleIrARuta = () => {
    if (hoy.length === 0) return
    if (puedeOrdenar) {
      if (pos) { ordenarPorGPS(pos.lat, pos.lon); setTab('ruta') }
      else { setPendingAction('ir'); getPos() }
    } else {
      setTab('ruta')
    }
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIdx = hoy.indexOf(active.id)
    const newIdx = hoy.indexOf(over.id)
    reordenarHoy(arrayMove(hoy, oldIdx, newIdx))
    if (!dragHintDone) {
      localStorage.setItem('rr_drag_seen', '1')
      setDragHintDone(true)
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
            { n: hoy.length - entCount, color: 'text-[#6b85a0]',   label: 'Pendientes' },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-[#131e2e] border border-white/7 rounded-xl p-2 text-center">
              <div className={`font-heading text-[22px] font-extrabold ${s.color}`}>{s.n}</div>
              <div className="text-[9px] text-[#6b85a0] uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setVista('lista')}
            className={`px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all ${
              vista === 'lista' ? 'bg-amber-400 text-[#0b1320]' : 'bg-[#131e2e] border border-white/10 text-[#6b85a0]'
            }`}
          >📋 Lista</button>
          <button
            onClick={() => setVista('mapa')}
            className={`px-3 py-[7px] rounded-lg text-[11px] font-bold transition-all ${
              vista === 'mapa' ? 'bg-amber-400 text-[#0b1320]' : 'bg-[#131e2e] border border-white/10 text-[#6b85a0]'
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
        <div className="sticky top-0 z-40 bg-amber-400 text-[#0b1320] px-4 py-[10px] rounded-xl mb-3 font-heading text-[13px] font-bold flex items-center justify-between">
          <span>{hoy.length} cliente{hoy.length > 1 ? 's' : ''} en ruta</span>
          <div className="flex gap-2">
            <button
              className="bg-[#0b1320] text-amber-400 text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
              onClick={handleIrARuta}
              disabled={waiting}
            >
              {waiting && pendingAction === 'ir' ? '📍 Localizando...' : '▶ Ir a ruta'}
            </button>
            {puedeOrdenar && (
              <button
                className="bg-black/20 text-[#0b1320] text-[10px] font-bold px-3 py-[6px] rounded-lg disabled:opacity-60"
                onClick={handleOrdenar}
                disabled={waiting}
              >
                {waiting && pendingAction === 'ordenar' ? '📍...' : '🧭 Ordenar'}
              </button>
            )}
            <button
              className="bg-black/20 text-[#0b1320] text-[10px] font-bold px-2 py-[6px] rounded-lg"
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
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-2">Cargar ruta guardada</p>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {rutas.map(r => (
              <button
                key={r.id}
                onClick={() => cargarRutaEnHoy(r.id)}
                className="flex-shrink-0 bg-[#1a2840] border border-white/7 rounded-xl px-3 py-2 text-left"
              >
                <div className="text-[12px] font-semibold text-[#f0f4f8] whitespace-nowrap">{r.nombre}</div>
                <div className="text-[10px] text-[#6b85a0]">{r.clienteIds?.length || 0} clientes</div>
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
          {/* ── Ruta de hoy — draggable ──────────────────────────── */}
          {rutaClientes.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px]">Ruta de hoy</p>
                {!dragHintDone && (
                  <span className="text-[10px] text-amber-400 animate-pulse">
                    ⠿ arrastrá para reordenar
                  </span>
                )}
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={hoy} strategy={verticalListSortingStrategy}>
                  {rutaClientes.map(c => (
                    <SortableItem
                      key={c.id}
                      cliente={c}
                      entrega={entregas[c.id]}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* ── Agregar clientes ─────────────────────────────────── */}
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-2">
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
              className="w-full bg-[#131e2e] border border-white/7 rounded-xl pl-9 pr-4 py-[11px] text-[#f0f4f8] text-sm outline-none focus:border-amber-400 placeholder:text-[#6b85a0]"
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
                    ? 'bg-amber-400 text-[#0b1320] border-amber-400'
                    : 'bg-[#131e2e] border-white/7 text-[#6b85a0]'
                }`}
              >{z}</button>
            ))}
          </div>

          {/* Lista disponibles */}
          {clientes.length === 0 ? (
            <div className="text-center py-12 text-[#6b85a0]">
              <div className="text-[44px] mb-2 opacity-40">👥</div>
              <div className="text-[13px] leading-relaxed">No hay clientes aún.<br />Andá a la pestaña Clientes para agregar.</div>
            </div>
          ) : disponibles.length === 0 && hoy.length > 0 ? (
            <div className="text-center py-6 text-[#6b85a0] text-[13px]">
              {q || zona !== 'Todos' ? 'Sin resultados' : 'Todos los clientes están en la ruta 👆'}
            </div>
          ) : disponibles.map(c => {
            const tieneGPS = !!(c.lat && c.lon)
            return (
              <div
                key={c.id}
                onClick={() => toggleHoy(c.id)}
                className="flex items-center gap-3 rounded-[14px] p-[13px_14px] mb-2 border border-white/7 bg-[#131e2e] cursor-pointer active:bg-amber-400/5 active:border-amber-400/30 transition-all animate-fadeUp"
              >
                <div className="w-[26px] h-[26px] rounded-full border-2 border-white/15 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[14px] text-[#f0f4f8] truncate">{c.nombre}</div>
                    {c.codigo && <span className="flex-shrink-0 text-[10px] text-[#6b85a0] font-mono bg-[#1a2840] px-[5px] py-[1px] rounded">#{c.codigo}</span>}
                  </div>
                  <div className="text-[11px] text-[#6b85a0] truncate mt-[2px]">{c.direccion || 'Sin dirección'}</div>
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
