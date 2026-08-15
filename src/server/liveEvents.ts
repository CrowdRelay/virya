import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"
import { CURATED_LIVE_EVENTS } from "../data/liveEvents"
import type {
  PublicEvent,
  TicketSaleOffer,
  TicketSaleSummary,
} from "../lib/crowdrelay-client"
import { normalizeTicketInventory } from "../lib/ticketInventory"

const DEFAULT_CROWDRELAY_URL = "https://signal-api.virya.music/v1/"
const DEFAULT_BANDSINTOWN_APP_ID = "virya-website"
const REQUEST_TIMEOUT_MS = 6_000
const MAX_RESPONSE_BYTES = 512 * 1024
const HEALTHY_CACHE_TTL_MS = 60 * 1000
const DEGRADED_CACHE_TTL_MS = 30 * 1000
const HEALTHY_STALE_TTL_MS = 10 * 60 * 1000
const TICKET_SALE_CACHE_TTL_MS = 45 * 1000
const TICKET_SALE_NEGATIVE_CACHE_TTL_MS = 15 * 1000
const MAX_TICKET_SALE_CACHE_ENTRIES = 128
const MAX_TICKET_SALE_ENRICHMENT_EVENTS = 24
const TICKET_SALE_ENRICHMENT_CONCURRENCY = 4
const EVENT_MATCH_WINDOW_MS = 8 * 60 * 60 * 1000

type BandsintownEvent = {
  id?: string | number
  datetime?: string
  url?: string
  lineup?: string[]
  venue?: {
    name?: string
    city?: string
    region?: string
    country?: string
  }
  offers?: Array<{ type?: string; url?: string }>
}

type EventPayload = {
  events?: unknown
  items?: unknown
  data?: unknown
}

const safeBaseUrl = () => {
  const configured = readServerEnv("PUBLIC_CROWDRELAY_API_URL", import.meta.env.PUBLIC_CROWDRELAY_API_URL)
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_CROWDRELAY_URL
  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const readJson = async (response: Response): Promise<unknown> =>
  readLimitedJson<unknown>(response, MAX_RESPONSE_BYTES)

const fetchJson = async (url: URL): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`)
  return readJson(response)
}

const countryCode = (country?: string): string => {
  const normalized = country?.trim().toLowerCase()
  if (!normalized) return "--"
  const known: Record<string, string> = {
    poland: "PL",
    polska: "PL",
    germany: "DE",
    deutschland: "DE",
    czechia: "CZ",
    "czech republic": "CZ",
    slovakia: "SK",
    austria: "AT",
    hungary: "HU",
    lithuania: "LT",
    latvia: "LV",
    estonia: "EE",
    netherlands: "NL",
    belgium: "BE",
    france: "FR",
    italy: "IT",
    spain: "ES",
    portugal: "PT",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    ireland: "IE",
    "united kingdom": "GB",
    uk: "GB",
    "united states": "US",
    usa: "US",
    canada: "CA",
  }
  return known[normalized] ?? (/^[a-z]{2}$/.test(normalized) ? normalized.toUpperCase() : "--")
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const normalizeBandsintownEvent = (event: BandsintownEvent): PublicEvent | null => {
  const startsAt = event.datetime
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return null

  const externalId = event.id == null
    ? `${startsAt}-${event.venue?.city ?? "show"}`
    : String(event.id)
  const venue = event.venue?.name?.trim() || null
  const cityName = event.venue?.city?.trim() || null
  const lineup = Array.isArray(event.lineup) ? event.lineup.filter(Boolean) : []
  const title = lineup.length > 0 ? lineup.join(" · ") : venue || "Virya live"
  const ticketUrl =
    event.offers?.find(offer => offer?.type === "Tickets" && offer.url)?.url ??
    event.offers?.find(offer => offer?.url)?.url ??
    null

  return {
    id: `bandsintown:${externalId}`,
    slug: `gig-${slugify(externalId)}`,
    title,
    description: null,
    city: cityName
      ? {
          id: `bandsintown-city:${slugify(cityName)}`,
          slug: slugify(cityName),
          name: cityName,
          country_code: countryCode(event.venue?.country),
          region: event.venue?.region ?? null,
        }
      : null,
    venue,
    venue_address: null,
    timezone: "Europe/Warsaw",
    starts_at: startsAt,
    doors_at: null,
    ends_at: null,
    ticket_url: ticketUrl,
    listen_url: null,
    image_url: null,
    trailer_url: null,
    external_event_url: event.url ?? ticketUrl,
    updated_at: new Date().toISOString(),
    source: "bandsintown",
  }
}

const isPublicEvent = (value: unknown): value is PublicEvent => {
  if (!value || typeof value !== "object") return false
  const event = value as Record<string, unknown>
  return (
    typeof event.id === "string" &&
    typeof event.slug === "string" &&
    typeof event.title === "string" &&
    typeof event.starts_at === "string" &&
    !Number.isNaN(new Date(event.starts_at).getTime())
  )
}

const eventDay = (event: PublicEvent) => event.starts_at.slice(0, 10)

const normalizedEventUrl = (value: string | null): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ""
    url.search = ""
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    return null
  }
}

const sameEvent = (left: PublicEvent, right: PublicEvent): boolean => {
  if (left.slug === right.slug) return true

  const leftUrl = normalizedEventUrl(left.external_event_url)
  const rightUrl = normalizedEventUrl(right.external_event_url)
  if (leftUrl && rightUrl && leftUrl === rightUrl) return true

  if (eventDay(left) !== eventDay(right)) return false

  const timeDistance = Math.abs(
    new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
  )
  if (!Number.isFinite(timeDistance) || timeDistance > EVENT_MATCH_WINDOW_MS) {
    return false
  }

  const leftCity = slugify(left.city?.name ?? "")
  const rightCity = slugify(right.city?.name ?? "")
  const sameCity = Boolean(leftCity && rightCity && leftCity === rightCity)

  const leftVenue = slugify(left.venue ?? "")
  const rightVenue = slugify(right.venue ?? "")
  const sameVenue = Boolean(leftVenue && rightVenue && leftVenue === rightVenue)
  if (sameVenue && (sameCity || !leftCity || !rightCity)) return true

  const leftAddress = slugify(left.venue_address ?? "")
  const rightAddress = slugify(right.venue_address ?? "")
  const addressMatches = Boolean(
    (leftVenue && rightAddress.includes(leftVenue)) ||
      (rightVenue && leftAddress.includes(rightVenue)),
  )

  return sameCity && (sameVenue || addressMatches || timeDistance <= 4 * 60 * 60 * 1000)
}

const hasFirstPartyTicketSale = (event: PublicEvent): boolean =>
  event.ticket_sale !== null && event.ticket_sale !== undefined

const preferredDuplicate = (
  existing: PublicEvent,
  candidate: PublicEvent,
): [primary: PublicEvent, fallback: PublicEvent] => {
  // A ticket sale belongs to one concrete CrowdRelay event slug. When provider
  // syncs leave duplicate rows for the same gig, retaining the first row can
  // silently disconnect the public card from the configured sale. Keep the
  // sale-bearing event identity and only use the duplicate as content fallback.
  if (!hasFirstPartyTicketSale(existing) && hasFirstPartyTicketSale(candidate)) {
    return [candidate, existing]
  }
  return [existing, candidate]
}

const enrichEvent = (primary: PublicEvent, fallback: PublicEvent): PublicEvent => ({
  ...fallback,
  ...primary,
  description: primary.description ?? fallback.description,
  city: primary.city ?? fallback.city,
  venue: primary.venue ?? fallback.venue,
  venue_address: primary.venue_address ?? fallback.venue_address,
  doors_at: primary.doors_at ?? fallback.doors_at,
  ends_at: primary.ends_at ?? fallback.ends_at,
  ticket_url: primary.ticket_url ?? fallback.ticket_url,
  listen_url: primary.listen_url ?? fallback.listen_url,
  image_url: primary.image_url ?? fallback.image_url,
  trailer_url: primary.trailer_url ?? fallback.trailer_url,
  external_event_url: primary.external_event_url ?? fallback.external_event_url,
  ticket_sale: primary.ticket_sale ?? fallback.ticket_sale ?? null,
  source: primary.source,
})

const mergeEvents = (...groups: PublicEvent[][]): PublicEvent[] => {
  const merged: PublicEvent[] = []

  for (const group of groups) {
    for (const event of group) {
      const existingIndex = merged.findIndex(existing => sameEvent(existing, event))
      if (existingIndex >= 0) {
        const existing = merged[existingIndex]
        if (existing) {
          const [primary, fallback] = preferredDuplicate(existing, event)
          merged[existingIndex] = enrichEvent(primary, fallback)
        }
        continue
      }
      merged.push(event)
    }
  }

  return merged
    .filter(event => new Date(event.starts_at).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    )
}

const eventList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []

  const wrapped = payload as EventPayload
  for (const candidate of [wrapped.events, wrapped.items, wrapped.data]) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const loadCrowdRelayEvents = async (): Promise<PublicEvent[]> => {
  const url = new URL("public/events?limit=100", safeBaseUrl())
  const payload = await fetchJson(url)
  return eventList(payload)
    .filter(isPublicEvent)
    .map(event => ({ ...event, source: "crowdrelay" as const }))
}

const loadBandsintownEvents = async (): Promise<PublicEvent[]> => {
  const configured = readServerEnv("BANDSINTOWN_APP_ID", import.meta.env.BANDSINTOWN_APP_ID)
  const appId =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_BANDSINTOWN_APP_ID

  const url = new URL("https://rest.bandsintown.com/artists/virya/events")
  url.searchParams.set("app_id", appId)
  url.searchParams.set("date", "upcoming")
  const payload = await fetchJson(url)
  if (!Array.isArray(payload)) return []
  return payload
    .map(item => normalizeBandsintownEvent(item as BandsintownEvent))
    .filter((event): event is PublicEvent => event !== null)
}

type CachedTicketSale = {
  expiresAt: number
  sale: TicketSaleOffer | null
}

const ticketSaleCache = new Map<string, CachedTicketSale>()
const pendingTicketSales = new Map<string, Promise<TicketSaleOffer | null>>()

const pruneTicketSaleCache = () => {
  const now = Date.now()
  for (const [slug, cached] of ticketSaleCache) {
    if (cached.expiresAt <= now) ticketSaleCache.delete(slug)
  }
  while (ticketSaleCache.size > MAX_TICKET_SALE_CACHE_ENTRIES) {
    const oldest = ticketSaleCache.keys().next().value
    if (typeof oldest !== "string") break
    ticketSaleCache.delete(oldest)
  }
}

const ticketSaleSummary = (sale: TicketSaleOffer): TicketSaleSummary => {
  const activeTypes = sale.ticket_types.filter(type => type.active)
  const inventory = normalizeTicketInventory(sale)
  const availablePrices = activeTypes
    .filter(type => type.available > 0)
    .map(type => type.price_gross_minor)

  return {
    currency: sale.currency,
    capacity: inventory.capacity,
    sold: inventory.sold,
    reserved: inventory.reserved,
    available: inventory.available,
    sales_open_at: sale.sales_open_at,
    sales_close_at: sale.sales_close_at,
    sales_state: sale.sales_state,
    from_price_gross_minor:
      availablePrices.length > 0 ? Math.min(...availablePrices) : null,
    active_ticket_type_count: activeTypes.length,
  }
}

export type LiveEventLoadResult = {
  events: PublicEvent[]
  degraded: boolean
}

type CachedLiveEvents = {
  expiresAt: number
  staleUntil: number
  result: LiveEventLoadResult
}

let cachedLiveEvents: CachedLiveEvents | null = null
let pendingLiveEvents: Promise<LiveEventLoadResult> | null = null

const resolveLiveEvents = async (): Promise<LiveEventLoadResult> => {
  try {
    const crowdRelayEvents = await loadCrowdRelayEvents()
    if (crowdRelayEvents.length > 0) {
      // Resolve sales before deduplication. Otherwise a duplicate event without
      // a sale can win the merge and its slug is later used to query tickets,
      // making a valid allocation appear missing on Virya.
      const ticketedCrowdRelayEvents = await enrichEventsWithTicketSales(
        crowdRelayEvents,
      )
      return {
        // Curated records are content-only fallbacks for address/description.
        // CrowdRelay keeps identity and ticket state whenever the same gig exists
        // in both sources.
        events: mergeEvents(ticketedCrowdRelayEvents, CURATED_LIVE_EVENTS),
        degraded: false,
      }
    }
  } catch {
    // CrowdRelay is the source of truth. Bandsintown is queried only as a
    // degraded fallback so healthy page renders do not duplicate provider I/O.
  }

  try {
    const bandsintownEvents = await loadBandsintownEvents()
    return {
      events: mergeEvents(bandsintownEvents, CURATED_LIVE_EVENTS),
      degraded: true,
    }
  } catch {
    return { events: mergeEvents(CURATED_LIVE_EVENTS), degraded: true }
  }
}

export const loadLiveEvents = async (): Promise<LiveEventLoadResult> => {
  const now = Date.now()
  if (cachedLiveEvents && cachedLiveEvents.expiresAt > now) {
    return cachedLiveEvents.result
  }
  if (pendingLiveEvents) return pendingLiveEvents

  const staleHealthy = cachedLiveEvents &&
    !cachedLiveEvents.result.degraded &&
    cachedLiveEvents.staleUntil > now
    ? cachedLiveEvents
    : null

  pendingLiveEvents = resolveLiveEvents()
    .then(result => {
      const resolvedAt = Date.now()
      // During a short CrowdRelay outage, keep the last ticket-aware event model
      // rather than replacing it immediately with a content-only provider fallback.
      // The degraded flag stays visible and the stale window is never extended.
      const effective = result.degraded && staleHealthy
        ? { events: staleHealthy.result.events, degraded: true }
        : result
      cachedLiveEvents = {
        result: effective,
        expiresAt:
          resolvedAt + (effective.degraded ? DEGRADED_CACHE_TTL_MS : HEALTHY_CACHE_TTL_MS),
        staleUntil:
          result.degraded && staleHealthy
            ? staleHealthy.staleUntil
            : resolvedAt + (effective.degraded ? DEGRADED_CACHE_TTL_MS : HEALTHY_STALE_TTL_MS),
      }
      return effective
    })
    .finally(() => {
      pendingLiveEvents = null
    })

  return pendingLiveEvents
}


export const loadLiveEvent = async (slug: string): Promise<PublicEvent | null> => {
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(slug)) return null
  const { events } = await loadLiveEvents()
  return events.find(event => event.slug === slug) ?? null
}

const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

const isOptionalNonNegativeNumber = (value: unknown): boolean =>
  value === undefined || isNonNegativeNumber(value)

const isTicketTypeOffer = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false
  const ticketType = value as Record<string, unknown>
  return (
    typeof ticketType.id === "string" &&
    typeof ticketType.slug === "string" &&
    typeof ticketType.name === "string" &&
    (ticketType.description === null || typeof ticketType.description === "string") &&
    isNonNegativeNumber(ticketType.price_gross_minor) &&
    (ticketType.capacity === null || isNonNegativeNumber(ticketType.capacity)) &&
    isOptionalNonNegativeNumber(ticketType.sold) &&
    isOptionalNonNegativeNumber(ticketType.reserved) &&
    isNonNegativeNumber(ticketType.available) &&
    typeof ticketType.sort_order === "number" &&
    typeof ticketType.active === "boolean"
  )
}

const TICKET_SALE_STATES = new Set([
  "upcoming",
  "open",
  "closed",
  "sold_out",
  "inactive",
  "event_unavailable",
])

const isTicketSaleOffer = (value: unknown): value is TicketSaleOffer => {
  if (!value || typeof value !== "object") return false
  const sale = value as Record<string, unknown>
  return (
    typeof sale.event_slug === "string" &&
    typeof sale.currency === "string" &&
    typeof sale.vat_rate_basis_points === "number" &&
    isNonNegativeNumber(sale.capacity) &&
    isOptionalNonNegativeNumber(sale.sold) &&
    isOptionalNonNegativeNumber(sale.reserved) &&
    isNonNegativeNumber(sale.available) &&
    typeof sale.sales_state === "string" &&
    TICKET_SALE_STATES.has(sale.sales_state) &&
    Array.isArray(sale.ticket_types) &&
    sale.ticket_types.every(isTicketTypeOffer)
  )
}

const fetchLiveTicketSale = async (slug: string): Promise<TicketSaleOffer | null> => {
  try {
    const url = new URL(
      `public/events/${encodeURIComponent(slug)}/tickets`,
      safeBaseUrl(),
    )
    const value = await fetchJson(url)
    return isTicketSaleOffer(value) ? value : null
  } catch (error) {
    console.warn(
      "[live-ticket-sale]",
      slug,
      error instanceof Error ? error.message : "unknown upstream error",
    )
    return null
  }
}

export const loadLiveTicketSale = async (
  slug: string,
): Promise<TicketSaleOffer | null> => {
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(slug)) return null

  const now = Date.now()
  const cached = ticketSaleCache.get(slug)
  if (cached && cached.expiresAt > now) return cached.sale

  const pending = pendingTicketSales.get(slug)
  if (pending) return pending

  const request = fetchLiveTicketSale(slug)
    .then(sale => {
      ticketSaleCache.delete(slug)
      ticketSaleCache.set(slug, {
        sale,
        expiresAt:
          Date.now() +
          (sale ? TICKET_SALE_CACHE_TTL_MS : TICKET_SALE_NEGATIVE_CACHE_TTL_MS),
      })
      pruneTicketSaleCache()
      return sale
    })
    .finally(() => {
      pendingTicketSales.delete(slug)
    })

  pendingTicketSales.set(slug, request)
  return request
}

const enrichEventsWithTicketSales = async (
  events: PublicEvent[],
): Promise<PublicEvent[]> => {
  const candidates = events
    .filter(event => event.source === "crowdrelay")
    .slice(0, MAX_TICKET_SALE_ENRICHMENT_EVENTS)

  if (candidates.length === 0) return events

  const sales = new Map<string, TicketSaleOffer | null>()
  let cursor = 0
  const worker = async () => {
    while (cursor < candidates.length) {
      const index = cursor
      cursor += 1
      const event = candidates[index]
      if (!event) continue
      sales.set(event.slug, await loadLiveTicketSale(event.slug))
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          TICKET_SALE_ENRICHMENT_CONCURRENCY,
          candidates.length,
        ),
      },
      worker,
    ),
  )

  return events.map(event => {
    if (event.source !== "crowdrelay") return event
    const sale = sales.get(event.slug)
    return {
      ...event,
      ticket_sale: sale ? ticketSaleSummary(sale) : null,
    }
  })
}
