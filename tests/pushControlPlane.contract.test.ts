import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8")

test("push delivery diagnostics stay out of the normal Staff overview", () => {
  const overview = read("src/pages/api/staff/admin/overview.ts")
  const shared = read("src/components/preact/staff/adminConsoleShared.ts")
  const tabs = read("src/components/preact/staff/AdminConsoleTabs.tsx")
  const controls = read("src/components/preact/staff/EcosystemControl.tsx")

  assert.doesNotMatch(overview, /public\/push\/config|android_fcm|web_push|health\/ready|health\/live/)
  assert.doesNotMatch(shared, /push\?: QueueSummary|OpsOverview|QueueSummary/)
  assert.doesNotMatch(tabs, /push\.pending|push\.processing|push\.dead|push\.delivered_24h|Push runtime/)
  // The underlying feature flag/control implementation remains available for the
  // future Control Plane surface; only normal Staff presentation is removed.
  assert.match(controls, /push_delivery_enabled: "Push notifications"/)
})
