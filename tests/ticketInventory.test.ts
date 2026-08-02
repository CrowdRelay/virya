import test from "node:test"
import assert from "node:assert/strict"
import { normalizeTicketInventory } from "../src/lib/ticketInventory.ts"

test("normalizes legacy inventory without losing capacity", () => {
  const value = normalizeTicketInventory({ capacity: 100, available: 70 })
  assert.deepEqual({ sold: value.sold, reserved: value.reserved, available: value.available }, { sold: 30, reserved: 0, available: 70 })
  assert.equal(value.sold + value.reserved + value.available, value.capacity)
})

test("clamps malformed counters and preserves the invariant", () => {
  for (const input of [
    { capacity: -1, available: 20, sold: 20, reserved: 20 },
    { capacity: 10, available: 20, sold: 20, reserved: 20 },
    { capacity: 10.8, available: 2.9, sold: 3.1, reserved: 1.9 },
  ]) {
    const value = normalizeTicketInventory(input)
    assert.ok(value.sold >= 0 && value.reserved >= 0 && value.available >= 0)
    assert.equal(value.sold + value.reserved + value.available, value.capacity)
  }
})
