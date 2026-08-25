import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Plan ID → Stripe Price ID (configurar en Vercel env vars)
const PLAN_PRICES = {
  'solo':          process.env.STRIPE_PRICE_SOLO,
  'equipo-chico':  process.env.STRIPE_PRICE_EQUIPO_CHICO,
  'equipo-grande': process.env.STRIPE_PRICE_EQUIPO_GRANDE,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { plan_id, user_id } = req.body

  if (!plan_id || !PLAN_PRICES[plan_id]) {
    return res.status(400).json({ error: 'Plan inválido' })
  }
  if (!user_id) {
    return res.status(400).json({ error: 'Falta user_id' })
  }

  const priceId = PLAN_PRICES[plan_id]
  if (!priceId) {
    return res.status(500).json({ error: 'Price ID no configurado para este plan' })
  }

  const origin = req.headers.origin || 'https://app.vora-system.com'

  try {
    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      line_items:           [{ price: priceId, quantity: 1 }],
      client_reference_id:  user_id,
      success_url:          `${origin}/?checkout=success`,
      cancel_url:           `${origin}/?checkout=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
