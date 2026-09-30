import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("concert QR conversion offer stays wired through staff create, edit and print", async () => {
  const [manager, staffApi, contextRoute] = await Promise.all([
    read("src/components/preact/staff/ConcertQrManager.tsx"),
    read("src/server/staffQrApi.ts"),
    read("src/pages/api/staff/qr/campaigns/[id]/context.ts"),
  ])

  assert.match(staffApi, /placement:\s*string \| null/)
  assert.match(staffApi, /announced_from_stage:\s*boolean/)
  assert.match(staffApi, /incentive:\s*string \| null/)

  assert.match(manager, /placement:\s*placement\.trim\(\) \|\| null/)
  assert.match(manager, /announced_from_stage:\s*announcedFromStage/)
  assert.match(manager, /incentive:\s*incentive\.trim\(\) \|\| null/)

  assert.match(
    manager,
    /activeCampaign\.incentive\?\.trim\(\) \|\| "Zeskanuj\. Potwierdź obecność\. Zwiększ szansę na album\."/,
  )
  assert.match(
    manager,
    /activeCampaign\.incentive\?\.trim\(\) \|\| "Scan\. Confirm attendance\. Increase your album chance\."/,
  )

  assert.match(manager, /\/context`/)
  assert.match(contextRoute, /admin\/event-qr\/campaigns\/\$\{encodeURIComponent\(id\)\}\/context/)
  assert.match(contextRoute, /isSameOriginRequest/)
  assert.match(contextRoute, /hasStaffQrSession/)
})

test("concert QR incentive remains optional and keeps the existing fallback", async () => {
  const manager = await read("src/components/preact/staff/ConcertQrManager.tsx")
  assert.match(manager, /Puste = domyślna szansa na album/)
  assert.match(manager, /incentive:\s*contextIncentive\.trim\(\) \|\| null/)
})
