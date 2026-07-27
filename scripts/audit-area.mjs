import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = process.cwd()
const read = path => readFileSync(resolve(root, path), "utf8")
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const liveConfig = read("src/server/areaLiveDrops.ts")
const catalog = read("src/server/areaCatalog.ts")
const wallet = read("src/pages/api/area/wallet.ts")
const claim = read("src/pages/api/area/claim.ts")
const experience = read("src/components/AreaExperience.astro")
const publicDrops = read("src/data/area.ts")

assert(
  liveConfig.includes("AREA_LIVE_DROPS_JSON"),
  "Exact drop configuration must come from AREA_LIVE_DROPS_JSON.",
)
assert(
  !/["'](?:wro|poz|gdn|waw|ktw|krk)-\d{3}["']\s*:\s*\{/.test(liveConfig),
  "Server live-drop config must not hardcode campaign locations.",
)
assert(
  !experience.includes("/api/area/profile"),
  "The removed /api/area/profile endpoint is still referenced.",
)
assert(
  !experience.includes("zoneLat") &&
    !experience.includes("zoneLng") &&
    !experience.includes("radiusMeters"),
  "The browser component still references private zone geometry.",
)
assert(
  /getPublicLiveDrops[\s\S]*?\.map\(drop\s*=>\s*\(\{\s*id:\s*drop\.id\s*\}\)\)/.test(
    catalog,
  ),
  "Public live-drop output must expose IDs only.",
)
assert(
  wallet.includes("getAreaCommunityProgress") && wallet.includes("community,"),
  "Wallet endpoint must return community progress.",
)
assert(
  existsSync(resolve(root, "src/pages/api/area/events.ts")),
  "Area telemetry endpoint is missing.",
)

const outsideZoneAt = claim.indexOf('code: "OUTSIDE_ZONE"')
assert(outsideZoneAt >= 0, "OUTSIDE_ZONE response is missing.")
if (outsideZoneAt >= 0) {
  const responseWindow = claim.slice(
    Math.max(0, outsideZoneAt - 220),
    outsideZoneAt + 100,
  )
  assert(
    !responseWindow.includes("distanceMeters"),
    "OUTSIDE_ZONE response leaks the measured distance.",
  )
}

const coordinateLiterals = [
  ...publicDrops.matchAll(/approximate(?:Lat|Lng):\s*(-?\d+(?:\.(\d+))?)/g),
]
assert(
  coordinateLiterals.length > 0,
  "Public city reference coordinates are missing.",
)
for (const match of coordinateLiterals) {
  assert(
    (match[2]?.length ?? 0) <= 1,
    `Public city reference is too precise: ${match[0]}`,
  )
}

const configuredDrops = process.env.AREA_LIVE_DROPS_JSON?.trim()
if (configuredDrops) {
  try {
    const parsed = JSON.parse(configuredDrops)
    const clientFacing = [experience, publicDrops]
    for (const config of Object.values(parsed)) {
      if (!config || typeof config !== "object") continue
      for (const field of ["lat", "lng"]) {
        const value = Number(config[field])
        if (!Number.isFinite(value)) continue
        const exact = String(value)
        assert(
          clientFacing.every(source => !source.includes(exact)),
          `Exact configured ${field} value appears in client-facing source.`,
        )
      }
    }
  } catch {
    failures.push("AREA_LIVE_DROPS_JSON is not valid JSON.")
  }
}

if (failures.length) {
  console.error("VIRYA AREA audit failed:\n")
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("VIRYA AREA source audit passed.")
