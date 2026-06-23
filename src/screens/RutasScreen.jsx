import { useState } from 'react'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'

export default function RutasScreen() {
  const rutas                = useStore(s => s.rutas)
  const clientes             = useStore(s => s.clientes)
  const openModal            = useStore(s => s.openModal)
  const deleteRuta           = useStore(s => s.deleteRuta)
  const removeClienteFromRuta = useStore(s => s.removeClienteFromRuta)
  const cargarRutaEnHoy      = useStore(s => s.cargarRutaEnHoy)
  const setTab               = useStore(s => s.setTab)

  const [expandedId, setExpandedId] = useState(null)

  const toggle = (id) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px]">
          {rutas.length} ruta{rutas.length !== 1 ? 's' : ''} guardada{rutas.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => openModal('ruta', {})}
          className="bg-amber-400 text-[#0b1320] font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg"
        >+ Nueva ruta</button>
      </div>

      {rutas.length === 0 && (
        <div className="text-center py-16 text-[#6b85a0]">
          <div className="text-[48px] mb-3 opacity-40">📍</div>
          <div className="text-[13px] leading-relaxed">
            Las rutas guardadas te permiten<br/>pre-cargar clientes de un viaje rápido.<br/>
            <br/>Ej: "Ruta Godoy Cruz Lunes"
          </div>
          <button
            onClick={() => openModal('ruta', {})}
            className="mt-5 bg-amber-400 text-[#0b1320] font-heading font-bold text-[13px] px-5 py-3 rounded-xl"
          >+ Crear primera ruta</button>
        </div>
      )}

      {rutas.map(r => {
        const isExpanded = expandedId === r.id
        const rutaClientes = (r.clienteIds || []).map(id => clientes.find(c => c.id === id)).filter(Boolean)

        return (
          <div key={r.id} className="bg-[#131e2e] border border-white/7 rounded-[16px] mb-3 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => toggle(r.id)}>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-[15px] text-[#f0f4f8]">{r.nombre}</div>
                {r.descripcion && <div className="text-[11px] text-[#6b85a0] mt-[2px] truncate">{r.descripcion}</div>}
                <div className="text-[10px] text-[#6b85a0] mt-1">{rutaClientes.length} cliente{rutaClientes.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); cargarRutaEnHoy(r.id); setTab('hoy') }}
                  className="bg-amber-400/15 text-amber-400 font-heading font-bold text-[10px] px-3 py-[6px] rounded-lg"
                >▶ Cargar hoy</button>
                <span className="text-[#6b85a0] text-[12px]">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded */}
            {isExpanded && (
              <div className="border-t border-white/7">
                {/* Actions */}
                <div className="flex gap-2 px-4 py-3 border-b border-white/7">
                  <button
                    onClick={() => openModal('ruta', { edit: r })}
                    className="flex-1 bg-blue-500/12 text-blue-400 font-heading font-bold text-[11px] py-2 rounded-lg"
                  >✏️ Editar</button>
                  <button
                    onClick={() => openModal('confirm', {
                      title: 'Eliminar ruta',
                      msg: `¿Eliminar la ruta "${r.nombre}"?`,
                      onConfirm: () => deleteRuta(r.id),
                    })}
                    className="flex-1 bg-red-500/12 text-red-400 font-heading font-bold text-[11px] py-2 rounded-lg"
                  >🗑️ Eliminar</button>
                </div>

                {/* Client list */}
                {rutaClientes.length === 0 ? (
                  <div className="px-4 py-4 text-[12px] text-[#6b85a0] text-center">
                    Sin clientes. Editá la ruta para agregar.
                  </div>
                ) : rutaClientes.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-[10px] border-b border-white/5 last:border-b-0">
                    <div className="w-6 h-6 rounded-full bg-[#1a2840] flex items-center justify-center text-[10px] font-bold text-[#6b85a0] flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#f0f4f8] truncate">{c.nombre}</div>
                      <div className="text-[10px] text-[#6b85a0] truncate">{c.direccion || 'Sin dirección'}</div>
                    </div>
                    <ZoneBadge zona={c.zona} />
                    <button
                      onClick={() => removeClienteFromRuta(r.id, c.id)}
                      className="text-red-400 text-[13px] px-1"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="h-8" />
    </div>
  )
}
