import { create } from 'zustand'
import { supabase, isConfigured } from '../lib/supabase'
import { greedyRoute } from '../lib/geo'

const LS_HOY         = 'rr_hoy'
const LS_ENT         = 'rr_ent'
const LS_COM         = 'rr_com'
const LS_FECHA       = 'rr_fecha'
const LS_PENDING     = 'rr_pending_hist'    // días finalizados sin conexión, esperando sync
const LS_PENDING_SES = 'rr_pending_session' // sesión sin finalizar del día anterior, persiste en LS

function lsGet(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } }
function lsSet(k, v)   { localStorage.setItem(k, JSON.stringify(v)) }
function lsDel(k)      { localStorage.removeItem(k) }

// ── Corte diario ──────────────────────────────────────────────────────────────
const _todayKey   = new Date().toISOString().slice(0, 10)
const _storedDate = lsGet(LS_FECHA, null)
let _pendingDayData = null

if (_storedDate && _storedDate !== _todayKey) {
  const prevHoy = lsGet(LS_HOY, [])
  const prevEnt = lsGet(LS_ENT, {})
  if (prevHoy.length > 0) {
    // Guardar en localStorage antes de limpiar — así sobrevive si la app se cierra antes de loadAll
    const session = { fechaKey: _storedDate, hoy: prevHoy, entregas: prevEnt, comisionPct: lsGet(LS_COM, 4) }
    lsSet(LS_PENDING_SES, session)
    _pendingDayData = session
  }
  lsSet(LS_HOY, []); lsSet(LS_ENT, {})
}
lsSet(LS_FECHA, _todayKey)

// También recuperar sesión pendiente que quedó de reinicios anteriores sin loadAll
if (!_pendingDayData) {
  const savedSession = lsGet(LS_PENDING_SES, null)
  if (savedSession && savedSession.fechaKey && savedSession.fechaKey !== _todayKey) {
    _pendingDayData = savedSession
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Auto-guarda la sesión activa en Supabase (fire & forget, no bloquea UI)
async function autoSaveSession(hoy, entregas, comisionPct) {
  if (!isConfigured || !navigator.onLine) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    await supabase.from('sesion_activa').upsert(
      { fecha_iso: _todayKey, user_id: session.user.id, hoy, entregas, comision_pct: comisionPct, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,fecha_iso' }
    )
  } catch (_) {}
}

const useStore = create((set, get) => ({
  // ── Remote data ──────────────────────────────────────────────
  clientes:   [],
  rutas:      [],
  historial:  [],
  perfil:     null, // { id, nombre, rol }
  userId:     null,

  // ── Today's session (localStorage) ───────────────────────────
  hoy:         lsGet(LS_HOY, []),
  entregas:    lsGet(LS_ENT, {}),
  comisionPct: lsGet(LS_COM, 4),

  // ── UI ────────────────────────────────────────────────────────
  activeTab: 'hoy',
  loading:   false,
  modal:     null,
  toast:     null,

  // ═══════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════
  loadAll: async () => {
    if (!isConfigured) return
    set({ loading: true })

    // Obtener usuario primero — necesario para incluir user_id en todos los inserts
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ loading: false }); return }
    const userId = user.id
    set({ userId })

    const [{ data: clientes }, { data: rutas }, { data: rc }, { data: historialRaw }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('rutas').select('*').order('nombre'),
      supabase.from('ruta_clientes').select('*'),
      supabase.from('historial').select('*').order('created_at', { ascending: false }).limit(90),
    ])

    // Deduplicar por fecha — conservar el que tenga más datos (mayor total_monto)
    // Esto protege contra registros basura que pisan datos reales
    const byFecha = {}
    ;(historialRaw || []).forEach(h => {
      if (!byFecha[h.fecha] || (+h.total_monto || 0) > (+byFecha[h.fecha].total_monto || 0)) {
        byFecha[h.fecha] = h
      }
    })
    const historial = Object.values(byFecha).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const rutasWithClientes = (rutas || []).map(r => ({
      ...r,
      clienteIds: (rc || []).filter(x => x.ruta_id === r.id).sort((a,b) => a.orden - b.orden).map(x => x.cliente_id),
    }))
    set({ clientes: clientes || [], rutas: rutasWithClientes, historial, loading: false })

    // ── Sincronizar días pendientes guardados sin conexión ──────
    const pending = lsGet(LS_PENDING, [])
    if (pending.length > 0) {
      let synced = 0
      for (const record of pending) {
        // Evitar duplicados: solo insertar si no existe ya un registro con esa fecha
        const exists = historial.some(h => h.fecha === record.fecha)
        if (!exists) {
          const { error } = await supabase.from('historial').insert({ ...record, user_id: userId })
          if (!error) synced++
        } else {
          synced++
        }
      }
      if (synced > 0) {
        lsSet(LS_PENDING, [])
        get().showToast(`☁️ ${synced} día${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''} con la nube`)
      }
    }

    // ── Recuperar sesión del día si el localStorage está vacío ──
    try {
      // Traer TODAS las sesiones activas (hoy y días anteriores)
      const { data: todasSesiones } = await supabase.from('sesion_activa').select('*')

      // Primero: rescatar sesiones de días anteriores que no fueron finalizadas
      const sesionesViejas = (todasSesiones || []).filter(s => s.fecha_iso !== _todayKey)
      for (const sesion of sesionesViejas) {
        if (!sesion.hoy?.length) continue
        const [y, m, d] = sesion.fecha_iso.split('-').map(Number)
        const fechaLabel = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        const yaExiste = historial.some(h => h.fecha === fechaLabel)
        if (!yaExiste) {
          // Sesión vieja sin finalizar → auto-guardar en historial antes de borrarla
          const clientesList = get().clientes
          const entList = sesion.hoy.map(id => {
            const c = clientesList.find(x => x.id === id)
            const e = (sesion.entregas || {})[id]
            return { id, nombre: c?.nombre || '?', direccion: c?.direccion || '', zona: c?.zona || '',
                     entregado: !!e && e.tipo !== 'cancelado',
                     tipo: e?.tipo || null, obs: e?.obs || '', hora: e?.hora || '',
                     metodo_pago: e?.metodo_pago || '', monto: e?.monto || 0,
                     foto_url: e?.foto_url || '', foto_urls: e?.foto_urls || [] }
          })
          const totalMonto = Math.round(entList.reduce((s, e) => s + (+e.monto || 0), 0))
          const record = { fecha: fechaLabel, fecha_iso: sesion.fecha_iso,
                           comision_pct: sesion.comision_pct || 4,
                           total_monto: totalMonto, total_entregados: entList.filter(e => e.entregado).length,
                           total_clientes: entList.length, entregas: entList }
          const { error } = await supabase.from('historial').insert({ ...record, user_id: userId })
          if (!error) {
            const histNext = [{ ...record, id: Date.now().toString(), created_at: new Date().toISOString() },
                              ...get().historial].slice(0, 90)
            set({ historial: histNext })
            get().showToast(`📅 Sesión del ${fechaLabel.split(',')[0]} guardada automáticamente`)
          }
        }
      }
      // Ahora sí borrar sesiones viejas — ya fueron rescatadas
      if (sesionesViejas.length > 0) {
        supabase.from('sesion_activa').delete().neq('fecha_iso', _todayKey).then(() => {})
      }

      // Segundo: recuperar sesión de HOY si el localStorage está vacío
      const sesionHoy = (todasSesiones || []).find(s => s.fecha_iso === _todayKey)
      if (sesionHoy && sesionHoy.hoy?.length > 0) {
        const localHoy = lsGet(LS_HOY, [])
        if (localHoy.length === 0) {
          lsSet(LS_HOY, sesionHoy.hoy)
          lsSet(LS_ENT, sesionHoy.entregas)
          lsSet(LS_COM, sesionHoy.comision_pct)
          set({ hoy: sesionHoy.hoy, entregas: sesionHoy.entregas, comisionPct: sesionHoy.comision_pct })
          get().showToast('🔄 Sesión del día recuperada de la nube')
        }
      }
    } catch (_) {}

    // ── Cargar perfil del usuario logueado ──────────────────────
    const { data: perfil } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    set({ perfil: perfil || { id: userId, rol: 'repartidor', nombre: user.email } })

    // ── Auto-guardar día anterior si cambió la fecha ────────────
    if (_pendingDayData) {
      // Limpiar ANTES del await para evitar condición de carrera si loadAll se llama dos veces
      const snapshot = _pendingDayData
      _pendingDayData = null
      try {
        const { fechaKey, hoy: prevHoy, entregas: prevEnt, comisionPct: prevPct } = snapshot
        const [y, m, d] = fechaKey.split('-').map(Number)
        const fecha = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        // Evitar duplicado: si ya hay un registro con esa fecha en Supabase, no insertar
        const alreadyExists = historial.some(h => h.fecha === fecha)
        if (!alreadyExists) {
          const clientesList = clientes || []
          const entList = prevHoy.map(id => {
            const c = clientesList.find(x => x.id === id)
            const e = prevEnt[id]
            return { id, nombre: c?.nombre || '?', direccion: c?.direccion || '', zona: c?.zona || '',
                     entregado: !!e && e.tipo !== 'cancelado',
                     tipo: e?.tipo || (e ? 'entregado' : null),
                     obs: e?.obs || '', hora: e?.hora || '',
                     metodo_pago: e?.metodo_pago || '', monto: e?.monto || 0,
                     foto_url: e?.foto_url || '', foto_urls: e?.foto_urls || [],
                     motivo_cancelacion: e?.motivo_cancelacion || null }
          })
          const totalMonto = Math.round(entList.reduce((s, e) => s + (+e.monto || 0), 0))
          const totalEnt   = entList.filter(e => e.entregado).length
          const record = { fecha, comision_pct: prevPct, total_monto: totalMonto,
                           total_entregados: totalEnt, total_clientes: entList.length, entregas: entList,
                           user_id: userId }
          await supabase.from('historial').insert(record)
          const histNext = [{ ...record, id: Date.now().toString(), created_at: new Date().toISOString() },
                            ...historial].slice(0, 90)
          set({ historial: histNext })
          get().showToast('📅 Día anterior guardado automáticamente')
        }
        // Limpiar sesión pendiente del localStorage — ya fue procesada con éxito
        lsDel(LS_PENDING_SES)
      } catch (_) {}
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CLIENTES CRUD
  // ═══════════════════════════════════════════════════════════════
  addCliente: async (data) => {
    if (!isConfigured || !navigator.onLine) {
      get().showToast('⚠️ Sin conexión — conectate para guardar clientes')
      return
    }
    const { data: inserted, error } = await supabase.from('clientes').insert({ ...data, user_id: get().userId }).select().single()
    if (error) { get().showToast('❌ Error al guardar'); return }
    set(s => ({ clientes: [...s.clientes, inserted].sort((a,b) => a.nombre.localeCompare(b.nombre)) }))
    get().showToast('✅ Cliente agregado')
  },

  importClientes: async (rows) => {
    // rows: [{nombre, direccion, zona, telefono, notas, codigo}] — ya validados
    if (!isConfigured || !navigator.onLine) return { ok: 0, dbErrors: rows.map((r, i) => ({ row: i + 2, nombre: r.nombre, reason: 'Sin conexión' })) }
    const userId = get().userId
    const toInsert = rows.map(r => ({ ...r, user_id: userId }))

    // Intento batch
    const { data: inserted, error } = await supabase.from('clientes').insert(toInsert).select()
    if (!error) {
      const merged = [...get().clientes, ...(inserted || [])].sort((a, b) => a.nombre.localeCompare(b.nombre))
      set({ clientes: merged })
      return { ok: inserted?.length || 0, dbErrors: [] }
    }

    // Si el batch falla, insertar uno a uno para identificar la fila exacta
    let ok = 0
    const dbErrors = []
    const succeeded = []
    for (let i = 0; i < rows.length; i++) {
      const { data: d, error: e } = await supabase.from('clientes').insert({ ...rows[i], user_id: userId }).select().single()
      if (e) dbErrors.push({ row: i + 2, nombre: rows[i].nombre, reason: e.message })
      else { ok++; succeeded.push(d) }
    }
    if (succeeded.length > 0) {
      const merged = [...get().clientes, ...succeeded].sort((a, b) => a.nombre.localeCompare(b.nombre))
      set({ clientes: merged })
    }
    return { ok, dbErrors }
  },

  updateCliente: async (id, data) => {
    // Guardar snapshot para revertir si falla Supabase
    const prev = get().clientes.find(c => c.id === id)
    // Actualizar estado local de inmediato (optimista)
    set(s => ({ clientes: s.clientes.map(c => c.id === id ? {...c, ...data} : c) }))
    if (!isConfigured || !navigator.onLine) {
      get().showToast('✅ Actualizado localmente')
      return
    }
    const { error } = await supabase.from('clientes').update(data).eq('id', id)
    if (error) {
      if (prev) set(s => ({ clientes: s.clientes.map(c => c.id === id ? prev : c) }))
      get().showToast('❌ Error al actualizar')
      return
    }
    get().showToast('✅ Cliente actualizado')
  },

  deleteCliente: async (id) => {
    if (!isConfigured) {
      set(s => ({ clientes: s.clientes.filter(c => c.id !== id) }))
      get().showToast('🗑️ Cliente eliminado')
      return
    }
    await supabase.from('clientes').delete().eq('id', id)
    const hoy = get().hoy.filter(x => x !== id)
    const entregas = {...get().entregas}; delete entregas[id]
    set(s => ({ clientes: s.clientes.filter(c => c.id !== id), hoy, entregas }))
    lsSet(LS_HOY, hoy); lsSet(LS_ENT, entregas)
    get().showToast('🗑️ Cliente eliminado')
  },

  // ═══════════════════════════════════════════════════════════════
  // RUTAS CRUD
  // ═══════════════════════════════════════════════════════════════
  addRuta: async (data) => {
    if (!isConfigured) {
      const fake = { ...data, id: Date.now().toString(), clienteIds: [], created_at: new Date().toISOString() }
      set(s => ({ rutas: [...s.rutas, fake] }))
      get().showToast('✅ Ruta creada')
      return fake
    }
    const { data: inserted, error } = await supabase.from('rutas').insert({ nombre: data.nombre, descripcion: data.descripcion, user_id: get().userId }).select().single()
    if (error) { get().showToast('❌ Error al crear ruta'); return }
    const newRuta = { ...inserted, clienteIds: [] }
    set(s => ({ rutas: [...s.rutas, newRuta] }))
    get().showToast('✅ Ruta creada')
    return newRuta
  },

  updateRuta: async (id, data) => {
    if (!isConfigured) {
      set(s => ({ rutas: s.rutas.map(r => r.id === id ? {...r, ...data} : r) }))
      return
    }
    await supabase.from('rutas').update({ nombre: data.nombre, descripcion: data.descripcion }).eq('id', id)
    set(s => ({ rutas: s.rutas.map(r => r.id === id ? {...r, ...data} : r) }))
    get().showToast('✅ Ruta actualizada')
  },

  deleteRuta: async (id) => {
    if (!isConfigured) {
      set(s => ({ rutas: s.rutas.filter(r => r.id !== id) }))
      return
    }
    await supabase.from('rutas').delete().eq('id', id)
    set(s => ({ rutas: s.rutas.filter(r => r.id !== id) }))
    get().showToast('🗑️ Ruta eliminada')
  },

  addClienteToRuta: async (rutaId, clienteId) => {
    const ruta = get().rutas.find(r => r.id === rutaId)
    if (!ruta || ruta.clienteIds.includes(clienteId)) return
    const orden = ruta.clienteIds.length
    set(s => ({ rutas: s.rutas.map(r => r.id === rutaId ? {...r, clienteIds: [...r.clienteIds, clienteId]} : r) }))
    get().showToast('✅ Cliente agregado a la ruta')
    if (isConfigured) {
      const { error } = await supabase.from('ruta_clientes').insert({ ruta_id: rutaId, cliente_id: clienteId, orden })
      if (error) {
        set(s => ({ rutas: s.rutas.map(r => r.id === rutaId ? {...r, clienteIds: r.clienteIds.filter(id => id !== clienteId)} : r) }))
        get().showToast('❌ Error al agregar cliente')
      }
    }
  },

  removeClienteFromRuta: async (rutaId, clienteId) => {
    set(s => ({ rutas: s.rutas.map(r => r.id === rutaId ? {...r, clienteIds: r.clienteIds.filter(id => id !== clienteId)} : r) }))
    if (isConfigured) {
      await supabase.from('ruta_clientes').delete().eq('ruta_id', rutaId).eq('cliente_id', clienteId)
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // HOY / RUTA DEL DÍA
  // ═══════════════════════════════════════════════════════════════
  toggleHoy: (id) => {
    const { hoy, entregas } = get()
    if (entregas[id]) { get().showToast('Ya fue entregado hoy'); return }
    const next = hoy.includes(id) ? hoy.filter(x => x !== id) : [...hoy, id]
    set({ hoy: next }); lsSet(LS_HOY, next)
    autoSaveSession(next, get().entregas, get().comisionPct)
  },

  cargarRutaEnHoy: (rutaId) => {
    const ruta = get().rutas.find(r => r.id === rutaId)
    if (!ruta) return
    const { hoy } = get()
    const toAdd = ruta.clienteIds.filter(id => !hoy.includes(id))
    const next  = [...hoy, ...toAdd]
    set({ hoy: next }); lsSet(LS_HOY, next)
    autoSaveSession(next, get().entregas, get().comisionPct)
    get().showToast(`📍 ${toAdd.length} clientes cargados`)
  },

  deselAll: () => {
    set({ hoy: [], entregas: {} })
    lsSet(LS_HOY, []); lsSet(LS_ENT, {})
    if (isConfigured && navigator.onLine) {
      supabase.from('sesion_activa').delete().eq('fecha_iso', _todayKey).then(() => {})
    }
  },

  reordenarHoy: (newOrder) => {
    set({ hoy: newOrder }); lsSet(LS_HOY, newOrder)
    autoSaveSession(newOrder, get().entregas, get().comisionPct)
  },

  ordenarPorGPS: (lat, lon) => {
    const { hoy, clientes } = get()
    const hoyClientes = hoy.map(id => clientes.find(c => c.id === id)).filter(Boolean)
    const ordered = greedyRoute(lat, lon, hoyClientes)
    const next = ordered.map(c => c.id)
    set({ hoy: next }); lsSet(LS_HOY, next)
    get().showToast('🧭 Ruta ordenada por cercanía')
  },

  reordenarPendientes: (lat, lon) => {
    const { hoy, entregas, clientes } = get()
    const deliveredIds    = hoy.filter(id => entregas[id])
    const pendingIds      = hoy.filter(id => !entregas[id])
    const pendingClientes = pendingIds.map(id => clientes.find(c => c.id === id)).filter(Boolean)
    const ordered = greedyRoute(lat, lon, pendingClientes)
    const next = [...deliveredIds, ...ordered.map(c => c.id)]
    set({ hoy: next }); lsSet(LS_HOY, next)
    get().showToast('🧭 Pendientes reordenados por cercanía')
  },

  setComisionPct: (pct) => {
    set({ comisionPct: pct }); lsSet(LS_COM, pct)
    autoSaveSession(get().hoy, get().entregas, pct)
  },

  // ═══════════════════════════════════════════════════════════════
  // ENTREGAS
  // ═══════════════════════════════════════════════════════════════
  confirmarEntrega: async (clienteId, data) => {
    const { entregas } = get()
    const hora = data.hora || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    const { isEdit, hora: _hora, ...rest } = data
    const next = { ...entregas, [clienteId]: { ...rest, hora } }
    set({ entregas: next }); lsSet(LS_ENT, next)
    // Auto-guardar en la nube después de cada entrega
    autoSaveSession(get().hoy, next, get().comisionPct)

    // Actualizar deuda del cliente (solo en registros nuevos, no ediciones)
    if (!isEdit && data.tipo === 'parcial' && data.deuda_generada > 0) {
      const cliente = get().clientes.find(c => c.id === clienteId)
      const nuevaDeuda = (cliente?.deuda || 0) + data.deuda_generada
      set(s => ({ clientes: s.clientes.map(c => c.id === clienteId ? { ...c, deuda: nuevaDeuda } : c) }))
      if (isConfigured && navigator.onLine) {
        await supabase.from('clientes').update({ deuda: nuevaDeuda }).eq('id', clienteId)
      }
    }

    if (!isEdit && data.cobro_deuda) {
      set(s => ({ clientes: s.clientes.map(c => c.id === clienteId ? { ...c, deuda: 0 } : c) }))
      if (isConfigured && navigator.onLine) {
        await supabase.from('clientes').update({ deuda: 0 }).eq('id', clienteId)
      }
    }

    const toastMsg = data.tipo === 'cancelado'  ? '❌ Cancelación registrada' :
                     data.tipo === 'parcial'    ? '💸 Pago parcial registrado' :
                     data.tipo === 'devolucion' ? '🔄 Devolución registrada' :
                                                  '✅ Entrega registrada'
    get().showToast(toastMsg)
  },

  deleteHistorialDia: async (id) => {
    set(s => ({ historial: s.historial.filter(h => h.id !== id) }))
    if (isConfigured && navigator.onLine) {
      await supabase.from('historial').delete().eq('id', id)
    }
    get().showToast('🗑️ Día eliminado del historial')
  },

  editarEntregaHistorial: async (historialId, entregaIdx, newData) => {
    const hist = get().historial.find(h => h.id === historialId)
    if (!hist) return
    const entregas = [...(hist.entregas || [])]
    const prev = entregas[entregaIdx]
    entregas[entregaIdx] = { ...prev, ...newData, entregado: newData.tipo !== 'cancelado' }
    const total_monto      = Math.round(entregas.reduce((s, e) => s + (+e.monto || 0), 0))
    const total_entregados = entregas.filter(e => e.entregado).length
    if (isConfigured && navigator.onLine) {
      await supabase.from('historial').update({ entregas, total_monto, total_entregados }).eq('id', historialId)
    }
    set(s => ({ historial: s.historial.map(h => h.id === historialId ? { ...h, entregas, total_monto, total_entregados } : h) }))
    get().showToast('✅ Entrega actualizada')
  },

  uploadFoto: async (file, clienteId) => {
    if (!isConfigured) return null
    const ext  = file.name.split('.').pop() || 'jpg'
    const path = `${new Date().toISOString().slice(0,10)}/${clienteId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('fotos-entregas').upload(path, file, { upsert: true })
    if (error) { get().showToast('❌ Error al subir foto'); return null }
    const { data } = supabase.storage.from('fotos-entregas').getPublicUrl(path)
    return data.publicUrl
  },

  // ═══════════════════════════════════════════════════════════════
  // FINALIZAR DÍA
  // ═══════════════════════════════════════════════════════════════
  finalizarDia: async () => {
    const { hoy, entregas, comisionPct, clientes } = get()

    // Guardia crítica: nunca finalizar con ruta vacía — evita pisar historial con $0
    if (hoy.length === 0) {
      get().showToast('⚠️ No hay clientes en la ruta de hoy')
      return
    }

    const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const entList = hoy.map(id => {
      const c = clientes.find(x => x.id === id)
      const e = entregas[id]
      return { id, nombre: c?.nombre || '?', direccion: c?.direccion || '', zona: c?.zona || '',
               entregado: !!e && e.tipo !== 'cancelado',
               tipo: e?.tipo || (e ? 'entregado' : null),
               obs: e?.obs || '', hora: e?.hora || '',
               metodo_pago: e?.metodo_pago || '', monto: e?.monto || 0,
               foto_url: e?.foto_url || '', foto_urls: e?.foto_urls || [],
               monto_original: e?.monto_original || null,
               monto_devolucion: e?.monto_devolucion || null,
               monto_total: e?.monto_total || null,
               deuda_generada: e?.deuda_generada || null,
               motivo_cancelacion: e?.motivo_cancelacion || null }
    })
    const totalMonto = Math.round(entList.reduce((s,e) => s + (+e.monto || 0), 0))
    const totalEnt   = entList.filter(e => e.entregado).length
    const record = { fecha, fecha_iso: _todayKey, comision_pct: comisionPct, total_monto: totalMonto,
                     total_entregados: totalEnt, total_clientes: entList.length, entregas: entList,
                     user_id: get().userId }

    if (isConfigured) {
      if (navigator.onLine) {
        // Buscar TODOS los registros con esa fecha (puede haber duplicados)
        const { data: existentes } = await supabase.from('historial').select('id,total_monto').eq('fecha', fecha).order('created_at', { ascending: false })
        if (existentes && existentes.length > 0) {
          const existingMonto = +(existentes[0].total_monto || 0)
          // Solo actualizar si el nuevo monto es igual o mayor — protección contra pisar datos reales con $0
          if (totalMonto >= existingMonto) {
            await supabase.from('historial').update(record).eq('id', existentes[0].id)
          }
          // Borrar duplicados siempre
          for (let i = 1; i < existentes.length; i++) {
            await supabase.from('historial').delete().eq('id', existentes[i].id)
          }
        } else {
          await supabase.from('historial').insert(record)
        }
      } else {
        // Sin conexión: guardar en cola local, se sincroniza al reconectar
        const pending = lsGet(LS_PENDING, [])
        // Reemplazar si ya hay un registro pendiente para la misma fecha
        const filteredPending = pending.filter(p => p.fecha !== fecha)
        lsSet(LS_PENDING, [...filteredPending, record])
        get().showToast('📦 Día guardado — se sube a la nube cuando tengas internet')
      }
    }

    // Deduplicar por fecha al actualizar el estado local
    const newEntry = { ...record, id: Date.now().toString(), created_at: new Date().toISOString() }
    const prevHist = get().historial.filter(h => h.fecha !== fecha)
    const histNext = [newEntry, ...prevHist].slice(0, 90)
    set({ historial: histNext, hoy: [], entregas: {} })
    lsSet(LS_HOY, []); lsSet(LS_ENT, {})
    // Limpiar sesión activa de la nube — el día ya quedó en historial
    if (isConfigured && navigator.onLine) {
      supabase.from('sesion_activa').delete().eq('fecha_iso', _todayKey).then(() => {})
    }
    if (navigator.onLine) get().showToast('📦 Día guardado en historial')
  },

  // ═══════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════
  updateNegocio: async (negocio) => {
    const userId = get().userId
    if (!userId || !isConfigured) return
    await supabase.from('profiles').upsert({ id: userId, negocio }, { onConflict: 'id' })
    set(s => ({ perfil: { ...s.perfil, negocio } }))
    get().showToast('✅ Negocio actualizado')
  },

  deleteAccount: async () => {
    try {
      await supabase.rpc('delete_current_user')
    } catch (_) {
      // Fallback si la función no está disponible: eliminar datos manualmente
      const userId = get().userId
      await supabase.from('clientes').delete().eq('user_id', userId)
      await supabase.from('historial').delete().eq('user_id', userId)
      await supabase.from('sesion_activa').delete().eq('user_id', userId)
      await supabase.from('rutas').delete().eq('user_id', userId)
    }
    await supabase.auth.signOut()
  },

  logout: async () => {
    lsDel(LS_HOY); lsDel(LS_ENT); lsDel(LS_COM)
    lsDel(LS_FECHA); lsDel(LS_PENDING); lsDel(LS_PENDING_SES)
    if (isConfigured) await supabase.auth.signOut()
  },

  setTab:    (tab)        => set({ activeTab: tab }),
  openModal: (type, data = {}) => set({ modal: { type, data } }),
  closeModal: ()          => set({ modal: null }),

  showToast: (msg) => {
    const id = Date.now()
    set({ toast: { msg, id } })
    setTimeout(() => set(s => s.toast?.id === id ? { toast: null } : s), 2600)
  },
}))

export default useStore
