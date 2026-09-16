import assert from "node:assert/strict"
import test from "node:test"
import { parseListing } from "../src/server/bandListing.ts"

// The listing wire contract: the page renders only what survived upstream
// redaction, and the parser must refuse anything that arrives in a shape it
// does not expect — a public endpoint's payload is not trusted content.

const listing = () => ({
  act_name: "Virya",
  genre_tags: ["modern metal"],
  cities: ["Warsaw", "Kraków"],
  claims: [
    {
      label: "Tickets banked in Warsaw, last 12 months",
      value: 420,
      tier: "downstream",
      basis: "CrowdRelay ticket ledger",
    },
  ],
  published_dates: ["2026-11-14 Warsaw"],
  seeking: ["booking agent"],
  visibility: "admitted_readers",
})

test("a well-formed published listing parses", () => {
  const parsed = parseListing(listing())
  assert.ok(parsed)
  assert.equal(parsed.act_name, "Virya")
  assert.equal(parsed.claims.length, 1)
  assert.equal(parsed.claims[0].value, 420)
})

test("claims with no number never reach the page", () => {
  // Upstream redaction already drops them; if one slips through anyway the
  // parser drops the claim — a bad row is not a reason to refuse the page.
  const broken = listing()
  broken.claims[0].value = null as unknown as number
  const parsed = parseListing(broken)
  assert.ok(parsed)
  assert.equal(parsed.claims.length, 0)
})

test("a claim without a basis is dropped, not rendered", () => {
  const broken = listing()
  broken.claims[0].basis = ""
  const parsed = parseListing(broken)
  assert.ok(parsed)
  assert.equal(parsed.claims.length, 0)
})

test("malformed payloads are refused, not rendered", () => {
  assert.equal(parseListing(null), null)
  assert.equal(parseListing("string"), null)
  assert.equal(parseListing({ act_name: "" }), null)
  const oversized = listing()
  oversized.genre_tags = Array.from({ length: 13 }, (_, i) => `tag${i}`)
  assert.equal(parseListing(oversized), null)
  const floatValue = listing()
  floatValue.claims[0].value = 4.2
  const parsedFloat = parseListing(floatValue)
  assert.ok(parsedFloat)
  assert.equal(parsedFloat.claims.length, 0)
})

test("unknown claim tiers are dropped, not rendered", () => {
  const broken = listing()
  broken.claims[0].tier = "platinum" as unknown as string
  const parsed = parseListing(broken)
  assert.ok(parsed)
  assert.equal(parsed.claims.length, 0)
})
