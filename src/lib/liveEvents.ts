import type { PublicEvent } from "./crowdrelay-client"

const REQUEST_TIMEOUT_MS = 8_000
const MEMORY_CACHE_TTL_MS = 60_000
const UPCOMING_GRACE_MS = 12 * 60 * 60 * 1000

type CachedEvents = {
  expiresAt: number
  events: PublicEvent[]
}

type UpcomingOptions = {
  now?: number
  graceMs?: number
  limit?: number
}

let cachedEvents: CachedEvents | null = null
let pendingEvents: Promise<PublicEvent[]> | null = null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string"

const isPublicEvent = (value: unknown): value is PublicEvent => {
  if (!isRecord(value)) return false
  if (
    typeof value.id !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.starts_at !== "string" ||
    Number.isNaN(Date.parse(value.starts_at))
  ) {
    return false
  }

  if (value.city !== null && value.city !== undefined) {
    if (!isRecord(value.city)) return false
    if (
      typeof value.city.id !== "string" ||
      typeof value.city.slug !== "string" ||
      typeof value.city.name !== "string" ||
      typeof value.city.country_code !== "string" ||
      !isNullableString(value.city.region)
    ) {
      return false
    }
  }

  return (
    isNullableString(value.description) &&
    isNullableString(value.venue) &&
    isNullableString(value.venue_address) &&
    typeof value.timezone === "string" &&
    isNullableString(value.doors_at) &&
    isNullableString(value.ends_at) &&
    isNullableString(value.ticket_url) &&
    isNullableString(value.listen_url) &&
    isNullableString(value.image_url) &&
    isNullableString(value.trailer_url) &&
    isNullableString(value.external_event_url) &&
    typeof value.updated_at === "string"
  )
}

const fetchLiveEvents = async (): Promise<PublicEvent[]> => {
  const response = await fetch("/api/events", {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Events endpoint returned ${response.status}`)

  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.events)) return []
  return payload.events.filter(isPublicEvent)
}

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError")

const waitFor = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(abortReason(signal))

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortReason(signal))
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", abort)
    })
  })
}

export const loadLiveEvents = (signal?: AbortSignal): Promise<PublicEvent[]> => {
  const now = Date.now()
  if (cachedEvents && cachedEvents.expiresAt > now) {
    return waitFor(Promise.resolve(cachedEvents.events), signal)
  }

  if (!pendingEvents) {
    pendingEvents = fetchLiveEvents()
      .then(events => {
        cachedEvents = {
          events,
          expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
        }
        return events
      })
      .finally(() => {
        pendingEvents = null
      })
  }

  return waitFor(pendingEvents, signal)
}

export const upcomingLiveEvents = (
  events: readonly PublicEvent[],
  options: UpcomingOptions = {},
): PublicEvent[] => {
  const now = options.now ?? Date.now()
  const graceMs = options.graceMs ?? UPCOMING_GRACE_MS
  const limit = options.limit
  const upcoming = events
    .filter(event => Date.parse(event.starts_at) >= now - graceMs)
    .slice()
    .sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at))

  return limit === undefined ? upcoming : upcoming.slice(0, Math.max(0, limit))
}
