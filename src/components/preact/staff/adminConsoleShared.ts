import { staffApi, type StaffApiError } from "./staffApi"

// Shared types and bounded browser helpers for the staff control center.

export type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
export type Tab = "overview" | "signal" | "audience" | "ops" | "ticketing" | "admission" | "mailer" | "system"
export type ApiError = StaffApiError
export type Capabilities = {
  crowdrelayAdmin: boolean
  crowdrelayCommerce: boolean
  crowdrelayWebhook: boolean
  crowdrelayMailer: boolean
  ticketMailer: boolean
  gmail: boolean
  stripe: boolean
}
export type EventItem = {
  id: string
  slug: string
  title: string
  venue: string | null
  starts_at: string
  status?: string
  city?: { name?: string } | null
}

export type QrCampaign = {
  id: string
  event_slug: string
  event_title: string
  label: string
  valid_from: string
  valid_until: string
  checkin_count: number
  max_checkins: number | null
  active: boolean
}

export type Overview = {
  services: { live: string; ready: string }
  push?: { enabled: boolean; android_fcm: boolean; web_push: boolean }
  operations: { events: EventItem[]; campaigns: QrCampaign[] }
  publicEvents: EventItem[]
  cities: Array<{ slug: string; name: string; fan_count: number }>
  degraded: { active: boolean; unavailableSources: string[] }
  generatedAt: string
}

export type TicketType = {
  slug: string
  name: string
  description: string | null
  price_gross_minor: number
  capacity: number | null
  sold: number
  reserved: number
  available: number
  sort_order: number
  active: boolean
}

export type TicketSale = {
  event_slug: string
  event_title: string
  event_status: string
  venue: string | null
  starts_at: string
  currency: string
  vat_rate_basis_points: number
  capacity: number
  sold: number
  reserved: number
  available: number
  max_per_order: number
  sales_open_at: string
  sales_close_at: string
  active: boolean
  sales_state: string
  ticket_types: TicketType[]
}

export type TicketingOverview = {
  sale: TicketSale
  reserved_orders: number
  checkout_created_orders: number
  reserved_tickets: number
  paid_orders: number
  paid_tickets: number
  gross_sales_minor: number
  refunded_minor: number
  recent_orders: Array<{
    order_id: string
    public_reference: string
    status: string
    buyer_email_masked: string
    amount_gross_minor: number
    amount_refunded_minor: number
    currency: string
    paid_at: string | null
  }>
}

export type QueueSummary = {
  pending: number
  processing: number
  delivered_24h: number
  dead: number
  oldest_pending_seconds: number
}

export type OpsItem = {
  id: string
  event_type: string
  status: string
  available_at: string
  last_error_kind: string | null
  created_at: string
  dead_at: string | null
  attempts?: number
  attempt_count?: number
  max_attempts: number
  endpoint_name?: string
  endpoint_active?: boolean
  last_response_status?: number | null
}

export type OpsOverview = {
  summary: {
    outbox: QueueSummary
    deliveries: QueueSummary
    push?: QueueSummary
    watchdog?: {
      active_alerts: number
      critical_alerts: number
      last_observed_at?: string | null
    }
  }
  deadDeliveries: OpsItem[]
  deadOutbox: OpsItem[]
  degraded?: Array<"dead_deliveries" | "dead_outbox">
}

export type SignalOverview = {
  generated_at: string
  summary: {
    total_fans: number
    active_fans: number
    pending_fans: number
    unsubscribed_fans: number
    suppressed_fans: number
    marketing_opted_in: number
    nearby_enabled: number
  }
  activity: {
    new_fans_7d: number
    new_fans_30d: number
    referral_attributions_total: number
    referral_attributions_30d: number
    event_interests_total: number
    event_interests_30d: number
    nearby_notifications_30d: number
    pending_city_requests: number
  }
  top_cities: Array<{
    slug: string
    name: string
    country_code: string
    active_fans: number
  }>
  unavailable_sources: string[]
}

export type TicketForm = {
  currency: string
  vatRatePercent: string
  capacity: string
  maxPerOrder: string
  holdSeconds: string
  salesOpenAt: string
  salesCloseAt: string
  active: boolean
  ticketTypes: Array<{
    slug: string
    name: string
    description: string
    priceGross: string
    capacity: string
    active: boolean
  }>
}

export const REQUEST_TIMEOUT_MS = 15_000
export const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
})
export const moneyFormatter = new Map<string, Intl.NumberFormat>()

export const formatDate = (value: string | null | undefined) => {
  if (!value || Number.isNaN(Date.parse(value))) return "—"
  return dateFormatter.format(new Date(value))
}

export const money = (minor: number, currency = "PLN") => {
  let formatter = moneyFormatter.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency })
    moneyFormatter.set(currency, formatter)
  }
  return formatter.format(minor / 100)
}

export const localInput = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const api = <T,>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: unknown
    signal?: AbortSignal
  } = {},
) => staffApi<T>(path, { ...options, timeoutMs: REQUEST_TIMEOUT_MS })

export const blankTicketForm = (event?: EventItem): TicketForm => {
  const start = event?.starts_at
    ? new Date(event.starts_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const close = new Date(start.getTime() - 60 * 60 * 1000)
  return {
    currency: "PLN",
    vatRatePercent: "8",
    capacity: "100",
    maxPerOrder: "8",
    holdSeconds: "2100",
    salesOpenAt: localInput(new Date().toISOString()),
    salesCloseAt: localInput(close.toISOString()),
    active: false,
    ticketTypes: [
      {
        slug: "standard",
        name: "Bilet standardowy",
        description: "",
        priceGross: "50.00",
        capacity: "100",
        active: true,
      },
    ],
  }
}

export const formFromSale = (sale: TicketSale): TicketForm => ({
  currency: sale.currency,
  vatRatePercent: String(sale.vat_rate_basis_points / 100),
  capacity: String(sale.capacity),
  maxPerOrder: String(sale.max_per_order),
  holdSeconds: "2100",
  salesOpenAt: localInput(sale.sales_open_at),
  salesCloseAt: localInput(sale.sales_close_at),
  active: sale.active,
  ticketTypes: sale.ticket_types.map(type => ({
    slug: type.slug,
    name: type.name,
    description: type.description ?? "",
    priceGross: (type.price_gross_minor / 100).toFixed(2),
    capacity: type.capacity == null ? "" : String(type.capacity),
    active: type.active,
  })),
})

export const formFromOverview = (overview: TicketingOverview): TicketForm =>
  formFromSale(overview.sale)

export type TicketingSaveReceipt = {
  saved: true
  sale: TicketSale
  refreshPending: true
}

export const tabs: Array<{ key: Tab; label: string; hint: string }> = [
  { key: "overview", label: "Stan", hint: "system i koncerty" },
  { key: "signal", label: "Sygnał", hint: "fani, miasta i wzrost" },
  { key: "audience", label: "Audience", hint: "Fan 360 i kampanie" },
  { key: "ops", label: "Operacje", hint: "kolejki i retry" },
  { key: "ticketing", label: "Bilety", hint: "ceny i pule" },
  { key: "admission", label: "Wejściówki", hint: "wydaj i unieważnij" },
  { key: "mailer", label: "Mailer", hint: "konfiguracja i test" },
  { key: "system", label: "Integracje", hint: "n8n, Meta, Stripe" },
]
