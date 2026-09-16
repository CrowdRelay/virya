import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"

// The band listing is a shared-link read: the token in the URL is the whole
// credential, and the page renders only what the band published. No workspace,
// no contact address — the redaction happened upstream; this parser refuses
// anything that arrives in a shape it does not expect anyway.

const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const LISTING_RESPONSE_BYTES = 64 * 1024
const FETCH_TIMEOUT_MS = 2500

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TIERS = new Set(["vanity", "intermediate", "downstream"])

export type ListingClaim = {
  label: string
  value: number
  tier: "vanity" | "intermediate" | "downstream"
  basis: string
}

export type BandListing = {
  act_name: string
  genre_tags: string[]
  cities: string[]
  claims: ListingClaim[]
  published_dates: string[]
  seeking: string[]
}

export type BandListingState =
  | { kind: "ready"; listing: BandListing }
  | { kind: "not_found" }
  | { kind: "unavailable" }

function listingApiBase(): URL {
  const configured =
    readServerEnv(
      "PUBLIC_CROWDRELAY_API_URL",
      import.meta.env.PUBLIC_CROWDRELAY_API_URL,
    )?.trim() || DEFAULT_BASE_URL
  const url = new URL(configured)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay listing API URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const boundedString = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null

const boundedList = (value: unknown, max: number, itemMax: number): string[] | null => {
  if (!Array.isArray(value) || value.length > max) return null
  const out: string[] = []
  for (const item of value) {
    const s = boundedString(item, itemMax)
    if (s === null) return null
    out.push(s)
  }
  return out
}

export function parseListing(value: unknown): BandListing | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const actName = boundedString(raw.act_name, 160)
  const genreTags = boundedList(raw.genre_tags, 12, 80)
  const cities = boundedList(raw.cities, 40, 80)
  const publishedDates = boundedList(raw.published_dates, 40, 120)
  const seeking = boundedList(raw.seeking, 8, 80)
  if (!actName || !genreTags || !cities || !publishedDates || !seeking) return null
  if (!Array.isArray(raw.claims) || raw.claims.length > 24) return null
  const claims: ListingClaim[] = []
  for (const item of raw.claims) {
    // A claim that does not parse is dropped, not fatal: upstream redaction
    // already filters unsupported claims, so what reaches here is meant to
    // render, and one bad row must not take the whole listing down with it.
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const claim = item as Record<string, unknown>
    const label = boundedString(claim.label, 120)
    const basis = boundedString(claim.basis, 200)
    // A supported claim carries an integer; anything else is not a number
    // the page should show as one.
    const n = claim.value
    const value =
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 9e15
        ? n
        : null
    const tier = typeof claim.tier === "string" ? claim.tier : null
    if (!label || !basis || value === null || !tier || !TIERS.has(tier)) continue
    claims.push({
      label,
      value,
      tier: tier as ListingClaim["tier"],
      basis,
    })
  }
  return {
    act_name: actName,
    genre_tags: genreTags,
    cities,
    claims,
    published_dates: publishedDates,
    seeking,
  }
}

/**
 * Reads a published listing by its share token. A wrong token, a rotated
 * token and an unlisted band are the same answer upstream (404) and the same
 * answer here — `not_found`. `unavailable` is the network failing, which the
 * page reports differently because a retry can clear it.
 */
export async function readBandListing(token: string): Promise<BandListingState> {
  if (!UUID.test(token)) return { kind: "not_found" }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // A malformed PUBLIC_CROWDRELAY_API_URL is a configuration failure, so it
    // lands here and reports `unavailable` like any other upstream failure.
    const url = new URL(`public/listings/${token}`, listingApiBase())
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (response.status === 404) return { kind: "not_found" }
    if (!response.ok) return { kind: "unavailable" }
    const body = await readLimitedJson(response, LISTING_RESPONSE_BYTES)
    const listing = parseListing(body)
    return listing ? { kind: "ready", listing } : { kind: "unavailable" }
  } catch {
    return { kind: "unavailable" }
  } finally {
    clearTimeout(timer)
  }
}
