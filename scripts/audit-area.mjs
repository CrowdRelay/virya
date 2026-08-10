import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { BUNDLES, isAreaRewardEligible } from "../src/data/products.js"

const root = process.cwd()
const read = path => readFileSync(resolve(root, path), "utf8")
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const backend = read("src/server/crowdrelayArea.ts")
const wallet = read("src/pages/api/area/wallet.ts")
const claim = read("src/pages/api/area/claim.ts")
const challenge = read("src/pages/api/area/challenge.ts")
const experience = read("src/components/AreaExperience.astro") + read("src/client/areaExperience.ts")
const publicDrops = read("src/data/area.ts")
const actor = read("src/server/areaActor.ts")
const auth = read("src/server/areaAuth.ts")
const migration = read("src/server/areaMigration.ts")
const legacyLedger = read("src/server/areaLedger.ts")
const envExample = read(".env.example")

assert(
  BUNDLES.length > 0 && BUNDLES.every(isAreaRewardEligible),
  "Every merch bundle must count as one complete AREA free item.",
)
assert(
  backend.includes('"CROWDRELAY_COMMERCE_API_KEY"') &&
    !backend.includes('"CROWDRELAY_ADMIN_API_KEY"'),
  "AREA service calls must use the deployed commerce credential.",
)
assert(
  backend.includes('"public/area/drops"') &&
    backend.includes('"internal/area/players"') &&
    backend.includes('"me/area/claim"'),
  "AREA clients must use CrowdRelay as the canonical game backend.",
)
assert(
  backend.includes("getPublicAreaSnapshot") &&
    backend.includes("PUBLIC_CACHE_TTL_MS") &&
    backend.includes("PUBLIC_STALE_TTL_MS"),
  "Public AREA catalogue reads must have a bounded stale cache.",
)
assert(
  !backend.includes("exactLat") &&
    !backend.includes("exactLng") &&
    !backend.includes("radiusMeters"),
  "Virya must not receive private AREA claim geometry.",
)
assert(
  backend.includes("FAN_TOKEN_PATTERN = /^[0-9a-f]{64}$/i"),
  "The compatibility proxy must accept only canonical CrowdRelay fan tokens.",
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
  experience.includes("if (liveDrops.size === 0)") &&
    experience.indexOf("if (liveDrops.size === 0)") <
      experience.indexOf("const position = await areaPosition()"),
  "Nearest-point lookup must not request GPS when no signal is active.",
)
assert(
  wallet.includes("ensureLegacyAreaImported") &&
    migration.includes("missingClaims") &&
    migration.includes("claimedAt: claim.claimedAt") &&
    migration.includes("editionNumber: claim.editionNumber") &&
    migration.includes("importLegacyAreaWallet"),
  "One-way wallet migration must preserve legacy claim timestamps, editions and rewards.",
)
assert(
  legacyLedger.includes("Read-only compatibility view") &&
    legacyLedger.includes("getAreaWallet") &&
    !legacyLedger.includes(".set("),
  "Legacy Netlify Blob wallet must be read-only after Postgres becomes authoritative.",
)
assert(
  auth.match(/linkAreaPlayer\(email\)/g)?.length === 1 &&
    auth.includes("linkedBackendPlayerId"),
  "AREA account linking must not repeat during Blob CAS retries.",
)
assert(
  existsSync(resolve(root, "src/pages/api/area/events.ts")),
  "AREA telemetry endpoint is missing.",
)
assert(
  claim.includes("claimAreaBackendDrop") &&
    claim.includes('proxyMobileArea(request, "me/area/claim"'),
  "AREA claims must be verified and stored by CrowdRelay.",
)
assert(
  actor.includes("isSameOriginRequest") &&
    !actor.includes("createHash") &&
    !actor.includes("fan_session_token"),
  "Browser actor resolution must not duplicate native fan authentication.",
)
assert(
  wallet.includes("getAreaReadActor(request, cookies)") &&
    challenge.includes("getAreaMutationActor(request, cookies)") &&
    claim.includes("getAreaMutationActor(request, cookies)") &&
    [wallet, challenge, claim].every(source => source.includes("proxyMobileArea")),
  "AREA endpoints must preserve the website boundary and old-app proxy.",
)
assert(
  !existsSync(resolve(root, "src/server/areaCatalog.ts")) &&
    !existsSync(resolve(root, "src/server/areaLiveDrops.ts")) &&
    !existsSync(resolve(root, ".env.area.production")) &&
    !envExample.includes("AREA_LIVE_DROPS_JSON"),
  "Retired frontend drop configuration must be removed.",
)

const coordinateLiterals = [
  ...publicDrops.matchAll(/approximate(?:Lat|Lng):\s*(-?\d+(?:\.(\d+))?)/g),
]
assert(coordinateLiterals.length === 24, "Expected 12 coarse AREA city points.")
for (const match of coordinateLiterals) {
  assert(
    (match[2]?.length ?? 0) <= 1,
    `Public city reference is too precise: ${match[0]}`,
  )
}
assert(
  !/button\.hidden\s*=\s*!live/.test(experience),
  "AREA city markers must remain visible when no drop is live.",
)
assert(
  experience.includes("data-drop-marker") &&
    experience.includes("area-marker-core"),
  "AREA map must render explicit city marker icons.",
)

if (failures.length) {
  console.error("VIRYA AREA audit failed:\n")
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exit(1)
}

console.log("VIRYA AREA source audit passed.")
