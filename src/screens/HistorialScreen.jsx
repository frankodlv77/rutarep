import { useState } from 'react'
import { jsPDF } from 'jspdf'
import useStore from '../store/useStore'
import { useFreemium } from '../hooks/useFreemium'

function fmtMoney(n) {
  if (!n && n !== 0) return '—'
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

const PAGO_ICONS = { transferencia: '🏦', tarjeta: '💳', efectivo: '💵', otro: '❓' }

const MESES = { enero:0, febrero:1, marzo:2, abril:3, mayo:4, junio:5, julio:6, agosto:7, septiembre:8, octubre:9, noviembre:10, diciembre:11 }

function parseFecha(fechaStr) {
  // Parsea "jueves, 30 de abril de 2026" → Date
  const m = (fechaStr || '').match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/)
  if (!m) return null
  const month = MESES[m[2].toLowerCase()]
  if (month === undefined) return null
  return new Date(parseInt(m[3]), month, parseInt(m[1]))
}

function getWeekRange() {
  const now = new Date()
  // Semana sábado–viernes: sábado=0, domingo=1, lunes=2, ..., viernes=6
  const offset = (now.getDay() + 1) % 7
  const start = new Date(now); start.setDate(now.getDate() - offset); start.setHours(0,0,0,0)
  const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
  return { start, end }
}

function getMonthRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function statsFor(dias) {
  const total     = dias.reduce((s, d) => s + (+d.total_monto || 0), 0)
  const entregas  = dias.reduce((s, d) => s + (+d.total_entregados || 0), 0)
  const comision  = dias.reduce((s, d) => s + (+d.total_monto || 0) * ((+d.comision_pct || 0) / 100), 0)

  let efectivo = 0, transferencia = 0, tarjeta = 0
  dias.forEach(d => {
    ;(d.entregas || []).forEach(e => {
      const m = +e.monto || 0
      if (e.metodo_pago === 'efectivo')      efectivo      += m
      else if (e.metodo_pago === 'transferencia') transferencia += m
      else if (e.metodo_pago === 'tarjeta')  tarjeta       += m
    })
  })
  return { total, entregas, comision, efectivo, transferencia, tarjeta }
}

function exportCSV(historial) {
  const BOM = '﻿'
  const rows = [
    ['Fecha', 'Clientes', 'Entregados', 'No Entregados', 'Total ($)', 'Comisión %', 'Comisión ($)', 'Efectivo ($)', 'Transferencia ($)', 'Tarjeta ($)'],
  ]
  historial.forEach(d => {
    let ef = 0, tr = 0, ta = 0
    ;(d.entregas || []).forEach(e => {
      const m = +e.monto || 0
      if (e.metodo_pago === 'efectivo')           ef += m
      else if (e.metodo_pago === 'transferencia') tr += m
      else if (e.metodo_pago === 'tarjeta')       ta += m
    })
    rows.push([
      d.fecha,
      d.total_clientes,
      d.total_entregados,
      (+d.total_clientes || 0) - (+d.total_entregados || 0),
      +d.total_monto || 0,
      d.comision_pct,
      Math.round((+d.total_monto || 0) * (+d.comision_pct || 0) / 100),
      ef, tr, ta,
    ])
  })

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `vorarep-historial-${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function fmt(n) { return n ? Math.round(Number(n)).toLocaleString('es-AR') : '0' }

function exportPeriodoPDF(dias, stats, periodLabel, negocio) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const gray   = [107, 133, 160]
  const dark   = [11, 19, 32]
  const amber  = [251, 191, 36]
  const green  = [52, 211, 153]
  const white  = [240, 244, 248]

  // Fondo oscuro
  doc.setFillColor(...dark)
  doc.rect(0, 0, W, 297, 'F')

  // Header strip
  doc.setFillColor(19, 30, 46)
  doc.roundedRect(10, 8, W - 20, 28, 3, 3, 'F')

  doc.setFontSize(18)
  doc.setTextColor(...amber)
  doc.setFont('helvetica', 'bold')
  doc.text('VoraRep', 18, 21)

  doc.setFontSize(10)
  doc.setTextColor(...gray)
  doc.setFont('helvetica', 'normal')
  doc.text(negocio || '', 18, 28)

  doc.setFontSize(9)
  doc.text(`Reporte: ${periodLabel}`, W - 18, 18, { align: 'right' })
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - 18, 24, { align: 'right' })

  // Stats cards
  let y = 44
  const cards = [
    { label: 'Total recaudado', value: `$${fmt(stats.total)}`,   color: green },
    { label: 'Entregas',        value: String(stats.entregas),    color: white },
    { label: 'Comisión',        value: `$${fmt(stats.comision)}`, color: amber },
  ]
  const cw = (W - 20 - 8) / 3
  cards.forEach((c, i) => {
    const x = 10 + i * (cw + 4)
    doc.setFillColor(19, 30, 46)
    doc.roundedRect(x, y, cw, 20, 2, 2, 'F')
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...c.color)
    doc.text(c.value, x + cw / 2, y + 10, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gray)
    doc.text(c.label.toUpperCase(), x + cw / 2, y + 16, { align: 'center' })
  })

  // Desglose métodos si hay
  if (stats.efectivo > 0 || stats.transferencia > 0 || stats.tarjeta > 0) {
    y += 26
    const metodos = [
      { label: 'Efectivo',      value: stats.efectivo },
      { label: 'Transferencia', value: stats.transferencia },
      { label: 'Tarjeta',       value: stats.tarjeta },
    ].filter(m => m.value > 0)
    const mw = (W - 20 - (metodos.length - 1) * 3) / metodos.length
    metodos.forEach((m, i) => {
      const x = 10 + i * (mw + 3)
      doc.setFillColor(26, 40, 64)
      doc.roundedRect(x, y, mw, 14, 2, 2, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...white)
      doc.text(`$${fmt(m.value)}`, x + mw / 2, y + 7, { align: 'center' })
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gray)
      doc.text(m.label.toUpperCase(), x + mw / 2, y + 12, { align: 'center' })
    })
    y += 20
  } else {
    y += 26
  }

  // Detalle por día
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...gray)
  doc.text('DETALLE POR DÍA', 10, y)
  y += 4

  dias.forEach(dia => {
    if (y > 270) { doc.addPage(); doc.setFillColor(...dark); doc.rect(0, 0, W, 297, 'F'); y = 15 }

    // Día header
    doc.setFillColor(19, 30, 46)
    doc.roundedRect(10, y, W - 20, 13, 2, 2, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...amber)
    doc.text(dia.fecha, 15, y + 6)

    doc.setTextColor(...green)
    doc.text(`$${fmt(dia.total_monto)}`, W - 15, y + 6, { align: 'right' })

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gray)
    doc.text(`${dia.total_entregados}/${dia.total_clientes} entregas · Comisión ${dia.comision_pct}%`, 15, y + 11)

    y += 17

    // Entregas del día
    ;(dia.entregas || []).forEach(e => {
      if (y > 275) { doc.addPage(); doc.setFillColor(...dark); doc.rect(0, 0, W, 297, 'F'); y = 15 }
      const dot  = e.tipo === 'cancelado' ? '✕' : e.entregado ? '✓' : '–'
      const col  = e.tipo === 'cancelado' ? [239, 68, 68] : e.entregado ? [52, 211, 153] : gray
      doc.setTextColor(...col)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text(dot, 16, y + 1)
      doc.setTextColor(...white)
      doc.setFont('helvetica', 'normal')
      doc.text(e.nombre || '', 21, y + 1)
      if (e.monto > 0) {
        doc.setTextColor(...green)
        doc.text(`$${fmt(e.monto)}`, W - 15, y + 1, { align: 'right' })
      } else if (e.tipo === 'cancelado') {
        doc.setTextColor(239, 68, 68)
        doc.text('Cancelado', W - 15, y + 1, { align: 'right' })
      }
      y += 5
    })
    y += 4
  })

  // Footer
  doc.setFontSize(6.5)
  doc.setTextColor(...gray)
  doc.text('Generado con VoraRep · vorarep.com', W / 2, 292, { align: 'center' })

  const fname = `vorarep-${periodLabel.toLowerCase().replace(/\s/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`
  doc.save(fname)
}

function exportDiaPDF(dia, negocio) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210
  const dark  = [11, 19, 32]
  const gray  = [107, 133, 160]
  const amber = [251, 191, 36]
  const green = [52, 211, 153]
  const white = [240, 244, 248]

  doc.setFillColor(...dark)
  doc.rect(0, 0, W, 297, 'F')

  // Header
  doc.setFillColor(19, 30, 46)
  doc.roundedRect(10, 8, W - 20, 26, 3, 3, 'F')
  doc.setFontSize(16)
  doc.setTextColor(...amber)
  doc.setFont('helvetica', 'bold')
  doc.text('VoraRep', 18, 20)
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  doc.setFont('helvetica', 'normal')
  doc.text(negocio || '', 18, 28)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...white)
  doc.text(dia.fecha, W - 18, 20, { align: 'right' })
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.text(`${dia.total_entregados}/${dia.total_clientes} entregas · Comisión ${dia.comision_pct}%`, W - 18, 28, { align: 'right' })

  // Stats
  let y = 42
  const com = Math.round((+dia.total_monto || 0) * (+dia.comision_pct || 0) / 100)
  const cards = [
    { l: 'Recaudado', v: `$${fmt(dia.total_monto)}`, c: green },
    { l: 'Entregados', v: String(dia.total_entregados), c: white },
    { l: 'Comisión', v: `$${fmt(com)}`, c: amber },
  ]
  const cw = (W - 20 - 8) / 3
  cards.forEach((c, i) => {
    const x = 10 + i * (cw + 4)
    doc.setFillColor(19, 30, 46)
    doc.roundedRect(x, y, cw, 18, 2, 2, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...c.c)
    doc.text(c.v, x + cw / 2, y + 9, { align: 'center' })
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gray)
    doc.text(c.l.toUpperCase(), x + cw / 2, y + 15, { align: 'center' })
  })

  y += 24
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...gray)
  doc.text('DETALLE DE ENTREGAS', 10, y)
  y += 5

  ;(dia.entregas || []).forEach((e, idx) => {
    if (y > 278) { doc.addPage(); doc.setFillColor(...dark); doc.rect(0, 0, W, 297, 'F'); y = 15 }

    doc.setFillColor(idx % 2 === 0 ? 19 : 15, idx % 2 === 0 ? 30 : 24, idx % 2 === 0 ? 46 : 38)
    doc.roundedRect(10, y, W - 20, 16, 1.5, 1.5, 'F')

    const isCancelled = e.tipo === 'cancelado'
    const isParcial   = e.tipo === 'parcial'
    const dotCol = isCancelled ? [239, 68, 68] : e.entregado ? [52, 211, 153] : gray
    doc.setTextColor(...dotCol)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(isCancelled ? '✕' : e.entregado ? '✓' : '–', 15, y + 7)

    doc.setTextColor(...white)
    doc.setFontSize(9)
    doc.text(e.nombre || '', 21, y + 7)

    if (e.direccion) {
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.text(e.direccion, 21, y + 13)
    }

    // Monto / estado
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    if (isCancelled) {
      doc.setTextColor(239, 68, 68)
      doc.text(e.motivo_cancelacion || 'Cancelado', W - 15, y + 7, { align: 'right' })
    } else if (isParcial) {
      doc.setTextColor(...amber)
      doc.text(`$${fmt(e.monto_pagado)} / $${fmt(e.monto_total)}`, W - 15, y + 7, { align: 'right' })
    } else if (e.monto > 0) {
      doc.setTextColor(...green)
      doc.text(`$${fmt(e.monto)}`, W - 15, y + 7, { align: 'right' })
    }

    if (e.metodo_pago) {
      const label = { efectivo: 'Efectivo', transferencia: 'Transfer.', tarjeta: 'Tarjeta' }[e.metodo_pago] || e.metodo_pago
      doc.setFontSize(6.5)
      doc.setTextColor(...gray)
      doc.setFont('helvetica', 'normal')
      doc.text(label, W - 15, y + 13, { align: 'right' })
    }

    y += 19
  })

  doc.setFontSize(6.5)
  doc.setTextColor(...gray)
  doc.text('Generado con VoraRep · vorarep.com', W / 2, 292, { align: 'center' })

  doc.save(`vorarep-${dia.fecha_iso || dia.fecha.replace(/,?\s/g, '-')}.pdf`)
}

const PERIODS = [
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes'    },
  { key: 'todo',   label: 'Todo'        },
]

export default function HistorialScreen() {
  const historialRaw       = useStore(s => s.historial)
  const openModal          = useStore(s => s.openModal)
  const deleteHistorialDia = useStore(s => s.deleteHistorialDia)
  const perfil             = useStore(s => s.perfil)
  const setTab             = useStore(s => s.setTab)
  const { isLimited }      = useFreemium()
  const [period, setPeriod]         = useState('semana')
  const [expanded, setExpanded]     = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteText, setDeleteText] = useState('')

  // Freemium: only last 7 days visible when trial expired
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const historial = isLimited
    ? historialRaw.filter(d => {
        const t = d.fecha_iso
          ? new Date(d.fecha_iso + 'T12:00:00').getTime()
          : (parseFecha(d.fecha)?.getTime() ?? new Date(d.created_at).getTime())
        return t >= sevenDaysAgo
      })
    : historialRaw

  if (historialRaw.length === 0) {
    return (
      <div className="p-4 text-center pt-16 text-muted">
        <div className="text-[48px] mb-3 opacity-40">📦</div>
        <div className="text-[13px] leading-relaxed">Todavía no hay días finalizados.<br/>Cuando completes una ruta, aparecerá acá.</div>
      </div>
    )
  }

  const { start: wStart, end: wEnd } = getWeekRange()
  const { start: mStart, end: mEnd } = getMonthRange()

  const filtered = historial.filter(d => {
    if (period === 'todo') return true
    // Usar fecha_iso cuando existe (más confiable), luego parsear la fecha en español, luego created_at
    const t = d.fecha_iso
      ? new Date(d.fecha_iso + 'T12:00:00').getTime()
      : (parseFecha(d.fecha)?.getTime() ?? new Date(d.created_at).getTime())
    if (period === 'semana') return t >= wStart.getTime() && t <= wEnd.getTime()
    if (period === 'mes')    return t >= mStart.getTime() && t <= mEnd.getTime()
    return true
  })

  const stats = statsFor(filtered)

  return (
    <div className="p-4">

      {/* Banner freemium historial */}
      {isLimited && (
        <div className="mb-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-amber-400">🔒 Solo últimos 7 días</p>
            <p className="text-[11px] text-muted mt-[2px]">Suscribite para ver todo el historial.</p>
          </div>
          <button
            onClick={() => setTab('planes')}
            className="flex-shrink-0 text-[10px] font-bold text-[#1a1a28] bg-amber-400 px-3 py-[5px] rounded-lg active:scale-95 transition-transform"
          >Ver planes</button>
        </div>
      )}

      {/* Selector de período */}
      <div className="flex bg-surface border border-[var(--c-border)] rounded-xl p-1 mb-4 gap-1">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`flex-1 py-[8px] rounded-lg text-[11px] font-heading font-bold transition-all ${
              period === p.key ? 'bg-amber-400 text-[#1a1a28]' : 'text-muted'
            }`}>{p.label}</button>
        ))}
      </div>

      {/* Stats del período */}
      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Recaudado',  value: fmtMoney(stats.total),    color: 'text-emerald-400' },
              { label: 'Entregas',   value: stats.entregas,            color: 'text-textc'  },
              { label: 'Comisión',   value: fmtMoney(stats.comision),  color: 'text-amber-400'  },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
                <div className={`font-heading text-[15px] font-extrabold ${s.color} leading-tight`}>{s.value}</div>
                <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Desglose por método */}
          {(stats.efectivo > 0 || stats.transferencia > 0 || stats.tarjeta > 0) && (
            <div className="flex gap-2 mb-3">
              {stats.efectivo > 0 && (
                <div className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl px-2 py-[9px] text-center">
                  <div className="text-[12px]">💵</div>
                  <div className="text-[11px] font-bold text-textc">{fmtMoney(stats.efectivo)}</div>
                  <div className="text-[9px] text-muted mt-[1px]">Efectivo</div>
                </div>
              )}
              {stats.transferencia > 0 && (
                <div className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl px-2 py-[9px] text-center">
                  <div className="text-[12px]">🏦</div>
                  <div className="text-[11px] font-bold text-textc">{fmtMoney(stats.transferencia)}</div>
                  <div className="text-[9px] text-muted mt-[1px]">Transfer.</div>
                </div>
              )}
              {stats.tarjeta > 0 && (
                <div className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl px-2 py-[9px] text-center">
                  <div className="text-[12px]">💳</div>
                  <div className="text-[11px] font-bold text-textc">{fmtMoney(stats.tarjeta)}</div>
                  <div className="text-[9px] text-muted mt-[1px]">Tarjeta</div>
                </div>
              )}
            </div>
          )}

          {/* Exportar */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => exportCSV(filtered)}
              className="flex-1 bg-surface2 border border-emerald-500/30 text-emerald-400 font-heading font-bold text-[12px] py-[10px] rounded-xl flex items-center justify-center gap-1 active:bg-emerald-500/10 transition-colors"
            >
              📊 CSV
            </button>
            <button
              onClick={() => exportPeriodoPDF(filtered, stats, PERIODS.find(p => p.key === period)?.label || 'Todo', perfil?.negocio)}
              className="flex-1 bg-surface2 border border-red-400/30 text-red-400 font-heading font-bold text-[12px] py-[10px] rounded-xl flex items-center justify-center gap-1 active:bg-red-400/10 transition-colors"
            >
              📄 PDF resumen
            </button>
          </div>
        </>
      ) : (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-4 text-center mb-4">
          <p className="text-[13px] text-muted">Sin datos para este período</p>
        </div>
      )}

      {/* Lista de días */}
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">
        {filtered.length} día{filtered.length !== 1 ? 's' : ''} registrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.map((dia, di) => {
        const isOpen     = expanded === (dia.id || di)
        const isDeleting = deletingId === (dia.id || di)
        const canDelete  = deleteText.trim().toUpperCase() === 'BORRAR'
        return (
          <div key={dia.id || di} className="mb-3 bg-surface border border-[var(--c-border)] rounded-xl overflow-hidden">
            {/* Day header — tap to expand */}
            <button
              type="button"
              onClick={() => { setExpanded(isOpen ? null : (dia.id || di)); setDeletingId(null); setDeleteText('') }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-amber-400 capitalize">{dia.fecha}</div>
                <div className="flex items-center gap-2 mt-[3px] flex-wrap">
                  <span className="text-[10px] text-muted">{dia.total_entregados}/{dia.total_clientes} entregas</span>
                  <span className="text-[10px] text-amber-400">· Comisión {dia.comision_pct}% = {fmtMoney((+dia.total_monto||0) * (+dia.comision_pct||0) / 100)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-heading font-extrabold text-[15px] text-emerald-400">{fmtMoney(dia.total_monto)}</span>
                <span className="text-muted text-[11px]">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded deliveries */}
            {isOpen && (
              <div className="border-t border-[var(--c-border)] px-4 py-3 flex flex-col gap-[6px]">
                {/* Botón borrar + PDF día */}
                {!isDeleting ? (
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); exportDiaPDF(dia, perfil?.negocio) }}
                      className="text-[10px] text-red-400/80 bg-red-400/10 border border-red-400/20 rounded-lg px-2 py-[5px] font-semibold"
                    >📄 PDF del día</button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDeletingId(dia.id || di); setDeleteText('') }}
                      className="text-[10px] text-red-400/50 underline"
                    >🗑️ Borrar</button>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-2">
                    <p className="text-[11px] text-red-300 mb-2 leading-snug">
                      ¿Eliminar este día del historial? Esta acción no se puede deshacer.<br/>
                      <span className="font-bold">Escribí BORRAR para confirmar.</span>
                    </p>
                    <input
                      type="text"
                      placeholder="Escribí BORRAR"
                      value={deleteText}
                      onChange={e => setDeleteText(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-bg border border-red-500/40 rounded-lg px-3 py-[8px] text-[12px] text-textc outline-none mb-2 placeholder:text-muted"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canDelete}
                        onClick={e => { e.stopPropagation(); deleteHistorialDia(dia.id); setDeletingId(null); setDeleteText('') }}
                        className={`flex-1 py-[8px] rounded-lg text-[11px] font-bold transition-all ${canDelete ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-500/40 cursor-not-allowed'}`}
                      >Borrar día</button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setDeletingId(null); setDeleteText('') }}
                        className="flex-1 py-[8px] rounded-lg text-[11px] font-bold bg-surface2 text-muted"
                      >Cancelar</button>
                    </div>
                  </div>
                )}

                {(dia.entregas || []).map((e, ei) => {
                  const isCancelled = e.tipo === 'cancelado'
                  const isParcial   = e.tipo === 'parcial'
                  const isDevol     = e.tipo === 'devolucion'
                  return (
                    <div key={ei} className="flex items-start gap-3">
                      <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-[1px] ${
                        isCancelled ? 'bg-red-500 text-white' :
                        isParcial   ? 'bg-amber-500 text-white' :
                        e.entregado ? 'bg-emerald-500 text-white' :
                                      'bg-surface2 text-muted'
                      }`}>{isCancelled ? '✕' : isParcial ? '$' : e.entregado ? '✓' : '–'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-[13px] font-medium text-textc truncate">{e.nombre}</div>
                          <button
                            onClick={() => openModal('entrega', { clienteId: e.id, clienteNombre: e.nombre, clienteDir: e.direccion, editData: e, historialId: dia.id, entregaIdx: ei })}
                            className="flex-shrink-0 bg-surface2 border border-[var(--c-border2)] text-muted text-[10px] font-semibold px-2 py-[3px] rounded-lg"
                          >✏️ Editar</button>
                        </div>
                        {e.direccion && <div className="text-[10px] text-muted truncate">{e.direccion}</div>}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-[2px]">
                          {e.hora && <span className="text-[10px] text-muted">{e.hora}</span>}
                          {isCancelled ? (
                            <span className="text-[10px] text-red-400 italic">{e.motivo_cancelacion || 'Cancelado'}</span>
                          ) : isParcial ? (
                            <>
                              <span className="text-[10px] text-amber-400 font-bold">Pagó {fmtMoney(e.monto_pagado)} de {fmtMoney(e.monto_total)}</span>
                              {e.deuda_generada > 0 && <span className="text-[10px] text-red-400">Deuda +{fmtMoney(e.deuda_generada)}</span>}
                              {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago] || '💰'}</span>}
                            </>
                          ) : isDevol ? (
                            <>
                              <span className="text-[10px] text-blue-400">Dev. {fmtMoney(e.monto_devolucion)}</span>
                              <span className="text-[10px] font-bold text-emerald-400">Cobrado {fmtMoney(e.monto)}</span>
                              {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago] || '💰'}</span>}
                            </>
                          ) : (
                            <>
                              {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago] || '💰'} {e.metodo_pago}</span>}
                              {e.monto > 0 && <span className="text-[10px] font-bold text-emerald-400">{fmtMoney(e.monto)}</span>}
                            </>
                          )}
                          {e.obs && <span className="text-[10px] text-muted italic">{e.obs}</span>}
                        </div>
                        {(() => {
                          const urls = e.foto_urls?.length ? e.foto_urls : e.foto_url ? [e.foto_url] : []
                          return urls.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {urls.map((url, ui) => (
                                <a key={ui} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt="Comprobante" className="h-16 w-24 object-cover rounded-lg border border-[var(--c-border2)]" />
                                </a>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <div className="h-8" />
    </div>
  )
}
