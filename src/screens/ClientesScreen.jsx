import { useState, useRef, useMemo } from 'react'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'
import { useFreemium, CLIENT_LIMIT } from '../hooks/useFreemium'

const ZONAS = ['Centro', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras', 'Luján', 'Otro']

// ── CSV helpers ────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const cols = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      cols.push(cur.trim()); cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur.trim())
  return cols
}

function parseCSV(text) {
  // Strip BOM si viene de Excel en UTF-8
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)
    const row = { _line: i + 1 }
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

function validateRow(raw) {
  const nombre = (raw.nombre || '').trim()
  if (!nombre) return { valid: false, reason: 'Nombre vacío' }
  let zona = (raw.zona || '').trim()
  const zonaMatch = ZONAS.find(z => z.toLowerCase() === zona.toLowerCase())
  zona = zonaMatch || (zona ? 'Otro' : 'Centro')
  return {
    valid: true,
    data: {
      nombre,
      direccion: (raw.direccion || '').trim(),
      zona,
      telefono: (raw.telefono || '').trim(),
      notas: (raw.notas || '').trim(),
      codigo: (raw.codigo || '').trim(),
    },
  }
}

function downloadTemplate() {
  const rows = [
    'nombre,direccion,zona,telefono,notas,codigo',
    '"Supermercado López","San Martín 1234","Centro","2614001234","Cliente VIP","C001"',
    '"Almacén Rodríguez","Belgrano 567","Godoy Cruz","2615009876","","C002"',
    '"Kiosco Fernández","Rivadavia 890","Maipú","","Pago siempre en efectivo","C003"',
  ].join('\n')
  const blob = new Blob(['﻿' + rows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_clientes.csv'; a.click()
  URL.revokeObjectURL(url)
}
function getInitials(nombre) {
  if (!nombre) return '?'
  const w = nombre.trim().split(/\s+/)
  return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : (w[0][0] + w[1][0]).toUpperCase()
}

const ICON_BTN = {
  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--c-border)',
  color: '#636366', cursor: 'pointer',
}

// ──────────────────────────────────────────────────────────────────────────

export default function ClientesScreen() {
  const clientes        = useStore(s => s.clientes)
  const perfil          = useStore(s => s.perfil)
  const openModal       = useStore(s => s.openModal)
  const deleteCliente   = useStore(s => s.deleteCliente)
  const updateCliente   = useStore(s => s.updateCliente)
  const importClientes  = useStore(s => s.importClientes)
  const setTab          = useStore(s => s.setTab)
  const { isLimited }   = useFreemium()
  const atLimit         = isLimited && clientes.length >= CLIENT_LIMIT

  const [q, setQ]                         = useState('')
  const [zona, setZona]                   = useState('Todos')
  const [soloDeudores, setSoloDeudores]   = useState(false)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState(null)
  const [alertaDismissed, setAlerta]      = useState(false)

  const diasRecordatorio = perfil?.recordatorio_deuda_dias ?? 3

  const clientesMorosos = useMemo(() => {
    if (!diasRecordatorio || alertaDismissed) return []
    const hoy = new Date()
    return clientes.filter(c => {
      if (!c.deuda || c.deuda <= 0 || !c.deuda_desde) return false
      const diasDeuda = Math.floor((hoy - new Date(c.deuda_desde)) / 86400000)
      return diasDeuda >= diasRecordatorio
    })
  }, [clientes, diasRecordatorio, alertaDismissed])

  const fileRef = useRef(null)

  const zonasFiltro = ['Todos', ...ZONAS.filter(z => clientes.some(c => c.zona === z))]

  const lista = clientes.filter(c => {
    const mQ = !q ||
      c.nombre.toLowerCase().includes(q.toLowerCase()) ||
      (c.direccion || '').toLowerCase().includes(q.toLowerCase()) ||
      (c.codigo || '').includes(q.trim())
    const mZ = zona === 'Todos' || c.zona === zona
    const mD = !soloDeudores || (c.deuda > 0)
    return mQ && mZ && mD
  })

  const byZona = {}
  ZONAS.forEach(z => { byZona[z] = clientes.filter(c => c.zona === z).length })
  const topZonas = ZONAS.filter(z => byZona[z] > 0).slice(0, 2)
  const totalDeuda = clientes.reduce((s, c) => s + (+c.deuda || 0), 0)

  function fmtMoney(n) {
    if (!n) return '$0'
    return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })
  }

  const navGPS = (lat, lon) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`, '_blank')

  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset para permitir re-importar el mismo archivo
    if (!file) return

    setImporting(true)
    setImportResult(null)

    const text = await file.text()
    const rawRows = parseCSV(text)

    if (rawRows.length === 0) {
      setImportResult({ ok: 0, errors: [{ row: 1, nombre: '', reason: 'Archivo vacío o sin datos' }] })
      setImporting(false)
      return
    }

    // Validar cada fila
    const valid = []
    const parseErrors = []
    rawRows.forEach(raw => {
      const result = validateRow(raw)
      if (result.valid) valid.push(result.data)
      else parseErrors.push({ row: raw._line, nombre: (raw.nombre || '').trim(), reason: result.reason })
    })

    let ok = 0
    let dbErrors = []
    if (valid.length > 0) {
      const result = await importClientes(valid)
      ok = result.ok
      // db errors: adjust row numbers to match original file (valid rows only, offset by parse errors before them)
      dbErrors = result.dbErrors
    }

    setImportResult({ ok, errors: [...parseErrors, ...dbErrors] })
    setImporting(false)
  }

  return (
    <div className="p-4">
      {/* Stats */}
      <div className="flex mb-4" style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '13px 14px', borderRight: '0.5px solid var(--c-border)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 500, color: '#D4962A', lineHeight: 1 }}>{clientes.length}</div>
          <div style={{ fontSize: 9, color: 'var(--c-muted3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>Clientes</div>
        </div>
        {totalDeuda > 0 && (
          <button onClick={() => setSoloDeudores(v => !v)} style={{ flex: 1, padding: '13px 14px', borderRight: '0.5px solid var(--c-border)', textAlign: 'left' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 500, color: soloDeudores ? '#D4962A' : '#FF453A', lineHeight: 1 }}>{fmtMoney(totalDeuda)}</div>
            <div style={{ fontSize: 9, color: 'var(--c-muted3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{soloDeudores ? '← Todos' : 'Deuda total'}</div>
          </button>
        )}
        {topZonas.slice(0, totalDeuda > 0 ? 1 : 2).map(z => (
          <div key={z} style={{ flex: 1, padding: '13px 14px', borderRight: '0.5px solid var(--c-border)' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 500, color: '#636366', lineHeight: 1 }}>{byZona[z]}</div>
            <div style={{ fontSize: 9, color: 'var(--c-muted3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{z.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      {/* Banner deudas vencidas */}
      {clientesMorosos.length > 0 && (
        <div className="mb-3 bg-red-500/8 border border-red-500/30 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-[12px] font-bold text-red-400">
                ⏰ {clientesMorosos.length} cliente{clientesMorosos.length > 1 ? 's deben' : ' debe'} hace +{diasRecordatorio} día{diasRecordatorio !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-muted mt-[2px]">Configurá en Perfil el tiempo de aviso</p>
            </div>
            <button
              onClick={() => setAlerta(true)}
              className="text-muted text-[18px] leading-none flex-shrink-0 mt-[-2px]"
            >×</button>
          </div>
          <div className="flex flex-col gap-[5px]">
            {clientesMorosos.slice(0, 4).map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-textc truncate flex-1">{c.nombre}</span>
                <span className="text-[11px] font-bold text-red-400 flex-shrink-0">{fmtMoney(c.deuda)}</span>
                <button
                  onClick={() => openModal('confirm', {
                    title: 'Cobrar deuda',
                    msg: `¿Marcar la deuda de ${fmtMoney(c.deuda)} de "${c.nombre}" como cobrada?`,
                    onConfirm: () => updateCliente(c.id, { deuda: 0 }),
                  })}
                  className="flex-shrink-0 text-[10px] font-bold text-[#1a1a28] bg-amber-400 px-2 py-[3px] rounded-lg"
                >
                  Cobrar
                </button>
              </div>
            ))}
            {clientesMorosos.length > 4 && (
              <button onClick={() => setSoloDeudores(true)} className="text-[10px] text-red-400 underline text-left mt-1">
                Ver {clientesMorosos.length - 4} más →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banner freemium */}
      {atLimit && (
        <div className="mb-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-amber-400">🔒 Límite alcanzado</p>
            <p className="text-[11px] text-muted mt-[2px]">Suscribite para agregar más clientes.</p>
          </div>
          <button
            onClick={() => setTab('planes')}
            className="flex-shrink-0 text-[10px] font-bold text-[#1a1a28] bg-amber-400 px-3 py-[5px] rounded-lg active:scale-95 transition-transform"
          >Ver planes</button>
        </div>
      )}

      {/* Import bar */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => atLimit ? setTab('planes') : fileRef.current?.click()}
          disabled={importing}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-[11px] text-[12px] font-heading font-bold active:scale-[.98] transition-transform disabled:opacity-50 ${
            atLimit
              ? 'bg-surface border border-[var(--c-border)] text-muted'
              : 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
          }`}
        >
          {atLimit ? '🔒 Importar CSV' : '📥 Importar CSV'}
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center justify-center gap-1 bg-surface border border-[var(--c-border)] text-muted rounded-xl px-4 py-[11px] text-[12px] font-heading font-bold active:scale-[.98] transition-transform"
        >
          📄 Plantilla
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />

      {/* Import loading */}
      {importing && (
        <div className="mb-3 bg-surface border border-[var(--c-border)] rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <span className="text-[13px] text-muted">Importando clientes...</span>
        </div>
      )}

      {/* Import result */}
      {importResult && !importing && (
        <div className={`mb-3 rounded-xl border px-4 py-3 ${
          importResult.errors.length === 0
            ? 'bg-emerald-500/5 border-emerald-500/25'
            : importResult.ok === 0
              ? 'bg-red-500/5 border-red-500/25'
              : 'bg-amber-400/5 border-amber-400/20'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              {importResult.ok > 0 && (
                <span className="text-[13px] font-bold text-emerald-400">
                  ✅ {importResult.ok} cliente{importResult.ok !== 1 ? 's' : ''} importado{importResult.ok !== 1 ? 's' : ''}
                </span>
              )}
              {importResult.errors.length > 0 && (
                <span className={`text-[13px] font-bold text-red-400 ${importResult.ok > 0 ? ' · ' : ''}`}>
                  {importResult.ok > 0 && '· '}❌ {importResult.errors.length} con error
                </span>
              )}
              {importResult.ok === 0 && importResult.errors.length === 0 && (
                <span className="text-[13px] text-muted">Sin filas válidas</span>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-muted text-[18px] leading-none flex-shrink-0 hover:text-textc">×</button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-2 space-y-[3px]">
              {importResult.errors.map((err, i) => (
                <div key={i} className="text-[11px] text-red-400">
                  Fila {err.row}{err.nombre ? ` — "${err.nombre}"` : ''}: {err.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3A3A3C" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, dirección o código..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', caretColor: '#D4962A', fontFamily: "'General Sans', sans-serif" }}
          className="w-full rounded-xl pl-9 pr-4 py-[11px] text-sm outline-none placeholder:text-[#3A3A3C]"
        />
      </div>

      {/* Zone filter */}
      <div className="flex gap-[7px] overflow-x-auto hide-scrollbar pb-1 mb-3">
        {zonasFiltro.map(z => (
          <button key={z} onClick={() => setZona(z)}
            style={zona === z
              ? { background: '#D4962A', color: '#0C0C0E', border: '1px solid #D4962A' }
              : { background: 'var(--c-surface)', color: '#636366', border: '1px solid var(--c-border)' }}
            className="flex-shrink-0 px-3 py-[6px] rounded-full text-[11px] font-semibold transition-all">{z}</button>
        ))}
      </div>

      {/* List */}
      {lista.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <div className="text-[44px] mb-2 opacity-40">{clientes.length === 0 ? '👥' : '🔍'}</div>
          <div className="text-[13px] leading-relaxed">
            {clientes.length === 0 ? 'La base está vacía.\nTocá + para agregar clientes.' : 'Sin resultados'}
          </div>
        </div>
      ) : lista.map(c => {
        const hasDebt = c.deuda > 0
        const initials = getInitials(c.nombre)
        return (
          <div key={c.id} className="flex items-center gap-3 animate-fadeUp" style={{ padding: '12px 4px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: hasDebt ? '#1E1A14' : '#16161A',
              border: '1px solid ' + (hasDebt ? 'rgba(212,150,42,0.18)' : 'var(--c-border)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 500, color: hasDebt ? '#D4962A' : '#636366' }}>{initials}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-[2px]">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)' }} className="truncate">{c.nombre}</div>
                {c.codigo && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: '#636366', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '1px 5px' }}>#{c.codigo}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#636366' }} className="truncate">{c.direccion || 'Sin dirección'}</div>
              {(c.telefono || c.notas) && (
                <div className="flex items-center gap-2 mt-[2px]">
                  {c.telefono && <a href={`tel:${c.telefono}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#636366' }}>{c.telefono}</a>}
                  {c.notas && <span style={{ fontSize: 10, color: '#D4962A' }} className="truncate">{c.notas}</span>}
                </div>
              )}
            </div>
            {/* Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {/* Debt badge */}
              <div style={{
                background: hasDebt ? 'rgba(255,69,58,0.10)' : 'rgba(52,199,89,0.08)',
                border: '1px solid ' + (hasDebt ? 'rgba(255,69,58,0.20)' : 'rgba(52,199,89,0.16)'),
                borderRadius: 6, padding: '2px 7px',
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 500, color: hasDebt ? '#FF453A' : '#34C759' }}>
                  {hasDebt ? fmtMoney(c.deuda) : 'Al día'}
                </span>
              </div>
              {/* Action buttons */}
              <div className="flex gap-1">
                {hasDebt && (
                  <button onClick={() => openModal('confirm', { title: 'Cobrar deuda', msg: `¿Marcar la deuda de ${fmtMoney(c.deuda)} de "${c.nombre}" como cobrada?`, onConfirm: () => updateCliente(c.id, { deuda: 0 }) })}
                    style={{ ...ICON_BTN, color: '#FF453A', background: 'rgba(255,69,58,0.10)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  </button>
                )}
                <button onClick={() => openModal('clienteHistorial', { clienteId: c.id, nombre: c.nombre, deuda: c.deuda || 0 })} style={ICON_BTN}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6"/></svg>
                </button>
                {c.lat && (
                  <button onClick={() => navGPS(c.lat, c.lon)} style={{ ...ICON_BTN, color: '#34C759' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 018 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 018-8z"/></svg>
                  </button>
                )}
                <button onClick={() => openModal('cliente', { edit: c })} style={ICON_BTN}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => openModal('confirm', { title: 'Eliminar cliente', msg: `¿Eliminar a "${c.nombre}" de la base?`, onConfirm: () => deleteCliente(c.id) })}
                  style={{ ...ICON_BTN, color: '#FF453A' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                </button>
              </div>
            </div>
          </div>
        )
      })}

      <div className="h-20" />

      <button
        onClick={() => atLimit ? setTab('planes') : openModal('cliente', {})}
        className="fixed bottom-[88px] right-[18px] w-[52px] h-[52px] rounded-[16px] flex items-center justify-center z-[60] transition-transform active:scale-95"
        style={atLimit
          ? { background: 'var(--c-surface)', border: '2px solid rgba(212,150,42,0.40)', color: '#D4962A' }
          : { background: '#D4962A', color: '#0C0C0E', boxShadow: '0 8px 24px rgba(212,150,42,0.35)' }}
      >
        {atLimit
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          : <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, marginTop: -2 }}>+</span>
        }
      </button>
    </div>
  )
}
