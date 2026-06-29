import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Map Stripe amount_total (cents) → plan ID
const PLAN_BY_AMOUNT = {
  799:  'solo',
  1999: 'equipo-chico',
  3999: 'equipo-grande',
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifySignature(rawBody, sigHeader, secret) {
  // Parse t=... v1=... from header
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const idx = part.indexOf('=')
    acc[part.slice(0, idx)] = part.slice(idx + 1)
    return acc
  }, {})
  const ts = parts.t
  const sig = parts.v1
  if (!ts || !sig) return false
  // Reject events older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(ts)) > 300) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody    = await getRawBody(req)
  const sigHeader  = req.headers['stripe-signature']
  const secret     = process.env.STRIPE_WEBHOOK_SECRET

  if (!sigHeader || !secret) return res.status(400).json({ error: 'Missing config' })
  if (!verifySignature(rawBody, sigHeader, secret)) {
    return res.status(400).json({ error: 'Invalid signature' })
  }

  let event
  try { event = JSON.parse(rawBody.toString()) } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId  = session.client_reference_id
    const plan    = PLAN_BY_AMOUNT[session.amount_total]

    if (userId && plan) {
      await supabase.from('profiles').update({
        plan,
        stripe_customer_id: session.customer || null,
      }).eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const customerId = event.data.object.customer
    if (customerId) {
      await supabase.from('profiles')
        .update({ plan: 'free' })
        .eq('stripe_customer_id', customerId)
    }
  }

  return res.status(200).json({ received: true })
}
