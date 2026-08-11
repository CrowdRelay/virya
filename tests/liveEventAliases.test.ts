import assert from "node:assert/strict"
import test from "node:test"

import { canonicalLiveEventSlug } from "../src/data/liveEventAliases.ts"

test("legacy Bandsintown live URLs resolve to canonical CrowdRelay slugs", () => {
  assert.equal(
    canonicalLiveEventSlug("gig-108530289"),
    "sanity-check-gorzow-2026",
  )
  assert.equal(
    canonicalLiveEventSlug("gig-108530287"),
    "sanity-check-namyslow-2026",
  )
  assert.equal(canonicalLiveEventSlug("gig-108543480"), "zakrec-smiglem-2026")
  assert.equal(
    canonicalLiveEventSlug("gig-108530293"),
    "seidr-hradec-kralove-2026",
  )
})

test("canonical and unknown live slugs remain unchanged", () => {
  assert.equal(
    canonicalLiveEventSlug("sanity-check-gorzow-2026"),
    "sanity-check-gorzow-2026",
  )
  assert.equal(canonicalLiveEventSlug("future-event"), "future-event")
})
