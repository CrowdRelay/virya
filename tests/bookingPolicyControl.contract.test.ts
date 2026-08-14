import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const route = readFileSync(new URL("../src/pages/api/staff/admin/autopilot.ts", import.meta.url), "utf8")
const panel = readFileSync(new URL("../src/components/preact/staff/BookingPolicyPanel.tsx", import.meta.url), "utf8")
const handoffs = readFileSync(new URL("../src/components/preact/staff/AutopilotHandoffs.tsx", import.meta.url), "utf8")

test("booking manager policy has a versioned operator surface without a new BFF route", () => {
  assert.match(route, /admin\/autopilot\/manager-config\/booking-policy/)
  assert.match(route, /operation === "set_booking_policy"/)
  assert.match(route, /source: "operator"/)
  assert.match(route, /expected_version: expectedVersion/)
  assert.match(route, /\[400, 404, 409, 422, 429, 503\]/)
  assert.match(panel, /summary\.version/)
  assert.match(panel, /failure\?\.status === 409/)
  assert.match(panel, /ZAPISZ POLITYKĘ BOOKINGOWĄ/)
  assert.match(panel, /min-h-11/)
  assert.match(handoffs, /<BookingPolicyPanel summary=\{bookingPolicy\}/)
})

test("booking policy input is bounded before it reaches CrowdRelay", () => {
  assert.match(route, /annualStretch < annualTarget/)
  assert.match(route, /markets\.length < 1 \|\| markets\.length > 12/)
  assert.match(route, /\^\[A-Z0-9-\]\{1,24\}\$/)
  assert.match(route, /0, 10_000/)
})
