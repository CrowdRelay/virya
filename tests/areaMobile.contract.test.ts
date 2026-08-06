import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("AREA city icons remain visible and GPS stays idle without a live drop", () => {
  const experience = read("src/components/AreaExperience.astro")
  assert.doesNotMatch(experience, /button\.hidden\s*=\s*!live/)
  assert.match(experience, /data-drop-marker/)
  assert.match(experience, /area-marker-core/)
  assert.match(experience, /classList\.toggle\("is-inactive", !live\)/)
  const noLiveGuard = experience.indexOf("if (liveDrops.size === 0)")
  const geolocation = experience.indexOf("const position = await areaPosition()")
  assert.ok(noLiveGuard >= 0 && noLiveGuard < geolocation)
})

test("old Virya Signal requests use a strict compatibility proxy", () => {
  const actor = read("src/server/areaActor.ts")
  const backend = read("src/server/crowdrelayArea.ts")
  const publicDrops = read("src/data/area.ts")
  const wallet = read("src/pages/api/area/wallet.ts")
  const challenge = read("src/pages/api/area/challenge.ts")
  const claim = read("src/pages/api/area/claim.ts")

  assert.match(backend, /FAN_TOKEN_PATTERN = \/\^\[0-9a-f\]\{64\}\$\/i/)
  assert.match(backend, /Cookie: `crowdrelay_fan=\$\{token\}`/)
  assert.match(backend, /"Idempotency-Key": randomUUID\(\)/)
  assert.doesNotMatch(actor, /createHash|fan_session_token|x-virya-area-wallet/)
  assert.match(wallet, /getAreaReadActor\(request, cookies\)/)
  assert.match(challenge, /getAreaMutationActor\(request, cookies\)/)
  assert.match(claim, /getAreaMutationActor\(request, cookies\)/)
  assert.ok([wallet, challenge, claim].every(source => source.includes("proxyMobileArea")))

  const coordinates = [
    ...publicDrops.matchAll(/approximate(?:Lat|Lng):\s*-?\d+(?:\.(\d+))?/g),
  ]
  assert.equal(coordinates.length, 24)
  for (const coordinate of coordinates) {
    assert.ok((coordinate[1]?.length ?? 0) <= 1)
  }
})
