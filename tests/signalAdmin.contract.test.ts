import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const ui = [
  "src/components/preact/staff/AdminConsole.tsx",
  "src/components/preact/staff/AdminConsoleTabs.tsx",
  "src/components/preact/staff/AdminTicketingTab.tsx",
  "src/components/preact/staff/adminConsoleShared.ts",
].map(read).join("\n")
const route = read("src/pages/api/staff/admin/signal/overview.ts")
const ecosystem = read("src/components/preact/staff/EcosystemControl.tsx")
const loader = read("src/components/preact/staff/BackendLoader.tsx")

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


test("backend-backed admin sections expose scoped loading overlays", () => {
  for (const marker of [
    "BackendLoader",
    "overviewLoading",
    "Pobieram aktualne dane",
    "Pobieram sprzedaż",
    "Pobieram statystyki Sygnału",
    "aria-busy",
  ]) {
    assert.ok(ui.includes(marker), `missing admin loading marker: ${marker}`)
  }
  assert.match(ecosystem, /BackendLoader/)
  assert.match(ecosystem, /Pobieram control plane i proofy/)
  assert.match(loader, /animate-pulse/)
  assert.match(loader, /role="status"/)
})
