import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { usePushSubscription } from '../hooks/usePushSubscription'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
}

export default function ChatScreen() {
  const perfil     = useStore(s => s.perfil)
  const activeTab  = useStore(s => s.activeTab)
  const setChatUnread = useStore(s => s.setChatUnread)

  const [equipoId, setEquipoId]   = useState(null)
  const [mensajes, setMensajes]   = useState([])
  const [perfiles, setPerfiles]   = useState({})
  const [texto, setTexto]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [noEquipo, setNoEquipo]   = useState(false)
  const [enviando, setEnviando]   = useState(false)

  const bottomRef    = useRef(null)
  const channelRef   = useRef(null)
  const equipoIdRef  = useRef(null)
  const textareaRef  = useRef(null)

  usePushSubscription(perfil, equipoId)

  const markRead = useCallback((eId) => {
    const key = `rr_chat_last_read_${eId}`
    localStorage.setItem(key, new Date().toISOString())
    setChatUnread(0)
  }, [setChatUnread])

  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => {
    if (activeTab === 'chat' && equipoIdRef.current) {
      markRead(equipoIdRef.current)
    }
  }, [activeTab, markRead])

  const init = async () => {
    // Buscar equipo: primero como dueño, luego como miembro
    let eId = null

    const { data: myEquipo } = await supabase
      .from('equipos').select('id').eq('owner_id', perfil.id).maybeSingle()
    eId = myEquipo?.id

    if (!eId) {
      const { data: member } = await supabase
        .from('equipo_miembros').select('equipo_id').eq('user_id', perfil.id).maybeSingle()
      eId = member?.equipo_id
    }

    if (!eId) {
      setNoEquipo(true)
      setLoading(false)
      return
    }

    setEquipoId(eId)
    equipoIdRef.current = eId
    await fetchMensajes(eId)
    suscribirse(eId)
    markRead(eId)
    setLoading(false)
  }

  const fetchMensajes = async (eId) => {
    const { data } = await supabase
      .from('mensajes')
      .select('id, user_id, texto, created_at')
      .eq('equipo_id', eId)
      .order('created_at', { ascending: true })
      .limit(150)

    if (!data) return
    setMensajes(data)
    await fetchPerfiles(data.map(m => m.user_id))
  }

  const fetchPerfiles = async (ids) => {
    const unique = [...new Set(ids)]
    if (!unique.length) return
    const { data } = await supabase
      .from('profiles').select('id, negocio, nombre, rol').in('id', unique)
    if (data) setPerfiles(prev => ({
      ...prev,
      ...Object.fromEntries(data.map(p => [p.id, p]))
    }))
  }

  const suscribirse = (eId) => {
    const channel = supabase
      .channel(`chat-${eId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensajes',
        filter: `equipo_id=eq.${eId}`,
      }, async (payload) => {
        const msg = payload.new
        setMensajes(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        // Fetch profile if new sender
        setPerfiles(prev => {
          if (!prev[msg.user_id]) {
            fetchPerfiles([msg.user_id])
          }
          return prev
        })
        if (document.visibilityState === 'visible') {
          markRead(eId)
        } else {
          // Increment badge
          useStore.getState().setChatUnread(
            (useStore.getState().chatUnread || 0) + 1
          )
        }
      })
      .subscribe()
    channelRef.current = channel
  }

  const enviar = async () => {
    const t = texto.trim()
    if (!t || !equipoId || enviando) return
    setEnviando(true)
    setTexto('')
    textareaRef.current?.focus()
    const { error } = await supabase.from('mensajes').insert({
      equipo_id: equipoId,
      user_id: perfil.id,
      texto: t,
    })
    if (error) {
      setTexto(t)
    } else {
      const nombre = perfiles[perfil.id]?.negocio || perfiles[perfil.id]?.nombre || 'Equipo'
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return
        fetch('/api/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            equipoId,
            title: `💬 ${nombre}`,
            body: t.slice(0, 120),
          }),
        }).catch(() => {})
      })
    }
    setEnviando(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  // Agrupar mensajes por fecha
  const buildItems = () => {
    const items = []
    let lastDate = null
    for (const m of mensajes) {
      const d = formatDate(m.created_at)
      if (d !== lastDate) {
        items.push({ type: 'date', label: d, key: `d-${m.id}` })
        lastDate = d
      }
      items.push({ type: 'msg', ...m })
    }
    return items
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-[13px] text-muted">Cargando chat...</p>
    </div>
  )

  if (noEquipo) return (
    <div className="flex flex-col items-center justify-center h-[60vh] px-8 text-center">
      <div className="text-[48px] mb-3 opacity-40">💬</div>
      <p className="text-[15px] font-bold text-textc mb-2">Sin equipo todavía</p>
      <p className="text-[12px] text-muted leading-relaxed">
        El chat es para equipos. Pedile al encargado que te mande un link de invitación.
      </p>
    </div>
  )

  const items = buildItems()

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* Mensajes — scrollable, padding para el input fijo + tabbar */}
      <div className="overflow-y-auto px-3 py-3 hide-scrollbar" style={{ height: '100%', paddingBottom: '140px' }}>
        {mensajes.length === 0 && (
          <div className="text-center py-16 text-muted">
            <div className="text-[44px] mb-3 opacity-30">💬</div>
            <p className="text-[13px]">Ningún mensaje todavía.</p>
            <p className="text-[11px] mt-1">¡Empezá la conversación!</p>
          </div>
        )}

        <div className="space-y-[3px]">
          {items.map((item) => {
            if (item.type === 'date') return (
              <div key={item.key} className="flex items-center gap-2 py-3">
                <div className="flex-1 h-px bg-[var(--c-border)]" />
                <span className="text-[9px] text-muted uppercase tracking-[.6px]">{item.label}</span>
                <div className="flex-1 h-px bg-[var(--c-border)]" />
              </div>
            )

            const isMe  = item.user_id === perfil.id
            const prof  = perfiles[item.user_id]
            const nombre = prof?.negocio || prof?.nombre || 'Usuario'
            const rol    = prof?.rol || 'repartidor'
            const time   = formatTime(item.created_at)

            return (
              <div key={item.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-[2px]`}>
                <div className={`max-w-[78%] flex flex-col gap-[3px] ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <div className="flex items-center gap-[4px] px-1">
                      <span className="text-[9px]">{rol === 'encargado' ? '📊' : '🚚'}</span>
                      <span className="text-[10px] font-semibold text-muted">{nombre}</span>
                    </div>
                  )}
                  <div className={`px-[12px] py-[8px] text-[13px] leading-snug break-words ${
                    isMe
                      ? 'bg-amber-400 text-[#1a1a28] rounded-2xl rounded-br-[6px]'
                      : 'bg-surface2 text-textc border border-[var(--c-border)] rounded-2xl rounded-bl-[6px]'
                  }`}>
                    {item.texto}
                  </div>
                  <span className="text-[9px] text-muted2 px-1">{time}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Input fijo encima del tabbar */}
      <div
        className="fixed left-0 right-0 px-3 pt-[10px] pb-[80px] border-t border-[var(--c-border)]"
        style={{
          bottom: 0,
          background: 'var(--c-surface)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 40,
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribí un mensaje..."
            rows={1}
            className="flex-1 bg-bg border border-[var(--c-border2)] rounded-xl px-3 py-[10px] text-[13px] text-textc placeholder:text-muted2 outline-none focus:border-amber-400 resize-none transition-colors"
            style={{ maxHeight: '96px' }}
          />
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            className="w-[40px] h-[40px] bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-35 active:scale-95 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1a1a28" style={{ transform: 'rotate(90deg)' }}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
