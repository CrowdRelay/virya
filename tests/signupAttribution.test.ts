import assert from "node:assert/strict"
import test from "node:test"

import { attributionFromSearch } from "../src/lib/signupAttribution.ts"

test("the join ask's own link is carried field by field", () => {
  assert.deepEqual(
    attributionFromSearch(
      "?utm_source=facebook&utm_medium=join_ask&utm_campaign=join_ask_w39",
      "https://virya.music/signal/",
    ),
    {
      utm_source: "facebook",
      utm_medium: "join_ask",
      utm_campaign: "join_ask_w39",
      event_source_url: "https://virya.music/signal/",
    },
  )
})

test("a landing with no campaign tags carries nothing", () => {
  assert.equal(attributionFromSearch("?city=gorzow", "https://virya.music/signal/"), undefined)
  assert.equal(attributionFromSearch("", "https://virya.music/signal/"), undefined)
})

test("ad-platform click ids are not carried", () => {
  const found = attributionFromSearch(
    "?utm_source=instagram&fbclid=abc&gclid=def",
    "https://virya.music/signal/",
  )
  assert.deepEqual(Object.keys(found ?? {}).sort(), ["event_source_url", "utm_source"])
})

test("blank and oversized values are trimmed", () => {
  const found = attributionFromSearch(`?utm_source=%20&utm_campaign=${"x".repeat(500)}`)
  assert.equal(found?.utm_source, undefined)
  assert.equal(found?.utm_campaign?.length, 200)
})
