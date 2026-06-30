import useStore from '../store/useStore'
import Modal from '../components/ui/Modal'

const TIPO_META = {
  entregado:  { icon: '✅', label: 'Entregado',    color: 'text-emerald-400' },
  devolucion: { icon: '🔄', label: 'Devolución',   color: 'text-blue-400'   },
  parcial:    { icon: '💸', label: 'Pago parcial', color: 'text-amber-400'  },
  cancelado:  { icon: '❌', label: 'Cancelado',    color: 'text-red-400'    },
}

const METODO_LABEL = {
  efectivo:      '💵 Efectivo',
  transferencia: '🏦 Transferencia',
  tarjeta:       '💳 Tarjeta',
  otro:          '❓ Otro',
}

function fmtMoney(n) {
  if (!n && n !== 0) return '-'
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function ClienteHistorialModal() {
  const modal      = useStore(s => s.modal)
  const closeModal = useStore(s => s.closeModal)
  const historial  = useStore(s => s.historial)

  const isOpen    = modal?.type === 'clienteHistorial'
  const clienteId = modal?.data?.clienteId
  const nombre    = modal?.data?.nombre || ''
  const deuda     = modal?.data?.deuda  || 0

  if (!isOpen) return null

  const transacciones = historial.flatMap(dia => {
    const e = (dia.entregas || []).find(x => x.id === clienteId)
    if (!e || !e.tipo) return []
    return [{ fecha: dia.fecha, ...e }]
  })

  const totalCobrado = transacciones.reduce((s, t) => s + (t.tipo !== 'cancelado' ? (+t.monto || 0) : 0), 0)
  const totalVisitas = transacciones.length
  const cancelados   = transacciones.filter(t => t.tipo === 'cancelado').length

  return (
    <Modal id="clienteHistorial">
      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-textc mb-[2px]">{nombre}</h2>
        <p className="text-[11px] text-muted mb-4">Historial de visitas (últimos 90 días)</p>

        {/* Deuda actual */}
        {deuda > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted">Deuda actual</p>
              <p className="font-heading font-extrabold text-[20px] text-red-400 leading-tight">{fmtMoney(deuda)}</p>
            </div>
            <span className="text-[28px]">🚨</span>
          </div>
        )}

        {/* Stats resumen */}
        {totalVisitas > 0 && (
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-surface2 border border-[var(--c-border)] rounded-xl p-2 text-center">
              <div className="font-heading text-[18px] font-extrabold text-textc">{totalVisitas}</div>
              <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[1px]">Visitas</div>
            </div>
            <div className="flex-1 bg-surface2 border border-[var(--c-border)] rounded-xl p-2 text-center">
              <div className="font-heading text-[15px] font-extrabold text-emerald-400 leading-tight mt-[2px]">{fmtMoney(totalCobrado)}</div>
              <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[1px]">Cobrado</div>
            </div>
            {cancelados > 0 && (
              <div className="flex-1 bg-surface2 border border-[var(--c-border)] rounded-xl p-2 text-center">
                <div className="font-heading text-[18px] font-extrabold text-red-400">{cancelados}</div>
                <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[1px]">Cancelados</div>
              </div>
            )}
          </div>
        )}

        {/* Lista de transacciones */}
        {transacciones.length === 0 ? (
          <div className="text-center py-10 text-muted">
            <div className="text-[40px] mb-2 opacity-40">📭</div>
            <p className="text-[13px]">Sin visitas en los últimos 90 días</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transacciones.map((t, i) => {
              const meta = TIPO_META[t.tipo] || { icon: '📋', label: t.tipo, color: 'text-muted' }
              return (
                <div key={i} className="bg-surface2 border border-[var(--c-border)] rounded-xl px-3 py-[11px]">
                  <div className="flex items-center justify-between mb-[6px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">{meta.icon}</span>
                      <span className={`text-[12px] font-bold ${meta.color}`}>{meta.label}</span>
                      {t.hora && <span className="text-[10px] text-muted">{t.hora}</span>}
                    </div>
                    <span className="text-[11px] text-muted font-medium">{t.fecha}</span>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="flex flex-col gap-[3px]">
                      {t.metodo_pago && t.tipo !== 'cancelado' && (
                        <span className="text-[10px] text-muted">{METODO_LABEL[t.metodo_pago] || t.metodo_pago}</span>
                      )}
                      {t.motivo_cancelacion && t.tipo === 'cancelado' && (
                        <span className="text-[10px] text-red-400/70">{t.motivo_cancelacion}</span>
                      )}
                      {t.tipo === 'devolucion' && t.monto_devolucion > 0 && (
                        <span className="text-[10px] text-muted">Devuelto: {fmtMoney(t.monto_devolucion)}</span>
                      )}
                      {t.tipo === 'parcial' && t.monto_total > 0 && (
                        <span className="text-[10px] text-muted">Total: {fmtMoney(t.monto_total)}</span>
                      )}
                      {t.deuda_generada > 0 && (
                        <span className="text-[10px] font-bold text-red-400">+{fmtMoney(t.deuda_generada)} deuda nueva</span>
                      )}
                      {t.obs ? <span className="text-[10px] text-muted italic">"{t.obs}"</span> : null}
                    </div>
                    {t.tipo !== 'cancelado' && t.monto != null && (
                      <span className="font-heading font-extrabold text-[17px] text-textc flex-shrink-0">
                        {fmtMoney(t.monto)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="h-4" />
        <button
          onClick={closeModal}
          className="w-full bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[13px] py-[13px] rounded-xl"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  )
}
