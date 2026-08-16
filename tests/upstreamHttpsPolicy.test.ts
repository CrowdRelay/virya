import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const protectedModules = [
  "src/server/staffQrApi.ts",
  "src/server/crowdrelayTicketing.ts",
  "src/server/crowdrelayCommerce.ts",
  "src/server/areaTicketRewards.ts",
  "src/server/liveEvents.ts",
]

test("CrowdRelay server integrations require HTTPS outside local development", () => {
  for (const path of protectedModules) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.match(
      source,
      /import\.meta\.env\.DEV && url\.protocol === ["']http:["']/,
    )
    assert.match(source, /url\.protocol !== ["']https:["'] && !localHttp/)
    assert.doesNotMatch(source, /!\/\^https\\\?:\$\/\.test\(url\.protocol\)/)
  }
})

const proofRoutes = [
  "src/pages/api/proofs/draws/[slug].ts",
  "src/pages/api/proofs/draws/[slug]/status.ts",
]

test("public draw proxy routes reuse the validated CrowdRelay proof base", () => {
  const proofClient = readFileSync(
    new URL("../src/server/publicDrawProof.ts", import.meta.url),
    "utf8",
  )
  assert.match(proofClient, /export function publicDrawApiBase\(\)/)
  assert.match(proofClient, /url\.protocol !== ["']https:["'] && !localHttp/)
  for (const path of proofRoutes) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.match(source, /publicDrawApiBase\(\)/)
    assert.doesNotMatch(source, /readServerEnv\(/)
  }
})
