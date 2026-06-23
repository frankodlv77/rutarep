import { useState, useEffect } from 'react'
import Modal from '../components/ui/Modal'
import Field, { Input } from '../components/ui/Field'
import ZoneBadge from '../components/ui/ZoneBadge'
import useStore from '../store/useStore'

export default function RutaModal() {
  const modal           = useStore(s => s.modal)
  const closeModal      = useStore(s => s.closeModal)
  const clientes        = useStore(s => s.clientes)
  const addRuta         = useStore(s => s.addRuta)
  const updateRuta      = useStore(s => s.updateRuta)
  const addClienteToRuta     = useStore(s => s.addClienteToRuta)
  const removeClienteFromRuta = useStore(s => s.removeClienteFromRuta)
  const showToast       = useStore(s => s.showToast)

  const editData = modal?.type === 'ruta' ? modal.data?.edit : null
  const isEdit   = !!editData

  const [nombre, setNombre]   = useState('')
  const [desc, setDesc]       = useState('')
  const [rutaId, setRutaId]   = useState(null)
  const [saved, setSaved]     = useState(false)
  const [q, setQ]             = useState('')

  useEffect(() => {
    if (modal?.type === 'ruta') {
      if (editData) {
        setNombre(editData.nombre || '')
        setDesc(editData.descripcion || '')
        setRutaId(editData.id)
        setSaved(true)
      } else {
        setNombre(''); setDesc(''); setRutaId(null); setSaved(false)
      }
      setQ('')
    }
  }, [modal])

  const guardarInfo = async () => {
    if (!nombre.trim()) { showToast('⚠️ Ingresá el nombre'); return }
    if (isEdit) {
      await updateRuta(editData.id, { nombre: nombre.trim(), descripcion: desc.trim() })
      setSaved(true)
    } else {
      const created = await addRuta({ nombre: nombre.trim(), descripcion: desc.trim() })
      if (created) { setRutaId(created.id); setSaved(true) }
    }
  }

  const ruta = useStore(s => s.rutas.find(r => r.id === rutaId))
  const clienteIds = ruta?.clienteIds || []

  const filteredClientes = clientes.filter(c =>
    !clienteIds.includes(c.id) &&
    (!q || c.nombre.toLowerCase().includes(q.toLowerCase()) || (c.direccion||'').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <Modal id="ruta">
      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-textc mb-4">{isEdit ? 'Editar ruta' : 'Nueva ruta'}</h2>

        <Field label="Nombre de la ruta *">
          <Input placeholder="Ej: Ruta Godoy Cruz Lunes" value={nombre} onChange={e => setNombre(e.target.value)} />
        </Field>
        <Field label="Descripción (opcional)">
          <Input placeholder="Ej: 25 clientes zona norte" value={desc} onChange={e => setDesc(e.target.value)} />
        </Field>

        {!saved ? (
          <button
            onClick={guardarInfo}
            className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[13px] py-[13px] rounded-xl mb-3"
          >Continuar → Agregar clientes</button>
        ) : (
          <>
            {/* Clientes en la ruta */}
            {clienteIds.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">En la ruta ({clienteIds.length})</p>
                {clienteIds.map((id, idx) => {
                  const c = clientes.find(x => x.id === id)
                  if (!c) return null
                  return (
                    <div key={id} className="flex items-center gap-3 bg-surface2 rounded-xl px-3 py-[9px] mb-[5px]">
                      <span className="text-[10px] text-muted font-bold w-4">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-textc truncate">{c.nombre}</div>
                        <div className="text-[10px] text-muted truncate">{c.direccion || 'Sin dirección'}</div>
                      </div>
                      <ZoneBadge zona={c.zona} />
                      <button
                        type="button"
                        onClick={() => removeClienteFromRuta(rutaId, id)}
                        className="text-red-400 text-[13px] px-1 py-1"
                      >✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="h-[1px] bg-white/7 my-3" />

            {/* Add clients */}
            <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">
              Tocá un cliente para agregarlo
            </p>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none">🔍</span>
              <Input className="pl-8 text-[13px] py-[9px]" placeholder="Buscar cliente..." value={q} onChange={e => setQ(e.target.value)} />
            </div>

            <div className="max-h-64 overflow-y-auto -mx-[2px] px-[2px]">
              {filteredClientes.slice(0, 40).map(c => (
                <button
                  key={c.id}
                  type="button"
                  onPointerDown={() => addClienteToRuta(rutaId, c.id)}
                  className="flex items-center gap-3 w-full text-left bg-surface border border-white/5 rounded-xl px-3 py-[11px] mb-[6px] active:bg-amber-400/10 active:border-amber-400/40 transition-colors"
                >
                  <span className="text-amber-400 text-[16px] font-bold flex-shrink-0">+</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-textc truncate">{c.nombre}</div>
                    <div className="text-[10px] text-muted truncate">{c.direccion || 'Sin dirección'}</div>
                  </div>
                  <ZoneBadge zona={c.zona} />
                </button>
              ))}
              {filteredClientes.length === 0 && (
                <p className="text-[12px] text-muted text-center py-4">
                  {q ? 'Sin resultados' : 'Todos los clientes ya están en esta ruta'}
                </p>
              )}
            </div>

            <div className="h-3" />
            <button
              type="button"
              onClick={async () => { await updateRuta(rutaId, { nombre: nombre.trim(), descripcion: desc.trim() }); closeModal() }}
              className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[13px] py-[13px] rounded-xl"
            >Guardar y cerrar</button>
          </>
        )}

        <div className="h-2" />
        <button
          type="button"
          onClick={closeModal}
          className="w-full bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[13px] py-[13px] rounded-xl"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
