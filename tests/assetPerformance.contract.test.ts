import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("live event JSON uses the shared streaming byte budget", () => {
  const source = read("src/server/liveEvents.ts")
  const reader = read("src/server/readLimitedBody.ts")
  assert.match(source, /readLimitedJson<unknown>\(response, MAX_RESPONSE_BYTES/)
  assert.match(reader, /response\.body\.getReader\(\)/)
  assert.match(reader, /totalBytes \+= value\.byteLength/)
  assert.match(reader, /totalBytes > maxBytes/)
})

test("merch reuses canonical album artwork without duplicate source assets", () => {
  const products = read("src/data/products.js")
  const resolver = read("src/components/preact/merch/useMerchImages.js")
  assert.match(products, /front: "\/covers\/echoes\.webp"/)
  assert.match(resolver, /key\.startsWith\("\/"\)/)
  assert.match(resolver, /export const useMerchImages = \(\) => merchImages/)
  for (const duplicate of ["public/images/merch/echoes.webp", "public/images/rise.webp"]) {
    assert.equal(existsSync(new URL(`../${duplicate}`, import.meta.url)), false, `${duplicate} must stay deduplicated`)
  }
})
