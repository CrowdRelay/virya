import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"
const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const MAX_UPSTREAM_BYTES = 512 * 1024
const DEFAULT_TIMEOUT_MS = 5_000

export type MerchVariant = {
  id: string
  sku: string
  label: string
  attributes: Record<string, unknown>
  active: boolean
  low_stock_threshold: number
  sell_without_stock: boolean
  available: boolean
  availability: "in_stock" | "low_stock" | "out_of_stock" | "preorder"
  on_hand?: number
  reserved?: number
  available_quantity?: number
}

export type MerchProduct = {
  id: string
  slug: string
  name: string
  description?: string | null
  image_url?: string | null
  currency: string
  price_gross_minor: number
  active: boolean
  public: boolean
  variants: MerchVariant[]
}

export type MerchCatalog = {
  generated_at: string
  products: MerchProduct[]
}

export type InventoryActivation = {
  status: "preparing" | "ready"
  ready: boolean
  fully_enabled: boolean
  catalog_seed_version: number
  catalog_seeded_at?: string | null
  ready_at?: string | null
  ready_by?: string | null
  version: number
  total_active_variants: number
  counted_active_variants: number
  missing_skus: string[]
  blockers: string[]
  can_mark_ready: boolean
  public_enabled: boolean
  writes_enabled: boolean
  campaigns_enabled: boolean
}

export type InventoryOverviewItem = {
  product_slug: string
  product_name: string
  variant_id: string
  sku: string
  variant_label: string
  attributes: Record<string, unknown>
  active: boolean
  low_stock_threshold: number
  sell_without_stock: boolean
  counted: boolean
  last_counted_at?: string | null
  on_hand: number
  order_reserved: number
  campaign_reserved: number
  operational_reserved: number
  reserved: number
  available_quantity: number
  sold_total: number
  sold_30d: number
  promotional_issued_total: number
  active_campaigns: number
}

export type InventoryOverview = {
  generated_at: string
  items: InventoryOverviewItem[]
}

export type InventoryReservation = {
  id: string
  external_reference: string
  status: "active" | "committed" | "released" | "expired"
  expires_at?: string | null
  items: Array<{ sku: string; label: string; quantity: number }>
}

export class CrowdRelayCommerceError extends Error {
  readonly status: number
  readonly retryable: boolean

  constructor(status: number, retryable = status >= 500) {
    super(`CrowdRelay commerce returned ${status}`)
    this.name = "CrowdRelayCommerceError"
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

export const merchInventoryConfigured = () => commerceKey() !== null

type RequestOptions = {
  method?: "GET" | "POST"
  body?: unknown
  authenticated?: boolean
  timeoutMs?: number
  correlationId?: string
  idempotencyKey?: string
}

const commerceRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const headers = new Headers({ Accept: "application/json" })
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json")
  if (options.correlationId) {
    headers.set("X-CrowdRelay-Correlation-Id", options.correlationId)
  }
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey)
  }
  if (options.authenticated) {
    const key = commerceKey()
    if (!key) throw new CrowdRelayCommerceError(503)
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
    if (!response.ok) throw new CrowdRelayCommerceError(response.status)
    if (response.status === 204) return undefined as T
    return await readLimitedJson<T>(
      response,
      MAX_UPSTREAM_BYTES,
      () => new CrowdRelayCommerceError(502),
    )
  } catch (error) {
    if (error instanceof CrowdRelayCommerceError) throw error
    throw new CrowdRelayCommerceError(502)
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchPublicMerchCatalog = (timeoutMs = 2_500) =>
  commerceRequest<MerchCatalog>("public/merch/catalog", { timeoutMs })

export const fetchMerchInventoryActivation = (timeoutMs = 3_000) =>
  commerceRequest<InventoryActivation>("internal/merch/inventory/activation", {
    authenticated: true,
    timeoutMs,
  })

export const merchInventoryWritesReady = async () => {
  if (!merchInventoryConfigured()) return false
  try {
    const activation = await fetchMerchInventoryActivation()
    return activation.ready && activation.fully_enabled
  } catch (error) {
    // Compatibility with a backend deployed before inventory onboarding. Once
    // the endpoint exists, every other error fails closed rather than bypassing
    // stock reservations after staff activation.
    if (error instanceof CrowdRelayCommerceError && error.status === 404)
      return false
    throw error
  }
}

export const reserveMerchInventory = (input: {
  externalReference: string
  expiresAt: string
  items: Array<{ sku: string; quantity: number }>
}) =>
  commerceRequest<InventoryReservation>("internal/merch/reservations", {
    method: "POST",
    authenticated: true,
    correlationId: input.externalReference,
    body: {
      external_reference: input.externalReference,
      expires_at: input.expiresAt,
      items: input.items,
    },
  })

export const commitMerchInventory = (reservationId: string) =>
  commerceRequest<InventoryReservation>(
    `internal/merch/reservations/${encodeURIComponent(reservationId)}/commit`,
    {
      method: "POST",
      authenticated: true,
      correlationId: `merch-commit-${reservationId}`,
    },
  )

export const releaseMerchInventory = (reservationId: string, reason: string) =>
  commerceRequest<InventoryReservation>(
    `internal/merch/reservations/${encodeURIComponent(reservationId)}/release`,
    {
      method: "POST",
      authenticated: true,
      correlationId: `merch-release-${reservationId}`,
      body: { reason },
    },
  )

export type ConfirmedMerchOrder = {
  stripeSessionId: string
  inventoryReservationId: string
  buyerEmail?: string | null
  eventId?: string | null
  fulfillmentMode: "inpost" | "event_pickup" | "none"
  currency: string
  amountGrossMinor: number
  goodsGrossMinor: number
  shippingGrossMinor: number
  confirmedAt: string
}

export const recordConfirmedMerchOrder = (input: ConfirmedMerchOrder) =>
  commerceRequest<void>("internal/merch/orders/confirmed", {
    method: "POST",
    authenticated: true,
    correlationId: `merch-order-${input.stripeSessionId}`,
    idempotencyKey: `merch-order-${input.stripeSessionId}`,
    body: {
      stripe_session_id: input.stripeSessionId,
      inventory_reservation_id: input.inventoryReservationId,
      buyer_email: input.buyerEmail ?? null,
      event_id: input.eventId ?? null,
      fulfillment_mode: input.fulfillmentMode,
      currency: input.currency,
      amount_gross_minor: input.amountGrossMinor,
      goods_gross_minor: input.goodsGrossMinor,
      shipping_gross_minor: input.shippingGrossMinor,
      confirmed_at: input.confirmedAt,
    },
  })
