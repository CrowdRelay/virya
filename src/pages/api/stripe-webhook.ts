import type { APIRoute } from "astro"
import Stripe from "stripe"
import { sendOrderEmail } from "../../utils/orderEmail"
import { createInpostShipment } from "../../utils/inpostShipment"

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey) {
    return new Response("Stripe not configured", { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const rawBody = await request.text()
  const sig = request.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = webhookSecret
      ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
      : JSON.parse(rawBody)
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err)
    return new Response("Webhook signature invalid", { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.payment_status !== "paid") {
      return new Response("Not paid yet", { status: 200 })
    }

    try {
      const lineItemsResp = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
      const lineItems = lineItemsResp.data

      await Promise.allSettled([
        sendOrderEmail({ session, lineItems }),
        createInpostShipment({ session }),
      ])
    } catch (err) {
      console.error("[stripe-webhook] post-payment tasks failed:", err)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
