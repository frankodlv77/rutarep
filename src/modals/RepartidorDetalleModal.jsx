import { createPortal } from 'react-dom'

function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('es-AR') }

const TIPO_COLOR = {
  entregado:  '#22c55e',
  parcial:    '#f59e0b',
  devolucion: '#60a5fa',
  cancelado:  '#f87171',
}
const TIPO_BG = {
  entregado:  'rgba(34,197,94,0.1)',
  parcial:    'rgba(245,158,11,0.1)',
  devolucion: 'rgba(96,165,250,0.1)',
  cancelado:  'rgba(248,113,113,0.1)',
}
const TIPO_LABEL = {
  entregado:  '✓ Entregado',
  parcial:    '½ Parcial',
  devolucion: '↩ Devolución',
  cancelado:  '✕ Cancelado',
}

export default function RepartidorDetalleModal({ repartidor, onClose }) {
  if (!repartidor) return null

  const nombre   = repartidor.profiles?.negocio || repartidor.profiles?.nombre || 'Repartidor'
  const monto    = +repartidor.total_monto || 0
  const comision = monto * ((+repartidor.comision_pct || 0) / 100)
  const pct      = repartidor.total_clientes > 0
    ? Math.round((repartidor.total_entregados / repartidor.total_clientes) * 100)
    : 0

  // Usar entregasArr (enriquecido por DashboardScreen) si existe, sino fallback
  const entregas = Array.isArray(repartidor.entregasArr)
    ? repartidor.entregasArr
    : Array.isArray(repartidor.entregas) ? repartidor.entregas : []

  const porTipo = entregas.reduce((acc, e) => {
    if (e.tipo) acc[e.tipo] = (acc[e.tipo] || 0) + 1
    return acc
  }, {})

  const metodoPago = entregas.reduce((acc, e) => {
    const m = +e.monto || 0
    if (m > 0 && e.metodo_pago) acc[e.metodo_pago] = (acc[e.metodo_pago] || 0) + m
    return acc
  }, {})

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', background: 'var(--c-bg)', borderRadius: '20px 20px 0 0', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-surface3 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 pb-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-heading text-[17px] font-extrabold text-textc">{nombre}</h3>
              <p className="text-[11px] text-muted">Detalle del día</p>
            </div>
            <button onClick={onClose} className="text-muted text-[22px] leading-none px-1 mt-[-2px]">×</button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Recaudado',  value: fmtMoney(monto),    color: 'text-emerald-400' },
              { label: 'Comisión',   value: fmtMoney(comision), color: 'text-amber-400'   },
              { label: 'Efectividad',value: `${pct}%`,
                color: pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-[var(--c-border)] rounded-xl p-3 text-center">
                <div className={`font-heading text-[15px] font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-muted">{repartidor.total_entregados}/{repartidor.total_clientes} entregas</span>
              <span className="text-[11px] font-bold text-textc">{pct}%</span>
            </div>
            <div className="w-full h-[6px] bg-surface2 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Resumen por tipo */}
          {Object.keys(porTipo).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(porTipo).map(([tipo, cant]) => (
                <span key={tipo} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: TIPO_COLOR[tipo] || 'rgba(255,255,255,0.4)', background: TIPO_BG[tipo] || 'rgba(255,255,255,0.05)' }}>
                  {TIPO_LABEL[tipo] || tipo} × {cant}
                </span>
              ))}
            </div>
          )}

          {/* Métodos de pago */}
          {Object.keys(metodoPago).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(metodoPago).map(([metodo, total]) => (
                <span key={metodo} style={{ fontSize: 10, color: 'var(--c-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 20 }}>
                  {metodo}: {fmtMoney(total)}
                </span>
              ))}
            </div>
          )}

          {/* Entregas lista */}
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">
            Clientes del día ({entregas.length})
          </p>

          {entregas.length === 0 ? (
            <p className="text-[12px] text-muted text-center py-4">Sin clientes cargados hoy</p>
          ) : (
            entregas.map((e, i) => {
              const clienteNombre = e.nombre || `Cliente #${i + 1}`
              const color = TIPO_COLOR[e.tipo] || 'rgba(255,255,255,0.4)'
              const bg    = TIPO_BG[e.tipo]    || 'rgba(255,255,255,0.03)'
              const label = e.tipo ? (TIPO_LABEL[e.tipo] || e.tipo) : '— Pendiente'
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: '10px 12px', marginBottom: 5, border: `1px solid ${e.tipo ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)'}`, background: e.tipo ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)' }}>
                  {/* Dot */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clienteNombre}</div>
                    {e.direccion && <div style={{ fontSize: 10, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.direccion}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 20 }}>{label}</div>
                    {(+e.monto || 0) > 0 && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>{fmtMoney(e.monto)}</div>}
                    {e.hora && <div style={{ fontSize: 9, color: 'var(--c-muted)', marginTop: 1 }}>{e.hora}{e.metodo_pago ? ` · ${e.metodo_pago}` : ''}</div>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>,
    document.body
  )
}
