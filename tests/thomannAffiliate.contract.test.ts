import test from "node:test"
import assert from "node:assert/strict"
import {
  THOMANN_AFFILIATE_ID,
  THOMANN_OFFER_ID,
  THOMANN_SOURCE,
  thomannAffiliateUrl,
} from "../src/lib/thomann.ts"
import { GEAR_ITEMS } from "../src/data/gear.ts"

test("Thomann helper emits the Clickfire contract confirmed for VIRYA", () => {
  const result = new URL(
    thomannAffiliateUrl(
      "https://www.thomann.pl/neural_dsp_quad_cortex.htm",
      "gear",
    ),
  )

  assert.equal(result.hostname, "www.thomann.pl")
  assert.equal(result.searchParams.get("offid"), THOMANN_OFFER_ID)
  assert.equal(result.searchParams.get("affid"), THOMANN_AFFILIATE_ID)
  assert.equal(result.searchParams.get("subid"), THOMANN_SOURCE)
  assert.equal(result.searchParams.get("subid2"), "gear")
})

test("Thomann helper overwrites stale affiliate parameters but preserves unrelated query state", () => {
  const result = new URL(
    thomannAffiliateUrl(
      "https://www.thomann.pl/search_dir.html?sw=iem&affid=old&subid=old",
      "footer",
    ),
  )

  assert.equal(result.searchParams.get("sw"), "iem")
  assert.equal(result.searchParams.get("affid"), "4979")
  assert.equal(result.searchParams.get("subid"), "virya_music")
  assert.equal(result.searchParams.get("subid2"), "footer")
})

test("Thomann helper refuses arbitrary external affiliate targets", () => {
  assert.throws(
    () => thomannAffiliateUrl("https://example.com/product", "gear"),
    /Unsupported Thomann affiliate target/,
  )
})

test("Every published gear item has a unique id and an allowed Thomann target", () => {
  assert.ok(GEAR_ITEMS.length >= 1)
  assert.equal(new Set(GEAR_ITEMS.map((item) => item.id)).size, GEAR_ITEMS.length)

  for (const item of GEAR_ITEMS) {
    const affiliateUrl = new URL(thomannAffiliateUrl(item.thomannUrl, "gear"))
    assert.equal(affiliateUrl.searchParams.get("affid"), "4979")
  }
})
