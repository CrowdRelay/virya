import type { APIRoute } from "astro"
import Stripe from "stripe"
import { sendOrderEmail } from "../../utils/orderEmail"
import { createInpostShipment } from "../../utils/inpostShipment"
import {
  acquireFulfillmentLease,
  completeFulfillmentLease,
  releaseFulfillmentLease,
} from "../../server/fulfillmentLedger"

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY?.trim()
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!stripeKey) {
    return new Response("Stripe not configured", { status: 500 })
  }
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured")
    return new Response("Stripe webhook not configured", { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const rawBody = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) {
    return new Response("Webhook signature missing", { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err)
    return new Response("Webhook signature invalid", { status: 400 })
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const evtSession = event.data.object as Stripe.Checkout.Session
    let leaseId: string

    try {
      const lease = await acquireFulfillmentLease(evtSession.id)
      if (lease.status !== "acquired") {
        if (lease.status === "done") {
          return new Response(
            JSON.stringify({ received: true, duplicate: true }),
            { status: 200 }
          )
        }
        // A concurrent delivery must be retried. The lease owner will either
        // complete the record or release it on failure.
        return new Response("Fulfilment already processing", { status: 500 })
      }
      leaseId = lease.leaseId
    } catch (error) {
      console.error("[stripe-webhook] could not acquire fulfilment lease:", error)
      return new Response("Fulfilment temporarily unavailable", { status: 500 })
    }

    try {
      // Trust the freshly retrieved session for payment and metadata, not the
      // webhook payload. Stripe retries must not repeat order fulfilment.
      let session = await stripe.checkout.sessions.retrieve(evtSession.id)
      if (session.payment_status !== "paid") {
        await releaseFulfillmentLease(session.id, leaseId)
        return new Response("Not paid yet", { status: 200 })
      }
      if (session.metadata?.virya_processed === "1") {
        await completeFulfillmentLease(session.id, leaseId)
        return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
      }

      if (session.metadata?.virya_email_done !== "1") {
        const lineItemsResp = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 100 }
        )
        await sendOrderEmail({ session, lineItems: lineItemsResp.data })
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_email_done: "1",
          },
        })
      }

      if (session.metadata?.virya_shipment_done !== "1") {
        const shipment = await createInpostShipment({ session })
        if (shipment?.created === false) {
          throw new Error(
            `InPost shipment failed with status ${shipment.status ?? "unknown"}`
          )
        }
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_shipment_done: "1",
          },
        })
      }

      // Mark processed only after every required fulfilment step succeeded or
      // was intentionally skipped because it does not apply.
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          ...session.metadata,
          virya_processed: "1",
        },
      })
      await completeFulfillmentLease(session.id, leaseId)
    } catch (err) {
      console.error("[stripe-webhook] post-payment tasks failed:", err)
      try {
        await releaseFulfillmentLease(evtSession.id, leaseId)
      } catch (releaseError) {
        console.error(
          "[stripe-webhook] could not release fulfilment lease:",
          releaseError
        )
      }
      // A non-2xx response makes Stripe retry the signed event.
      return new Response("Fulfilment temporarily failed", { status: 500 })
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
