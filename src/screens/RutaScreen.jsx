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
  const [swipeX, setSwipeX]   = useState(null)   // posición X inicial del touch
  const [dragX, setDragX]     = useState(0)       // cuánto se movió
  const [hint, setHint]       = useState(true)    // mostrar hint de swipe al inicio

  // Ajustar índice si el actual ya fue entregado
  useEffect(() => {
    if (pendientes.length === 0) return
    if (idx >= pendientes.length) setIdx(pendientes.length - 1)
  }, [pendientes.length])

  // Ocultar hint después de 2s
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

  // Touch handlers para swipe
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
        // Swipe derecha → registrar entrega
        registrarEntrega()
      } else {
        // Swipe izquierda → saltar al siguiente (solo si hay más)
        if (pendientes.length > 1) irSiguiente()
      }
    }
    setSwipeX(null)
    setDragX(0)
  }

  const navGPS = (lat, lon)    => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`, '_blank')
  const navDir = (dir, nombre) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir || nombre + ' Mendoza')}&travelmode=driving`, '_blank')

  if (pendientes.length === 0) {
    return (
      <div className="fixed inset-0 z-[500] bg-bg flex flex-col items-center justify-center text-center px-8">
        <div className="text-[72px] mb-4">🎉</div>
        <div className="font-heading text-[28px] font-extrabold text-emerald-400 mb-2">¡Todo entregado!</div>
        <div className="text-[14px] text-muted mb-8">{entregados} de {list.length} paradas completadas</div>
        <button onClick={onSalir} className="bg-amber-400 text-[#1a1a28] font-heading font-bold text-[16px] px-8 py-4 rounded-2xl w-full max-w-[300px]">
          Volver a la ruta
        </button>
      </div>
    )
  }

  const c = pendientes[idx]
  const deuda = c.deuda || 0
  const numParada = list.indexOf(c) + 1

  // Color de fondo según drag
  const swipeingRight = dragX > 40
  const swipeingLeft  = dragX < -40

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col select-none transition-colors duration-150"
      style={{
        background: swipeingRight ? '#0d2318' : swipeingLeft ? '#1a1008' : '#060e1a',
        transform: `translateX(${dragX * 0.12}px)`,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--c-border)]">
        <span className="text-[12px] text-muted">🚗 Modo conductor</span>
        <span className="text-[12px] text-muted">
          {entregados} entregados · {pendientes.length} pendientes
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-[5px] px-5 pt-3 pb-1 overflow-x-auto hide-scrollbar">
        {list.map(cl => (
          <div key={cl.id} className={`h-[4px] flex-1 rounded-full min-w-[8px] transition-colors ${
            entregas[cl.id] ? 'bg-emerald-500' :
            cl.id === c.id  ? 'bg-amber-400'   : 'bg-white/10'
          }`} />
        ))}
      </div>

      {/* Hint swipe */}
      {hint && (
        <div className="flex justify-between px-6 pt-3 pb-0">
          <span className="text-[11px] text-muted opacity-70">← saltar</span>
          <span className="text-[11px] text-muted opacity-70">entregar →</span>
        </div>
      )}

      {/* Indicador visual de swipe activo */}
      {swipeingRight && (
        <div className="absolute inset-y-0 right-0 w-[6px] bg-emerald-500/60 rounded-l-full" />
      )}
      {swipeingLeft && pendientes.length > 1 && (
        <div className="absolute inset-y-0 left-0 w-[6px] bg-amber-400/60 rounded-r-full" />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-4">
        <div className="text-[13px] font-bold text-muted uppercase tracking-[1px] mb-2">
          Parada {numParada} de {list.length}
        </div>
        <div className="font-heading font-extrabold text-[36px] leading-[1.1] text-textc mb-3 break-words">
          {c.nombre}
        </div>
        <div className="text-[17px] text-muted mb-4 leading-snug">
          {c.direccion || 'Sin dirección registrada'}
        </div>
        {c.notas && (
          <div className="bg-amber-400/10 border border-amber-400/25 rounded-xl px-4 py-3 mb-4">
            <p className="text-[14px] text-amber-300">📝 {c.notas}</p>
          </div>
        )}
        {deuda > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-[15px] font-bold text-red-400">⚠️ Debe {fmtMoney(deuda)}</p>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="px-5 pb-6 space-y-3">
        <button
          onClick={() => c.lat ? navGPS(c.lat, c.lon) : navDir(c.direccion, c.nombre)}
          className="w-full bg-surface2 border border-[var(--c-border2)] text-textc font-heading font-bold text-[17px] py-[18px] rounded-2xl flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
        >
          🧭 Navegar
        </button>
        <button
          onClick={registrarEntrega}
          className="w-full bg-emerald-500 text-white font-heading font-extrabold text-[20px] py-[22px] rounded-2xl active:scale-[.98] transition-transform shadow-lg"
        >
          ✅ Registrar entrega
        </button>
        {pendientes.length > 1 && (
          <button
            onClick={irSiguiente}
            className="w-full text-muted text-[13px] font-semibold py-2"
          >
            Saltar → siguiente pendiente
          </button>
        )}

        {/* Salir — siempre visible, inconfundible */}
        <button
          onClick={onSalir}
          className="w-full bg-surface border border-white/15 text-muted font-heading font-bold text-[14px] py-[14px] rounded-2xl active:scale-[.98] transition-transform"
        >
          ← Volver a la ruta normal
        </button>
      </div>
    </div>
  )
}

export default function RutaScreen() {
  const clientes           = useStore(s => s.clientes)
  const hoy                = useStore(s => s.hoy)
  const entregas           = useStore(s => s.entregas)
  const openModal          = useStore(s => s.openModal)
  const comisionPct        = useStore(s => s.comisionPct)
  const setTab             = useStore(s => s.setTab)
  const reordenarPendientes = useStore(s => s.reordenarPendientes)

  const [showComplete, setShowComplete]     = useState(false)
  const [showCierre, setShowCierre]         = useState(false)
  const [confirmText, setConfirmText]       = useState('')
  const [reordenando, setReordenando]       = useState(false)
  const [modoConductor, setModoConductor]   = useState(false)
  const finalizarDia = useStore(s => s.finalizarDia)

  const { pos, loading: gpsLoading, getPos } = useGeolocation()

  // Cuando llega el GPS y estábamos esperando para reordenar
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
          className="mt-6 bg-amber-400 text-[#1a1a28] font-heading font-bold text-[13px] px-6 py-3 rounded-xl"
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

  const navGPS = (lat, lon)    => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`, '_blank')
  const navDir = (dir, nombre) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dir || nombre + ' Mendoza')}&travelmode=driving`, '_blank')

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

      {/* Botón modo conductor */}
      {!allDone && (
        <button
          onClick={() => setModoConductor(true)}
          className="w-full bg-amber-400 text-[#1a1a28] font-heading font-extrabold text-[14px] py-[14px] rounded-2xl mb-3 flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
        >
          🚗 Entrar a modo conductor
        </button>
      )}

      {/* Stats row */}
      <div className="flex gap-2 mb-3">
        {[
          { n: list.length - totalEnt, color: 'text-amber-400', label: 'Faltan' },
          { n: totalEnt,               color: 'text-emerald-400', label: 'Listos' },
          { n: `${pct}%`,              color: 'text-textc', label: 'Avance' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
            <div className={`font-heading text-[22px] font-extrabold ${s.color}`}>{s.n}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface2 rounded-full overflow-hidden mb-1">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted text-right mb-3">{totalEnt} de {list.length} entregas</p>

      {/* Totales del día */}
      <div className="bg-surface border border-[var(--c-border)] rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-muted uppercase tracking-wide font-bold">Total del día</span>
          <span className="font-heading font-extrabold text-[18px] text-emerald-400">{fmtMoney(totalMonto)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Comisión</span>
            <div className="flex items-center bg-surface2 border border-[var(--c-border)] rounded-lg overflow-hidden">
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
                className="w-[44px] bg-transparent px-2 py-1 text-[12px] text-amber-400 font-bold outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-amber-400 font-bold pr-2">%</span>
            </div>
          </div>
          <span className="font-heading font-bold text-[15px] text-amber-400">{fmtMoney(comision)}</span>
        </div>
      </div>

      {/* Botón reordenar pendientes */}
      {canReorder && (
        <button
          onClick={handleReordenar}
          disabled={reordenando && gpsLoading}
          className="w-full bg-surface2 border border-amber-400/30 text-amber-400 font-heading font-bold text-[12px] py-[10px] rounded-xl mb-3 flex items-center justify-center gap-2 active:bg-amber-400/10 transition-colors"
        >
          {reordenando && gpsLoading ? '📍 Localizando...' : '🧭 Reordenar pendientes por cercanía'}
        </button>
      )}

      {/* Completado */}
      {allDone && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 mb-4 text-center">
          <div className="text-[40px] mb-2">🎉</div>
          <div className="font-heading font-extrabold text-[17px] text-emerald-400 mb-1">¡Ruta completada!</div>
          <div className="text-[12px] text-muted mb-4">Todas las entregas están listas.</div>
          <button
            onClick={() => setShowComplete(true)}
            className="bg-emerald-500 text-white font-heading font-bold text-[13px] px-6 py-3 rounded-xl w-full"
          >Finalizar y guardar día</button>
        </div>
      )}

      <p className="text-[10px] font-bold text-muted uppercase tracking-[.8px] mb-3">Paradas de hoy</p>

      {/* Stops */}
      {list.map((c, i) => {
        const e          = entregas[c.id]
        const done       = !!e
        const isCancelled = done && e.tipo === 'cancelado'
        const isParcial   = done && e.tipo === 'parcial'
        const isDevol     = done && e.tipo === 'devolucion'
        const isNext     = !done && list.slice(0, i).every(prev => entregas[prev.id])
        const deudaC     = c.deuda || 0

        return (
          <div key={c.id} className="flex gap-3 items-start relative">
            {/* Connector line */}
            {i < list.length - 1 && (
              <div className="absolute left-[17px] top-[36px] bottom-[-8px] w-[2px] bg-white/7" />
            )}
            {/* Circle */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading text-[13px] font-extrabold border-2 flex-shrink-0 ${
              isCancelled ? 'bg-red-500 border-red-500 text-white' :
              isParcial   ? 'bg-amber-500 border-amber-500 text-white' :
              done        ? 'bg-emerald-500 border-emerald-500 text-white' :
              isNext      ? 'bg-amber-400 border-amber-400 text-[#1a1a28] animate-pulse2' :
                            'bg-surface2 border-[#1f3050] text-muted'
            }`}>
              {isCancelled ? '✕' : isParcial ? '$' : done ? '✓' : i + 1}
            </div>

            {/* Card */}
            <div className={`flex-1 border rounded-xl p-[12px_13px] mb-2 ${
              isCancelled ? 'opacity-50 bg-surface border-red-500/20' :
              isParcial   ? 'opacity-60 bg-surface border-amber-500/20' :
              done        ? 'opacity-45 bg-surface border-[var(--c-border)]' :
              isNext      ? 'bg-amber-400/4 border-amber-400' :
                            'bg-surface border-[var(--c-border)]'
            }`}>
              <span className={`inline-block px-2 py-[2px] rounded-full text-[9px] font-bold uppercase tracking-[.5px] mb-1 ${
                isCancelled ? 'bg-red-500/20 text-red-400' :
                isParcial   ? 'bg-amber-500/20 text-amber-400' :
                done        ? 'bg-emerald-500/20 text-emerald-400' :
                isNext      ? 'bg-amber-400/20 text-amber-400' :
                              'bg-white/6 text-muted'
              }`}>
                {isCancelled ? '✕ Cancelado' : isParcial ? '💸 Pago parcial' : isDevol ? '🔄 Devolución' : done ? '✓ Entregado' : isNext ? '▶ Siguiente' : `Parada ${i + 1}`}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold text-[14px] text-textc">{c.nombre}</div>
                {c.codigo && <span className="text-[10px] text-muted font-mono bg-surface2 px-[5px] py-[1px] rounded">#{c.codigo}</span>}
                {!done && deudaC > 0 && (
                  <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-[6px] py-[2px] rounded-full">
                    Debe {fmtMoney(deudaC)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted mt-[2px]">{c.direccion || 'Sin dirección'}</div>
              {c.notas && <div className="text-[11px] text-amber-400 italic mt-1">📝 {c.notas}</div>}

              {done ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[10px] text-muted font-semibold">{e.hora}</span>
                  <button
                    onClick={() => openModal('entrega', { clienteId: c.id, clienteNombre: c.nombre, clienteDir: c.direccion, clienteDeuda: c.deuda || 0, editData: e })}
                    className="text-[9px] text-muted underline opacity-70"
                  >✏️ editar</button>
                  {isCancelled ? (
                    <span className="text-[10px] text-red-400 italic">{e.motivo_cancelacion}</span>
                  ) : isParcial ? (
                    <>
                      <span className="text-[10px] font-bold text-amber-400">Pagó {fmtMoney(e.monto_pagado)} de {fmtMoney(e.monto_total)}</span>
                      <span className="text-[10px] text-red-400">· Deuda +{fmtMoney(e.deuda_generada)}</span>
                      {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago]}</span>}
                    </>
                  ) : isDevol ? (
                    <>
                      <span className="text-[10px] text-blue-400">Dev. {fmtMoney(e.monto_devolucion)}</span>
                      <span className="text-[10px] font-bold text-emerald-400">· Cobrado {fmtMoney(e.monto)}</span>
                      {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago]}</span>}
                    </>
                  ) : (
                    <>
                      {e.metodo_pago && <span className="text-[10px] text-muted">{PAGO_ICONS[e.metodo_pago]} {e.metodo_pago}</span>}
                      {e.monto > 0 && <span className="text-[10px] font-bold text-emerald-400">{fmtMoney(e.monto)}</span>}
                    </>
                  )}
                  {e.obs && <span className="text-[10px] text-muted italic">{e.obs}</span>}
                  {e.foto_url && (
                    <a href={e.foto_url} target="_blank" rel="noreferrer" className="text-[10px] text-info underline">📷 Ver foto</a>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {c.lat
                    ? <button onClick={() => navGPS(c.lat, c.lon)} className="bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg">🧭 Navegar</button>
                    : <button onClick={() => navDir(c.direccion, c.nombre)} className="bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg">🧭 Navegar</button>
                  }
                  <button
                    onClick={() => openModal('entrega', { clienteId: c.id, clienteNombre: c.nombre, clienteDir: c.direccion, clienteDeuda: c.deuda || 0 })}
                    className="bg-emerald-500 text-white font-heading font-bold text-[11px] px-3 py-[7px] rounded-lg"
                  >✅ Entregar</button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Botón cerrar día — siempre visible */}
      {!allDone && (
        <button
          onClick={() => setShowCierre(true)}
          className="w-full mt-2 border border-[var(--c-border2)] text-muted font-heading font-bold text-[12px] py-[12px] rounded-xl mb-2 active:bg-white/5 transition-colors"
        >
          ✂️ Cerrar día
        </button>
      )}

      <div className="h-16" />

      {/* Overlay cierre parcial */}
      {showCierre && (
        <div className="fixed inset-0 bg-bg/95 z-[300] flex flex-col items-center justify-center text-center px-10 animate-fadeIn">
          <div className="text-[52px] mb-4">📦</div>
          <div className="font-heading text-[22px] font-extrabold text-textc mb-1">Cerrar día</div>
          <div className="text-[13px] text-muted mb-6 leading-relaxed">
            Se guarda el resumen en el historial<br/>y la ruta queda limpia para mañana.
          </div>

          {/* Resumen */}
          <div className="w-full bg-surface border border-[var(--c-border)] rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Entregados</span>
              <span className="font-heading font-bold text-[14px] text-emerald-400">{totalEnt} de {list.length}</span>
            </div>
            {list.length - totalEnt > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-muted">Sin visitar</span>
                <span className="font-heading font-bold text-[14px] text-amber-400">{list.length - totalEnt} cliente{list.length - totalEnt > 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="border-t border-[var(--c-border)] pt-3 flex justify-between items-center">
              <span className="text-[12px] text-muted">Total recaudado</span>
              <span className="font-heading font-extrabold text-[18px] text-emerald-400">{fmtMoney(totalMonto)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Comisión ({comisionPct}%)</span>
              <span className="font-heading font-bold text-[16px] text-amber-400">{fmtMoney(comision)}</span>
            </div>
          </div>

          {/* Campo de confirmación */}
          <div className="w-full max-w-[280px] mb-4">
            <p className="text-[11px] text-muted mb-2">Escribí <strong className="text-textc">CERRAR</strong> para confirmar</p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder="CERRAR"
              className="w-full bg-surface border border-white/15 rounded-xl px-4 py-3 text-textc text-[15px] font-bold text-center tracking-widest outline-none focus:border-amber-400 placeholder:text-white/20 placeholder:font-normal placeholder:tracking-normal"
            />
          </div>

          <button
            disabled={confirmText !== 'CERRAR'}
            className="bg-amber-400 text-[#1a1a28] font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px] disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            onClick={async () => { await finalizarDia(); setShowCierre(false); setConfirmText(''); useStore.getState().setTab('hist') }}
          >Guardar y cerrar día</button>
          <div className="h-3" />
          <button
            className="text-muted text-[13px] font-semibold py-3"
            onClick={() => { setShowCierre(false); setConfirmText('') }}
          >Cancelar</button>
        </div>
      )}

      {/* Complete overlay */}
      {showComplete && (
        <div className="fixed inset-0 bg-bg z-[300] flex flex-col items-center justify-center text-center px-10 animate-fadeIn">
          <div className="text-[64px] mb-5">🎉</div>
          <div className="font-heading text-[26px] font-extrabold text-emerald-400 mb-2">¡Ruta completada!</div>
          <div className="text-[14px] text-muted leading-relaxed mb-3">Total recaudado: <strong className="text-emerald-400">{fmtMoney(totalMonto)}</strong></div>
          <div className="text-[14px] text-muted mb-8">Tu comisión ({comisionPct}%): <strong className="text-amber-400">{fmtMoney(comision)}</strong></div>
          <button
            className="bg-amber-400 text-[#1a1a28] font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px]"
            onClick={async () => { await finalizarDia(); setShowComplete(false); useStore.getState().setTab('hist') }}
          >Guardar en historial y limpiar</button>
          <div className="h-3" />
          <button
            className="bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[14px] px-8 py-4 rounded-xl w-full max-w-[280px]"
            onClick={() => setShowComplete(false)}
          >Volver a la ruta</button>
        </div>
      )}
    </div>
  )
}
