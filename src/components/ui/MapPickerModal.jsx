import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const MENDOZA_CENTER = [-32.89, -68.83]

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
    if (!res.ok) return null
    const data = await res.json()
    const a = data.address || {}
    const street   = a.road ? a.road + (a.house_number ? ' ' + a.house_number : '') : null
    const locality = a.suburb || a.neighbourhood || a.city_district || null
    const city     = a.city || a.town || a.village || a.municipality || null
    const parts = [street, locality, city].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : data.display_name?.split(',').slice(0, 3).join(', ') || null
  } catch { return null }
}

export default function MapPickerModal({ initialLat, initialLon, onConfirm, onClose }) {
  const mapRef    = useRef(null)
  const mapInst   = useRef(null)
  const markerRef = useRef(null)

  const [pin,        setPin]     = useState(initialLat ? { lat: +initialLat, lon: +initialLon } : null)
  const [confirming, setConfirm] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return

    const center = pin ? [pin.lat, pin.lon] : MENDOZA_CENTER
    const zoom   = pin ? 17 : 13

    const map = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom)
    mapInst.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const icon = L.divIcon({
      html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">📍</div>',
      className: '',
      iconAnchor: [14, 28],
    })

    if (pin) {
      markerRef.current = L.marker([pin.lat, pin.lon], { icon }).addTo(map)
    }

    map.on('click', e => {
      const { lat, lng } = e.latlng
      setPin({ lat, lon: lng })
      if (markerRef.current) markerRef.current.setLatLng([lat, lng])
      else markerRef.current = L.marker([lat, lng], { icon }).addTo(map)
    })

    return () => { map.remove(); mapInst.current = null }
  }, [])

  const handleConfirm = async () => {
    if (!pin) return
    setConfirm(true)
    const address = await reverseGeocode(pin.lat, pin.lon)
    onConfirm({ lat: pin.lat, lon: pin.lon, address })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-bg">
      <div className="flex items-center gap-3 px-4 py-3 bg-surface2 border-b border-[var(--c-border2)] shrink-0">
        <button onClick={onClose} className="text-muted text-[22px] leading-none px-1">‹</button>
        <div>
          <p className="text-[13px] font-bold text-textc">Seleccioná un punto en el mapa</p>
          <p className="text-[10px] text-muted">Tocá el mapa para colocar el pin</p>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="shrink-0 px-4 py-3 bg-surface2 border-t border-[var(--c-border2)] space-y-2">
        {pin ? (
          <p className="text-[10px] text-emerald-400 text-center">
            📍 {pin.lat.toFixed(6)}, {pin.lon.toFixed(6)}
          </p>
        ) : (
          <p className="text-[10px] text-muted text-center">Tocá el mapa para marcar la ubicación</p>
        )}
        <button
          onClick={handleConfirm}
          disabled={!pin || confirming}
          className="w-full bg-amber-400 text-[#1a1a28] font-bold text-[13px] py-[13px] rounded-xl disabled:opacity-40 active:scale-[.97] transition-transform"
        >
          {confirming ? 'Guardando…' : 'Confirmar punto'}
        </button>
      </div>
    </div>
  )
}
