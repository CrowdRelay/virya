import assert from "node:assert/strict"
import test from "node:test"
import {
  NUDGE_DISMISS_DAYS,
  parseDismissedAt,
  shouldNudgePush,
  type NudgeInput,
} from "../src/lib/pushNudge.ts"

const now = Date.UTC(2026, 9, 3, 12, 0, 0)
const day = 24 * 60 * 60 * 1000
const base: NudgeInput = {
  supported: true,
  permission: "default",
  subscribed: false,
  dismissedAtMs: null,
  nowMs: now,
}

test("a fan who can take push and has not is asked", () => {
  assert.equal(shouldNudgePush(base), true)
})

test("permission granted but no subscription on this device is still asked", () => {
  assert.equal(shouldNudgePush({ ...base, permission: "granted" }), true)
})

test("never asked when push is unsupported, blocked, or already on", () => {
  assert.equal(shouldNudgePush({ ...base, supported: false }), false)
  assert.equal(shouldNudgePush({ ...base, permission: "denied" }), false)
  assert.equal(shouldNudgePush({ ...base, subscribed: true }), false)
})

test("a not-now holds for fourteen days and then the ask returns", () => {
  const dismissed = (daysAgo: number) => now - daysAgo * day
  assert.equal(shouldNudgePush({ ...base, dismissedAtMs: dismissed(1) }), false)
  assert.equal(shouldNudgePush({ ...base, dismissedAtMs: dismissed(NUDGE_DISMISS_DAYS - 0.1) }), false)
  assert.equal(shouldNudgePush({ ...base, dismissedAtMs: dismissed(NUDGE_DISMISS_DAYS + 0.1) }), true)
})

test("a dismissal stamped in the future does not hide the ask forever", () => {
  assert.equal(shouldNudgePush({ ...base, dismissedAtMs: now + 30 * day }), true)
})

test("garbage in storage means never dismissed", () => {
  assert.equal(parseDismissedAt(null), null)
  assert.equal(parseDismissedAt("not a number"), null)
  assert.equal(parseDismissedAt("0"), null)
  assert.equal(parseDismissedAt("-5"), null)
  assert.equal(parseDismissedAt(String(now)), now)
})
