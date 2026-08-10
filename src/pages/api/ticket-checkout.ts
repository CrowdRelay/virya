import { readServerEnv } from "../../server/runtimeEnv.ts"
import type { APIRoute } from "astro"
import { siteOriginForRequest } from "../../config"
import Stripe from "stripe"
import {
  bindTicketCheckout,
  cancelTicketOrder,
  CrowdRelayTicketingError,
  reserveTicketOrder,
} from "../../server/crowdrelayTicketing"
import { staffApiRequest } from "../../server/staffQrApi"

export const prerender = false

const MAX_BODY_BYTES = 16 * 1024
const MAX_LINES = 10
const MAX_QTY = 100
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EVENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const TICKET_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/
const STRIPE_MINIMUM_EXPIRY_SECONDS = 30 * 60
const STRIPE_TARGET_EXPIRY_SECONDS = 31 * 60
const FEATURE_FLAG_CACHE_MS = 10_000

type FeatureFlag = { key: string; enabled: boolean }
let ticketSalesFlagCache: { enabled: boolean; expiresAt: number } | null = null

const ticketSalesEnabled = async () => {
  const now = Date.now()
  if (ticketSalesFlagCache && ticketSalesFlagCache.expiresAt > now) {
    return ticketSalesFlagCache.enabled
  }
  const flags = await staffApiRequest<FeatureFlag[]>("admin/ecosystem/flags", {
    timeoutMs: 3_000,
    correlationId: `checkout-flag:${crypto.randomUUID()}`,
  })
  const enabled = flags.find(flag => flag.key === "ticket_sales_enabled")?.enabled === true
  ticketSalesFlagCache = { enabled, expiresAt: now + FEATURE_FLAG_CACHE_MS }
  return enabled
}

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const cleanText = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string") return required ? null : ""
  const text = value.trim()
  if (
    (required && !text) ||
    text.length > max ||
    CONTROL_CHAR_PATTERN.test(text)
  ) {
    return null
  }
  return text
}


type InvoiceDetails = {
  buyer_type: "individual" | "company"
  company_name?: string
  tax_id?: string
  full_name?: string
  address_line1: string
  postal_code: string
  city: string
  country_code: string
}

const parseInvoiceDetails = (value: unknown): InvoiceDetails | null => {
  const details = asRecord(value)
  if (!details) return null
  const buyerType =
    details.buyerType === "company"
      ? "company"
      : details.buyerType === "individual"
        ? "individual"
        : null
  const addressLine1 = cleanText(details.addressLine1, 240, true)
  const postalCode = cleanText(details.postalCode, 32, true)
  const city = cleanText(details.city, 120, true)
  const countryCode = cleanText(details.countryCode, 2, true)?.toUpperCase()
  if (
    !buyerType ||
    !addressLine1 ||
    !postalCode ||
    !city ||
    !countryCode ||
    !COUNTRY_CODE_PATTERN.test(countryCode)
  ) {
    return null
  }
  if (buyerType === "company") {
    const companyName = cleanText(details.companyName, 200, true)
    const taxId = cleanText(details.taxId, 32, true)
    if (!companyName || !taxId) return null
    return {
      buyer_type: buyerType,
      company_name: companyName,
      tax_id: taxId,
      address_line1: addressLine1,
      postal_code: postalCode,
      city,
      country_code: countryCode,
    }
  }
  const fullName = cleanText(details.fullName, 200, true)
  if (!fullName) return null
  return {
    buyer_type: buyerType,
    full_name: fullName,
    address_line1: addressLine1,
    postal_code: postalCode,
    city,
    country_code: countryCode,
  }
}

const siteOrigin = siteOriginForRequest

const cancelReservation = async (
  orderId: string,
  checkoutToken: string,
  reason: string,
) => {
  try {
    await cancelTicketOrder(orderId, {
      checkout_token: checkoutToken,
      reason,
    })
  } catch (error) {
    console.error("[ticket-checkout] reservation release failed", error)
  }
}

export const POST: APIRoute = async ({ request }) => {
  const requestOrigin = new URL(request.url).origin
  if (request.headers.get("origin") !== requestOrigin) {
    return json({ error: "Invalid request origin" }, 403)
  }
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== "application/json") {
    return json({ error: "Unsupported content type" }, 415)
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large" }, 413)
  }
  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json({ error: "Request too large" }, 413)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody) as unknown
  } catch {
    return json({ error: "Invalid request" }, 400)
  }
  const body = asRecord(parsed)
  if (!body) return json({ error: "Invalid request" }, 400)

  const eventSlug = cleanText(body.eventSlug, 128, true)
  const buyerEmail = cleanText(body.buyerEmail, 320, true)?.toLowerCase()
  const buyerName = cleanText(body.buyerName, 160)
  const checkoutRequestId = cleanText(body.checkoutRequestId, 36, true)?.toLowerCase()
  const lang = body.lang === "pl" ? "pl" : "en"
  const invoiceRequested = body.invoiceRequested === true
  const invoiceDetails = invoiceRequested
    ? parseInvoiceDetails(body.invoiceDetails)
    : undefined
  if (
    eventSlug == null ||
    !EVENT_SLUG_PATTERN.test(eventSlug) ||
    buyerEmail == null ||
    !EMAIL_PATTERN.test(buyerEmail) ||
    buyerName == null ||
    (invoiceRequested && invoiceDetails == null) ||
    checkoutRequestId == null ||
    !UUID_PATTERN.test(checkoutRequestId) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > MAX_LINES
  ) {
    return json({ error: "Invalid ticket order" }, 400)
  }

  const quantities = new Map<string, number>()
  let totalQuantity = 0
  for (const rawItem of body.items) {
    const item = asRecord(rawItem)
    const slug = cleanText(item?.ticketTypeSlug, 128, true)
    const quantity = Number(item?.quantity)
    if (
      slug == null ||
      !TICKET_TYPE_PATTERN.test(slug) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QTY
    ) {
      return json({ error: "Invalid ticket order" }, 400)
    }
    const next = (quantities.get(slug) ?? 0) + quantity
    if (next > MAX_QTY) return json({ error: "Invalid quantity" }, 400)
    quantities.set(slug, next)
    totalQuantity += quantity
    if (totalQuantity > MAX_QTY) {
      return json({ error: "Ticket order is too large" }, 400)
    }
  }

  try {
    if (!(await ticketSalesEnabled())) {
      return json({ error: "Ticket sales are temporarily paused" }, 503)
    }
  } catch (error) {
    console.error("[ticket-checkout] feature flag unavailable")
    return json({ error: "Ticket checkout temporarily unavailable" }, 503)
  }

  const stripeKey = readServerEnv("STRIPE_SECRET_KEY", import.meta.env.STRIPE_SECRET_KEY)?.trim()
  if (!stripeKey) {
    return json({ error: "Ticket checkout temporarily unavailable" }, 503)
  }

  let reservation
  try {
    reservation = await reserveTicketOrder(
      eventSlug,
      `ticket:${checkoutRequestId}`,
      {
        buyer_email: buyerEmail,
        buyer_name: buyerName || undefined,
        buyer_locale: lang,
        invoice_requested: invoiceRequested,
        invoice_details: invoiceDetails ?? undefined,
        items: [...quantities].map(([ticket_type_slug, quantity]) => ({
          ticket_type_slug,
          quantity,
        })),
      },
    )
  } catch (error) {
    if (error instanceof CrowdRelayTicketingError) {
      const status = error.status === 409 ? 409 : error.status >= 500 ? 503 : 400
      return json(
        {
          error:
            status === 409
              ? "Tickets are no longer available in this quantity"
              : "Ticket reservation temporarily unavailable",
          retrySameRequest: error.retryable,
        },
        status,
      )
    }
    console.error("[ticket-checkout] reservation failed", error)
    return json({ error: "Ticket reservation temporarily unavailable" }, 503)
  }

  if (!matchesCheckoutStatus(reservation.order.status)) {
    return json(
      {
        error: "This ticket checkout can no longer be continued",
        retryNewRequest: true,
        orderId: reservation.order.order_id,
      },
      409,
    )
  }

  const orderExpiryMs = Date.parse(reservation.order.expires_at)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const latestExpirySeconds = Math.floor(orderExpiryMs / 1000) - 5
  const stripeExpiresAt = Math.min(
    latestExpirySeconds,
    nowSeconds + STRIPE_TARGET_EXPIRY_SECONDS,
  )
  if (
    !Number.isFinite(orderExpiryMs) ||
    stripeExpiresAt < nowSeconds + STRIPE_MINIMUM_EXPIRY_SECONDS
  ) {
    await cancelReservation(
      reservation.order.order_id,
      reservation.checkout_token,
      "insufficient_stripe_expiry_window",
    )
    return json({ error: "Ticket checkout temporarily unavailable" }, 503)
  }

  const prefix = lang === "pl" ? "/pl" : ""
  const eventPath = `${prefix}/live/${encodeURIComponent(eventSlug)}/`
  const origin = siteOrigin(request)
  const stripe = new Stripe(stripeKey)
  const metadata = {
    virya_order_kind: "ticket",
    crowdrelay_ticket_order_id: reservation.order.order_id,
    crowdrelay_ticket_order_reference: reservation.order.public_reference,
    crowdrelay_event_slug: eventSlug,
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: buyerEmail,
        client_reference_id: reservation.order.order_id,
        line_items: reservation.order.items.map(item => ({
          price_data: {
            currency: reservation.order.currency.toLowerCase(),
            product_data: {
              name: item.ticket_type_name,
              description: `${reservation.order.event_title} · ${reservation.order.public_reference}`,
              metadata: {
                crowdrelay_ticket_type_slug: item.ticket_type_slug,
                crowdrelay_ticket_order_item_id: item.id,
              },
            },
            unit_amount: item.unit_gross_minor,
          },
          quantity: item.quantity,
        })),
        metadata,
        payment_intent_data: { metadata },
        billing_address_collection: invoiceRequested ? "required" : "auto",
        expires_at: stripeExpiresAt,
        success_url: `${origin}${prefix}/tickets/${encodeURIComponent(reservation.order.order_id)}/?ticket_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${eventPath}?ticket_checkout=cancelled`,
      },
      { idempotencyKey: `ticket-checkout-${reservation.order.order_id}` },
    )
  } catch (error) {
    console.error("[ticket-checkout] Stripe session creation failed", error)
    await cancelReservation(
      reservation.order.order_id,
      reservation.checkout_token,
      "stripe_session_creation_failed",
    )
    return json(
      {
        error: "Ticket checkout temporarily unavailable",
        retryNewRequest: true,
      },
      503,
    )
  }

  if (!session.url) {
    try {
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id)
    } catch (error) {
      console.error("[ticket-checkout] could not expire unusable Stripe session", error)
    }
    await cancelReservation(
      reservation.order.order_id,
      reservation.checkout_token,
      "stripe_session_without_url",
    )
    return json({ error: "Ticket checkout temporarily unavailable" }, 503)
  }

  const bindBody = {
    checkout_token: reservation.checkout_token,
    stripe_checkout_session_id: session.id,
    stripe_expires_at: new Date(stripeExpiresAt * 1000).toISOString(),
  }
  let bound = false
  for (let attempt = 0; attempt < 2 && !bound; attempt += 1) {
    try {
      await bindTicketCheckout(reservation.order.order_id, bindBody)
      bound = true
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof CrowdRelayTicketingError &&
        error.retryable
      ) {
        continue
      }
      console.error("[ticket-checkout] Stripe binding failed", error)
    }
  }

  if (!bound) {
    let expired = false
    try {
      const current = await stripe.checkout.sessions.retrieve(session.id)
      if (current.status === "open") {
        await stripe.checkout.sessions.expire(session.id)
        expired = true
      } else if (current.status === "expired") {
        expired = true
      }
    } catch (error) {
      console.error("[ticket-checkout] could not reconcile unbound session", error)
    }
    if (expired) {
      await cancelReservation(
        reservation.order.order_id,
        reservation.checkout_token,
        "stripe_binding_failed",
      )
    }
    return json(
      {
        error: "Ticket checkout temporarily unavailable",
        retrySameRequest: !expired,
        checkoutRequestId,
      },
      503,
    )
  }

  return json({
    url: session.url,
    orderId: reservation.order.order_id,
    orderReference: reservation.order.public_reference,
    checkoutToken: reservation.checkout_token,
    expiresAt: new Date(stripeExpiresAt * 1000).toISOString(),
  })
}

const matchesCheckoutStatus = (status: string) =>
  status === "reserved" || status === "checkout_created"
