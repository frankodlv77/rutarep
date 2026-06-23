import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [pos, setPos]         = useState(null)   // { lat, lon }
  const [error, setErr]       = useState(null)   // { code, message }
  const [loading, setLoading] = useState(false)

  const getPos = useCallback(() => {
    if (!navigator.geolocation) {
      setErr({ code: 0, message: 'GPS no disponible en este dispositivo' })
      return
    }
    setLoading(true)
    setErr(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude })
        setLoading(false)
      },
      (e) => {
        setErr({ code: e.code, message: e.message })
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }, [])

  return { pos, error, loading, getPos }
}
