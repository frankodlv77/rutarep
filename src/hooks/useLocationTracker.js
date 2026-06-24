import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Haversine distance in km
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MIN_INTERVAL_MS = 15_000   // 15 segundos mínimo entre updates
const MIN_DISTANCE_KM = 0.03     // 30 metros mínimo de movimiento

export function useLocationTracker(perfil) {
  const watchIdRef     = useRef(null)
  const equipoIdRef    = useRef(null)
  const lastUpdateRef  = useRef(0)
  const lastPosRef     = useRef(null)

  useEffect(() => {
    if (!perfil || perfil.rol !== 'repartidor') return
    if (!navigator.geolocation) return

    let cancelled = false

    const init = async () => {
      // Buscar equipo
      const { data } = await supabase
        .from('equipo_miembros')
        .select('equipo_id')
        .eq('user_id', perfil.id)
        .maybeSingle()

      if (cancelled || !data?.equipo_id) return
      equipoIdRef.current = data.equipo_id
      startWatch()
    }

    init()

    return () => {
      cancelled = true
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [perfil?.id, perfil?.rol])

  const startWatch = () => {
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now()
        const { latitude: lat, longitude: lng } = pos.coords

        const tooSoon = now - lastUpdateRef.current < MIN_INTERVAL_MS
        const tooClose = lastPosRef.current
          ? distKm(lastPosRef.current.lat, lastPosRef.current.lng, lat, lng) < MIN_DISTANCE_KM
          : false

        if (tooSoon && tooClose) return

        lastUpdateRef.current = now
        lastPosRef.current = { lat, lng }

        supabase.from('ubicaciones').upsert(
          {
            user_id:    perfil.id,
            equipo_id:  equipoIdRef.current,
            lat,
            lng,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    )
  }
}
