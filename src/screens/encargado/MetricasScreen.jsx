import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('es-AR') }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0 }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function isoDate(h) { return h.fecha_iso || h.created_at?.slice(0, 10) || '' }

const PERIOD_OPTIONS = [
  { key: '7d',     label: '7 días'  },
  { key: '30d',    label: '30 días' },
  { key: 'todo',   label: 'Todo'    },
  { key: 'custom', label: '📅 Fechas' },
]

export default function MetricasScreen() {
  const perfil = useStore(s => s.perfil)

  const [historial, setHistorial] = useState([])
  const [miembros,  setMiembros]  = useState({}) // userId → { negocio, nombre }
  const [loading,   setLoading]   = useState(true)
  const [period,    setPeriod]    = useState('30d')
  const [dateFrom,  setDateFrom]  = useState(() => daysAgo(7).toISOString().slice(0, 10))
  const [dateTo,    setDateTo]    = useState(todayStr)
  const [rankingBy, setRankingBy] = useState('monto')
  const [chartMode, setChartMode] = useState('semana')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)

    const { data: membrosData } = await supabase
      .from('equipo_miembros').select('user_id, rol')

    if (!membrosData?.length) { setLoading(false); return }

    const userIds = membrosData.map(m => m.user_id)

    const [{ data: perfiles }, { data: hist }] = await Promise.all([
      supabase.from('profiles').select('id, negocio, nombre').in('id', userIds),
      supabase.from('historial').select('*').in('user_id', userIds).order('fecha_iso', { ascending: false }),
    ])

    setMiembros(Object.fromEntries((perfiles || []).map(p => [p.id, p])))
    setHistorial(hist || [])
    setLoading(false)
  }

  // ── Filtrado por período ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (period === 'todo') return historial
    if (period === 'custom') {
      const from = new Date(dateFrom + 'T00:00:00')
      const to   = new Date(dateTo   + 'T23:59:59')
      return historial.filter(h => {
        const d = new Date(isoDate(h))
        return d >= from && d <= to
      })
    }
    const cutoff = period === '7d' ? daysAgo(7) : daysAgo(30)
    return historial.filter(h => new Date(isoDate(h)) >= cutoff)
  }, [historial, period, dateFrom, dateTo])

  // ── KPIs globales ────────────────────────────────────────────────
  const totalMonto    = filtered.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const totalEntregas = filtered.reduce((s, h) => s + (+h.total_entregados || 0), 0)
  const totalVisitas  = filtered.reduce((s, h) => s + (+h.total_clientes || 0), 0)
  const totalComision = filtered.reduce((s, h) => s + (+h.total_monto || 0) * ((+h.comision_pct || 0) / 100), 0)
  const efectividadGlobal = pct(totalEntregas, totalVisitas)
  const diasEquipo = filtered.length
  const repsUnicos = new Set(filtered.map(h => h.user_id)).size
  const promedioPorRep = repsUnicos > 0 ? totalMonto / repsUnicos : 0
  const promedioPorDia = diasEquipo > 0 ? totalMonto / diasEquipo : 0

  // ── Por repartidor ───────────────────────────────────────────────
  const byRep = useMemo(() => {
    const map = {}
    filtered.forEach(h => {
      if (!map[h.user_id]) {
        map[h.user_id] = {
          user_id:  h.user_id,
          nombre:   miembros[h.user_id]?.negocio || miembros[h.user_id]?.nombre || 'Repartidor',
          monto: 0, entregas: 0, visitas: 0, comision: 0, dias: 0,
        }
      }
      const r = map[h.user_id]
      r.monto   += +h.total_monto || 0
      r.entregas += +h.total_entregados || 0
      r.visitas  += +h.total_clientes || 0
      r.comision += (+h.total_monto || 0) * ((+h.comision_pct || 0) / 100)
      r.dias     += 1
    })
    return Object.values(map)
  }, [filtered, miembros])

  const ranking = [...byRep].sort((a, b) =>
    rankingBy === 'monto'
      ? b.monto - a.monto
      : pct(b.entregas, b.visitas) - pct(a.entregas, a.visitas)
  )

  // ── Tendencia semana actual vs anterior ──────────────────────────
  const semActual   = historial.filter(h => new Date(isoDate(h)) >= daysAgo(7))
  const semAnterior = historial.filter(h => {
    const d = new Date(isoDate(h)); return d >= daysAgo(14) && d < daysAgo(7)
  })
  const mActual   = semActual.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const mAnterior = semAnterior.reduce((s, h) => s + (+h.total_monto || 0), 0)
  const tendencia = mAnterior > 0 ? Math.round(((mActual - mAnterior) / mAnterior) * 100) : null

  // ── Mejor día ────────────────────────────────────────────────────
  const mejorDia = [...filtered].sort((a, b) => (+b.total_monto || 0) - (+a.total_monto || 0))[0]

  // ── Gráfico por día (equipo) ─────────────────────────────────────
  const byDay = useMemo(() => {
    const map = {}
    filtered.forEach(h => {
      const k = isoDate(h)
      map[k] = (map[k] || 0) + (+h.total_monto || 0)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  }, [filtered])
  const maxDay = Math.max(...byDay.map(([, m]) => m), 1)

  // ── Gráfico por semana ───────────────────────────────────────────
  const byWeek = useMemo(() => {
    const map = {}
    filtered.forEach(h => {
      const d = new Date(isoDate(h) + 'T00:00:00')
      const dow = d.getDay()
      const daysToMon = dow === 0 ? 6 : dow - 1
      const mon = new Date(d)
      mon.setDate(d.getDate() - daysToMon)
      const key = mon.toISOString().slice(0, 10)
      map[key] = (map[key] || 0) + (+h.total_monto || 0)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])
  const maxWeek = Math.max(...byWeek.map(([, m]) => m), 1)

  // ── Métodos de pago ──────────────────────────────────────────────
  let efectivo = 0, transferencia = 0, tarjeta = 0, otro = 0
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      const m = +e.monto || 0
      if      (e.metodo_pago === 'efectivo')       efectivo      += m
      else if (e.metodo_pago === 'transferencia')  transferencia += m
      else if (e.metodo_pago === 'tarjeta')        tarjeta       += m
      else if (m > 0)                              otro          += m
    })
  })
  const totalPagos = efectivo + transferencia + tarjeta + otro

  // ── Cancelaciones ────────────────────────────────────────────────
  const motivos = {}
  let totalCanc = 0
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.tipo === 'cancelado') {
        totalCanc++
        const m = e.motivo_cancelacion || 'Sin motivo'
        motivos[m] = (motivos[m] || 0) + 1
      }
    })
  })
  const motivosArr = Object.entries(motivos).sort((a, b) => b[1] - a[1])

  // ── Por zona ─────────────────────────────────────────────────────
  const zonaMap = {}
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.zona && (+e.monto || 0) > 0) {
        zonaMap[e.zona] = (zonaMap[e.zona] || 0) + (+e.monto || 0)
      }
    })
  })
  const zonas = Object.entries(zonaMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // ── Top clientes (cross-repartidor) ─────────────────────────────
  const clienteMap = {}
  filtered.forEach(h => {
    ;(h.entregas || []).forEach(e => {
      if (e.nombre && (+e.monto || 0) > 0) {
        if (!clienteMap[e.nombre]) clienteMap[e.nombre] = { monto: 0, visitas: 0 }
        clienteMap[e.nombre].monto   += +e.monto || 0
        clienteMap[e.nombre].visitas += 1
      }
    })
  })
  const topClientes = Object.entries(clienteMap).sort((a, b) => b[1].monto - a[1].monto).slice(0, 5)

  // ── Export CSV ───────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Fecha', 'Repartidor', 'Recaudado', 'Entregas', 'Visitas', 'Efectividad%', 'Comision%', 'Comision$'],
    ]
    filtered.forEach(h => {
      const nombre = miembros[h.user_id]?.negocio || miembros[h.user_id]?.nombre || h.user_id
      const ef  = pct(+h.total_entregados || 0, +h.total_clientes || 0)
      const com = Math.round((+h.total_monto || 0) * ((+h.comision_pct || 0) / 100))
      rows.push([
        isoDate(h), nombre,
        Math.round(+h.total_monto || 0),
        +h.total_entregados || 0,
        +h.total_clientes   || 0,
        ef, +h.comision_pct || 0, com,
      ])
    })
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `vorarep-metricas-${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── Loading / empty ──────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-[13px] text-muted">Cargando métricas...</p>
    </div>
  )

  if (!historial.length) return (
    <div className="p-4 text-center pt-16 text-muted">
      <div className="text-[48px] mb-3 opacity-40">📊</div>
      <div className="text-[13px] leading-relaxed">Ningún repartidor ha finalizado un día todavía.</div>
    </div>
  )

  return (
    <div className="p-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading text-[18px] font-extrabold text-textc">Métricas del equipo</h2>
          <p className="text-[11px] text-muted">{Object.keys(miembros).length} repartidores</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-[6px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-heading font-bold text-[11px] px-3 py-[8px] rounded-xl active:scale-95 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
      </div>

      {/* Period selector */}
      <div className="flex bg-surface border border-[var(--c-border)] rounded-xl p-1 mb-2 gap-1">
        {PERIOD_OPTIONS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`flex-1 py-[8px] rounded-lg text-[11px] font-heading font-bold transition-all ${
              period === p.key ? 'bg-amber-400 text-[#1a1a28]' : 'text-muted'
            }`}>{p.label}</button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex gap-2 mb-2">
          {[
            { label: 'Desde', val: dateFrom, max: dateTo, setter: setDateFrom },
            { label: 'Hasta', val: dateTo, min: dateFrom, max: todayStr(), setter: setDateTo },
          ].map(f => (
            <div key={f.label} className="flex-1">
              <p className="text-[9px] text-muted uppercase tracking-[.5px] mb-1 ml-1">{f.label}</p>
              <input type="date" value={f.val} min={f.min} max={f.max} onChange={e => f.setter(e.target.value)}
                className="w-full bg-surface border border-[var(--c-border)] rounded-xl px-3 py-[10px] text-textc text-[13px] outline-none focus:border-amber-400" />
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted text-right mb-4">
        {filtered.length} registros · {repsUnicos} repartidores activos
      </p>

      {/* KPIs totales */}
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">Totales del equipo</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {[
          { label: 'Recaudado',    value: fmtMoney(totalMonto),    color: 'text-emerald-400' },
          { label: 'Comisiones',   value: fmtMoney(totalComision), color: 'text-amber-400'   },
          { label: 'Promedio/rep', value: fmtMoney(promedioPorRep),color: 'text-info'         },
          {
            label: 'Efectividad', value: `${efectividadGlobal}%`,
            color: efectividadGlobal >= 80 ? 'text-emerald-400' : efectividadGlobal >= 60 ? 'text-amber-400' : 'text-red-400',
          },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-[var(--c-border)] rounded-xl p-3 text-center">
            <div className={`font-heading text-[18px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { label: 'Días',      value: diasEquipo,   color: 'text-textc' },
          { label: 'Visitas',   value: totalVisitas, color: 'text-textc' },
          { label: 'Entregas',  value: totalEntregas,color: 'text-emerald-400' },
          { label: 'Canceladas',value: totalCanc,    color: totalCanc > 0 ? 'text-red-400' : 'text-muted' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
            <div className={`font-heading text-[17px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[1px]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Promedio por día */}
      <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4 flex items-center justify-between">
        <span className="text-[12px] text-muted">Promedio recaudado por día (equipo)</span>
        <span className="text-[14px] font-extrabold font-heading text-emerald-400">{fmtMoney(promedioPorDia)}</span>
      </div>

      {/* Tendencia */}
      {tendencia !== null && (
        <div className={`rounded-xl px-4 py-3 mb-4 border flex items-center justify-between ${
          tendencia >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div>
            <p className={`text-[12px] font-bold ${tendencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {tendencia >= 0 ? '📈' : '📉'} Esta semana vs anterior
            </p>
            <p className="text-[10px] text-muted mt-[2px]">{fmtMoney(mActual)} vs {fmtMoney(mAnterior)}</p>
          </div>
          <span className={`font-heading font-extrabold text-[22px] ${tendencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {tendencia >= 0 ? '+' : ''}{tendencia}%
          </span>
        </div>
      )}

      {/* Gráfico recaudación */}
      {(byDay.length > 0 || byWeek.length > 0) && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px]">
              Recaudación del equipo
            </p>
            <div className="flex gap-1">
              {[{ key: 'dia', label: 'Por día' }, { key: 'semana', label: 'Por semana' }].map(o => (
                <button key={o.key} onClick={() => setChartMode(o.key)}
                  className={`px-2 py-[3px] rounded-lg text-[10px] font-bold transition-all ${
                    chartMode === o.key ? 'bg-amber-400 text-[#1a1a28]' : 'bg-surface2 text-muted'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>

          {chartMode === 'dia' && byDay.length > 0 && (
            <div className="flex items-end gap-[3px] h-24">
              {byDay.map(([fecha, monto], i) => {
                const h = Math.max((monto / maxDay) * 100, 3)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[3px]">
                    <div className="w-full rounded-t-[3px] bg-amber-400" style={{ height: `${h}%` }} />
                    <span className="text-[7px] text-muted truncate w-full text-center">{fecha.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {chartMode === 'semana' && byWeek.length > 0 && (() => {
            const semLabel = iso => {
              const d = new Date(iso + 'T00:00:00')
              return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
            }
            return (
              <div className="flex items-end gap-[6px] h-28">
                {byWeek.map(([iso, monto], i) => {
                  const h = Math.max((monto / maxWeek) * 100, 3)
                  const isLast = i === byWeek.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[4px]">
                      {/* valor encima */}
                      <span className="text-[7px] font-bold text-amber-400 truncate w-full text-center">
                        {fmtMoney(monto)}
                      </span>
                      <div
                        className="w-full rounded-t-[4px] transition-all"
                        style={{ height: `${h}%`, background: isLast ? '#f59e0b' : 'rgba(245,158,11,0.45)' }}
                      />
                      <span className="text-[8px] text-muted truncate w-full text-center leading-tight">
                        {semLabel(iso)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px]">Ranking repartidores</p>
            <div className="flex gap-1">
              {[{ key: 'monto', label: '$ Monto' }, { key: 'efectividad', label: '% Efect.' }].map(o => (
                <button key={o.key} onClick={() => setRankingBy(o.key)}
                  className={`px-2 py-[3px] rounded-lg text-[10px] font-bold transition-all ${
                    rankingBy === o.key ? 'bg-amber-400 text-[#1a1a28]' : 'bg-surface2 text-muted'
                  }`}>{o.label}</button>
              ))}
            </div>
          </div>
          {ranking.map((r, i) => {
            const ef      = pct(r.entregas, r.visitas)
            const top     = ranking[0]
            const barPct  = rankingBy === 'monto' ? pct(r.monto, top.monto) : ef
            const promDia = r.dias > 0 ? r.monto / r.dias : 0
            return (
              <div key={r.user_id} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-amber-400 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="text-[12px] font-semibold text-textc truncate">{r.nombre}</span>
                    <span className="text-[9px] text-muted flex-shrink-0">{r.dias}d</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-[12px] font-bold text-emerald-400">{fmtMoney(r.monto)}</div>
                    <div className="text-[9px] text-muted">
                      {ef}% efect · com {fmtMoney(r.comision)}
                    </div>
                  </div>
                </div>
                <div className="h-[4px] bg-surface2 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${barPct}%` }} />
                </div>
                <div className="text-[9px] text-muted mt-[2px]">
                  {r.entregas}/{r.visitas} entregas · promedio/día {fmtMoney(promDia)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mejor día */}
      {mejorDia && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">🏆 Mejor día del período</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-amber-400">{isoDate(mejorDia)}</p>
              <p className="text-[11px] text-muted">
                {miembros[mejorDia.user_id]?.negocio || miembros[mejorDia.user_id]?.nombre || 'Repartidor'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[18px] font-extrabold text-emerald-400 font-heading">{fmtMoney(mejorDia.total_monto)}</div>
              <div className="text-[10px] text-muted">{mejorDia.total_entregados}/{mejorDia.total_clientes} entregas</div>
            </div>
          </div>
        </div>
      )}

      {/* Métodos de pago */}
      {totalPagos > 0 && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">Métodos de pago</p>
          {[
            { label: 'Efectivo',      value: efectivo,      icon: '💵', color: 'bg-emerald-400' },
            { label: 'Transferencia', value: transferencia,  icon: '🏦', color: 'bg-blue-400'    },
            { label: 'Tarjeta',       value: tarjeta,        icon: '💳', color: 'bg-purple-400'  },
            { label: 'Otro',          value: otro,           icon: '❓', color: 'bg-[#6b85a0]'   },
          ].filter(m => m.value > 0).map(m => (
            <div key={m.label} className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-textc">{m.icon} {m.label}</span>
                <span className="text-[11px] font-bold text-textc">
                  {fmtMoney(m.value)}{' '}
                  <span className="text-muted font-normal">({pct(m.value, totalPagos)}%)</span>
                </span>
              </div>
              <div className="h-[6px] bg-surface2 rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct(m.value, totalPagos)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Por zona */}
      {zonas.length > 0 && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">Recaudación por zona</p>
          {zonas.map(([zona, monto], i) => (
            <div key={zona} className="flex items-center justify-between mb-2 last:mb-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-amber-400 w-4">{i + 1}</span>
                <span className="text-[12px] text-textc">{zona}</span>
              </div>
              <span className="text-[12px] font-bold text-emerald-400">{fmtMoney(monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Top clientes */}
      {topClientes.length > 0 && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">Top clientes del equipo</p>
          {topClientes.map(([nombre, data], i) => (
            <div key={nombre} className="flex items-center justify-between mb-2 last:mb-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold text-amber-400 w-4 flex-shrink-0">{i + 1}</span>
                <span className="text-[12px] text-textc truncate">{nombre}</span>
                <span className="text-[9px] text-muted flex-shrink-0">{data.visitas}v</span>
              </div>
              <span className="text-[12px] font-bold text-emerald-400 flex-shrink-0 ml-2">{fmtMoney(data.monto)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cancelaciones */}
      {totalCanc > 0 && (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-4">
          <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">
            Cancelaciones — {totalCanc} total
          </p>
          {motivosArr.map(([motivo, cant]) => (
            <div key={motivo} className="flex items-center justify-between mb-2 last:mb-0">
              <span className="text-[12px] text-textc">{motivo}</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-red-400">{cant}</span>
                <span className="text-[10px] text-muted">({pct(cant, totalCanc)}%)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-20" />
    </div>
  )
}
