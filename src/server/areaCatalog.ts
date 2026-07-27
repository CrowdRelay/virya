import { AREA_DROPS, getAreaDrop } from "../data/area"
import { AREA_LIVE_DROPS } from "./areaLiveDrops"

export type AreaCollectible = {
  dropId: string
  line: string
  track: string
  edition: string
  riddle: string
}

const COLLECTIBLES: Record<string, AreaCollectible> = {
  "wro-001": {
    dropId: "wro-001",
    line: "Damnation through automation.",
    track: "Technophobia",
    edition: "Genesis",
    riddle: "Yanus",
  },
  "poz-002": {
    dropId: "poz-002",
    line: "Take them out, embrace your scars.",
    track: "Unmasked",
    edition: "Signal",
    riddle: "Yanus",
  },
  "gdn-003": {
    dropId: "gdn-003",
    line: "My time has not yet come.",
    track: "The Calling",
    edition: "Signal",
    riddle: "Yanus",
  },
  "waw-004": {
    dropId: "waw-004",
    line: "Rise unbound.",
    track: "Rise",
    edition: "Genesis",
    riddle: "Yanus",
  },
  "ktw-005": {
    dropId: "ktw-005",
    line: "I won't be the extension of your narcissism.",
    track: "Hybrid",
    edition: "Signal",
    riddle: "Yanus",
  },
  "krk-006": {
    dropId: "krk-006",
    line: "Through the flames you'll find your way.",
    track: "From The Ashes",
    edition: "Genesis",
    riddle: "Yanus",
  },
}

export type LiveDrop = {
  id: string
  lat: number
  lng: number
  radiusMeters: number
  maxClaims: number
  startsAt: number | null
  endsAt: number | null
}

const parseDate = (
  value: unknown
): { valid: true; value: number | null } | { valid: false; value: null } => {
  if (value === undefined) return { valid: true, value: null }
  if (typeof value !== "string") return { valid: false, value: null }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    )
  if (!match) return { valid: false, value: null }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] =
    match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? "0")
  const daysInMonth =
    month >= 1 && month <= 12
      ? new Date(Date.UTC(year, month, 0)).getUTCDate()
      : 0
  const zoneValid =
    zone === "Z" ||
    (() => {
      const offsetHours = Number(zone.slice(1, 3))
      const offsetMinutes = Number(zone.slice(4, 6))
      return (
        offsetHours <= 14 &&
        offsetMinutes <= 59 &&
        (offsetHours < 14 || offsetMinutes === 0)
      )
    })()
  if (
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    !zoneValid
  ) {
    return { valid: false, value: null }
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed)
    ? { valid: true, value: parsed }
    : { valid: false, value: null }
}

const parseLiveDrops = (): LiveDrop[] =>
  Object.entries(AREA_LIVE_DROPS).flatMap(([id, value]) => {
    if (!getAreaDrop(id)) return []

    const lat = Number(value.lat)
    const lng = Number(value.lng)
    const radius = Number(value.radiusMeters ?? 120)
    const maxClaims = Number(value.maxClaims ?? 25)
    const startsAt = parseDate(value.startsAt)
    const endsAt = parseDate(value.endsAt)

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(radius) ||
      !Number.isInteger(maxClaims) ||
      maxClaims < 1 ||
      maxClaims > 500 ||
      !startsAt.valid ||
      !endsAt.valid ||
      (startsAt.value != null &&
        endsAt.value != null &&
        endsAt.value < startsAt.value)
    ) {
      console.error(`[area] Invalid live drop configuration: ${id}`)
      return []
    }

    return [
      {
        id,
        lat,
        lng,
        radiusMeters: Math.min(500, Math.max(25, Math.round(radius))),
        maxClaims,
        startsAt: startsAt.value,
        endsAt: endsAt.value,
      },
    ]
  })

const isActive = (drop: LiveDrop, now = Date.now()) =>
  (drop.startsAt == null || drop.startsAt <= now) &&
  (drop.endsAt == null || drop.endsAt >= now)

export const getLiveDrop = (id: string) =>
  parseLiveDrops().find((drop) => drop.id === id && isActive(drop))

export const getPublicLiveDrops = () =>
  parseLiveDrops()
    .filter((drop) => isActive(drop) && Boolean(COLLECTIBLES[drop.id]))
    .map((drop) => ({
      id: drop.id,
      // A roughly 100 m zone is enough for the hunt; exact verification stays
      // server-side.
      zoneLat: Number(drop.lat.toFixed(3)),
      zoneLng: Number(drop.lng.toFixed(3)),
      radiusMeters: drop.radiusMeters,
    }))

export const getCollectible = (dropId: string) => COLLECTIBLES[dropId]

export const getPublicCollectible = (dropId: string) => {
  const collectible = getCollectible(dropId)
  const drop = getAreaDrop(dropId)
  if (!collectible || !drop) return null
  return {
    dropId,
    number: drop.number,
    city: drop.city,
    line: collectible.line,
    track: collectible.track,
    edition: collectible.edition,
    riddle: collectible.riddle,
  }
}

export const AREA_COLLECTION_SIZE = AREA_DROPS.length
