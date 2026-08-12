import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const shared = readFileSync(
  new URL("../src/components/preact/staff/adminConsoleShared.ts", import.meta.url),
  "utf8",
)
const tabs = readFileSync(
  new URL("../src/components/preact/staff/AdminConsoleTabs.tsx", import.meta.url),
  "utf8",
)

test("staff ops keeps CrowdRelay watchdog state visible even if notification delivery is down", () => {
  assert.match(shared, /watchdog\?:/)
  assert.match(shared, /active_alerts: number/)
  assert.match(shared, /critical_alerts: number/)
  assert.match(tabs, /overview\?\.summary\.watchdog/)
  assert.match(tabs, /Autopilot pilnuje/)
  assert.match(tabs, /n8n jest tylko kanałem powiadomienia/)
})
