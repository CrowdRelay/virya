import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const consoleUi = [
  "src/components/preact/staff/AdminConsole.tsx",
  "src/components/preact/staff/AdminConsoleTabs.tsx",
  "src/components/preact/staff/AdminTicketingTab.tsx",
  "src/components/preact/staff/adminConsoleShared.ts",
].map(read).join("\n")
const audienceUi = read("src/components/preact/staff/AudienceIntelligence.tsx")
const dashboard = read("src/pages/api/staff/admin/audience/dashboard.ts")
const fanTags = read("src/pages/api/staff/admin/audience/fans/[id]/tags/index.ts")
const campaigns = read("src/pages/api/staff/admin/communications/campaigns/index.ts")

test("control center exposes Audience Intelligence without exposing admin credentials", () => {
  // The panel is code-split, so the console references it by its lazy import
  // rather than by an eager element.
  for (const marker of ['key: "audience"', 'import("./AudienceIntelligence")', 'Fan 360 i komunikacja']) {
    assert.ok(consoleUi.includes(marker), marker)
  }
  assert.doesNotMatch(audienceUi, /CROWDRELAY_(ADMIN|COMMERCE)_API_KEY/)
  assert.match(audienceUi, /\/api\/staff\/admin\/audience\/dashboard/)
})

test("audience dashboard is one browser request backed by bounded parallel server reads", () => {
  assert.match(dashboard, /Promise\.allSettled/)
  assert.match(dashboard, /admin\/audience\/overview/)
  assert.match(dashboard, /admin\/analytics\/funnel/)
  assert.match(dashboard, /admin\/analytics\/revenue/)
  assert.match(dashboard, /communication_campaigns_enabled/)
  assert.match(dashboard, /unavailable/)
})

test("audience mutations remain same-origin and staff-session protected", () => {
  for (const route of [fanTags, campaigns]) {
    assert.match(route, /isSameOriginRequest/)
    assert.match(route, /hasStaffQrSession/)
    assert.match(route, /staffApiRequest/)
    assert.doesNotMatch(route, /CROWDRELAY_ADMIN_API_KEY/)
  }
})

test("campaign scheduling is fail-closed and uses first-class inline datetime UI", () => {
  assert.match(audienceUi, /communication_campaigns_enabled/)
  assert.match(audienceUi, /type="datetime-local"/)
  assert.match(audienceUi, /scheduled_at: date\.toISOString\(\)/)
  assert.doesNotMatch(audienceUi, /window\.prompt/)
})

test("Fan 360 renders Synesthesia alongside acquisition, attendance and tickets", () => {
  for (const marker of ["detail.acquisitions", "detail.attendance", "detail.ticket_purchases", "detail.synesthesia", "detail.rewards"]) {
    assert.ok(audienceUi.includes(marker), marker)
  }
})


test("Audience UI degrades dashboard and fan list independently", () => {
  assert.match(audienceUi, /Promise\.allSettled/)
  assert.match(audienceUi, /dashboardAvailable/)
  assert.match(audienceUi, /fansAvailable/)
  assert.match(audienceUi, /Dashboard metryk jest chwilowo niedostępny/)
  assert.match(audienceUi, /Lista fanów jest chwilowo niedostępna/)
  assert.match(audienceUi, /dashboard && !dashboard\.features\.communication_campaigns_enabled/)
})
