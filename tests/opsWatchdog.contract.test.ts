import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync(
  new URL("../src/pages/api/staff/admin/ops/summary.ts", import.meta.url),
  "utf8",
)
const tabs = readFileSync(
  new URL("../src/components/preact/staff/AdminConsoleTabs.tsx", import.meta.url),
  "utf8",
)

test("watchdog telemetry remains available through the bounded ops route but is not normal Staff UI", () => {
  assert.match(route, /admin\/ops\/summary/)
  assert.match(route, /summary: summaryResult\.value/)
  assert.match(route, /Promise\.allSettled/)
  assert.doesNotMatch(tabs, /summary\.watchdog|Autopilot pilnuje|n8n jest tylko kanałem powiadomienia/)
})
