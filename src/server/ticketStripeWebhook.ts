import Stripe from "stripe"
import {
  applyStripeTicketEvent,
  type TicketStripeEvent,
} from "./crowdrelayTicketing"

const TICKET_KIND = "ticket"

const stripeObjectId = (value: { id: string } | string | null | undefined) =>
  typeof value === "string" ? value : value?.id

const isTicketMetadata = (
  metadata: Stripe.Metadata | null | undefined,
): boolean =>
  metadata?.virya_order_kind === TICKET_KIND &&
  typeof metadata.crowdrelay_ticket_order_id === "string" &&
  metadata.crowdrelay_ticket_order_id.length > 0

const checkoutEvent = (event: Stripe.Event) =>
  event.type === "checkout.session.completed" ||
  event.type === "checkout.session.async_payment_succeeded" ||
  event.type === "checkout.session.expired" ||
  event.type === "checkout.session.async_payment_failed"

const refundEvent = (event: Stripe.Event) =>
  event.type === "charge.refunded" ||
  event.type === "refund.created" ||
  event.type === "refund.updated" ||
  event.type === "refund.failed"

const occurredAt = (unixSeconds: number) =>
  new Date(unixSeconds * 1_000).toISOString()

type BalanceFields = Pick<
  TicketStripeEvent,
  | "stripe_balance_transaction_id"
  | "stripe_fee_minor"
  | "stripe_net_minor"
  | "stripe_reporting_category"
>

const balanceFields = (
  value: string | Stripe.BalanceTransaction | null | undefined,
): BalanceFields => {
  if (!value || typeof value === "string") return {}
  return {
    stripe_balance_transaction_id: value.id,
    stripe_fee_minor: value.fee,
    stripe_net_minor: value.net,
    stripe_reporting_category: value.reporting_category ?? undefined,
  }
}

const expandedCheckoutSession = async (
  stripe: Stripe,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) => {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return session
  }
  return await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["payment_intent.latest_charge.balance_transaction"],
  })
}

const checkoutBalanceFields = (
  session: Stripe.Checkout.Session,
): BalanceFields => {
  if (!session.payment_intent || typeof session.payment_intent === "string") {
    return {}
  }
  const latestCharge = session.payment_intent.latest_charge
  if (!latestCharge || typeof latestCharge === "string") return {}
  return balanceFields(latestCharge.balance_transaction)
}

const reconcileCheckoutEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<boolean> => {
  const eventSession = event.data.object as Stripe.Checkout.Session
  if (!isTicketMetadata(eventSession.metadata)) return false

  const session = await expandedCheckoutSession(stripe, event, eventSession)
  if (!isTicketMetadata(session.metadata)) {
    throw new Error("Ticket Checkout metadata changed after event creation")
  }
  const payload: TicketStripeEvent = {
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_checkout_session_id: session.id,
    occurred_at: occurredAt(event.created),
    ...checkoutBalanceFields(session),
  }
  const paymentIntentId = stripeObjectId(session.payment_intent)
  if (paymentIntentId) payload.stripe_payment_intent_id = paymentIntentId
  if (session.payment_status) payload.payment_status = session.payment_status
  if (typeof session.amount_total === "number") {
    payload.amount_total_minor = session.amount_total
  }
  if (session.currency) payload.currency = session.currency
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? undefined
  if (customerEmail) payload.customer_email = customerEmail

  await applyStripeTicketEvent(payload)
  return true
}

const retrieveExpandedRefund = async (
  stripe: Stripe,
  refundId: string,
) =>
  await stripe.refunds.retrieve(refundId, {
    expand: ["balance_transaction", "charge.payment_intent"],
  })

const ticketPaymentIntentFromRefund = async (
  stripe: Stripe,
  refund: Stripe.Refund,
): Promise<{ paymentIntentId: string; charge: Stripe.Charge } | null> => {
  const chargeValue = refund.charge
  const charge =
    chargeValue && typeof chargeValue !== "string"
      ? chargeValue
      : chargeValue
        ? await stripe.charges.retrieve(chargeValue)
        : null
  if (!charge) throw new Error("Stripe refund is missing its Charge")
  const paymentIntentId = stripeObjectId(charge.payment_intent)
  if (!paymentIntentId) return null
  const paymentIntent =
    charge.payment_intent && typeof charge.payment_intent !== "string"
      ? charge.payment_intent
      : await stripe.paymentIntents.retrieve(paymentIntentId)
  if (!isTicketMetadata(paymentIntent.metadata)) return null
  return { paymentIntentId, charge }
}

const applyExpandedRefund = async (
  stripe: Stripe,
  eventId: string,
  eventType: string,
  eventCreated: number,
  refund: Stripe.Refund,
  cumulativeRefundedMinor?: number,
): Promise<boolean> => {
  const context = await ticketPaymentIntentFromRefund(stripe, refund)
  if (!context) return false
  await applyStripeTicketEvent({
    stripe_event_id: eventId,
    event_type: eventType,
    stripe_payment_intent_id: context.paymentIntentId,
    amount_refunded_minor:
      cumulativeRefundedMinor ?? context.charge.amount_refunded,
    currency: context.charge.currency,
    occurred_at: occurredAt(eventCreated),
    ...balanceFields(refund.balance_transaction),
  })
  return true
}

const reconcileRefundObjectEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<boolean> => {
  const eventRefund = event.data.object as Stripe.Refund
  const refund = await retrieveExpandedRefund(stripe, eventRefund.id)
  const context = await ticketPaymentIntentFromRefund(stripe, refund)
  if (!context) return false
  if (refund.status !== "succeeded") return true
  await applyStripeTicketEvent({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_payment_intent_id: context.paymentIntentId,
    amount_refunded_minor: context.charge.amount_refunded,
    currency: context.charge.currency,
    occurred_at: occurredAt(event.created),
    ...balanceFields(refund.balance_transaction),
  })
  return true
}

const reconcileChargeRefunded = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<boolean> => {
  const chargeEvent = event.data.object as Stripe.Charge
  const paymentIntentId = stripeObjectId(chargeEvent.payment_intent)
  if (!paymentIntentId) return false
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (!isTicketMetadata(paymentIntent.metadata)) return false

  const refunds = await stripe.refunds.list({ charge: chargeEvent.id, limit: 100 })
  const ordered = refunds.data
    .filter(refund => refund.status === "succeeded")
    .sort(
      (left, right) => left.created - right.created || left.id.localeCompare(right.id),
    )
  let cumulative = 0
  for (const item of ordered) {
    cumulative += item.amount
    const refund = await retrieveExpandedRefund(stripe, item.id)
    await applyExpandedRefund(
      stripe,
      `${event.id}_${item.id}`,
      event.type,
      item.created,
      refund,
      cumulative,
    )
  }
  return true
}

const reconcileRefundEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<boolean> =>
  event.type === "charge.refunded"
    ? await reconcileChargeRefunded(stripe, event)
    : await reconcileRefundObjectEvent(stripe, event)

/**
 * Reconciles events belonging to first-party Virya ticket orders. Returns true
 * only when the signed Stripe event was positively identified as ticketing, so
 * the merch fulfilment pipeline cannot accidentally process the same Checkout.
 */
export const reconcileTicketStripeEvent = async (
  stripe: Stripe,
  event: Stripe.Event,
): Promise<boolean> => {
  if (checkoutEvent(event)) return await reconcileCheckoutEvent(stripe, event)
  if (refundEvent(event)) return await reconcileRefundEvent(stripe, event)
  return false
}
