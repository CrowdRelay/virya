import { readServerEnv } from "../../server/runtimeEnv.ts"
import { stripeFor } from "../../server/stripeClient.ts"
import type Stripe from "stripe"
import type { APIRoute } from "astro"
import { sendOrderEmail } from "../../utils/orderEmail"
import { createInpostShipment } from "../../utils/inpostShipment"
import {
  acquireFulfillmentLease,
  checkpointFulfillmentStep,
  completeFulfillmentLease,
  releaseFulfillmentLease,
} from "../../server/fulfillmentLedger"
import {
  redeemAreaRewardCode,
  releaseAreaRewardCode,
} from "../../server/areaReward"
import { reconcileTicketStripeEvent } from "../../server/ticketStripeWebhook"
import {
  CrowdRelayCommerceError,
  commitMerchInventory,
  recordConfirmedMerchOrder,
  releaseMerchInventory,
} from "../../server/crowdrelayCommerce"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"

const MAX_BODY_BYTES = 1024 * 1024

const decimalPlnToMinor = (value: string | null | undefined): number => {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return 0
  const [whole, fraction = ""] = value.split(".")
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : 0
}

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = readServerEnv("STRIPE_SECRET_KEY", import.meta.env.STRIPE_SECRET_KEY)?.trim()
  const webhookSecret = readServerEnv("STRIPE_WEBHOOK_SECRET", import.meta.env.STRIPE_WEBHOOK_SECRET)?.trim()

  if (!stripeKey) {
    return new Response("Stripe not configured", { status: 500 })
  }
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured")
    return new Response("Stripe webhook not configured", { status: 500 })
  }

  const stripe = stripeFor(stripeKey)
  let rawBody: string
  try {
    rawBody = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return new Response("Webhook payload too large", { status: 413 })
    throw error
  }
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

  try {
    if (await reconcileTicketStripeEvent(stripe, event)) {
      return new Response(JSON.stringify({ received: true, ticketing: true }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }
  } catch (error) {
    console.error("[stripe-webhook] ticket reconciliation failed:", error)
    // Stripe retries signed events until CrowdRelay commits the transition.
    return new Response("Ticket reconciliation temporarily failed", {
      status: 500,
    })
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session
    const codeHash = session.metadata?.area_reward_code_hash
    const reservationId = session.metadata?.area_reward_reservation_id
    if (codeHash && reservationId) {
      try {
        const released = await releaseAreaRewardCode({
          codeHash,
          reservationId,
          checkoutSessionId: session.id,
        })
        void released
      } catch (error) {
        console.error("[stripe-webhook] reward release failed:", error)
        return new Response("Reward release temporarily failed", { status: 500 })
      }
    }
    const inventoryReservationId =
      session.metadata?.crowdrelay_inventory_reservation_id
    if (inventoryReservationId) {
      try {
        await releaseMerchInventory(
          inventoryReservationId,
          `Stripe checkout ${event.type}`,
        )
      } catch (error) {
        if (
          !(error instanceof CrowdRelayCommerceError) ||
          error.status !== 409
        ) {
          console.error("[stripe-webhook] inventory release failed:", error)
          return new Response("Inventory release temporarily failed", {
            status: 500,
          })
        }
      }
    }
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const evtSession = event.data.object as Stripe.Checkout.Session
    let leaseId: string
    let emailDone = false
    let shipmentDone = false

    try {
      const lease = await acquireFulfillmentLease(evtSession.id)
      if (lease.status !== "acquired") {
        if (lease.status === "done") {
          return new Response(
            JSON.stringify({ received: true, duplicate: true }),
            { status: 200 },
          )
        }
        // A concurrent delivery must be retried. The lease owner will either
        // complete the record or release it on failure.
        return new Response("Fulfilment already processing", { status: 500 })
      }
      leaseId = lease.leaseId
      emailDone = lease.progress.emailDone
      shipmentDone = lease.progress.shipmentDone
    } catch (error) {
      console.error(
        "[stripe-webhook] could not acquire fulfilment lease:",
        error,
      )
      return new Response("Fulfilment temporarily unavailable", { status: 500 })
    }

    try {
      // Trust the freshly retrieved session for payment and metadata, not the
      // webhook payload. Stripe retries must not repeat order fulfilment.
      let session = await stripe.checkout.sessions.retrieve(evtSession.id)
      if (
        session.payment_status !== "paid" &&
        session.payment_status !== "no_payment_required"
      ) {
        await releaseFulfillmentLease(session.id, leaseId)
        return new Response("Not paid yet", { status: 200 })
      }

      const rewardCodeHash = session.metadata?.area_reward_code_hash
      const rewardReservationId =
        session.metadata?.area_reward_reservation_id
      if (rewardCodeHash && rewardReservationId) {
        const reward = await redeemAreaRewardCode({
          codeHash: rewardCodeHash,
          reservationId: rewardReservationId,
          checkoutSessionId: session.id,
        })
        if (!reward) {
          throw new Error("VIRYA Area reward could not be reconciled")
        }
      }

      if (session.metadata?.virya_processed === "1") {
        await completeFulfillmentLease(session.id, leaseId)
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200 },
        )
      }

      if (session.metadata?.virya_email_done === "1" && !emailDone) {
        await checkpointFulfillmentStep(session.id, leaseId, {
          emailDone: true,
        })
        emailDone = true
      }
      if (!emailDone) {
        const lineItemsResp = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 100 },
        )
        await sendOrderEmail({ session, lineItems: lineItemsResp.data })
        await checkpointFulfillmentStep(session.id, leaseId, {
          emailDone: true,
        })
        emailDone = true
      }
      if (session.metadata?.virya_email_done !== "1") {
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_email_done: "1",
          },
        })
      }

      if (session.metadata?.virya_shipment_done === "1" && !shipmentDone) {
        await checkpointFulfillmentStep(session.id, leaseId, {
          shipmentDone: true,
        })
        shipmentDone = true
      }
      if (!shipmentDone) {
        const eventPickup = session.metadata?.fulfillment_mode === "event_pickup"
        if (eventPickup) {
          await checkpointFulfillmentStep(session.id, leaseId, { shipmentDone: true })
        } else {
          const shipment = await createInpostShipment({ session })
          if (shipment?.created === false) {
            throw new Error(
              `InPost shipment failed with status ${shipment.status ?? "unknown"}`,
            )
          }
          await checkpointFulfillmentStep(session.id, leaseId, {
            shipmentDone: true,
            shipmentId:
              typeof shipment?.id === "string" || typeof shipment?.id === "number"
                ? String(shipment.id)
                : undefined,
          })
        }
        shipmentDone = true
      }
      if (session.metadata?.virya_shipment_done !== "1") {
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_shipment_done: "1",
          },
        })
      }

      // Inventory is appended after the established email and shipment
      // checkpoints. A CrowdRelay or Stripe retry therefore cannot resend the
      // customer email, recreate the shipment or decrement stock twice.
      const inventoryReservationId =
        session.metadata?.crowdrelay_inventory_reservation_id
      if (
        inventoryReservationId &&
        session.metadata?.virya_inventory_done !== "1"
      ) {
        await commitMerchInventory(inventoryReservationId)
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_inventory_done: "1",
          },
        })
      }

      if (inventoryReservationId && session.metadata?.virya_merch_fact_done !== "1") {
        const fulfillmentMode = session.metadata?.fulfillment_mode === "event_pickup"
          ? "event_pickup"
          : session.metadata?.fulfillment_mode === "none" ? "none" : "inpost"
        const eventId = fulfillmentMode === "event_pickup"
          ? session.metadata?.pickup_event_id || null
          : null
        await recordConfirmedMerchOrder({
          stripeSessionId: session.id,
          inventoryReservationId,
          buyerEmail: session.customer_details?.email || session.customer_email || session.metadata?.inv_email || null,
          eventId,
          fulfillmentMode,
          currency: String(session.currency || "pln").toUpperCase(),
          amountGrossMinor: session.amount_total ?? 0,
          goodsGrossMinor: decimalPlnToMinor(session.metadata?.goods_gross_pln),
          shippingGrossMinor: decimalPlnToMinor(session.metadata?.shipping_pln),
          confirmedAt: new Date(event.created * 1000).toISOString(),
        })
        session = await stripe.checkout.sessions.update(session.id, {
          metadata: {
            ...session.metadata,
            virya_merch_fact_done: "1",
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
          releaseError,
        )
      }
      // A non-2xx response makes Stripe retry the signed event.
      return new Response("Fulfilment temporarily failed", { status: 500 })
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}
