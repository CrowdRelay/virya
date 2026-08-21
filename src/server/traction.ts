import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"
import { getYoutubeChannel, type YoutubeVideo } from "./youtube.ts"

// Live traction numbers for the EPK and for booking one-pagers. Every source is
// a free public endpoint we already talk to elsewhere, so this adds reach data
// without a new account or API key.

const DEFAULT_CROWDRELAY_URL = "https://signal-api.virya.music/v1/"
// Bandsintown denies unregistered app ids outright. Prod passes the band's own
// id through BANDSINTOWN_APP_ID; this public widget id keeps dev and preview
// builds from silently reading zero.
const FALLBACK_BANDSINTOWN_APP_ID = "3cfcaea901e7597c0e1b683b76a2a134"
const BANDSINTOWN_ARTIST = "virya"
const REQUEST_TIMEOUT_MS = 6_000
const MAX_RESPONSE_BYTES = 256 * 1024
const CACHE_TTL_MS = 10 * 60 * 1000
const STALE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_TOP_CITIES = 8

export type TractionCity = {
  slug: string
  name: string
  countryCode: string
  fans: number
}

export type Traction = {
  /** Bandsintown trackers — the number promoters check first. */
  trackers: number | null
  upcomingEvents: number | null
  /** Fans registered in the Signal, summed across cities. */
  signalFans: number | null
  /** Cities with at least one registered fan. */
  activeCities: number | null
  /** Views across the 15 most recent YouTube uploads. */
  youtubeViews: number | null
  /** Null unless YOUTUBE_API_KEY is configured. */
  youtubeSubscribers: number | null
  latestVideo: YoutubeVideo | null
  topCities: TractionCity[]
  fetchedAt: string
  /** True when at least one upstream failed and the numbers are partial. */
  degraded: boolean
}

const EMPTY: Traction = {
  trackers: null,
  upcomingEvents: null,
  signalFans: null,
  activeCities: null,
  youtubeViews: null,
  youtubeSubscribers: null,
  latestVideo: null,
  topCities: [],
  fetchedAt: new Date(0).toISOString(),
  degraded: true,
}

const fetchJson = async (url: URL): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`)
  return readLimitedJson<unknown>(response, MAX_RESPONSE_BYTES)
}

const crowdrelayBase = (): URL => {
  const configured = readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  )
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_CROWDRELAY_URL
  const url = new URL(value)
  if (url.protocol !== "https:" && !import.meta.env.DEV) {
    throw new Error("Invalid CrowdRelay URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const wholeNumber = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null
}

const loadBandsintown = async (): Promise<Pick<Traction, "trackers" | "upcomingEvents">> => {
  const configured = readServerEnv(
    "BANDSINTOWN_APP_ID",
    import.meta.env.BANDSINTOWN_APP_ID,
  )
  const appId =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : FALLBACK_BANDSINTOWN_APP_ID

  const url = new URL(
    `https://rest.bandsintown.com/artists/${encodeURIComponent(BANDSINTOWN_ARTIST)}`,
  )
  url.searchParams.set("app_id", appId)
  const payload = await fetchJson(url)
  if (!payload || typeof payload !== "object") {
    return { trackers: null, upcomingEvents: null }
  }
  const artist = payload as Record<string, unknown>
  return {
    trackers: wholeNumber(artist.tracker_count),
    upcomingEvents: wholeNumber(artist.upcoming_event_count),
  }
}

const loadSignalCities = async (): Promise<
  Pick<Traction, "signalFans" | "activeCities" | "topCities">
> => {
  const payload = await fetchJson(new URL("public/cities", crowdrelayBase()))
  const items =
    payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : []

  const cities: TractionCity[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const slug = typeof row.slug === "string" ? row.slug : null
    const name = typeof row.name === "string" ? row.name : null
    const fans = wholeNumber(row.fan_count)
    if (!slug || !name || fans === null) continue
    cities.push({
      slug,
      name,
      countryCode:
        typeof row.country_code === "string" ? row.country_code.toUpperCase() : "--",
      fans,
    })
  }

  return {
    signalFans: cities.reduce((total, city) => total + city.fans, 0),
    activeCities: cities.filter(city => city.fans > 0).length,
    topCities: cities
      .filter(city => city.fans > 0)
      .sort((a, b) => b.fans - a.fans || a.name.localeCompare(b.name))
      .slice(0, MAX_TOP_CITIES),
  }
}

let cached: { value: Traction; expiresAt: number; staleUntil: number } | null = null
let inFlight: Promise<Traction> | null = null

const collect = async (): Promise<Traction> => {
  const [bandsintown, signal, youtube] = await Promise.allSettled([
    loadBandsintown(),
    loadSignalCities(),
    getYoutubeChannel(),
  ])

  const result: Traction = {
    ...EMPTY,
    fetchedAt: new Date().toISOString(),
    degraded: false,
  }

  if (bandsintown.status === "fulfilled") {
    result.trackers = bandsintown.value.trackers
    result.upcomingEvents = bandsintown.value.upcomingEvents
  } else {
    result.degraded = true
    console.warn("[traction] bandsintown unavailable", bandsintown.reason)
  }

  if (signal.status === "fulfilled") {
    result.signalFans = signal.value.signalFans
    result.activeCities = signal.value.activeCities
    result.topCities = signal.value.topCities
  } else {
    result.degraded = true
    console.warn("[traction] crowdrelay cities unavailable", signal.reason)
  }

  if (youtube.status === "fulfilled") {
    result.youtubeViews = youtube.value.recentViews
    result.youtubeSubscribers = youtube.value.subscribers
    result.latestVideo = youtube.value.latest
  } else {
    result.degraded = true
    console.warn("[traction] youtube unavailable", youtube.reason)
  }

  return result
}

/**
 * Never throws. A dead upstream yields nulls for that source only, so the page
 * degrades to whatever still answers instead of failing the render.
 */
export const getTraction = async (): Promise<Traction> => {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.value
  if (inFlight) return inFlight

  inFlight = collect()
    .then(value => {
      cached = {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
        staleUntil: Date.now() + STALE_TTL_MS,
      }
      return value
    })
    .catch(error => {
      console.warn("[traction] collection failed", error)
      if (cached && cached.staleUntil > Date.now()) return cached.value
      return { ...EMPTY, fetchedAt: new Date().toISOString() }
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}
