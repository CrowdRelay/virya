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
