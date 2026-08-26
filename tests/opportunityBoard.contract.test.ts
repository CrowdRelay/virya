import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync(new URL("../src/pages/api/staff/admin/autopilot.ts", import.meta.url), "utf8")
const board = readFileSync(new URL("../src/components/preact/staff/AutopilotHandoffs.tsx", import.meta.url), "utf8")
const handoffs = board

test("the staff panel reads the ranked queue without a new BFF route", () => {
  assert.match(route, /admin\/autopilot\/next-best-actions/)
  assert.match(route, /opportunitiesResult\.status === "fulfilled"\s*\n?\s*&& Array\.isArray/)
  // A missing queue degrades one card; it never fails the overview.
  assert.match(board, /overview\.opportunities \?\? \[\]/)
})

test("done-ourselves is a first-class decision through the canonical ledger write", () => {
  assert.match(route, /operation === "handled_externally"/)
  assert.match(route, /admin\/autopilot\/decisions\/\$\{encodeURIComponent\(decisionId\)\}\/handled-externally/)
  // The finding must be a real uuid before anything is recorded about it.
  assert.match(route, /if \(!decisionId\) return areaJson\(\{ error: "Invalid decision" \}, 422\)/)
  assert.match(board, /decision_id: item\.decision_id, operation: "handled_externally"/)
  assert.match(board, /JUŻ ZROBIONE/)
})

test("do-it reuses the existing approval operation instead of a second authority path", () => {
  assert.match(board, /action_id: item\.action_id, operation: "approve"/)
  assert.match(handoffs, /operation: action|operation: "approve"/)
})

test("both decisions need a deliberate confirm click before they are sent", () => {
  assert.match(board, /confirming !== key/)
  assert.match(board, /setConfirming\(null\)/)
})
