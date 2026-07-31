import { CURATED_LIVE_EVENTS } from "../data/liveEvents"
import type { PublicEvent, TicketSaleOffer } from "../lib/crowdrelay-client"

const DEFAULT_CROWDRELAY_URL = "https://signal-api.virya.music/v1/"
const DEFAULT_BANDSINTOWN_APP_ID = "virya-website"
const REQUEST_TIMEOUT_MS = 6_000
const MAX_RESPONSE_BYTES = 512 * 1024
const HEALTHY_CACHE_TTL_MS = 2 * 60 * 1000
const DEGRADED_CACHE_TTL_MS = 30 * 1000
const EVENT_MATCH_WINDOW_MS = 8 * 60 * 60 * 1000
const encoder = new TextEncoder()

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

type EventPayload = { events?: unknown }

const safeBaseUrl = () => {
  const configured = import.meta.env.PUBLIC_CROWDRELAY_API_URL
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

const readJson = async (response: Response): Promise<unknown> => {
  const declared = Number(response.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("Response too large")
  }
  const text = await response.text()
  if (encoder.encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Response too large")
  }
  return JSON.parse(text)
}

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
  source: primary.source,
})

const mergeEvents = (...groups: PublicEvent[][]): PublicEvent[] => {
  const merged: PublicEvent[] = []

  for (const group of groups) {
    for (const event of group) {
      const existingIndex = merged.findIndex(existing => sameEvent(existing, event))
      if (existingIndex >= 0) {
        const existing = merged[existingIndex]
        if (existing) merged[existingIndex] = enrichEvent(existing, event)
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

const loadCrowdRelayEvents = async (): Promise<PublicEvent[]> => {
  const url = new URL("public/events?limit=100", safeBaseUrl())
  const payload = (await fetchJson(url)) as EventPayload
  if (!Array.isArray(payload.events)) return []
  return payload.events
    .filter(isPublicEvent)
    .map(event => ({ ...event, source: "crowdrelay" as const }))
}

const loadBandsintownEvents = async (): Promise<PublicEvent[]> => {
  const configured = import.meta.env.BANDSINTOWN_APP_ID
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

export type LiveEventLoadResult = {
  events: PublicEvent[]
  degraded: boolean
}

type CachedLiveEvents = {
  expiresAt: number
  result: LiveEventLoadResult
}

let cachedLiveEvents: CachedLiveEvents | null = null
let pendingLiveEvents: Promise<LiveEventLoadResult> | null = null

const resolveLiveEvents = async (): Promise<LiveEventLoadResult> => {
  try {
    const crowdRelayEvents = await loadCrowdRelayEvents()
    if (crowdRelayEvents.length > 0) {
      return { events: mergeEvents(crowdRelayEvents), degraded: false }
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

  pendingLiveEvents = resolveLiveEvents()
    .then(result => {
      cachedLiveEvents = {
        result,
        expiresAt:
          Date.now() + (result.degraded ? DEGRADED_CACHE_TTL_MS : HEALTHY_CACHE_TTL_MS),
      }
      return result
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

const isTicketSaleOffer = (value: unknown): value is TicketSaleOffer => {
  if (!value || typeof value !== "object") return false
  const sale = value as Record<string, unknown>
  return (
    typeof sale.event_slug === "string" &&
    typeof sale.currency === "string" &&
    typeof sale.vat_rate_basis_points === "number" &&
    typeof sale.sales_state === "string" &&
    Array.isArray(sale.ticket_types)
  )
}

export const loadLiveTicketSale = async (
  slug: string,
): Promise<TicketSaleOffer | null> => {
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(slug)) return null
  try {
    const url = new URL(
      `public/events/${encodeURIComponent(slug)}/tickets`,
      safeBaseUrl(),
    )
    const value = await fetchJson(url)
    return isTicketSaleOffer(value) ? value : null
  } catch {
    return null
  }
}
