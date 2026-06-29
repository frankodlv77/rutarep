import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Basic in-memory rate limit (per serverless instance — sufficient for burst protection)
const RATE_MAP = new Map()
const WINDOW_MS = 60_000
const MAX_REQ = 10

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

  const { equipoId, subscription } = req.body
  const userId = user.id
  if (!subscription) return res.status(400).json({ error: 'Missing fields' })

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, equipo_id: equipoId || null, subscription, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

  if (error) return res.status(500).json({ error: 'Internal error' })
  return res.status(200).json({ ok: true })
}
