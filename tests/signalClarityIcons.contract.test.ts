import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(
  new URL("../src/components/SignalPage.astro", import.meta.url),
  "utf8",
)

test("Signal clarity section stays static, readable and editorial", () => {
  assert.match(source, /number: "01"/)
  assert.match(source, /number: "02"/)
  assert.match(source, /number: "03"/)
  assert.match(source, /signal-benefits-heading/)
  assert.match(source, /md:grid-cols-3/)
  assert.doesNotMatch(source, /signal-clarity-icon|\["✉", "⌖", "▣"\]/)
})
