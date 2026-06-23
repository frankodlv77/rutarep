import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { animate } from 'framer-motion'
import useStore from '../store/useStore'

function AnimatedNumber({ value, format = n => Math.round(n) }) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const from = prevRef.current
    prevRef.current = value
    const controls = animate(from, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setDisplay(v),
    })
    return controls.stop
  }, [value])

  return <>{format(display)}</>
}

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: i => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
}

function fmtMoney(n) {
  if (!n && n !== 0) return '$0'
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function pct(a, b) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

function getDateFromHistorial(h) {
  return new Date(h.created_at)
}

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const PERIOD_OPTIONS = [
  { key: '7d',     label: '7 días'  },
  { key: '30d',    label: '30 días' },
  { key: 'todo',   label: 'Todo'    },
  { key: 'custom', label: '📅 Fechas' },
]

export default function StatsScreen() {
  const historial = useStore(s => s.historial)
  const clientes  = useStore(s => s.clientes)
  const [period, setPeriod]     = useState('30d')
  const [dateFrom, setDateFrom] = useState(() => daysAgo(7).toISOString().slice(0, 10))
  const [dateTo, setDateTo]     = useState(todayStr)

  const filtered = useMemo(() => {
    if (period === 'todo') return historial
    if (period === 'custom') {
      const from = new Date(dateFrom + 'T00:00:00')
      const to   = new Date(dateTo   + 'T23:59:59')
      return historial.filter(h => {
        const d = getDateFromHistorial(h)
        return d >= from && d <= to
      })
    }
    const cutoff = period === '7d' ? daysAgo(7) : daysAgo(30)
    return historial.filter(h => getDateFromHistorial(h) >= cutoff)
  }, [historial, period, dateFrom, dateTo])

  // ── KPIs principales ──────────────────────────────────────────
  const totalMonto   = filtered.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const totalComision = filtered.reduce((s, h) => s + (+h.total_monto || 0) * ((+h.comision_pct || 0) / 100), 0)
  const diasTrabajados = filtered.length
  const totalVisitas  = filtered.reduce((s, h) => s + (+h.total_clientes || 0), 0)
  const totalEntregados = filtered.reduce((s, h) => s + (+h.total_entregados || 0), 0)
  const efectividad   = pct(totalEntregados, totalVisitas)
  const promedioPorDia = diasTrabajados > 0 ? totalMonto / diasTrabajados : 0

  // ── Tendencia (esta semana vs anterior) ───────────────────────
  const semanaActual  = historial.filter(h => getDateFromHistorial(h) >= daysAgo(7))
  const semanaAnterior = historial.filter(h => {
    const d = getDateFromHistorial(h)
    return d >= daysAgo(14) && d < daysAgo(7)
  })
  const montoActual   = semanaActual.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const montoAnterior = semanaAnterior.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const tendenciaPct  = montoAnterior > 0 ? Math.round(((montoActual - montoAnterior) / montoAnterior) * 100) : null

  // ── Gráfico de barras (últimos días según período) ────────────
  const chartDays = period === '7d' ? 7 : period === '30d' ? 14 : Math.min(historial.length, 14)
  const chartData = useMemo(() => {
    const last = historial.slice(0, chartDays).reverse()
    return last
  }, [historial, chartDays])
  const maxMonto = Math.max(...chartData.map(h => +h.total_monto || 0), 1)

  // ── Mejor día ─────────────────────────────────────────────────
  const mejorDia = [...filtered].sort((a, b) => (+b.total_monto || 0) - (+a.total_monto || 0))[0]

  // ── Métodos de pago ───────────────────────────────────────────
  let efectivo = 0, transferencia = 0, tarjeta = 0, otro = 0
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      const m = +e.monto || 0
      if (e.metodo_pago === 'efectivo')           efectivo      += m
      else if (e.metodo_pago === 'transferencia') transferencia += m
      else if (e.metodo_pago === 'tarjeta')       tarjeta       += m
      else if (m > 0)                              otro          += m
    })
  })
  const totalPagos = efectivo + transferencia + tarjeta + otro

  // ── Cancelaciones ─────────────────────────────────────────────
  const motivos = {}
  let totalCancelaciones = 0
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.tipo === 'cancelado') {
        totalCancelaciones++
        const m = e.motivo_cancelacion || 'Sin motivo'
        motivos[m] = (motivos[m] || 0) + 1
      }
    })
  })
  const motivosOrdenados = Object.entries(motivos).sort((a, b) => b[1] - a[1])

  // ── Por zona ──────────────────────────────────────────────────
  const zonaMap = {}
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.zona && e.monto > 0) {
        zonaMap[e.zona] = (zonaMap[e.zona] || 0) + (+e.monto || 0)
      }
    })
  })
  const zonasOrdenadas = Object.entries(zonaMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Top clientes ──────────────────────────────────────────────
  const clienteMap = {}
  historial.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.nombre && e.monto > 0) {
        if (!clienteMap[e.nombre]) clienteMap[e.nombre] = { monto: 0, visitas: 0 }
        clienteMap[e.nombre].monto  += +e.monto || 0
        clienteMap[e.nombre].visitas += 1
      }
    })
  })
  const topClientes = Object.entries(clienteMap)
    .sort((a, b) => b[1].monto - a[1].monto)
    .slice(0, 5)

  // ── Deudores ──────────────────────────────────────────────────
  const totalDeuda    = clientes.reduce((s, c) => s + (+c.deuda || 0), 0)
  const cantDeudores  = clientes.filter(c => c.deuda > 0).length
  const topDeudores   = [...clientes].filter(c => c.deuda > 0)
    .sort((a, b) => (+b.deuda || 0) - (+a.deuda || 0))
    .slice(0, 5)

  if (historial.length === 0) {
    return (
      <div className="p-4 text-center pt-16 text-[#6b85a0]">
        <div className="text-[48px] mb-3 opacity-40">📊</div>
        <div className="text-[13px] leading-relaxed">Finalizá tu primer día de ruta<br/>para ver las estadísticas.</div>
      </div>
    )
  }

  return (
    <div className="p-4 overflow-y-auto">

      {/* Selector período */}
      <div className="flex bg-[#131e2e] border border-white/7 rounded-xl p-1 mb-2 gap-1">
        {PERIOD_OPTIONS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`flex-1 py-[8px] rounded-lg text-[11px] font-heading font-bold transition-all ${
              period === p.key ? 'bg-amber-400 text-[#0b1320]' : 'text-[#6b85a0]'
            }`}>{p.label}</button>
        ))}
      </div>

      {/* Rango de fechas personalizado */}
      {period === 'custom' && (
        <div className="flex gap-2 mb-2">
          <div className="flex-1">
            <p className="text-[9px] text-[#6b85a0] uppercase tracking-[.5px] mb-1 ml-1">Desde</p>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-[#131e2e] border border-white/7 rounded-xl px-3 py-[10px] text-[#f0f4f8] text-[13px] outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex-1">
            <p className="text-[9px] text-[#6b85a0] uppercase tracking-[.5px] mb-1 ml-1">Hasta</p>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayStr()}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-[#131e2e] border border-white/7 rounded-xl px-3 py-[10px] text-[#f0f4f8] text-[13px] outline-none focus:border-amber-400"
            />
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#6b85a0] text-right mb-4">
        {filtered.length} día{filtered.length !== 1 ? 's' : ''} en el período
      </p>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Recaudado',    rawValue: totalMonto,     format: n => fmtMoney(n), color: 'text-emerald-400', icon: '💰' },
          { label: 'Comisión',     rawValue: totalComision,  format: n => fmtMoney(n), color: 'text-amber-400',   icon: '🏆' },
          { label: 'Promedio/día', rawValue: promedioPorDia, format: n => fmtMoney(n), color: 'text-info',         icon: '📈' },
          { label: 'Efectividad',  rawValue: efectividad,    format: n => `${Math.round(n)}%`, color: efectividad >= 80 ? 'text-emerald-400' : efectividad >= 60 ? 'text-amber-400' : 'text-red-400', icon: '🎯' },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i} variants={cardVariants} initial="hidden" animate="visible"
            className="bg-[#131e2e] border border-white/7 rounded-xl p-3">
            <div className="text-[16px] mb-1">{s.icon}</div>
            <div className={`font-heading text-[18px] font-extrabold ${s.color} leading-tight`}>
              <AnimatedNumber value={s.rawValue} format={s.format} />
            </div>
            <div className="text-[9px] text-[#6b85a0] uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Stats secundarias */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'Días',      value: diasTrabajados,     color: 'text-[#f0f4f8]' },
          { label: 'Visitas',   value: totalVisitas,       color: 'text-[#f0f4f8]' },
          { label: 'Entregas',  value: totalEntregados,    color: 'text-emerald-400' },
          { label: 'Canceladas', value: totalCancelaciones, color: totalCancelaciones > 0 ? 'text-red-400' : 'text-[#6b85a0]' },
        ].map((s, i) => (
          <motion.div key={s.label} custom={i + 4} variants={cardVariants} initial="hidden" animate="visible"
            className="flex-1 bg-[#131e2e] border border-white/7 rounded-xl p-2 text-center">
            <div className={`font-heading text-[18px] font-extrabold ${s.color}`}>
              <AnimatedNumber value={s.value} />
            </div>
            <div className="text-[9px] text-[#6b85a0] uppercase tracking-[.4px] mt-[1px]">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tendencia semana actual vs anterior */}
      {tendenciaPct !== null && (
        <div className={`rounded-xl px-4 py-3 mb-4 border flex items-center justify-between ${
          tendenciaPct >= 0
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div>
            <p className={`text-[12px] font-bold ${tendenciaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {tendenciaPct >= 0 ? '📈' : '📉'} Esta semana vs anterior
            </p>
            <p className="text-[10px] text-[#6b85a0] mt-[2px]">{fmtMoney(montoActual)} vs {fmtMoney(montoAnterior)}</p>
          </div>
          <span className={`font-heading font-extrabold text-[22px] ${tendenciaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {tendenciaPct >= 0 ? '+' : ''}{tendenciaPct}%
          </span>
        </div>
      )}

      {/* Gráfico de barras */}
      {chartData.length > 0 && (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">
            Recaudación por día
          </p>
          <div className="flex items-end gap-[5px] h-20">
            {chartData.map((h, i) => {
              const h2 = +h.total_monto || 0
              const heightPct = Math.max((h2 / maxMonto) * 100, 4)
              const label = h.fecha?.split(',')[0]?.slice(0, 3) || '—'
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[3px]">
                  <div
                    className="w-full rounded-t-[3px] bg-amber-400 transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={fmtMoney(h2)}
                  />
                  <span className="text-[8px] text-[#6b85a0] capitalize truncate w-full text-center">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Métodos de pago */}
      {totalPagos > 0 && (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">Métodos de pago</p>
          {[
            { label: 'Efectivo',      value: efectivo,      icon: '💵', color: 'bg-emerald-400' },
            { label: 'Transferencia', value: transferencia,  icon: '🏦', color: 'bg-blue-400' },
            { label: 'Tarjeta',       value: tarjeta,        icon: '💳', color: 'bg-purple-400' },
            { label: 'Otro',          value: otro,           icon: '❓', color: 'bg-[#6b85a0]' },
          ].filter(m => m.value > 0).map(m => (
            <div key={m.label} className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#f0f4f8]">{m.icon} {m.label}</span>
                <span className="text-[11px] font-bold text-[#f0f4f8]">{fmtMoney(m.value)} <span className="text-[#6b85a0] font-normal">({pct(m.value, totalPagos)}%)</span></span>
              </div>
              <div className="h-[6px] bg-[#1a2840] rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${pct(m.value, totalPagos)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mejor día */}
      {mejorDia && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-1">🏆 Mejor día del período</p>
          <p className="text-[13px] font-bold text-amber-400 capitalize">{mejorDia.fecha}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[18px] font-extrabold text-emerald-400 font-heading">{fmtMoney(mejorDia.total_monto)}</span>
            <span className="text-[11px] text-[#6b85a0]">{mejorDia.total_entregados}/{mejorDia.total_clientes} entregas</span>
          </div>
        </div>
      )}

      {/* Por zona */}
      {zonasOrdenadas.length > 0 && (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">Recaudación por zona</p>
          {zonasOrdenadas.map(([zona, monto], i) => (
            <div key={zona} className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-400 w-4">{i + 1}</span>
                <span className="text-[12px] text-[#f0f4f8]">{zona}</span>
              </div>
              <span className="text-[12px] font-bold text-emerald-400">{fmtMoney(monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top clientes */}
      {topClientes.length > 0 && (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">Top clientes (histórico)</p>
          {topClientes.map(([nombre, data], i) => (
            <div key={nombre} className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-amber-400 w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-[12px] text-[#f0f4f8] truncate">{nombre}</span>
                <span className="text-[9px] text-[#6b85a0] flex-shrink-0">{data.visitas}v</span>
              </div>
              <span className="text-[12px] font-bold text-emerald-400 flex-shrink-0 ml-2">{fmtMoney(data.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cancelaciones */}
      {totalCancelaciones > 0 && (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-3">
            Cancelaciones — {totalCancelaciones} total
          </p>
          {motivosOrdenados.map(([motivo, cant]) => (
            <div key={motivo} className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#f0f4f8]">{motivo}</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-red-400">{cant}</span>
                <span className="text-[10px] text-[#6b85a0]">({pct(cant, totalCancelaciones)}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deuda */}
      {totalDeuda > 0 && (
        <div className="bg-red-500/8 border border-red-500/25 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px]">Deuda pendiente</p>
            <span className="text-[13px] font-extrabold text-red-400 font-heading">{fmtMoney(totalDeuda)}</span>
          </div>
          <p className="text-[10px] text-[#6b85a0] mb-2">{cantDeudores} cliente{cantDeudores !== 1 ? 's' : ''} con deuda</p>
          {topDeudores.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between mb-[6px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-red-400 w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-[12px] text-[#f0f4f8] truncate">{c.nombre}</span>
              </div>
              <span className="text-[12px] font-bold text-red-400 flex-shrink-0 ml-2">{fmtMoney(c.deuda)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="h-8" />
    </div>
  )
}
