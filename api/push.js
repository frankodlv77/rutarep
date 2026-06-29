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

// Basic in-memory rate limit (per serverless instance — sufficient for burst protection)
const RATE_MAP = new Map()
const WINDOW_MS = 60_000
const MAX_REQ = 15

function isRateLimited(ip) {
  const now = Date.now()
  const entry = RATE_MAP.get(ip) || { count: 0, resetAt: now + WINDOW_MS }
  if (now > entry.resetAt) {
    RATE_MAP.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  RATE_MAP.set(ip, entry)
  return entry.count > MAX_REQ
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { equipoId, title, body } = req.body
  const senderId = user.id
  if (!equipoId) return res.status(400).json({ error: 'Missing fields' })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
    .eq('equipo_id', equipoId)
    .neq('user_id', senderId)

  if (!subs?.length) return res.status(200).json({ sent: 0 })

  const payload = JSON.stringify({ title: title || 'VoraRep', body: body || '' })

  const results = await Promise.allSettled(
    subs.map(s => webPush.sendNotification(s.subscription, payload))
  )

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
