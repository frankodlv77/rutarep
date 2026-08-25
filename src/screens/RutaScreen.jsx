import { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import { useGeolocation } from '../hooks/useGeolocation'

function fmtMoney(n) {
  if (!n) return '$0'
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

const PAGO_ICONS = { transferencia: '🏦', tarjeta: '💳', efectivo: '💵', otro: '❓' }

const vibrar = (patron = [60]) => { try { navigator.vibrate?.(patron) } catch (_) {} }

function ModoConductor({ list, entregas, onSalir, openModal }) {
  const pendientes = list.filter(c => !entregas[c.id])
  const entregados = list.filter(c => entregas[c.id]).length
  const [idx, setIdx]         = useState(0)
  const [swipeX, setSwipeX]   = useState(null)
  const [dragX, setDragX]     = useState(0)
  const [hint, setHint]       = useState(true)

  useEffect(() => {
    if (pendientes.length === 0) return
    if (idx >= pendientes.length) setIdx(pendientes.length - 1)
  }, [pendientes.length])

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 2500)
    return () => clearTimeout(t)
  }, [])

  const irSiguiente = () => {
    vibrar([40, 20, 40])
    setIdx(i => (i + 1) % pendientes.length)
  }

  const registrarEntrega = () => {
    vibrar([80])
    openModal('entrega', { clienteId: c.id, clienteNombre: c.nombre, clienteDir: c.direccion, clienteDeuda: deuda })
  }

  const onTouchStart = e => {
    setSwipeX(e.touches[0].clientX)
    setDragX(0)
  }
  const onTouchMove = e => {
    if (swipeX === null) return
    setDragX(e.touches[0].clientX - swipeX)
  }
  const onTouchEnd = () => {
    if (Math.abs(dragX) > 80) {
      if (dragX > 0) {
        registrarEntrega()
      } else {
        if (pendientes.length > 1) irSiguiente()
      }
    }
    setSwipeX(null)
    setDragX(0)
  }

  const navGPS = (lat, lon)    => { window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving` }
  const navDir = (dir, nombre) => { window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir || nombre + ' Mendoza')}&travelmode=driving` }

  if (pendientes.length === 0) {
    return (
      <div className="fixed inset-0 z-[500] bg-bg flex flex-col items-center justify-center text-center px-8">
        <div className="text-[72px] mb-4">🎉</div>
        <div className="font-heading text-[28px] font-extrabold mb-2" style={{ color: '#34C759' }}>¡Todo entregado!</div>
        <div className="text-[14px] text-muted mb-8">{entregados} de {list.length} paradas completadas</div>
        <button onClick={onSalir} className="font-heading font-bold text-[16px] px-8 py-4 rounded-2xl w-full max-w-[300px]" style={{ background: '#D4962A', color: '#0C0C0E' }}>
          Volver a la ruta
        </button>
      </div>
    )
  }

  const c = pendientes[idx]
  const deuda = c.deuda || 0
  const numParada = list.indexOf(c) + 1

  const swipeingRight = dragX > 40
  const swipeingLeft  = dragX < -40

  return (
    <div
      className="fixed inset-0 conductor-overlay z-[500] select-none transition-colors duration-150 flex flex-col"
      style={{
        background: swipeingRight ? '#0d2318' : swipeingLeft ? '#1a1008' : '#060e1a',
        transform: `translateX(${dragX * 0.12}px)`,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {swipeingRight && <div className="absolute inset-y-0 right-0 w-[6px] rounded-l-full" style={{ background: 'rgba(52,199,89,0.6)' }} />}
      {swipeingLeft && pendientes.length > 1 && <div className="absolute inset-y-0 left-0 w-[6px] rounded-r-full" style={{ background: 'rgba(212,150,42,0.6)' }} />}

      {/* Top — flex-shrink-0 */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--c-border)]">
        <span className="text-[12px] text-muted">🚗 Modo conductor</span>
        <span className="text-[12px] text-muted">{entregados} entregados · {pendientes.length} pendientes</span>
      </div>
      <div className="flex-shrink-0 flex gap-[5px] px-5 pt-3 pb-1 overflow-x-auto hide-scrollbar">
        {list.map(cl => (
          <div key={cl.id} className="h-[4px] flex-1 rounded-full min-w-[8px] transition-colors"
            style={{ background: entregas[cl.id] ? '#34C759' : cl.id === c.id ? '#D4962A' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>
      {hint && (
        <div className="flex-shrink-0 flex justify-between px-6 pt-2">
          <span className="text-[11px] text-muted opacity-70">← saltar</span>
          <span className="text-[11px] text-muted opacity-70">entregar →</span>
        </div>
      )}

      {/* Content — flex-1 scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="text-[12px] font-bold uppercase tracking-[1px] mb-2" style={{ color: 'var(--c-muted)' }}>
          Parada {numParada} de {list.length}
        </div>
        <div className="font-heading font-extrabold text-[26px] leading-[1.1] text-textc mb-2 break-words">{c.nombre}</div>
        <div className="text-[14px] mb-3 leading-snug" style={{ color: 'var(--c-muted)' }}>{c.direccion || 'Sin dirección registrada'}</div>
        {c.notas && (
          <div className="rounded-xl px-4 py-3 mb-3" style={{ background: 'rgba(212,150,42,0.08)', border: '1px solid rgba(212,150,42,0.2)' }}>
            <p className="text-[13px]" style={{ color: '#D4962A' }}>📝 {c.notas}</p>
          </div>
        )}
        {deuda > 0 && (
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}>
            <p className="text-[14px] font-bold" style={{ color: '#FF453A' }}>⚠️ Debe {fmtMoney(deuda)}</p>
          </div>
        )}
      </div>

      {/* Buttons — flex-shrink-0, always visible at bottom */}
      <div className="conductor-buttons flex-shrink-0 px-5 flex flex-col gap-[6px] pt-1">
        <button
          onClick={() => c.lat ? navGPS(c.lat, c.lon) : navDir(c.direccion, c.nombre)}
          className="w-full font-heading font-bold text-[14px] py-[10px] rounded-2xl flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
          style={{ background: '#16161A', border: '1px solid rgba(255,255,255,0.1)', color: '#F2F2F7' }}
        >🧭 Navegar</button>
        <button
          onClick={registrarEntrega}
          className="w-full font-heading font-extrabold text-[16px] py-[12px] rounded-2xl active:scale-[.98] transition-transform"
          style={{ background: '#34C759', color: '#fff' }}
        >✅ Registrar entrega</button>
        {pendientes.length > 1 && (
          <button onClick={irSiguiente} className="w-full text-[12px] font-semibold py-[5px]" style={{ color: 'var(--c-muted)' }}>
            Saltar → siguiente pendiente
          </button>
        )}
        <button
          onClick={onSalir}
          className="w-full font-heading font-bold text-[13px] py-[10px] rounded-2xl active:scale-[.98] transition-transform"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F2F2F7' }}
        >← Salir del modo conductor</button>
      </div>
    </div>
  )
}

export default function RutaScreen() {
  const clientes            = useStore(s => s.clientes)
  const hoy                 = useStore(s => s.hoy)
  const entregas            = useStore(s => s.entregas)
  const openModal           = useStore(s => s.openModal)
  const comisionPct         = useStore(s => s.comisionPct)
  const setTab              = useStore(s => s.setTab)
  const reordenarPendientes = useStore(s => s.reordenarPendientes)

  const [showComplete, setShowComplete]     = useState(false)
  const [showCierre, setShowCierre]         = useState(false)
  const [confirmText, setConfirmText]       = useState('')
  const [reordenando, setReordenando]       = useState(false)
  const [modoConductor, setModoConductor]   = useState(false)
  const finalizarDia = useStore(s => s.finalizarDia)

  const { pos, loading: gpsLoading, getPos } = useGeolocation()

  useEffect(() => {
    if (pos && reordenando) {
      reordenarPendientes(pos.lat, pos.lon)
      setReordenando(false)
    }
  }, [pos])

  if (hoy.length === 0) {
    return (
      <div className="p-4 text-center pt-16 text-muted">
        <div className="text-[48px] mb-3 opacity-40">🗺️</div>
        <div className="text-[13px] leading-relaxed">Seleccioná clientes en la pestaña <strong className="text-textc">Hoy</strong><br/>para armar la ruta del día.</div>
        <button
          onClick={() => setTab('hoy')}
          className="mt-6 font-heading font-bold text-[13px] px-6 py-3 rounded-xl"
          style={{ background: '#D4962A', color: '#0C0C0E' }}
        >Ir a Hoy →</button>
      </div>
    )
  }

  const list = hoy.map(id => clientes.find(c => c.id === id)).filter(Boolean)
  const totalEnt    = list.filter(c => entregas[c.id]).length
  const pct         = Math.round((totalEnt / list.length) * 100)
  const totalMonto  = Object.values(entregas).reduce((s, e) => s + (+e.monto || 0), 0)
  const comision    = totalMonto * (comisionPct / 100)
  const allDone     = totalEnt === list.length

  const entregadosCount = Object.values(entregas).filter(e => e.tipo === 'entregado' || e.tipo === 'devolucion').length
  const canceladosCount = Object.values(entregas).filter(e => e.tipo === 'cancelado').length
  const parcialesCount  = Object.values(entregas).filter(e => e.tipo === 'parcial').length
  let pagoEfectivo = 0, pagoTransf = 0, pagoTarjeta = 0, pagoOtro = 0
  Object.values(entregas).forEach(e => {
    if (e.tipo === 'cancelado') return
    const m = +e.monto || 0
    if      (e.metodo_pago === 'efectivo')      pagoEfectivo += m
    else if (e.metodo_pago === 'transferencia') pagoTransf   += m
    else if (e.metodo_pago === 'tarjeta')       pagoTarjeta  += m
    else if (m > 0)                              pagoOtro     += m
  })
  const pagosBreakdown = [
    { label: 'Efectivo',      icon: '💵', value: pagoEfectivo },
    { label: 'Transferencia', icon: '🏦', value: pagoTransf },
    { label: 'Tarjeta',       icon: '💳', value: pagoTarjeta },
    { label: 'Otro',          icon: '❓', value: pagoOtro },
  ].filter(p => p.value > 0)
  const deudasCobradas = list.reduce((s, c) => s + (entregas[c.id]?.cobro_deuda ? (+c.deuda || 0) : 0), 0)
  const deudasNuevas   = Object.values(entregas).reduce((s, e) => s + (e.tipo === 'parcial' ? (+e.deuda_generada || 0) : 0), 0)

  const pendingWithGPS = list.filter(c => !entregas[c.id] && c.lat && c.lon)
  const canReorder     = pendingWithGPS.length >= 2

  const handleReordenar = () => {
    if (!canReorder) return
    if (pos) {
      reordenarPendientes(pos.lat, pos.lon)
    } else {
      setReordenando(true)
      getPos()
    }
  }

  const navGPS = (lat, lon)    => { window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving` }
  const navDir = (dir, nombre) => { window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir || nombre + ' Mendoza')}&travelmode=driving` }

  return (
    <div className="p-4">
      {modoConductor && (
        <ModoConductor
          list={list}
          entregas={entregas}
          clientes={clientes}
          onSalir={() => setModoConductor(false)}
          openModal={openModal}
        />
      )}

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 style={{ fontFamily: "'General Sans', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: '-1px', color: 'var(--c-text)', lineHeight: 1.1 }}>
            Ruta
          </h1>
          <p style={{ fontSize: 11, color: 'var(--c-muted2)', marginTop: 3 }}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {list.length} parada{list.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Total amount pill */}
        {totalMonto > 0 && (
          <div
            className="rounded-xl px-3 py-[6px]"
            style={{ background: 'var(--c-surface)', border: '1px solid rgba(212,150,42,0.18)' }}
          >
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 500, color: '#D4962A' }}>
              {fmtMoney(totalMonto)}
            </span>
          </div>
        )}
      </div>

      {/* ── Driver mode button ────────────────────────────────────────── */}
      {!allDone && (
        <button
          onClick={() => setModoConductor(true)}
          className="w-full font-heading font-extrabold text-[14px] py-[14px] rounded-2xl mb-3 flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
          style={{ background: '#D4962A', color: '#0C0C0E' }}
        >
          🚗 Entrar a modo conductor
        </button>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="flex mb-3" style={{ background: 'var(--c-surface)', borderRadius: 14, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
        {[
          { n: list.length - totalEnt, color: '#D4962A', label: 'Faltan'  },
          { n: totalEnt,               color: '#34C759', label: 'Listos'  },
          { n: `${pct}%`,              color: 'var(--c-text)', label: 'Avance'  },
        ].map((s, i) => (
          <div key={s.label} className="flex-1 text-center py-3" style={i > 0 ? { borderLeft: '0.5px solid var(--c-border)' } : {}}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.n}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--c-muted3)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'var(--c-surface)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#34C759' }} />
      </div>
      <p className="text-[10px] text-right mb-3" style={{ color: 'var(--c-muted)' }}>{totalEnt} de {list.length} entregas</p>

      {/* ── Day total card ────────────────────────────────────────────── */}
      <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Total del día</span>
          <span className="font-heading font-extrabold text-[18px]" style={{ color: '#34C759', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(totalMonto)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Comisión</span>
            <div className="flex items-center rounded-lg overflow-hidden" style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={comisionPct}
                onChange={e => {
                  const v = Math.min(100, Math.max(0, +e.target.value || 0))
                  useStore.getState().setComisionPct(v)
                }}
                className="w-[44px] bg-transparent px-2 py-1 text-[12px] font-bold outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{ color: '#D4962A', caretColor: '#D4962A' }}
              />
              <span className="text-[11px] font-bold pr-2" style={{ color: '#D4962A' }}>%</span>
            </div>
          </div>
          <span className="font-heading font-bold text-[15px]" style={{ color: '#D4962A', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(comision)}</span>
        </div>
      </div>

      {/* ── Reorder button ────────────────────────────────────────────── */}
      {canReorder && (
        <button
          onClick={handleReordenar}
          disabled={reordenando && gpsLoading}
          className="w-full font-heading font-bold text-[12px] py-[10px] rounded-xl mb-3 flex items-center justify-center gap-2 transition-colors"
          style={{ background: 'var(--c-surface)', border: '1px solid rgba(212,150,42,0.3)', color: '#D4962A' }}
        >
          {reordenando && gpsLoading ? '📍 Localizando...' : '🧭 Reordenar pendientes por cercanía'}
        </button>
      )}

      {/* ── All done banner ───────────────────────────────────────────── */}
      {allDone && (
        <div className="rounded-xl p-5 mb-4 text-center" style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)' }}>
          <div className="text-[40px] mb-2">🎉</div>
          <div className="font-heading font-extrabold text-[17px] mb-1" style={{ color: '#34C759' }}>¡Ruta completada!</div>
          <div className="text-[12px] mb-4" style={{ color: 'var(--c-muted)' }}>Todas las entregas están listas.</div>
          <button
            onClick={() => setShowComplete(true)}
            className="font-heading font-bold text-[13px] px-6 py-3 rounded-xl w-full"
            style={{ background: '#34C759', color: '#fff' }}
          >Finalizar y guardar día</button>
        </div>
      )}

      <p className="text-[10px] font-bold uppercase mb-3" style={{ color: 'var(--c-muted3)', letterSpacing: '1.8px' }}>Paradas de hoy</p>

      {/* ── Stops ─────────────────────────────────────────────────────── */}
      {list.map((c, i) => {
        const e           = entregas[c.id]
        const done        = !!e
        const isCancelled = done && e.tipo === 'cancelado'
        const isParcial   = done && e.tipo === 'parcial'
        const isDevol     = done && e.tipo === 'devolucion'
        const isNext      = !done && list.slice(0, i).every(prev => entregas[prev.id])
        const deudaC      = c.deuda || 0

        const circleStyle = isCancelled
          ? { background: '#FF453A', borderColor: '#FF453A', color: '#fff' }
          : isParcial
          ? { background: '#D4962A', borderColor: '#D4962A', color: '#0C0C0E' }
          : done
          ? { background: '#34C759', borderColor: '#34C759', color: '#fff' }
          : isNext
          ? { background: '#D4962A', borderColor: '#D4962A', color: '#0C0C0E' }
          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--c-muted)' }

        const cardStyle = isCancelled
          ? { opacity: 0.5, background: 'var(--c-surface)', border: '1px solid rgba(255,69,58,0.15)' }
          : isParcial
          ? { opacity: 0.65, background: 'var(--c-surface)', border: '1px solid rgba(212,150,42,0.2)' }
          : done
          ? { opacity: 0.4, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }
          : isNext
          ? { background: 'var(--c-surface)', border: '1px solid #D4962A' }
          : { background: 'var(--c-surface)', border: '1px solid var(--c-border)' }

        const badgeStyle = isCancelled
          ? { background: 'rgba(255,69,58,0.15)', color: '#FF453A' }
          : isParcial
          ? { background: 'rgba(212,150,42,0.15)', color: '#D4962A' }
          : done
          ? { background: 'rgba(52,199,89,0.15)', color: '#34C759' }
          : isNext
          ? { background: 'rgba(212,150,42,0.15)', color: '#D4962A' }
          : { background: 'rgba(255,255,255,0.05)', color: 'var(--c-muted)' }

        return (
          <div key={c.id} className="flex gap-3 items-start relative">
            {i < list.length - 1 && (
              <div className="absolute left-[17px] top-[36px] bottom-[-8px] w-[2px]" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
            {/* Circle */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-heading text-[13px] font-extrabold border-2 flex-shrink-0"
              style={circleStyle}
            >
              {isCancelled ? '✕' : isParcial ? '$' : done ? '✓' : i + 1}
            </div>

            {/* Card */}
            <div className="flex-1 rounded-xl p-[12px_13px] mb-2" style={cardStyle}>
              <span className="inline-block px-2 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-[.5px] mb-1" style={badgeStyle}>
                {isCancelled ? '✕ Cancelado' : isParcial ? '💸 Pago parcial' : isDevol ? '🔄 Devolución' : done ? '✓ Entregado' : isNext ? '▶ Siguiente' : `Parada ${i + 1}`}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-[14px] text-textc">{c.nombre}</div>
                {c.codigo && <span className="text-[10px] font-mono bg-surface2 px-[5px] py-[1px] rounded" style={{ color: 'var(--c-muted)' }}>#{c.codigo}</span>}
                {!done && deudaC > 0 && (
                  <span className="text-[9px] font-bold px-[6px] py-[2px] rounded-full" style={{ color: '#FF453A', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)' }}>
                    Debe {fmtMoney(deudaC)}
                  </span>
                )}
              </div>
              <div className="text-[11px] mt-[2px]" style={{ color: 'var(--c-muted2)' }}>{c.direccion || 'Sin dirección'}</div>
              {c.notas && <div className="text-[11px] italic mt-1" style={{ color: '#D4962A' }}>📝 {c.notas}</div>}

              {done ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--c-muted)' }}>{e.hora}</span>
                  <button
                    onClick={() => openModal('entrega', { clienteId: c.id, clienteNombre: c.nombre, clienteDir: c.direccion, clienteDeuda: c.deuda || 0, editData: e })}
                    className="text-[9px] underline opacity-70"
                    style={{ color: 'var(--c-muted)' }}
                  >✏️ editar</button>
                  {isCancelled ? (
                    <span className="text-[10px] italic" style={{ color: '#FF453A' }}>{e.motivo_cancelacion}</span>
                  ) : isParcial ? (
                    <>
                      <span className="text-[10px] font-bold" style={{ color: '#D4962A' }}>Pagó {fmtMoney(e.monto_pagado)} de {fmtMoney(e.monto_total)}</span>
                      <span className="text-[10px]" style={{ color: '#FF453A' }}>· Deuda +{fmtMoney(e.deuda_generada)}</span>
                      {e.metodo_pago && <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{PAGO_ICONS[e.metodo_pago]}</span>}
                    </>
                  ) : isDevol ? (
                    <>
                      <span className="text-[10px]" style={{ color: '#3b82f6' }}>Dev. {fmtMoney(e.monto_devolucion)}</span>
                      <span className="text-[10px] font-bold" style={{ color: '#34C759' }}>· Cobrado {fmtMoney(e.monto)}</span>
                      {e.metodo_pago && <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{PAGO_ICONS[e.metodo_pago]}</span>}
                    </>
                  ) : (
                    <>
                      {e.metodo_pago && <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{PAGO_ICONS[e.metodo_pago]} {e.metodo_pago}</span>}
                      {e.monto > 0 && <span className="text-[10px] font-bold" style={{ color: '#34C759', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(e.monto)}</span>}
                    </>
                  )}
                  {e.obs && <span className="text-[10px] italic" style={{ color: 'var(--c-muted)' }}>{e.obs}</span>}
                  {e.foto_url && (
                    <a href={e.foto_url} target="_blank" rel="noreferrer" className="text-[10px] underline" style={{ color: '#3b82f6' }}>📷 Ver foto</a>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {c.lat
                    ? <button onClick={() => navGPS(c.lat, c.lon)} className="font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg" style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.06)', color: '#F2F2F7' }}>🧭 Navegar</button>
                    : <button onClick={() => navDir(c.direccion, c.nombre)} className="font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg" style={{ background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.06)', color: '#F2F2F7' }}>🧭 Navegar</button>
                  }
                  <button
                    onClick={() => openModal('entrega', { clienteId: c.id, clienteNombre: c.nombre, clienteDir: c.direccion, clienteDeuda: c.deuda || 0 })}
                    className="font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg"
                    style={{ background: '#34C759', color: '#fff' }}
                  >✅ Entregar</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Close day button ──────────────────────────────────────────── */}
      {!allDone && (
        <button
          onClick={() => setShowCierre(true)}
          className="w-full mt-2 font-heading font-bold text-[12px] py-[12px] rounded-xl mb-2 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--c-muted)' }}
        >
          ✂️ Cerrar día
        </button>
      )}

      <div className="h-16" />

      {/* ── Partial close overlay ─────────────────────────────────────── */}
      {showCierre && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center text-center px-10 animate-fadeIn" style={{ background: 'rgba(6,6,6,0.97)' }}>
          <div className="text-[52px] mb-4">📦</div>
          <div className="font-heading text-[22px] font-extrabold text-textc mb-1">Cerrar día</div>
          <div className="text-[13px] mb-6 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            Se guarda el resumen en el historial<br/>y la ruta queda limpia para mañana.
          </div>

          <div className="w-full rounded-2xl p-4 mb-6 text-left space-y-3" style={{ background: '#16161A', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center">
              <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>Entregados</span>
              <span className="font-heading font-bold text-[14px]" style={{ color: '#34C759' }}>{totalEnt} de {list.length}</span>
            </div>
            {list.length - totalEnt > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>Sin visitar</span>
                <span className="font-heading font-bold text-[14px]" style={{ color: '#D4962A' }}>{list.length - totalEnt} cliente{list.length - totalEnt > 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>Total recaudado</span>
              <span className="font-heading font-extrabold text-[18px]" style={{ color: '#34C759', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(totalMonto)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>Comisión ({comisionPct}%)</span>
              <span className="font-heading font-bold text-[16px]" style={{ color: '#D4962A', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(comision)}</span>
            </div>
          </div>

          <div className="w-full max-w-[280px] mb-4">
            <p className="text-[11px] mb-2" style={{ color: 'var(--c-muted)' }}>Escribí <strong className="text-textc">CERRAR</strong> para confirmar</p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder="CERRAR"
              className="w-full rounded-xl px-4 py-3 text-textc text-[15px] font-bold text-center tracking-widest outline-none placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal"
              style={{ background: '#16161A', border: '1px solid rgba(255,255,255,0.12)', caretColor: '#D4962A' }}
            />
          </div>

          <button
            disabled={confirmText !== 'CERRAR'}
            className="font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            style={{ background: '#D4962A', color: '#0C0C0E' }}
            onClick={async () => { await finalizarDia(); setShowCierre(false); setConfirmText(''); useStore.getState().setTab('hist') }}
          >Guardar y cerrar día</button>
          <div className="h-3" />
          <button
            className="text-[13px] font-semibold py-3"
            style={{ color: 'var(--c-muted)' }}
            onClick={() => { setShowCierre(false); setConfirmText('') }}
          >Cancelar</button>
        </div>
      )}

      {/* ── Complete overlay ──────────────────────────────────────────── */}
      {showComplete && (
        <div className="fixed inset-0 z-[300] overflow-y-auto animate-fadeIn" style={{ background: '#0C0C0E' }}>
          <div className="flex flex-col items-center text-center px-6 pt-10 pb-12 min-h-full">
            <div className="text-[64px] mb-3">🎉</div>
            <div className="font-heading text-[26px] font-extrabold mb-1" style={{ color: '#34C759' }}>¡Ruta completada!</div>
            <p className="text-[13px] mb-6" style={{ color: 'var(--c-muted)' }}>Revisá el resumen antes de guardar</p>

            <div className="w-full rounded-2xl p-4 mb-3 text-left space-y-[10px]" style={{ background: '#16161A', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between items-center">
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>✅ Entregados</span>
                <span className="font-heading font-bold text-[14px]" style={{ color: '#34C759' }}>{entregadosCount}</span>
              </div>
              {canceladosCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>❌ Cancelados</span>
                  <span className="font-heading font-bold text-[14px]" style={{ color: '#FF453A' }}>{canceladosCount}</span>
                </div>
              )}
              {parcialesCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>💸 Pago parcial</span>
                  <span className="font-heading font-bold text-[14px]" style={{ color: '#D4962A' }}>{parcialesCount}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>💰 Total cobrado</span>
                <span className="font-heading font-extrabold text-[18px]" style={{ color: '#34C759', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(totalMonto)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>🏆 Comisión ({comisionPct}%)</span>
                <span className="font-heading font-bold text-[15px]" style={{ color: '#D4962A', fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(comision)}</span>
              </div>
              {pagosBreakdown.length > 0 && (
                <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{ color: '#3A3A3C', letterSpacing: '1.8px' }}>Métodos de pago</p>
                  {pagosBreakdown.map(p => (
                    <div key={p.label} className="flex justify-between items-center mb-1">
                      <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>{p.icon} {p.label}</span>
                      <span className="text-[12px] font-bold text-textc" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(p.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {deudasCobradas > 0 && (
              <div className="w-full rounded-xl px-4 py-3 mb-3 flex items-center justify-between" style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.2)' }}>
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>✅ Deudas cobradas hoy</span>
                <span className="font-heading font-bold text-[14px]" style={{ color: '#34C759' }}>+{fmtMoney(deudasCobradas)}</span>
              </div>
            )}
            {deudasNuevas > 0 && (
              <div className="w-full rounded-xl px-4 py-3 mb-3 flex items-center justify-between" style={{ background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)' }}>
                <span className="text-[12px]" style={{ color: 'var(--c-muted)' }}>⚠️ Deudas generadas hoy</span>
                <span className="font-heading font-bold text-[14px]" style={{ color: '#FF453A' }}>{fmtMoney(deudasNuevas)}</span>
              </div>
            )}

            <div className="h-2" />
            <button
              className="font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px]"
              style={{ background: '#D4962A', color: '#0C0C0E' }}
              onClick={async () => { await finalizarDia(); setShowComplete(false); useStore.getState().setTab('hist') }}
            >Guardar en historial y limpiar</button>
            <div className="h-3" />
            <button
              className="font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px]"
              style={{ background: '#16161A', border: '1px solid rgba(255,255,255,0.06)', color: '#F2F2F7' }}
              onClick={() => setShowComplete(false)}
            >Volver a la ruta</button>
          </div>
        </div>
      )}
    </div>
  )
}
