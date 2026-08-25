import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MIN_INTERVAL_MS = 15_000
const MIN_DISTANCE_KM = 0.03

export function useLocationTracker(perfil, compartirUbicacion) {
  const watchIdRef       = useRef(null)
  const equipoIdRef      = useRef(null)
  const lastUpdateRef    = useRef(0)
  const lastPosRef       = useRef(null)
  const compartirRef     = useRef(compartirUbicacion)

  // Sync ref con el valor actual
  useEffect(() => {
    const prev = compartirRef.current
    compartirRef.current = compartirUbicacion

    // Apagó el toggle → borrar fila de ubicaciones
    if (prev && !compartirUbicacion && perfil?.id) {
      supabase.from('ubicaciones').delete().eq('user_id', perfil.id).then(() => {})
    }
  }, [compartirUbicacion, perfil?.id])

  useEffect(() => {
    if (!perfil || perfil.rol !== 'repartidor') return
    if (!navigator.geolocation) return

    let cancelled = false

    const init = async (attempt = 0) => {
      const { data } = await supabase
        .from('equipo_miembros')
        .select('equipo_id')
        .eq('user_id', perfil.id)
        .maybeSingle()

      if (cancelled) return
      if (!data?.equipo_id) {
        if (attempt < 4) {
          setTimeout(() => { if (!cancelled) init(attempt + 1) }, 4000)
        }
        return
      }
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
        // No compartir si el toggle está apagado
        if (!compartirRef.current) return

        const now = Date.now()
        const { latitude: lat, longitude: lng } = pos.coords

        const tooSoon  = now - lastUpdateRef.current < MIN_INTERVAL_MS
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
