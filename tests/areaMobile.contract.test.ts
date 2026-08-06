import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("AREA city icons remain visible without a live drop", () => {
  const experience = read("src/components/AreaExperience.astro")
  assert.doesNotMatch(experience, /button\.hidden\s*=\s*!live/)
  assert.match(experience, /data-drop-marker/)
  assert.match(experience, /area-marker-core/)
  assert.match(experience, /classList\.toggle\("is-inactive", !live\)/)
})

test("Virya Signal AREA requests authenticate without exposing exact locations", () => {
  const actor = read("src/server/areaActor.ts")
  const publicDrops = read("src/data/area.ts")
  const wallet = read("src/pages/api/area/wallet.ts")
  const challenge = read("src/pages/api/area/challenge.ts")
  const claim = read("src/pages/api/area/claim.ts")

  assert.match(actor, /authorization/)
  assert.match(actor, /x-virya-area-wallet/)
  assert.match(actor, /createHash\("sha256"\)\.update\(token\)/)
  assert.doesNotMatch(actor, /console\.(?:log|error)/)
  assert.match(wallet, /getAreaReadActor\(request, cookies\)/)
  assert.match(challenge, /getAreaMutationActor\(request, cookies\)/)
  assert.match(claim, /getAreaMutationActor\(request, cookies\)/)

  const coordinates = [...publicDrops.matchAll(/approximate(?:Lat|Lng):\s*-?\d+(?:\.(\d+))?/g)]
  assert.ok(coordinates.length > 0)
  for (const coordinate of coordinates) assert.ok((coordinate[1]?.length ?? 0) <= 1)
})

test("AREA live-drop configuration is read at Netlify function runtime", () => {
  const liveConfig = read("src/server/areaLiveDrops.ts")
  const wallet = read("src/pages/api/area/wallet.ts")
  assert.match(liveConfig, /import \{ getSecret \} from "astro:env\/server"/)
  assert.match(liveConfig, /getSecret\("AREA_LIVE_DROPS_JSON"\)/)
  assert.match(liveConfig, /getAreaLiveDropConfigState/)
  assert.doesNotMatch(liveConfig, /import\.meta\.env\.AREA_LIVE_DROPS_JSON/)
  assert.match(wallet, /liveState:/)
  assert.match(wallet, /getAreaLiveDropConfigState\(\) === "ready"/)
})

test("nearest-signal UX does not misreport an empty campaign as denied GPS", () => {
  const experience = read("src/components/AreaExperience.astro")
  const noLiveGuard = experience.indexOf("if (liveDrops.size === 0)")
  const positionRead = experience.indexOf("const position = await areaPosition()")
  assert.ok(noLiveGuard >= 0)
  assert.ok(positionRead > noLiveGuard)
  assert.match(experience, /areaLocationErrorMessage\(error, copy\)/)
  assert.match(experience, /code === 1/)
  assert.match(experience, /code === 3/)
})
