import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8")

test("push delivery is visible from backend readiness through operator queue health", () => {
  const overview = read("src/pages/api/staff/admin/overview.ts")
  const shared = read("src/components/preact/staff/adminConsoleShared.ts")
  const tabs = read("src/components/preact/staff/AdminConsoleTabs.tsx")
  const controls = read("src/components/preact/staff/EcosystemControl.tsx")

  assert.match(overview, /public\/push\/config/)
  assert.match(overview, /android_fcm/)
  assert.match(overview, /web_push/)
  assert.match(shared, /push\?: QueueSummary/)
  for (const metric of ["push.pending", "push.processing", "push.dead", "push.delivered_24h"]) {
    assert.ok(tabs.includes(metric), `missing operator push metric ${metric}`)
  }
  assert.ok(tabs.includes("Push runtime"))
  assert.ok(tabs.includes('Android ${overview.push.android_fcm ? "OK" : "OFF"}'))
  assert.ok(controls.includes('push_delivery_enabled: "Push notifications"'))
})
