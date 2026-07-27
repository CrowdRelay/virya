/**
 * Private, server-only VIRYA AREA drop configuration.
 *
 * Keep this file under src/server and never import it from an Astro component
 * or other browser-bundled code. The exact coordinates are used only by
 * server endpoints during GPS verification.
 */

export type AreaLiveDropConfig = {
  lat: number
  lng: number
  radiusMeters: number
  maxClaims: number
  startsAt: string
  endsAt: string
}

export const AREA_LIVE_DROPS = {
  "wro-001": {
    lat: 51.108,
    lng: 17.039,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
  "poz-002": {
    lat: 52.407,
    lng: 16.929,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
  "gdn-003": {
    lat: 54.352,
    lng: 18.646,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
  "waw-004": {
    lat: 52.23,
    lng: 21.012,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
  "ktw-005": {
    lat: 50.264,
    lng: 19.023,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
  "krk-006": {
    lat: 50.065,
    lng: 19.945,
    radiusMeters: 100,
    maxClaims: 25,
    startsAt: "2026-07-27T08:00:00+02:00",
    endsAt: "2026-12-31T23:59:59+01:00",
  },
} as const satisfies Record<string, AreaLiveDropConfig>
