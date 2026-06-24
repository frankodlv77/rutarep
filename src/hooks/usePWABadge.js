import { useEffect } from 'react'
import useStore from '../store/useStore'

export function usePWABadge() {
  const hoy      = useStore(s => s.hoy)
  const entregas = useStore(s => s.entregas)

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const pendientes = hoy.filter(id => !entregas[id]).length
    if (pendientes > 0) {
      navigator.setAppBadge(pendientes).catch(() => {})
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [hoy, entregas])
}
