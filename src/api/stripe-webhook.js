import Stripe from "stripe"
import { sendOrderEmail } from "../utils/orderEmail"
import { createInpostShipment } from "../utils/inpostShipment"

// Stripe webhook for fulfilled orders.
//
// Gatsby Functions parse the request body to JSON, which makes raw-body
// signature verification impractical. Instead we treat the incoming event as
// only a *hint*: we read the object id and re-fetch the Checkout Session from
// Stripe with our secret key. That fetched data is authoritative, so a forged
// webhook cannot create a fake order.
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
    // Acknowledge everything else so Stripe stops retrying.
    res.status(200).json({ received: true, ignored: event.type || null })
    return
  }

  const sessionId = event.data?.object?.id
  if (!sessionId) {
    res.status(400).json({ error: "Missing session id" })
    return
  }

  try {
    // Re-fetch from Stripe — this is the authoritative source of truth.
    // customer_details is returned by default; only line_items must be expanded.
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

    // Email is the must-have; shipment creation is best-effort.
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
