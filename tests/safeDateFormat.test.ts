import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { finiteDate, safeFormatDate, safeTimeZone } from "../src/lib/safeDateFormat.ts"

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
  const source = await readFile(
    new URL("../src/components/preact/staff/AccountingManager.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /safeFormatDate/)
  assert.doesNotMatch(source, /\.format\(new Date\(value\)\)/)
})

test("safeTimeZone preserves valid IANA zones and contains malformed input", () => {
  assert.equal(safeTimeZone("Europe/Warsaw"), "Europe/Warsaw")
  assert.equal(safeTimeZone("not/a-zone"), "Europe/Warsaw")
  assert.equal(safeTimeZone(null), "Europe/Warsaw")
})

test("ticket and admission surfaces use the bounded date helpers", async () => {
  const files = await Promise.all([
    readFile(new URL("../src/pages/api/ticket-mail.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/preact/tickets/TicketWallet.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/preact/signal/AdmissionPassCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/preact/area/AreaTicketRewards.tsx", import.meta.url), "utf8"),
  ])
  for (const source of files) assert.match(source, /safe(?:FormatDate|TimeZone)/)
})
