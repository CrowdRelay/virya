import { CrowdRelayClient } from "./crowdrelay-client"

const PRODUCTION_API_URL = "https://signal-api.virya.music/v1/"

export const crowdrelay = new CrowdRelayClient({
  baseUrl:
    (import.meta.env.PUBLIC_CROWDRELAY_API_URL as string | undefined) ??
    PRODUCTION_API_URL,
  timeoutMs: 2_500,
})

export function campaignIdFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined
  const value = new URLSearchParams(window.location.search).get("campaign_id")
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
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
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token")
  if (token) {
    history.replaceState(null, "", `${location.pathname}${location.search}`)
  }
  return token
}

export function bestEffort(task: Promise<unknown>): void {
  void task.catch(() => {
    // Telemetry and optional enrichment must never block the fan experience.
  })
}
