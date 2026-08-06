/**
 * Private, server-only VIRYA AREA drop configuration.
 *
 * Exact coordinates must be supplied through AREA_LIVE_DROPS_JSON in the
 * server environment. Keeping them out of the repository prevents accidental
 * disclosure through source archives, public forks and client bundles.
 */

import { getSecret } from "astro:env/server"

export type AreaLiveDropConfig = {
  lat: number
  lng: number
  radiusMeters: number
  maxClaims: number
  startsAt?: string
  endsAt?: string
}

type AreaLiveDropMap = Record<string, AreaLiveDropConfig>
export type AreaLiveDropConfigState = "ready" | "missing" | "invalid"

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

let cachedRaw: string | undefined
let cachedConfig: AreaLiveDropMap = {}
let cachedState: AreaLiveDropConfigState = "missing"

export const getAreaLiveDropConfigs = (): AreaLiveDropMap => {
  // `import.meta.env` may be statically replaced while Astro builds the
  // Netlify function. When the variable is intentionally scoped to Functions,
  // that replacement becomes `undefined` and every live drop disappears at
  // runtime. `getSecret()` is adapter-backed and reads the deployed function
  // environment instead of freezing the build-time value.
  const raw = getSecret("AREA_LIVE_DROPS_JSON")?.trim()
  if (!raw) {
    cachedRaw = undefined
    cachedConfig = {}
    cachedState = "missing"
    return cachedConfig
  }
  if (raw === cachedRaw) return cachedConfig

  try {
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      console.error("[area] AREA_LIVE_DROPS_JSON must be a JSON object")
      cachedRaw = raw
      cachedConfig = {}
      cachedState = "invalid"
      return cachedConfig
    }

    const next: AreaLiveDropMap = {}
    for (const [dropId, value] of Object.entries(parsed)) {
      if (!isPlainObject(value)) continue
      next[dropId] = {
        lat: Number(value.lat),
        lng: Number(value.lng),
        radiusMeters: Number(value.radiusMeters),
        maxClaims: Number(value.maxClaims),
        startsAt:
          typeof value.startsAt === "string" ? value.startsAt : undefined,
        endsAt: typeof value.endsAt === "string" ? value.endsAt : undefined,
      }
    }

    cachedRaw = raw
    cachedConfig = next
    cachedState = "ready"
    return cachedConfig
  } catch {
    // Never log the raw value because it contains exact locations.
    console.error("[area] AREA_LIVE_DROPS_JSON contains invalid JSON")
    cachedRaw = raw
    cachedConfig = {}
    cachedState = "invalid"
    return cachedConfig
  }
}

export const getAreaLiveDropConfigState = (): AreaLiveDropConfigState => {
  getAreaLiveDropConfigs()
  return cachedState
}
