import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"
const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const MAX_UPSTREAM_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 8_000

export type TicketOrderItem = {
  id: string
  ticket_type_slug: string
  ticket_type_name: string
  quantity: number
  unit_gross_minor: number
  unit_net_minor: number
  unit_vat_minor: number
  total_gross_minor: number
  total_net_minor: number
  total_vat_minor: number
}

export type IssuedTicket = {
  pass_id: string
  order_item_id: string
  sequence: number
  public_reference: string
  status: string
  holder_name: string | null
  holder_email_masked: string
  redeemed_at: string | null
}

export type TicketOrder = {
  order_id: string
  public_reference: string
  event_slug: string
  event_title: string
  venue: string | null
  timezone: string
  starts_at: string
  status: string
  buyer_email_masked: string
  buyer_name: string | null
  currency: string
  amount_gross_minor: number
  amount_net_minor: number
  amount_vat_minor: number
  amount_refunded_minor: number
  vat_rate_basis_points: number
  invoice_requested: boolean
  expires_at: string
  paid_at: string | null
  refunded_at: string | null
  items: TicketOrderItem[]
  tickets: IssuedTicket[]
}

export type TicketReservation = {
  checkout_token: string
  order: TicketOrder
}

export type TicketStripeEvent = {
  stripe_event_id: string
  event_type: string
  stripe_checkout_session_id?: string
  stripe_payment_intent_id?: string
  payment_status?: string
  amount_total_minor?: number
  amount_refunded_minor?: number
  currency?: string
  customer_email?: string
  occurred_at: string
  stripe_balance_transaction_id?: string
  stripe_fee_minor?: number
  stripe_net_minor?: number
  stripe_reporting_category?: string
}

export type TicketStripeEventResult = {
  received: boolean
  duplicate: boolean
  order: TicketOrder
}

export class CrowdRelayTicketingError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(status: number, retryable = status >= 500) {
    super(`CrowdRelay ticketing returned ${status}`)
    this.name = "CrowdRelayTicketingError"
    this.status = status
    this.retryable = retryable
  }
}

const baseUrl = () => {
  const configured = readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  )
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_BASE_URL
  const url = new URL(value)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.hash = ""
  url.search = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const commerceKey = () => {
  const value = readServerEnv(
    "CROWDRELAY_COMMERCE_API_KEY",
    import.meta.env.CROWDRELAY_COMMERCE_API_KEY,
  )
  return typeof value === "string" && value.length >= 24 && value.length <= 512
    ? value
    : null
}

export const isCrowdRelayTicketingConfigured = () => commerceKey() !== null

type TicketingRequestOptions = {
  method?: "GET" | "POST"
  body?: unknown
  idempotencyKey?: string
  authenticated?: boolean
  timeoutMs?: number
  correlationId?: string
}

const ticketingRequest = async <T>(
  path: string,
  options: TicketingRequestOptions = {},
): Promise<T> => {
  const headers = new Headers({ Accept: "application/json" })
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json")
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey)
  }
  headers.set(
    "X-CrowdRelay-Correlation-Id",
    options.correlationId ?? options.idempotencyKey ?? crypto.randomUUID(),
  )
  if (options.authenticated) {
    const key = commerceKey()
    if (!key) throw new CrowdRelayTicketingError(503)
    headers.set("Authorization", `Bearer ${key}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  try {
    const response = await fetch(new URL(path.replace(/^\/+/, ""), baseUrl()), {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new CrowdRelayTicketingError(response.status)
    }
    if (response.status === 204) return undefined as T
    return await readLimitedJson<T>(
      response,
      MAX_UPSTREAM_BYTES,
      () => new CrowdRelayTicketingError(502),
    )
  } catch (error) {
    if (error instanceof CrowdRelayTicketingError) throw error
    throw new CrowdRelayTicketingError(502)
  } finally {
    clearTimeout(timeout)
  }
}

export const reserveTicketOrder = (
  eventSlug: string,
  idempotencyKey: string,
  body: {
    buyer_email: string
    buyer_name?: string
    buyer_locale: "pl" | "en"
    invoice_requested: boolean
    invoice_details?: {
      buyer_type: "individual" | "company"
      company_name?: string
      tax_id?: string
      full_name?: string
      address_line1: string
      postal_code: string
      city: string
      country_code: string
    }
    items: Array<{ ticket_type_slug: string; quantity: number }>
  },
) =>
  ticketingRequest<TicketReservation>(
    `public/events/${encodeURIComponent(eventSlug)}/ticket-orders`,
    {
      method: "POST",
      body,
      idempotencyKey,
      correlationId: idempotencyKey,
      timeoutMs: 10_000,
    },
  )

export const bindTicketCheckout = (
  orderId: string,
  body: {
    checkout_token: string
    stripe_checkout_session_id: string
    stripe_expires_at: string
  },
) =>
  ticketingRequest<{
    order_id: string
    public_reference: string
    stripe_checkout_session_id: string
    currency: string
    amount_gross_minor: number
    expires_at: string
  }>(`internal/ticket-orders/${encodeURIComponent(orderId)}/stripe-checkout`, {
    method: "POST",
    body,
    authenticated: true,
    correlationId: `stripe-checkout:${orderId}`,
    timeoutMs: 10_000,
  })

export const cancelTicketOrder = (
  orderId: string,
  body: { checkout_token: string; reason: string },
) =>
  ticketingRequest<TicketOrder>(
    `internal/ticket-orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      body,
      authenticated: true,
      correlationId: `ticket-cancel:${orderId}`,
      timeoutMs: 10_000,
    },
  )

export const applyStripeTicketEvent = (body: TicketStripeEvent) =>
  ticketingRequest<TicketStripeEventResult>(
    "internal/ticket-orders/stripe-events",
    {
      method: "POST",
      body,
      authenticated: true,
      correlationId: `stripe-event:${body.stripe_event_id}`,
      timeoutMs: 15_000,
    },
  )
