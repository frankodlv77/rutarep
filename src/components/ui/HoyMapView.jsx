import { useEffect, useRef } from 'react'

const MENDOZA_CENTER = [-32.89, -68.83]
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'; link.href = LEAFLET_CSS
      document.head.appendChild(link)
    }
    if (document.getElementById('leaflet-js')) {
      document.getElementById('leaflet-js').addEventListener('load', () => resolve(window.L))
      return
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js'; script.src = LEAFLET_JS
    script.onload = () => resolve(window.L)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function pinHtml(color, label) {
  return `<div style="
    width:32px;height:32px;border-radius:50% 50% 50% 0;
    background:${color};border:2px solid rgba(255,255,255,.8);
    transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,.5);
  "><span style="transform:rotate(45deg);font-size:13px;line-height:1">${label}</span></div>`
}

// color y emoji según estado de entrega
function markerStyle(entrega) {
  if (!entrega)                     return { color: '#f59e0b', label: '●' } // pendiente - ámbar
  if (entrega.tipo === 'cancelado') return { color: '#ef4444', label: '✕' } // cancelado - rojo
  if (entrega.tipo === 'parcial')   return { color: '#8b5cf6', label: '½' } // parcial - violeta
  if (entrega.tipo === 'devolucion') return { color: '#3b82f6', label: '↩' } // devolución - azul
  return { color: '#10b981', label: '✓' }                                   // entregado - verde
}

export default function HoyMapView({ hoy, clientes, entregas }) {
  const mapRef    = useRef(null)
  const instanceRef = useRef(null)

  const hoyClientes = hoy
    .map(id => clientes.find(c => c.id === id))
    .filter(c => c && c.lat && c.lon)

  useEffect(() => {
    let map
    loadLeaflet().then(L => {
      if (!mapRef.current || instanceRef.current) return

      // Centro: promedio de los clientes con GPS, o Mendoza
      let center = MENDOZA_CENTER
      let zoom   = 13
      if (hoyClientes.length > 0) {
        const avgLat = hoyClientes.reduce((s, c) => s + +c.lat, 0) / hoyClientes.length
        const avgLon = hoyClientes.reduce((s, c) => s + +c.lon, 0) / hoyClientes.length
        center = [avgLat, avgLon]
        zoom   = hoyClientes.length === 1 ? 16 : 14
      }

      map = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom)
      instanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      hoyClientes.forEach((c, idx) => {
        const entrega = entregas[c.id]
        const { color, label } = markerStyle(entrega)
        const icon = L.divIcon({ html: pinHtml(color, label), className: '', iconAnchor: [16, 32] })
        const monto = entrega?.monto ? `$${(+entrega.monto).toLocaleString('es-AR')}` : ''
        const estado = !entrega ? 'Pendiente'
          : entrega.tipo === 'cancelado'   ? 'Cancelado'
          : entrega.tipo === 'parcial'     ? `Pago parcial ${monto}`
          : entrega.tipo === 'devolucion'  ? 'Devolución'
          : `Entregado ${monto}`
        const popup = `
          <div style="font-family:sans-serif;min-width:140px">
            <div style="font-weight:700;font-size:13px;margin-bottom:2px">${idx + 1}. ${c.nombre}</div>
            <div style="font-size:11px;color:#555;margin-bottom:4px">${c.direccion || 'Sin dirección'}</div>
            <div style="font-size:12px;font-weight:600;color:${color}">${estado}</div>
            ${entrega?.hora ? `<div style="font-size:10px;color:#888;margin-top:2px">${entrega.hora}</div>` : ''}
          </div>`
        L.marker([+c.lat, +c.lon], { icon }).addTo(map).bindPopup(popup)
      })

      // Ajustar bounds si hay más de 1 cliente
      if (hoyClientes.length > 1) {
        const bounds = L.latLngBounds(hoyClientes.map(c => [+c.lat, +c.lon]))
        map.fitBounds(bounds, { padding: [40, 40] })
      }
    }).catch(() => {})

    return () => { map?.remove(); instanceRef.current = null }
  }, [hoy.join(','), JSON.stringify(entregas)])  // re-render cuando cambia la lista o entregas

  const sinGPS = hoy.length - hoyClientes.length

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 180px)' }}>
      {sinGPS > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2 mb-2 mx-0">
          <p className="text-[11px] text-orange-400">
            ⚠️ {sinGPS} cliente{sinGPS > 1 ? 's' : ''} sin GPS no aparece{sinGPS > 1 ? 'n' : ''} en el mapa
          </p>
        </div>
      )}
      {hoyClientes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#6b85a0] text-center">
          <div>
            <div className="text-[44px] mb-2 opacity-40">🗺️</div>
            <div className="text-[13px]">Ningún cliente en ruta tiene GPS</div>
          </div>
        </div>
      ) : (
        <div ref={mapRef} className="flex-1 rounded-xl overflow-hidden border border-white/10" />
      )}
      {/* Leyenda */}
      <div className="flex gap-3 flex-wrap mt-2 px-1">
        {[
          { color: '#f59e0b', label: '● Pendiente' },
          { color: '#10b981', label: '✓ Entregado' },
          { color: '#8b5cf6', label: '½ Parcial' },
          { color: '#3b82f6', label: '↩ Devolución' },
          { color: '#ef4444', label: '✕ Cancelado' },
        ].map(({ color, label }) => (
          <span key={label} className="text-[10px] font-medium flex items-center gap-1" style={{ color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
