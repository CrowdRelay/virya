import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("../src/pages/api/crowdrelay-mail.ts", import.meta.url),
  "utf8",
)

test("ticket promo mail carries the exact code and an upcoming show list", () => {
  assert.match(source, /"crowdrelay-ticket-reward"/)
  assert.match(source, /variables\.coupon_code/)
  assert.match(source, /variables\.upcoming_events \?\? variables\.events/)
  assert.match(source, /Kod na najbliższy koncert/)
  assert.match(source, /Najbliższe koncerty/)
  assert.match(source, /buttonUrl: nearest\.ticketUrl/)
})

test("ticket promo event input is bounded and every destination is validated", () => {
  assert.match(source, /value\.length > 12/)
  assert.match(source, /safeUrl\(event\?\.ticket_url \?\? event\?\.event_url\)/)
  assert.match(source, /Number\.isNaN\(Date\.parse\(startsAtRaw\)\)/)
})
