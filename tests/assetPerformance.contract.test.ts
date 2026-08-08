import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("live event JSON enforces the byte budget while streaming", () => {
  const source = read("src/server/liveEvents.ts")
  assert.match(source, /response\.body\.getReader\(\)/)
  assert.match(source, /received \+= value\.byteLength/)
  assert.match(source, /received > MAX_RESPONSE_BYTES/)
  assert.doesNotMatch(source, /encoder\.encode\(text\)/)
})

test("merch reuses canonical album artwork without duplicate source assets", () => {
  const products = read("src/data/products.js")
  const resolver = read("src/components/preact/merch/useMerchImages.js")
  assert.match(products, /front: "\/covers\/echoes\.webp"/)
  assert.match(resolver, /key\.startsWith\("\/"\)/)
  assert.match(resolver, /export const useMerchImages = \(\) => merchImages/)
})
