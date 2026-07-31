const STORAGE_PREFIX = "virya-ticket-order:"
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type StoredTicketOrder = {
  orderId: string
  token: string
  eventSlug: string
  orderReference: string
  lang: "pl" | "en"
  savedAt: number
}

const key = (orderId: string) => `${STORAGE_PREFIX}${orderId}`

export function storeTicketOrder(value: StoredTicketOrder): void {
  if (typeof window === "undefined") return
  if (!UUID_PATTERN.test(value.orderId) || !TOKEN_PATTERN.test(value.token)) return
  try {
    localStorage.setItem(key(value.orderId), JSON.stringify(value))
  } catch {
    // The e-mail wallet URL remains the recovery path when storage is disabled.
  }
}

export function loadTicketOrder(orderId: string): StoredTicketOrder | null {
  if (typeof window === "undefined" || !UUID_PATTERN.test(orderId)) return null
  try {
    const raw = localStorage.getItem(key(orderId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredTicketOrder>
    if (
      value.orderId !== orderId ||
      typeof value.token !== "string" ||
      !TOKEN_PATTERN.test(value.token) ||
      typeof value.eventSlug !== "string" ||
      typeof value.orderReference !== "string" ||
      (value.lang !== "pl" && value.lang !== "en") ||
      typeof value.savedAt !== "number"
    ) {
      localStorage.removeItem(key(orderId))
      return null
    }
    return value as StoredTicketOrder
  } catch {
    return null
  }
}

export function captureTicketToken(orderId: string): string | null {
  if (typeof window === "undefined") return null
  const token = new URLSearchParams(location.hash.slice(1)).get("token")
  if (!token || !TOKEN_PATTERN.test(token) || !UUID_PATTERN.test(orderId)) {
    return loadTicketOrder(orderId)?.token ?? null
  }
  history.replaceState(null, "", `${location.pathname}${location.search}`)
  const existing = loadTicketOrder(orderId)
  storeTicketOrder({
    orderId,
    token,
    eventSlug: existing?.eventSlug ?? "unknown",
    orderReference: existing?.orderReference ?? orderId,
    lang: existing?.lang ?? (location.pathname.startsWith("/pl/") ? "pl" : "en"),
    savedAt: Date.now(),
  })
  return token
}
