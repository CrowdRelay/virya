import type { APIRoute } from "astro"
import Stripe from "stripe"
import { sendOrderEmail } from "../../utils/orderEmail"
import { createInpostShipment } from "../../utils/inpostShipment"
import {
  acquireFulfillmentLease,
  checkpointFulfillmentStep,
  completeFulfillmentLease,
  releaseFulfillmentLease,
} from "../../server/fulfillmentLedger"
import { mutateAreaWallet } from "../../server/areaLedger"
import {
  redeemAreaRewardCode,
  releaseAreaRewardCode,
} from "../../server/areaReward"

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
        if (released) {
          await mutateAreaWallet(released.ownerId, wallet => ({
            wallet: {
              ...wallet,
              vouchers: wallet.vouchers.map(item =>
                item.requestId === released.requestId &&
                item.status === "reserved"
                  ? {
                      ...item,
                      status: "issued" as const,
                      reservationId: undefined,
                      reservedUntil: undefined,
                      checkoutSessionId: undefined,
                      freeProductId: undefined,
                      freeProductLabel: undefined,
                    }
                  : item,
              ),
            },
            result: null,
          }))
        }
      } catch (error) {
        console.error("[stripe-webhook] reward release failed:", error)
        return new Response("Reward release temporarily failed", { status: 500 })
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
        await mutateAreaWallet(reward.ownerId, wallet => ({
          wallet: {
            ...wallet,
            vouchers: wallet.vouchers.map(item =>
              item.requestId === reward.requestId
                ? {
                    ...item,
                    status: "redeemed" as const,
                    checkoutSessionId: session.id,
                    freeProductId: reward.freeProductId,
                    freeProductLabel: reward.freeProductLabel,
                    redeemedAt: reward.redeemedAt,
                  }
                : item,
            ),
          },
          result: null,
        }))
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
