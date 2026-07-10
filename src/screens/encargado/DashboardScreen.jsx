import { useState, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'
import RepartidorDetalleModal from '../../modals/RepartidorDetalleModal'

function fmt(n)      { return Math.round(Number(n) || 0).toLocaleString('es-AR') }
function fmtMoney(n) { return '$' + fmt(n) }
function hoyISO()    { return new Date().toISOString().slice(0, 10) }
function hoyLabel()  {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// diaInicio: 0=dom, 1=lun, ... 6=sáb
function calcWeekStart(diaInicio = 1) {
  const now = new Date()
  const daysBack = (now.getDay() - diaInicio + 7) % 7
  const d = new Date(now)
  d.setDate(now.getDate() - daysBack)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function calcPrevWeekRange(diaInicio = 1) {
  const start = new Date(calcWeekStart(diaInicio) + 'T00:00:00')
  const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7)
  const prevEnd   = new Date(start); prevEnd.setDate(start.getDate() - 1)
  return { from: prevStart.toISOString().slice(0, 10), to: prevEnd.toISOString().slice(0, 10) }
}

function getEfectivoRepartidor(entregas = []) {
  return (entregas || [])
    .filter(e => e.metodo_pago === 'efectivo' && ['entregado', 'parcial'].includes(e.tipo))
    .reduce((s, e) => s + (+e.monto || 0), 0)
}

function semaforo(entregados, total) {
  if (!total) return null
  const pct = (entregados / total) * 100
  if (pct >= 100) return 'completo'
  if (pct >= 70)  return 'verde'
  if (pct >= 35)  return 'amarillo'
  return 'rojo'
}

const SEMAFORO_COLOR = {
  completo: '#22c55e',
  verde:    '#22c55e',
  amarillo: '#f59e0b',
  rojo:     '#ef4444',
}

const SEMAFORO_LABEL = {
  completo: 'Completo',
  verde:    'En curso',
  amarillo: 'Atrasado',
  rojo:     'Demorado',
}

export default function DashboardScreen() {
  const perfil = useStore(s => s.perfil)

  const [resumenHoy,    setResumenHoy]    = useState([])
  const [resumenSemana, setResumenSemana] = useState(null)
  const [resumenPrevSem, setResumenPrevSem] = useState(null)
  const [diaInicio,     setDiaInicio]     = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [exporting,     setExporting]     = useState(false)
  const [detalle,       setDetalle]       = useState(null)

  const channelRef = useRef(null)

  useEffect(() => {
    fetchDiaInicio().then(dia => fetchData(dia))

    // Realtime
    channelRef.current = supabase
      .channel('dash_sesion_activa')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesion_activa' },
        () => fetchData(diaInicioRef.current))
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  // Ref para acceder al dia en el callback de realtime sin stale closure
  const diaInicioRef = useRef(1)

  const fetchDiaInicio = async () => {
    const { data: eq } = await supabase
      .from('equipos')
      .select('dia_inicio_semana')
      .eq('owner_id', perfil.id)
      .maybeSingle()
    const dia = eq?.dia_inicio_semana ?? 1
    setDiaInicio(dia)
    diaInicioRef.current = dia
    return dia
  }

  const fetchData = async (dia = 1) => {
    setLoading(true)
    const hoy = hoyISO()

    // ── Hoy ──────────────────────────────────────────────────────────
    const { data: sesiones } = await supabase
      .from('sesion_activa')
      .select('user_id, fecha_iso, total_clientes, total_entregados, total_monto, comision_pct, entregas')
      .eq('fecha_iso', hoy)

    if (sesiones?.length) {
      const ids = sesiones.map(s => s.user_id)
      const { data: perfs } = await supabase.from('profiles').select('id, negocio, nombre').in('id', ids)
      const map = Object.fromEntries((perfs || []).map(p => [p.id, p]))
      sesiones.forEach(s => { s.profiles = map[s.user_id] || null })
    }

    // ── Semana actual ─────────────────────────────────────────────────
    const weekStart = calcWeekStart(dia)
    const { data: hist } = await supabase
      .from('historial')
      .select('total_monto, total_entregados, comision_pct')
      .gte('fecha_iso', weekStart)

    // ── Semana anterior ───────────────────────────────────────────────
    const { from, to } = calcPrevWeekRange(dia)
    const { data: histPrev } = await supabase
      .from('historial')
      .select('total_monto, total_entregados, comision_pct')
      .gte('fecha_iso', from)
      .lte('fecha_iso', to)

    setResumenHoy(sesiones || [])

    if (hist?.length) {
      setResumenSemana({
        totalMonto:    hist.reduce((s, d) => s + (+d.total_monto || 0), 0),
        totalEntregas: hist.reduce((s, d) => s + (+d.total_entregados || 0), 0),
        totalCom:      hist.reduce((s, d) => s + (+d.total_monto || 0) * ((+d.comision_pct || 0) / 100), 0),
      })
    } else {
      setResumenSemana(null)
    }

    if (histPrev?.length) {
      setResumenPrevSem({
        totalMonto: histPrev.reduce((s, d) => s + (+d.total_monto || 0), 0),
      })
    } else {
      setResumenPrevSem(null)
    }

    setLoading(false)
  }

  // ── PDF (sin cambios) ─────────────────────────────────────────────
  const exportPDF = () => {
    setExporting(true)
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210; const margin = 14; let y = 14
      doc.setFillColor(11, 19, 32); doc.rect(0, 0, W, 28, 'F')
      doc.setTextColor(255, 196, 0); doc.setFontSize(18); doc.setFont('helvetica', 'bold')
      doc.text('VoraRep', margin, 13)
      doc.setTextColor(180, 180, 200); doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text(perfil?.negocio || 'Resumen del equipo', margin, 20)
      doc.text(hoyLabel(), W - margin, 20, { align: 'right' })
      y = 36
      const totalMonto    = resumenHoy.reduce((s, r) => s + (+r.total_monto || 0), 0)
      const totalEntregas = resumenHoy.reduce((s, r) => s + (+r.total_entregados || 0), 0)
      const totalClientes = resumenHoy.reduce((s, r) => s + (+r.total_clientes || 0), 0)
      const totalCom      = resumenHoy.reduce((s, r) => s + (+r.total_monto || 0) * ((+r.comision_pct || 0) / 100), 0)
      doc.setFillColor(241, 242, 245); doc.roundedRect(margin, y, W - margin * 2, 24, 3, 3, 'F')
      doc.setTextColor(50, 50, 70); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
      doc.text('RESUMEN DEL DÍA', margin + 4, y + 6)
      const cols = [
        { label: 'Recaudado',   value: fmtMoney(totalMonto) },
        { label: 'Entregas',    value: `${totalEntregas}/${totalClientes}` },
        { label: 'Comisiones',  value: fmtMoney(totalCom) },
        { label: 'Repartidores', value: `${resumenHoy.length}` },
      ]
      const colW = (W - margin * 2 - 8) / 4
      cols.forEach((c, i) => {
        const cx = margin + 4 + i * colW
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.setTextColor(i === 0 ? 34 : 50, i === 0 ? 197 : 50, i === 0 ? 94 : 70)
        doc.text(c.value, cx, y + 16)
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 140)
        doc.text(c.label.toUpperCase(), cx, y + 21)
      })
      y += 32
      if (resumenHoy.length === 0) {
        doc.setTextColor(150, 150, 170); doc.setFontSize(11)
        doc.text('Ningún repartidor activo hoy.', margin, y + 6); y += 14
      } else {
        doc.setTextColor(80, 80, 100); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
        doc.text('DETALLE POR REPARTIDOR', margin, y); y += 5
        resumenHoy.forEach((r, idx) => {
          const nombre   = r.profiles?.negocio || r.profiles?.nombre || 'Repartidor'
          const monto    = +r.total_monto || 0
          const comision = monto * ((+r.comision_pct || 0) / 100)
          const pct      = r.total_clientes > 0 ? Math.round((r.total_entregados / r.total_clientes) * 100) : 0
          const cardH    = estimateCardH(r)
          if (y + cardH > 280) { doc.addPage(); y = 14 }
          const fillColor = idx % 2 === 0 ? [250, 250, 255] : [245, 246, 252]
          doc.setFillColor(...fillColor); doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, 'F')
          doc.setDrawColor(220, 220, 235); doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, 'S')
          doc.setTextColor(30, 30, 50); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
          doc.text(nombre, margin + 4, y + 8)
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 120)
          doc.text(`${r.total_entregados}/${r.total_clientes} entregas · ${pct}% completado`, margin + 4, y + 14)
          doc.setFillColor(220, 220, 235); doc.roundedRect(margin + 4, y + 17, W - margin * 2 - 8, 3, 1, 1, 'F')
          if (pct > 0) { doc.setFillColor(34, 197, 94); doc.roundedRect(margin + 4, y + 17, ((W - margin * 2 - 8) * pct) / 100, 3, 1, 1, 'F') }
          doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(34, 197, 94)
          doc.text(fmtMoney(monto), W - margin - 4, y + 8, { align: 'right' })
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(251, 191, 36)
          doc.text(`com. ${fmtMoney(comision)}`, W - margin - 4, y + 14, { align: 'right' })
          const entregas = Array.isArray(r.entregas) ? r.entregas.filter(e => e.tipo) : []
          if (entregas.length > 0) {
            let ey = y + 24
            entregas.forEach(e => {
              const tipoIcon = { entregado: '✓', parcial: '~', devolucion: '↩', cancelado: '✗' }[e.tipo] || '·'
              const tipoColor = { entregado: [34, 197, 94], parcial: [251, 191, 36], devolucion: [59, 130, 246], cancelado: [239, 68, 68] }[e.tipo] || [120, 120, 140]
              doc.setTextColor(...tipoColor); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
              doc.text(tipoIcon, margin + 6, ey)
              doc.setTextColor(60, 60, 80); doc.setFont('helvetica', 'normal')
              const clienteNombre = e.nombre || e.razon_social || `Cliente #${e.id?.slice?.(0, 6) || '?'}`
              doc.text(clienteNombre, margin + 11, ey)
              if (e.monto && e.tipo !== 'cancelado') {
                doc.setTextColor(80, 80, 100); doc.text(fmtMoney(e.monto), W - margin - 4, ey, { align: 'right' })
              }
              ey += 5
            })
          }
          y += cardH + 3
        })
      }
      if (y > 265) { doc.addPage(); y = 14 }
      doc.setDrawColor(200, 200, 220); doc.line(margin, y + 4, W - margin, y + 4)
      doc.setFontSize(7); doc.setTextColor(160, 160, 180); doc.setFont('helvetica', 'normal')
      doc.text(`Generado con VoraRep · ${new Date().toLocaleString('es-AR')}`, margin, y + 10)
      doc.save(`vorarep-${perfil?.negocio || 'equipo'}-${hoyISO()}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-[13px] text-muted">Cargando datos del equipo...</p>
      </div>
    )
  }

  const ranked = [...resumenHoy].sort((a, b) => (+b.total_monto || 0) - (+a.total_monto || 0))

  const totalHoyMonto    = resumenHoy.reduce((s, r) => s + (+r.total_monto || 0), 0)
  const totalHoyEntregas = resumenHoy.reduce((s, r) => s + (+r.total_entregados || 0), 0)
  const totalHoyClientes = resumenHoy.reduce((s, r) => s + (+r.total_clientes || 0), 0)
  const totalEfectivo    = resumenHoy.reduce((s, r) => s + getEfectivoRepartidor(r.entregas), 0)

  const varPct = resumenPrevSem?.totalMonto > 0 && resumenSemana
    ? Math.round(((resumenSemana.totalMonto - resumenPrevSem.totalMonto) / resumenPrevSem.totalMonto) * 100)
    : null

  return (
    <div className="p-4">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-heading text-[18px] font-extrabold text-textc">
            {perfil?.negocio || 'Dashboard'}
          </h2>
          <p className="text-[12px] text-muted">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={exportPDF}
          disabled={exporting || resumenHoy.length === 0}
          className="flex items-center gap-[6px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-heading font-bold text-[11px] px-3 py-[8px] rounded-xl active:scale-95 transition-all disabled:opacity-40"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {exporting ? 'Generando...' : 'PDF'}
        </button>
      </div>

      {/* ── Stats hoy ──────────────────────────────── */}
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">Equipo — hoy</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Recaudado',  value: `$${fmt(totalHoyMonto)}`,              color: 'text-emerald-400' },
          { label: 'Entregas',   value: `${totalHoyEntregas}/${totalHoyClientes}`, color: 'text-textc'   },
          { label: 'Pendientes', value: totalHoyClientes - totalHoyEntregas,   color: 'text-amber-400'  },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-[var(--c-border)] rounded-xl p-3 text-center">
            <div className={`font-heading text-[17px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Semana + comparativa ───────────────────── */}
      {resumenSemana && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px]">Esta semana</p>
            {varPct !== null && (
              <span className={`text-[10px] font-bold px-2 py-[2px] rounded-full ${
                varPct >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
              }`}>
                {varPct >= 0 ? '↑' : '↓'} {Math.abs(varPct)}% vs sem. ant.
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total',    value: `$${fmt(resumenSemana.totalMonto)}`,   color: 'text-emerald-400' },
              { label: 'Entregas', value: resumenSemana.totalEntregas,            color: 'text-textc'       },
              { label: 'Comisión', value: `$${fmt(resumenSemana.totalCom)}`,     color: 'text-amber-400'   },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-[var(--c-border)] rounded-xl p-3 text-center">
                <div className={`font-heading text-[17px] font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Efectivo en calle ──────────────────────── */}
      {totalEfectivo > 0 && (
        <div className="bg-amber-400/5 border border-amber-400/25 rounded-xl px-4 py-3 mb-4">
          <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-[.8px] mb-[2px]">
            Efectivo en calle
          </p>
          <p className="font-heading text-[22px] font-extrabold text-amber-400">
            {fmtMoney(totalEfectivo)}
          </p>
          <p className="text-[11px] text-muted mt-[2px]">
            Entre {resumenHoy.filter(r => getEfectivoRepartidor(r.entregas) > 0).length} repartidor
            {resumenHoy.filter(r => getEfectivoRepartidor(r.entregas) > 0).length !== 1 ? 'es' : ''}
          </p>
        </div>
      )}

      {/* ── Ranking ────────────────────────────────── */}
      <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-2">
        Repartidores hoy ({resumenHoy.length})
      </p>

      {resumenHoy.length === 0 ? (
        <div className="bg-surface border border-[var(--c-border)] rounded-xl p-6 text-center mb-4">
          <p className="text-[12px] text-muted">Ningún repartidor activo hoy todavía.</p>
        </div>
      ) : (
        ranked.map((r, idx) => {
          const nombre    = r.profiles?.negocio || r.profiles?.nombre || 'Repartidor'
          const pct       = r.total_clientes > 0 ? Math.round((r.total_entregados / r.total_clientes) * 100) : 0
          const comision  = (+r.total_monto || 0) * ((+r.comision_pct || 0) / 100)
          const efectivo  = getEfectivoRepartidor(r.entregas)
          const estado    = semaforo(r.total_entregados, r.total_clientes)
          const color     = SEMAFORO_COLOR[estado]
          const label     = SEMAFORO_LABEL[estado]

          return (
            <div
              key={r.user_id}
              className="bg-surface border border-[var(--c-border)] rounded-xl p-4 mb-2 active:opacity-70 transition-opacity cursor-pointer"
              style={{ borderLeft: `3px solid ${color}` }}
              onClick={() => setDetalle(r)}
            >
              {/* Fila principal */}
              <div className="flex items-start gap-3 mb-3">
                {/* Posición */}
                <div className="text-[11px] font-heading font-extrabold text-muted w-[18px] flex-shrink-0 pt-[1px]">
                  {idx + 1}
                </div>

                {/* Nombre + estado */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-[2px]">
                    <span className="text-[13px] font-bold text-textc truncate">{nombre}</span>
                    <span
                      className="text-[9px] font-bold px-[6px] py-[2px] rounded-full flex-shrink-0"
                      style={{ color, background: color + '18' }}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {r.total_entregados}/{r.total_clientes} entregas
                    {efectivo > 0 && (
                      <span className="text-amber-400 ml-2">· ef. {fmtMoney(efectivo)}</span>
                    )}
                  </div>
                </div>

                {/* Montos */}
                <div className="text-right flex-shrink-0">
                  <div className="font-heading text-[15px] font-extrabold text-emerald-400">
                    {fmtMoney(r.total_monto)}
                  </div>
                  <div className="text-[10px] text-amber-400">com. {fmtMoney(comision)}</div>
                </div>
              </div>

              {/* Barra progreso */}
              <div className="w-full h-[4px] bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="flex items-center justify-between mt-[5px]">
                <p className="text-[9px] text-muted">{pct}% completado</p>
                <p className="text-[9px] text-muted/40">Ver detalle →</p>
              </div>
            </div>
          )
        })
      )}

      <button
        onClick={() => fetchData(diaInicio)}
        className="w-full mt-2 bg-surface border border-[var(--c-border)] rounded-xl py-[10px] text-[12px] text-muted font-semibold"
      >
        Actualizar
      </button>

      <div className="h-16" />

      <RepartidorDetalleModal
        repartidor={detalle}
        onClose={() => setDetalle(null)}
      />
    </div>
  )
}

function estimateCardH(r) {
  const entregas = Array.isArray(r.entregas) ? r.entregas.filter(e => e.tipo) : []
  return 24 + (entregas.length > 0 ? entregas.length * 5 + 2 : 0)
}
