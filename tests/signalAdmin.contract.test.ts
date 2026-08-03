import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const ui = read("src/components/preact/staff/AdminConsole.tsx")
const route = read("src/pages/api/staff/admin/signal/overview.ts")

test("admin panel exposes a dedicated aggregate-only Signal tab", () => {
  for (const marker of [
    'key: "signal"',
    'label: "Sygnał"',
    "function SignalTab()",
    "/api/staff/admin/signal/overview",
    "top_cities",
    "pending_city_requests",
    "dane wyłącznie zagregowane",
  ]) {
    assert.ok(ui.includes(marker), `missing Signal UI marker: ${marker}`)
  }
})

test("Signal proxy stays behind staff session and server-side admin credentials", () => {
  assert.match(route, /hasStaffQrSession/)
  assert.match(route, /staffApiRequest\("admin\/signal\/overview"/)
  assert.match(route, /Signal control plane temporarily unavailable/)
  assert.doesNotMatch(route, /CROWDRELAY_ADMIN_API_KEY/)
  assert.doesNotMatch(route, /email|display_name|fan_id/i)
})
