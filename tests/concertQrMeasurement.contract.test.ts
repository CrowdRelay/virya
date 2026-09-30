import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const api = read("src/server/staffQrApi.ts")
const manager = read("src/components/preact/staff/ConcertQrManager.tsx")
const createRoute = read("src/pages/api/staff/qr/campaigns.ts")
const contextRoute = read("src/pages/api/staff/qr/campaigns/[id]/context.ts")

test("staff QR read model carries the scan context CrowdRelay already returns", () => {
  assert.match(api, /placement:\s*string \| null/)
  assert.match(api, /announced_from_stage:\s*boolean/)
  assert.match(api, /incentive:\s*string \| null/)
})

test("campaign creation records measurable room context without inventing a benefit", () => {
  assert.match(manager, /placement:\s*placement\.trim\(\) \|\| null/)
  assert.match(manager, /announced_from_stage:\s*announcedFromStage/)
  assert.match(manager, /incentive:\s*incentive\.trim\(\) \|\| null/)
  assert.match(manager, /useState\("album draw chance"\)/)
  assert.match(manager, /To tylko zapis pomiarowy/)
  assert.match(createRoute, /staffQrRequest<StaffQrCampaign>/)
})

test("the operator can record what actually happened without changing QR authority", () => {
  assert.match(manager, /Faktycznie zapowiedziane ze sceny/)
  assert.match(manager, /saveContext/)
  assert.match(manager, /\/context/)
  assert.match(contextRoute, /isSameOriginRequest/)
  assert.match(contextRoute, /hasStaffQrSession/)
  assert.match(contextRoute, /readSmallJson/)
  assert.match(
    contextRoute,
    /admin\/event-qr\/campaigns\/\$\{encodeURIComponent\(id\)\}\/context/,
  )
  assert.doesNotMatch(contextRoute, /revoke/)
})
