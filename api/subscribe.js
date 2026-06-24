import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verificar JWT de Supabase
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { equipoId, subscription } = req.body
  const userId = user.id // usar el user del JWT, no el body
  if (!subscription) return res.status(400).json({ error: 'Missing fields' })

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, equipo_id: equipoId || null, subscription, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
