import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("the shared JSON reader streams and enforces its byte budget", () => {
  // Which callers use readLimitedJson is pinned by upstreamJsonBounds; this
  // gate owns the reader's own streaming mechanics.
  const reader = read("src/server/readLimitedBody.ts")
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
