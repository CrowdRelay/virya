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
  const configured = import.meta.env.PUBLIC_CROWDRELAY_API_URL
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_BASE_URL
  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.hash = ""
  url.search = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const commerceKey = () => {
  const value = import.meta.env.CROWDRELAY_COMMERCE_API_KEY
  return typeof value === "string" && value.length >= 24 && value.length <= 512
    ? value
    : null
}

export const merchInventoryWritesEnabled = () =>
  import.meta.env.CROWDRELAY_MERCH_INVENTORY_WRITES_ENABLED === "true" &&
  commerceKey() !== null

const readLimitedJson = async <T>(response: Response): Promise<T> => {
  const declaredLength = Number(response.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BYTES) {
    throw new CrowdRelayCommerceError(502)
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_UPSTREAM_BYTES) {
    throw new CrowdRelayCommerceError(502)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new CrowdRelayCommerceError(502)
  }
}

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
  if (options.body !== undefined) headers.set("Content-Type", "application/json")
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
    return await readLimitedJson<T>(response)
  } catch (error) {
    if (error instanceof CrowdRelayCommerceError) throw error
    throw new CrowdRelayCommerceError(502)
  } finally {
    clearTimeout(timeout)
  }
}

export const fetchPublicMerchCatalog = (timeoutMs = 2_500) =>
  commerceRequest<MerchCatalog>("public/merch/catalog", { timeoutMs })

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

export const releaseMerchInventory = (
  reservationId: string,
  reason: string,
) =>
  commerceRequest<InventoryReservation>(
    `internal/merch/reservations/${encodeURIComponent(reservationId)}/release`,
    {
      method: "POST",
      authenticated: true,
      correlationId: `merch-release-${reservationId}`,
      body: { reason },
    },
  )
