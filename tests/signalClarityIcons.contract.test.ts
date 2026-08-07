import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(
  new URL("../src/components/SignalPage.astro", import.meta.url),
  "utf8",
)

test("Signal clarity icons use centered monochrome SVGs", () => {
  assert.match(source, /class="signal-clarity-icon"/)
  assert.match(source, /display: inline-flex/)
  assert.match(source, /align-items: center/)
  assert.match(source, /justify-content: center/)
  assert.match(source, /stroke: currentColor/)
  assert.doesNotMatch(source, /\["✉", "⌖", "▣"\]/)
  assert.equal((source.match(/<svg viewBox="0 0 24 24" fill="none">/g) ?? []).length, 4)
})
