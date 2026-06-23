import { useState, useRef } from 'react'
import useStore from '../store/useStore'
import ZoneBadge from '../components/ui/ZoneBadge'

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
// ──────────────────────────────────────────────────────────────────────────

export default function ClientesScreen() {
  const clientes        = useStore(s => s.clientes)
  const openModal       = useStore(s => s.openModal)
  const deleteCliente   = useStore(s => s.deleteCliente)
  const updateCliente   = useStore(s => s.updateCliente)
  const importClientes  = useStore(s => s.importClientes)

  const [q, setQ]                       = useState('')
  const [zona, setZona]                 = useState('Todos')
  const [soloDeudores, setSoloDeudores] = useState(false)
  const [importing, setImporting]       = useState(false)
  const [importResult, setImportResult] = useState(null)

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
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
          <div className="font-heading text-[22px] font-extrabold text-info">{clientes.length}</div>
          <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">Total</div>
        </div>
        {totalDeuda > 0 && (
          <button
            onClick={() => setSoloDeudores(v => !v)}
            className={`flex-1 rounded-xl p-2 text-center border transition-all ${soloDeudores ? 'bg-red-500/20 border-red-500/60' : 'bg-surface border-red-500/25'}`}
          >
            <div className="font-heading text-[15px] font-extrabold text-red-400 leading-tight mt-[3px]">{fmtMoney(totalDeuda)}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{soloDeudores ? '← Ver todos' : 'Deuda total'}</div>
          </button>
        )}
        {topZonas.slice(0, totalDeuda > 0 ? 1 : 2).map(z => (
          <div key={z} className="flex-1 bg-surface border border-[var(--c-border)] rounded-xl p-2 text-center">
            <div className="font-heading text-[22px] font-extrabold text-muted">{byZona[z]}</div>
            <div className="text-[9px] text-muted uppercase tracking-[.4px] mt-[2px]">{z.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      {/* Import bar */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-xl py-[11px] text-[12px] font-heading font-bold active:scale-[.98] transition-transform disabled:opacity-50"
        >
          📥 Importar CSV
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] pointer-events-none">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, dirección o código..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full bg-surface border border-[var(--c-border)] rounded-xl pl-9 pr-4 py-[11px] text-textc text-sm outline-none focus:border-amber-400 placeholder:text-muted"
        />
      </div>

      {/* Zone filter */}
      <div className="flex gap-[7px] overflow-x-auto hide-scrollbar pb-1 mb-3">
        {zonasFiltro.map(z => (
          <button key={z} onClick={() => setZona(z)}
            className={`flex-shrink-0 px-3 py-[6px] rounded-full border text-[11px] font-heading font-semibold transition-all ${
              zona === z ? 'bg-amber-400 text-[#1a1a28] border-amber-400' : 'bg-surface border-[var(--c-border)] text-muted'
            }`}>{z}</button>
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
      ) : lista.map(c => (
        <div key={c.id} className="bg-surface border border-[var(--c-border)] rounded-[14px] p-[13px_14px] mb-2 flex items-start gap-3 animate-fadeUp">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-[2px]">
              <div className="font-medium text-[14px] text-textc truncate">{c.nombre}</div>
              {c.codigo && (
                <span className="flex-shrink-0 text-[10px] font-bold text-muted bg-surface2 px-[6px] py-[2px] rounded-md font-mono">
                  #{c.codigo}
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted truncate">{c.direccion || 'Sin dirección'}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ZoneBadge zona={c.zona} />
              {c.telefono && (
                <a href={`tel:${c.telefono}`} onClick={e => e.stopPropagation()} className="text-[10px] text-blue-400 font-medium">
                  📞 {c.telefono}
                </a>
              )}
              {c.notas && <span className="text-[10px] text-amber-400 truncate">📝 {c.notas}</span>}
              {c.lat && <span className="text-[9px] text-emerald-400">📍 GPS</span>}
              {c.deuda > 0 && (
                <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-[6px] py-[2px] rounded-full">
                  Debe {fmtMoney(c.deuda)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-[5px] flex-shrink-0 flex-wrap justify-end">
            {c.deuda > 0 && (
              <button
                onClick={() => openModal('confirm', {
                  title: 'Cobrar deuda',
                  msg: `¿Marcar la deuda de ${fmtMoney(c.deuda)} de "${c.nombre}" como cobrada?`,
                  onConfirm: () => updateCliente(c.id, { deuda: 0 }),
                })}
                className="h-[30px] px-2 rounded-[7px] bg-red-500/12 text-red-400 flex items-center justify-center text-[10px] font-bold">
                💰 Cobrar
              </button>
            )}
            {c.lat && (
              <button onClick={() => navGPS(c.lat, c.lon)}
                className="w-[30px] h-[30px] rounded-[7px] bg-emerald-500/12 text-emerald-400 flex items-center justify-center text-[14px]">🧭</button>
            )}
            <button onClick={() => openModal('cliente', { edit: c })}
              className="w-[30px] h-[30px] rounded-[7px] bg-blue-500/12 text-blue-400 flex items-center justify-center text-[14px]">✏️</button>
            <button
              onClick={() => openModal('confirm', {
                title: 'Eliminar cliente',
                msg: `¿Eliminar a "${c.nombre}" de la base?`,
                onConfirm: () => deleteCliente(c.id),
              })}
              className="w-[30px] h-[30px] rounded-[7px] bg-red-500/12 text-red-400 flex items-center justify-center text-[14px]">✕</button>
          </div>
        </div>
      ))}

      <div className="h-20" />

      <button
        onClick={() => openModal('cliente', {})}
        className="fixed bottom-5 right-[18px] w-[52px] h-[52px] bg-amber-400 text-[#1a1a28] rounded-[16px] flex items-center justify-center text-[24px] font-bold shadow-[0_8px_24px_rgba(245,158,11,.35)] z-50 transition-transform active:scale-95"
      >+</button>
    </div>
  )
}
