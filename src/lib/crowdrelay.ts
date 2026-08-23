import { CrowdRelayClient } from "./crowdrelay-client"

const PRODUCTION_API_URL = "https://signal-api.virya.music/v1/"

export const crowdrelay = new CrowdRelayClient({
  baseUrl:
    (import.meta.env.PUBLIC_CROWDRELAY_API_URL as string | undefined) ??
    PRODUCTION_API_URL,
  timeoutMs: 2_500,
})

const PENDING_CHECKIN_KEY = "virya-pending-concert-checkin"
const PENDING_CHECKIN_TTL_MS = 48 * 60 * 60 * 1000
const CHECKIN_CLOCK_SKEW_MS = 60 * 1000
const CHECKIN_TOKEN_PATTERN =
  /^v1\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.\d{9,12}\.[0-9a-f]{64}$/i

const checkinTokenExpiresAt = (token: string): number | null => {
  if (!CHECKIN_TOKEN_PATTERN.test(token) || token.length > 256) return null
  const seconds = Number(token.split(".")[3])
  return Number.isSafeInteger(seconds) ? seconds * 1000 : null
}

const isLiveCheckinToken = (token: string, now = Date.now()) => {
  const expiresAt = checkinTokenExpiresAt(token)
  return expiresAt !== null && expiresAt + CHECKIN_CLOCK_SKEW_MS > now
}

export type PendingConcertCheckin = {
  slug: string
  token: string
  capturedAt: number
}

export function captureConcertCheckinFromLocation(
  expectedSlug: string,
): PendingConcertCheckin | null {
  if (typeof window === "undefined") return null
  const token = new URLSearchParams(window.location.hash.slice(1)).get(
    "checkin",
  )
  if (!token) return getPendingConcertCheckin(expectedSlug)

  history.replaceState(null, "", `${location.pathname}${location.search}`)
  if (!isLiveCheckinToken(token)) {
    clearPendingConcertCheckin()
    return null
  }

  const pending = { slug: expectedSlug, token, capturedAt: Date.now() }
  try {
    localStorage.setItem(PENDING_CHECKIN_KEY, JSON.stringify(pending))
  } catch {
    // The immediate check-in still works when storage is unavailable.
  }
  return pending
}

export function getPendingConcertCheckin(
  expectedSlug?: string,
): PendingConcertCheckin | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PENDING_CHECKIN_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PendingConcertCheckin>
    const now = Date.now()
    const structurallyValid =
      typeof value.slug === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value.slug) &&
      typeof value.token === "string" &&
      isLiveCheckinToken(value.token, now) &&
      typeof value.capturedAt === "number" &&
      Number.isFinite(value.capturedAt) &&
      value.capturedAt <= now + CHECKIN_CLOCK_SKEW_MS &&
      now - value.capturedAt <= PENDING_CHECKIN_TTL_MS
    if (!structurallyValid) {
      localStorage.removeItem(PENDING_CHECKIN_KEY)
      return null
    }
    if (expectedSlug && value.slug !== expectedSlug) return null
    return value as PendingConcertCheckin
  } catch {
    try {
      localStorage.removeItem(PENDING_CHECKIN_KEY)
    } catch {
      // Storage is optional.
    }
    return null
  }
}

export function clearPendingConcertCheckin(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(PENDING_CHECKIN_KEY)
  } catch {
    // Optional continuity storage only.
  }
}

export function campaignIdFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined
  const value = new URLSearchParams(window.location.search).get("campaign_id")
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined
}

export function referralCodeFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined
  const value = new URLSearchParams(window.location.search).get("ref")
  return value && /^[A-Za-z0-9_-]{6,128}$/.test(value) ? value : undefined
}

export function signalCityFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined
  const query = new URLSearchParams(window.location.search).get("city")
  if (query) return query
  try {
    return window.localStorage.getItem("virya-signal-city") || undefined
  } catch {
    return undefined
  }
}

export function rememberSignalCity(city: string): void {
  if (!city || typeof window === "undefined") return
  try {
    window.localStorage.setItem("virya-signal-city", city)
  } catch {
    // Personalization is optional; storage failure must not block the flow.
  }
}

export function readFragmentToken(): string | null {
  if (typeof window === "undefined") return null
  // The fragment is the form worth preferring, because it never reaches a
  // server. CrowdRelay also mails the query form, and mail clients and link
  // rewriters hand back whichever they please, so a page that reads only the
  // fragment reports a missing token for a link that is perfectly valid
  // everywhere else. Accept both, and strip whichever one carried it so the
  // one-time credential does not linger in the address bar, history or a
  // referrer header.
  const token =
    new URLSearchParams(window.location.hash.slice(1)).get("token")
    ?? new URLSearchParams(window.location.search).get("token")
  if (token) {
    const search = new URLSearchParams(window.location.search)
    search.delete("token")
    const query = search.toString()
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`)
  }
  return token
}

const SYNESTHESIA_HANDOFF_PATTERN = /^[0-9a-f]{64}$/i
const SYNESTHESIA_HANDOFF_STORE_KEY = "virya-synesthesia-handoff-v1"
const SYNESTHESIA_HANDOFF_CONTINUITY_MS = 14 * 60 * 1000

type StoredSynesthesiaHandoff = { code: string; capturedAt: number }

const synesthesiaHandoffStorage = (): Storage[] => {
  if (typeof window === "undefined") return []
  // Confirmation links are commonly opened from a mail app in a fresh browser
  // tab. sessionStorage is tab-scoped, so a Signal handoff kept only there is
  // lost exactly when a new fan confirms their address. localStorage gives the
  // short-lived (14 minute) handoff same-origin continuity across tabs; the
  // session copy remains a best-effort fallback for privacy-restricted browsers.
  return [window.localStorage, window.sessionStorage]
}

const rememberSynesthesiaHandoff = (code: string): void => {
  const serialized = JSON.stringify({
    code,
    capturedAt: Date.now(),
  } satisfies StoredSynesthesiaHandoff)
  for (const storage of synesthesiaHandoffStorage()) {
    try {
      storage.setItem(SYNESTHESIA_HANDOFF_STORE_KEY, serialized)
    } catch {
      // Storage is continuity only; the URL fragment remains the fallback.
    }
  }
}

const storedSynesthesiaHandoff = (): string | null => {
  for (const storage of synesthesiaHandoffStorage()) {
    try {
      const raw = storage.getItem(SYNESTHESIA_HANDOFF_STORE_KEY)
      if (!raw) continue
      const value = JSON.parse(raw) as Partial<StoredSynesthesiaHandoff>
      if (
        typeof value.code !== "string" ||
        !SYNESTHESIA_HANDOFF_PATTERN.test(value.code) ||
        typeof value.capturedAt !== "number" ||
        !Number.isFinite(value.capturedAt) ||
        Date.now() - value.capturedAt > SYNESTHESIA_HANDOFF_CONTINUITY_MS
      ) {
        storage.removeItem(SYNESTHESIA_HANDOFF_STORE_KEY)
        continue
      }
      return value.code.toLowerCase()
    } catch {
      // Try the next storage surface.
    }
  }
  return null
}

export function synesthesiaHandoffFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.hash.slice(1)).get(
    "handoff",
  )
  if (value && SYNESTHESIA_HANDOFF_PATTERN.test(value)) {
    const normalized = value.toLowerCase()
    rememberSynesthesiaHandoff(normalized)
    return normalized
  }
  return storedSynesthesiaHandoff()
}

export function clearSynesthesiaHandoff(): void {
  if (typeof window === "undefined") return
  for (const storage of synesthesiaHandoffStorage()) {
    try {
      storage.removeItem(SYNESTHESIA_HANDOFF_STORE_KEY)
    } catch {
      // Optional continuity storage only.
    }
  }
  const params = new URLSearchParams(location.hash.slice(1))
  params.delete("handoff")
  const hash = params.toString()
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}${hash ? `#${hash}` : ""}`,
  )
}

export function bestEffort(task: Promise<unknown>): void {
  void task.catch(() => {
    // Telemetry and optional enrichment must never block the fan experience.
  })
}
