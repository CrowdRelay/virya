import assert from "node:assert/strict"
import test from "node:test"
import { finiteDate, safeFormatDate } from "../src/lib/safeDateFormat.ts"

const formatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
})

test("finiteDate accepts valid Date, ISO and epoch values", () => {
  assert.ok(finiteDate(new Date("2026-08-03T22:09:31.460Z")))
  assert.ok(finiteDate("2026-08-03T22:09:31.460Z"))
  assert.ok(finiteDate(1_775_426_971_460))
})

test("finiteDate rejects malformed and non-finite API values", () => {
  for (const value of [null, undefined, "", "   ", "infinity", "-infinity", "not-a-date", Number.NaN, Number.POSITIVE_INFINITY, new Date(Number.NaN)]) {
    assert.equal(finiteDate(value), null)
  }
})

test("safeFormatDate returns a stable fallback instead of throwing", () => {
  for (const value of [null, undefined, "", "infinity", "invalid"]) {
    assert.doesNotThrow(() => safeFormatDate(value, formatter))
    assert.equal(safeFormatDate(value, formatter), "—")
  }
})

test("safeFormatDate preserves valid date formatting", () => {
  const value = "2026-08-03T22:09:31.460Z"
  assert.equal(safeFormatDate(value, formatter), formatter.format(new Date(value)))
})

test("accounting UI routes every untrusted timestamp through the safe formatter", async () => {
  const { readFile } = await import("node:fs/promises")
  const source = await readFile(
    new URL("../src/components/preact/staff/AccountingManager.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /safeFormatDate/)
  assert.doesNotMatch(source, /\.format\(new Date\(value\)\)/)
})
