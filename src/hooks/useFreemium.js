import useStore from '../store/useStore'

const TRIAL_DAYS   = 30
export const CLIENT_LIMIT = 10

export function useFreemium() {
  const perfil = useStore(s => s.perfil)

  if (!perfil) return { isLimited: false }

  const isPaid = perfil.plan && perfil.plan !== 'free'
  if (isPaid)  return { isLimited: false }

  const trialStart   = perfil.trial_start ? new Date(perfil.trial_start).getTime() : null
  const trialExpired = trialStart && (Date.now() - trialStart) > TRIAL_DAYS * 24 * 60 * 60 * 1000

  return { isLimited: !!trialExpired }
}
