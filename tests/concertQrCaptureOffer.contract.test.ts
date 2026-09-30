import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("concert QR keeps the configured fan offer from staff form to fan-facing surfaces", () => {
  const manager = read("src/components/preact/staff/ConcertQrManager.tsx")
  const transport = read("src/server/staffQrApi.ts")
  const contextRoute = read("src/pages/api/staff/qr/campaigns/[id]/context.ts")

  for (const field of ["placement", "announced_from_stage", "incentive"]) {
    assert.ok(transport.includes(field), `staff campaign transport lost ${field}`)
    assert.ok(manager.includes(field), `staff QR manager lost ${field}`)
  }

  assert.match(manager, /newIncentive\.trim\(\) \|\| null/)
  assert.match(manager, /contextIncentive\.trim\(\) \|\| null/)
  assert.match(manager, /activeCampaign\.incentive/)
  assert.match(manager, /Zeskanuj i odbierz/)
  assert.match(manager, /Scan and get/)
  assert.match(manager, /printCopy\.offer/)
  assert.match(manager, /Kontekst konwersji/)
  assert.match(manager, /Ten QR nie ma jeszcze konkretnej obietnicy dla fana/)

  assert.match(contextRoute, /isSameOriginRequest/)
  assert.match(contextRoute, /hasStaffQrSession/)
  assert.ok(contextRoute.includes("admin/event-qr/campaigns/${encodeURIComponent(id)}/context"))
})

test("concert QR offer remains optional instead of inventing a reward", () => {
  const manager = read("src/components/preact/staff/ConcertQrManager.tsx")

  assert.match(manager, /incentive:\s*newIncentive\.trim\(\) \|\| null/)
  assert.match(manager, /incentive:\s*contextIncentive\.trim\(\) \|\| null/)
  assert.match(manager, /activeCampaign\.incentive\s*\?/)
  assert.match(manager, /Zeskanuj\. Potwierdź obecność\. Zwiększ szansę na album\./)
})
