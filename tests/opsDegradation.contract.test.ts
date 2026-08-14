import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync(new URL("../src/pages/api/staff/admin/ops/summary.ts", import.meta.url), "utf8")
const ui = readFileSync(new URL("../src/components/preact/staff/AdminConsoleTabs.tsx", import.meta.url), "utf8")

test("Ops summary keeps primary telemetry when secondary dead-item diagnostics fail", () => {
  assert.match(route, /Promise\.allSettled/)
  assert.match(route, /if \(summaryResult\.status === "rejected"\) throw summaryResult\.reason/)
  assert.match(route, /deadDeliveries: deliveriesResult\.status === "fulfilled" \? deliveriesResult\.value : \[\]/)
  assert.match(route, /deadOutbox: outboxResult\.status === "fulfilled" \? outboxResult\.value : \[\]/)
  assert.match(route, /degraded/)
  assert.match(ui, /Częściowa diagnostyka kolejek/)
})
