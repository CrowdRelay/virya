import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync(
  new URL("../src/pages/api/staff/admin/ops/summary.ts", import.meta.url),
  "utf8",
)
const ui = readFileSync(
  new URL("../src/components/preact/staff/AdminConsoleTabs.tsx", import.meta.url),
  "utf8",
)

// One gate for the ops-summary contract: bounded server-side telemetry with
// per-source degradation, and no queue diagnostics leaking into normal Staff.
test("ops summary stays server-side, degraded per source and out of the Staff UI", () => {
  assert.match(route, /admin\/ops\/summary/)
  assert.match(route, /Promise\.allSettled/)
  assert.match(route, /if \(summaryResult\.status === "rejected"\) throw summaryResult\.reason/)
  assert.match(route, /deadDeliveries: deliveriesResult\.status === "fulfilled" \? deliveriesResult\.value : \[\]/)
  assert.match(route, /deadOutbox: outboxResult\.status === "fulfilled" \? outboxResult\.value : \[\]/)
  assert.match(route, /degraded/)
  assert.doesNotMatch(ui, /Częściowa diagnostyka kolejek|deadDeliveries|deadOutbox|summary\.watchdog|Autopilot pilnuje|n8n jest tylko kanałem powiadomienia/)
})
