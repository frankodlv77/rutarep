import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import useStore from '../../store/useStore'

function fmt(n) { return n ? Math.round(Number(n)).toLocaleString('es-AR') : '0' }

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardScreen() {
  const perfil = useStore(s => s.perfil)

  const [resumenHoy,   setResumenHoy]   = useState([])
  const [resumenSemana, setResumenSemana] = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const hoy = hoyISO()

    // Sesiones activas de hoy de todos los repartidores del equipo
    const { data: sesiones } = await supabase
      .from('sesion_activa')
      .select('user_id, fecha_iso, total_clientes, total_entregados, total_monto, comision_pct, entregas, profiles:user_id(negocio, nombre)')
      .eq('fecha_iso', hoy)

    // Historial de la semana del equipo
    const monday = new Date()
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    monday.setHours(0, 0, 0, 0)
    const mondayISO = monday.toISOString().slice(0, 10)

    const { data: hist } = await supabase
      .from('historial')
      .select('user_id, fecha_iso, total_clientes, total_entregados, total_monto, comision_pct')
      .gte('fecha_iso', mondayISO)

    setResumenHoy(sesiones || [])

    if (hist && hist.length > 0) {
      const totalMonto    = hist.reduce((s, d) => s + (+d.total_monto || 0), 0)
      const totalEntregas = hist.reduce((s, d) => s + (+d.total_entregados || 0), 0)
      const totalCom      = hist.reduce((s, d) => s + (+d.total_monto || 0) * ((+d.comision_pct || 0) / 100), 0)
      const diasActivos   = new Set(hist.map(d => d.user_id)).size
      setResumenSemana({ totalMonto, totalEntregas, totalCom, diasActivos })
    } else {
      setResumenSemana(null)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-48">
        <p className="text-[13px] text-[#6b85a0]">Cargando datos del equipo...</p>
      </div>
    )
  }

  const totalHoyMonto    = resumenHoy.reduce((s, r) => s + (+r.total_monto || 0), 0)
  const totalHoyEntregas = resumenHoy.reduce((s, r) => s + (+r.total_entregados || 0), 0)
  const totalHoyClientes = resumenHoy.reduce((s, r) => s + (+r.total_clientes || 0), 0)

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-heading text-[18px] font-extrabold text-[#f0f4f8]">
          {perfil?.negocio || 'Dashboard'}
        </h2>
        <p className="text-[12px] text-[#6b85a0]">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats de hoy */}
      <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-2">Equipo — hoy</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Recaudado',  value: `$${fmt(totalHoyMonto)}`,    color: 'text-emerald-400' },
          { label: 'Entregas',   value: totalHoyEntregas,             color: 'text-[#f0f4f8]'  },
          { label: 'Pendientes', value: totalHoyClientes - totalHoyEntregas, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#131e2e] border border-white/7 rounded-xl p-3 text-center">
            <div className={`font-heading text-[17px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-[#6b85a0] uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Semana */}
      {resumenSemana && (
        <>
          <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-2">Esta semana</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Total',    value: `$${fmt(resumenSemana.totalMonto)}`,    color: 'text-emerald-400' },
              { label: 'Entregas', value: resumenSemana.totalEntregas,            color: 'text-[#f0f4f8]'  },
              { label: 'Comisión', value: `$${fmt(resumenSemana.totalCom)}`,      color: 'text-amber-400'  },
            ].map(s => (
              <div key={s.label} className="bg-[#131e2e] border border-white/7 rounded-xl p-3 text-center">
                <div className={`font-heading text-[17px] font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-[#6b85a0] uppercase tracking-[.4px] mt-[2px]">{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Repartidores activos hoy */}
      <p className="text-[10px] font-bold text-[#6b85a0] uppercase tracking-[.8px] mb-2">
        Repartidores hoy ({resumenHoy.length})
      </p>

      {resumenHoy.length === 0 ? (
        <div className="bg-[#131e2e] border border-white/7 rounded-xl p-6 text-center mb-4">
          <div className="text-[36px] mb-2 opacity-30">🚚</div>
          <p className="text-[12px] text-[#6b85a0]">Ningún repartidor activo hoy todavía.</p>
        </div>
      ) : (
        resumenHoy.map(r => {
          const nombre    = r.profiles?.negocio || r.profiles?.nombre || 'Repartidor'
          const pct       = r.total_clientes > 0
            ? Math.round((r.total_entregados / r.total_clientes) * 100)
            : 0
          const comision  = (+r.total_monto || 0) * ((+r.comision_pct || 0) / 100)

          return (
            <div key={r.user_id} className="bg-[#131e2e] border border-white/7 rounded-xl p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-[32px] h-[32px] rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-[14px]">
                    🚚
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#f0f4f8]">{nombre}</div>
                    <div className="text-[10px] text-[#6b85a0]">{r.total_entregados}/{r.total_clientes} entregas</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-heading font-extrabold text-emerald-400">${fmt(r.total_monto)}</div>
                  <div className="text-[10px] text-amber-400">com. ${fmt(comision)}</div>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full h-[5px] bg-[#1a2840] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[9px] text-[#6b85a0] mt-1">{pct}% completado</p>
            </div>
          )
        })
      )}

      <button
        onClick={fetchData}
        className="w-full mt-2 bg-[#131e2e] border border-white/7 rounded-xl py-[10px] text-[12px] text-[#6b85a0] font-semibold"
      >
        🔄 Actualizar
      </button>

      <div className="h-16" />
    </div>
  )
}
