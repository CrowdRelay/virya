import { readServerEnv } from "./runtimeEnv"

/**
 * Private, server-only VIRYA AREA drop configuration.
 *
 * Exact coordinates must be supplied through AREA_LIVE_DROPS_JSON in the
 * server environment. Keeping them out of the repository prevents accidental
 * disclosure through source archives, public forks and client bundles.
 */

export type AreaLiveDropConfig = {
  lat: number
  lng: number
  radiusMeters: number
  maxClaims: number
  startsAt?: string
  endsAt?: string
}

type AreaLiveDropMap = Record<string, AreaLiveDropConfig>

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

let cachedRaw: string | undefined
let cachedConfig: AreaLiveDropMap = {}

export const getAreaLiveDropConfigs = (): AreaLiveDropMap => {
  const raw = readServerEnv(
    "AREA_LIVE_DROPS_JSON",
    import.meta.env.AREA_LIVE_DROPS_JSON,
  )
  if (!raw) return {}
  if (raw === cachedRaw) return cachedConfig

  try {
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      console.error("[area] AREA_LIVE_DROPS_JSON must be a JSON object")
      cachedRaw = raw
      cachedConfig = {}
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
    return cachedConfig
  } catch {
    // Never log the raw value because it contains exact locations.
    console.error("[area] AREA_LIVE_DROPS_JSON contains invalid JSON")
    cachedRaw = raw
    cachedConfig = {}
    return cachedConfig
  }
}
