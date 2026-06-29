import { useState, useEffect, useRef } from 'react'
import Modal from '../components/ui/Modal'
import Field, { Input, Select } from '../components/ui/Field'
import MapPickerModal from '../components/ui/MapPickerModal'
import useStore from '../store/useStore'

const ZONAS = ['Centro', 'Godoy Cruz', 'Maipú', 'Guaymallén', 'Las Heras', 'Luján', 'Otro']

const empty = { codigo: '', nombre: '', telefono: '', direccion: '', zona: 'Centro', notas: '', lat: '', lon: '' }

function formatSuggestion(item) {
  const a = item.address || {}
  const street = a.road ? a.road + (a.house_number ? ' ' + a.house_number : '') : null
  const locality = a.suburb || a.neighbourhood || a.city_district || null
  const city = a.city || a.town || a.village || a.municipality || a.county || null
  const parts = [street, locality, city].filter(Boolean)
  if (parts.length === 0) return item.display_name.split(',').slice(0, 3).join(', ').trim()
  return parts.join(', ')
}

const VIEWBOX = '-69.5,-32.5,-68.5,-33.5'

function AddressField({ value, onChange, onCoords, zona = '' }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen]               = useState(false)
  const [searching, setSearching]     = useState(false)
  const [searchErr, setSearchErr]     = useState(false)
  const containerRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close) }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value
    onChange(v)
    setSearchErr(false)
    clearTimeout(timer.current)
    if (v.length < 3) { setSuggestions([]); setOpen(false); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const zonaExtra = zona && zona !== 'Otro' && zona !== 'Centro' ? ` ${zona}` : ''
        const q = encodeURIComponent(v + zonaExtra + ' Mendoza Argentina')
        // bounded=0: viewbox is a soft hint, not a hard filter (bounded=1 silently drops valid addresses)
        const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=ar&addressdetails=1&viewbox=${VIEWBOX}&bounded=0`
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'es',
            'User-Agent': 'VoraRep/1.0 (https://app.vora-system.com)',
          },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setSuggestions(data); setOpen(data.length > 0)
        if (data.length === 0) setSearchErr(true)
      } catch { setSearchErr(true) }
      setSearching(false)
    }, 400)
  }

  const handleSelect = (item) => {
    onChange(formatSuggestion(item))
    onCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) })
    setSuggestions([]); setOpen(false); setSearchErr(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input placeholder="Ej: San Martín 450" value={value} onChange={handleChange} autoComplete="off" />
        {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted animate-pulse">Buscando...</span>}
      </div>
      {searchErr && !searching && value.length >= 3 && (
        <p className="text-[10px] text-muted mt-1 px-1">Sin resultados — probá escribir diferente o usá el GPS</p>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-surface2 border border-[var(--c-border2)] rounded-xl overflow-hidden shadow-2xl" style={{ zIndex: 9999 }}>
          {suggestions.map((s, i) => {
            const label = formatSuggestion(s)
            const cityPart = s.address?.city || s.address?.town || s.address?.municipality || s.address?.county || ''
            return (
              <button key={i} type="button" onPointerDown={(e) => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left px-3 py-[11px] text-[12px] text-textc active:bg-amber-400/10 border-b border-white/5 last:border-0 leading-snug">
                <span className="text-amber-400 mr-1">📍</span>
                <span className="font-medium">{label}</span>
                {cityPart && label !== cityPart && <span className="text-[10px] text-muted ml-1">— {cityPart}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ClienteModal() {
  const modal         = useStore(s => s.modal)
  const closeModal    = useStore(s => s.closeModal)
  const addCliente    = useStore(s => s.addCliente)
  const updateCliente = useStore(s => s.updateCliente)
  const showToast     = useStore(s => s.showToast)

  const editData = modal?.type === 'cliente' ? modal.data?.edit : null
  const isEdit   = !!editData

  const [form, setForm]      = useState(empty)
  const [gpsLoading, setGps] = useState(false)
  const [showMap, setShowMap] = useState(false)

  useEffect(() => {
    if (modal?.type === 'cliente') {
      setForm(editData ? {
        codigo:    editData.codigo    || '',
        nombre:    editData.nombre    || '',
        telefono:  editData.telefono  || '',
        direccion: editData.direccion || '',
        zona:      editData.zona      || 'Centro',
        notas:     editData.notas     || '',
        lat:       editData.lat       || '',
        lon:       editData.lon       || '',
      } : empty)
    }
  }, [modal])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const capturarGPS = () => {
    if (!navigator.geolocation) { showToast('❌ GPS no disponible'); return }
    setGps(true)
    navigator.geolocation.getCurrentPosition(
      p => { set('lat', p.coords.latitude); set('lon', p.coords.longitude); setGps(false); showToast('✅ Ubicación guardada') },
      e => {
        setGps(false)
        if (e.code === 1) showToast('❌ Sin permiso — activá ubicación en Ajustes')
        else if (e.code === 2) showToast('❌ GPS apagado')
        else showToast('❌ No se pudo obtener la ubicación')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { showToast('⚠️ Ingresá el nombre'); return }
    const data = {
      codigo:    form.codigo.trim() || null,
      nombre:    form.nombre.trim(),
      telefono:  form.telefono.trim() || null,
      direccion: form.direccion.trim(),
      zona:      form.zona,
      notas:     form.notas.trim(),
      lat:       form.lat !== '' && form.lat !== null ? +form.lat : null,
      lon:       form.lon !== '' && form.lon !== null ? +form.lon : null,
    }
    if (isEdit) await updateCliente(editData.id, data)
    else await addCliente(data)
    closeModal()
  }

  return (
    <Modal id="cliente">
      <div className="px-[18px] pb-10">
        <h2 className="font-heading font-extrabold text-[16px] text-textc mb-4">
          {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>

        {/* Código interno */}
        <Field label="Código de cliente (opcional)">
          <Input
            placeholder="Ej: 10234"
            value={form.codigo}
            onChange={e => set('codigo', e.target.value)}
            inputMode="numeric"
          />
        </Field>

        <Field label="Nombre *">
          <Input placeholder="Ej: Almacén Don José" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        </Field>

        <Field label="Teléfono (opcional)">
          <Input type="tel" placeholder="Ej: 261 4123456" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
        </Field>

        <Field label="Dirección — escribí para buscar o elegí en el mapa">
          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <AddressField
                value={form.direccion}
                zona={form.zona}
                onChange={v => set('direccion', v)}
                onCoords={({ lat, lon }) => { set('lat', lat); set('lon', lon); showToast('📍 Coordenadas cargadas automáticamente') }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowMap(true)}
              title="Elegir punto en el mapa"
              className="shrink-0 flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-surface2 border border-amber-400/40 text-amber-400 text-[20px] active:bg-amber-400/10">
              🗺️
            </button>
          </div>
        </Field>

        <Field label="Zona">
          <Select value={form.zona} onChange={e => set('zona', e.target.value)}>
            {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
          </Select>
        </Field>

        <Field label="Notas (opcional)">
          <Input placeholder="Ej: Tocar timbre, preguntar por Ana" value={form.notas} onChange={e => set('notas', e.target.value)} />
        </Field>

        {form.lat ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3">
            <span className="text-[11px] text-emerald-400 font-medium">✅ Tiene coordenadas GPS</span>
            <button onClick={() => { set('lat', ''); set('lon', '') }} className="ml-auto text-muted text-[13px] px-1">✕</button>
          </div>
        ) : (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 mb-3">
            <p className="text-[11px] text-orange-400">⚠️ Sin coordenadas — buscá la dirección arriba o usá el GPS.</p>
          </div>
        )}

        <button onClick={capturarGPS} disabled={gpsLoading}
          className="flex items-center gap-2 w-full bg-surface2 border border-dashed border-amber-400/40 rounded-[10px] px-3 py-[11px] text-amber-400 text-[12px] font-medium mb-4 active:bg-amber-400/10">
          {gpsLoading ? '📍 Obteniendo ubicación...' : '📍 Estoy en el local — guardar mi ubicación actual'}
        </button>

        <button onClick={guardar}
          className="w-full bg-amber-400 text-[#1a1a28] font-heading font-bold text-[13px] py-[13px] rounded-xl active:scale-[.97] transition-transform">
          Guardar cliente
        </button>
        <div className="h-2" />
        <button onClick={closeModal}
          className="w-full bg-surface2 border border-[var(--c-border)] text-textc font-heading font-bold text-[13px] py-[13px] rounded-xl">
          Cancelar
        </button>
      </div>

      {showMap && (
        <MapPickerModal
          initialLat={form.lat}
          initialLon={form.lon}
          onConfirm={({ lat, lon, address }) => {
            set('lat', lat)
            set('lon', lon)
            if (address && !form.direccion.trim()) set('direccion', address)
            setShowMap(false)
            showToast('📍 Punto guardado en el mapa')
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </Modal>
  )
}
