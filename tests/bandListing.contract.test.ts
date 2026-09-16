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
  // parser refuses the whole listing rather than render a half-claim.
  const broken = listing()
  broken.claims[0].value = null as unknown as number
  assert.equal(parseListing(broken), null)
})

test("a claim without a basis is refused", () => {
  const broken = listing()
  broken.claims[0].basis = ""
  assert.equal(parseListing(broken), null)
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
  assert.equal(parseListing(floatValue), null)
})

test("unknown claim tiers are refused", () => {
  const broken = listing()
  broken.claims[0].tier = "platinum" as unknown as string
  assert.equal(parseListing(broken), null)
})
