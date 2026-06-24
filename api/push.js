import webPush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webPush.setVapidDetails(
  'mailto:frankodlv77@gmail.com',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { equipoId, senderId, title, body } = req.body
  if (!equipoId || !senderId) return res.status(400).json({ error: 'Missing fields' })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .eq('equipo_id', equipoId)
    .neq('user_id', senderId)

  if (!subs?.length) return res.status(200).json({ sent: 0 })

  const payload = JSON.stringify({ title: title || 'RutaRep', body: body || '' })

  const results = await Promise.allSettled(
    subs.map(s => webPush.sendNotification(s.subscription, payload))
  )

  // Limpiar suscripciones expiradas (410 = unsubscribed, 404 = not found)
  const expired = subs.filter((_, i) => {
    const r = results[i]
    return r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode)
  })
  if (expired.length) {
    await supabase.from('push_subscriptions')
      .delete()
      .in('user_id', expired.map(s => s.user_id))
  }

  const sent = results.filter(r => r.status === 'fulfilled').length
  return res.status(200).json({ sent })
}
