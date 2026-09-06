import assert from "node:assert/strict"
import test from "node:test"
import { parseSignalCities } from "../src/server/traction.ts"

/**
 * A number the page shows must have come from an upstream that said it.
 *
 * `/api/traction` is the representative browser journey into CrowdRelay:
 * browser -> virya server route -> CrowdRelay `public/cities` -> durable fan
 * counts -> browser. The route never fails; it degrades, marks `degraded` in
 * the body, and shortens its own Cache-Control. That is right, and it makes
 * this the place that has to be honest, because nothing downstream will catch
 * a wrong number.
 *
 * `collect()` turns a throw from this parser into `degraded: true` with the
 * three fan fields left null. So "throws" here means "the page says it does
 * not know", and "returns" means "the page prints these numbers".
 */

test("an unreadable cities response is not a zero", () => {
  for (const [label, payload] of [
    ["a wrong envelope", { unexpected: "envelope" }],
    ["a renamed field", { cities: [{ slug: "wroclaw", name: "Wroclaw", fan_count: 12 }] }],
    ["an error page served as JSON", { error: "bad gateway" }],
    ["a bare array", [{ slug: "wroclaw", name: "Wroclaw", fan_count: 12 }]],
    ["null", null],
    ["a string", "items"],
    ["items that is not a list", { items: { wroclaw: 12 } }],
  ] as const) {
    assert.throws(
      () => parseSignalCities(payload),
      /no items array/,
      `${label} must degrade rather than render as zero fans`,
    )
  }
})

test("an empty city list really is zero", () => {
  // The distinction the throws above exist for: CrowdRelay answering with no
  // cities is a fact, and must still be reported as a fact.
  assert.deepEqual(parseSignalCities({ items: [] }), {
    signalFans: 0,
    activeCities: 0,
    topCities: [],
  })
})

test("real city rows are summed and ranked", () => {
  const parsed = parseSignalCities({
    items: [
      { slug: "wroclaw", name: "Wroclaw", country_code: "pl", fan_count: 7 },
      { slug: "krakow", name: "Krakow", country_code: "pl", fan_count: 3 },
      { slug: "gdansk", name: "Gdansk", country_code: "pl", fan_count: 0 },
      // Unusable rows are skipped, not counted as zero-fan cities.
      { slug: "berlin", name: "Berlin" },
      "not an object",
    ],
  })
  assert.equal(parsed.signalFans, 10)
  assert.equal(parsed.activeCities, 2, "a city with no fans is not an active city")
  assert.deepEqual(
    parsed.topCities.map(city => city.slug),
    ["wroclaw", "krakow"],
    "cities rank by fan count",
  )
  assert.equal(parsed.topCities[0]?.countryCode, "PL", "country codes are normalised")
})
