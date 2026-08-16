import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const page = read("src/components/LatarnikPage.astro")
const fulfillment = read("src/client/latarnikReleaseFulfillment.ts")

test("Latarnik gets one explicit per-release Paczkomat confirmation flow", () => {
  assert.match(page, /id="wydania"/)
  assert.match(page, /nie przechowujemy Paczkomatu jako stałego profilu/)
  assert.match(fulfillment, /beacon\/me\/releases\/\$\{encodeURIComponent\(campaign\.campaignId\)\}\/delivery/)
  assert.match(fulfillment, /recipientName/)
  assert.match(fulfillment, /recipientPhone/)
  assert.match(fulfillment, /parcelLockerCode/)
  assert.match(fulfillment, /toUpperCase\(\)/)
})

test("declining a reserved physical copy is explicit and cannot be an accidental single tap", () => {
  assert.match(fulfillment, /window\.confirm\(c\.declineConfirm\)/)
  assert.match(fulfillment, /\/decline`/)
  assert.match(fulfillment, /Tym razem rezygnuję/)
  assert.match(fulfillment, /Zarezerwowana sztuka wróci do puli/)
})

test("release fulfillment keeps help and press materials adjacent to the shipping decision", () => {
  assert.match(fulfillment, /recenzja\/wzmianka, radio lub podcast/)
  assert.match(fulfillment, /press\.href = "#press-room"/)
  assert.match(page, /\["releases", isPl \? "Premiery" : "Releases"\]/)
})
