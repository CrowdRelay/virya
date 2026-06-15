import Stripe from "stripe"
import { sendOrderEmail } from "../utils/orderEmail"
import { createInpostShipment } from "../utils/inpostShipment"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(500).json({ error: "Stripe is not configured." })
    return
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const event = req.body || {}

  if (event.type !== "checkout.session.completed") {
    res.status(200).json({ received: true, ignored: event.type || null })
    return
  }

  const sessionId = event.data?.object?.id
  if (!sessionId) {
    res.status(400).json({ error: "Missing session id" })
    return
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    })

    if (session.payment_status !== "paid") {
      res
        .status(200)
        .json({ received: true, payment_status: session.payment_status })
      return
    }

    const lineItems = session.line_items?.data || []

    const results = {}
    try {
      results.email = await sendOrderEmail({ session, lineItems })
    } catch (e) {
      results.email = { error: e.message }
      console.error("[stripe-webhook] order email failed:", e)
    }
    try {
      results.shipment = await createInpostShipment({ session })
    } catch (e) {
      results.shipment = { error: e.message }
      console.error("[stripe-webhook] InPost shipment failed:", e)
    }

    res.status(200).json({ received: true, ...results })
  } catch (e) {
    console.error("[stripe-webhook] error:", e)
    res.status(500).json({ error: e.message || "Webhook handling failed" })
  }
}
