import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("merch cart controls keep mobile-sized touch targets", () => {
  const cart = read("src/components/preact/merch/cartDrawer.jsx")
  assert.match(cart, /group w-11 h-11/)
  assert.match(cart, /self-start inline-flex min-h-\[44px\] min-w-\[44px\]/)
  assert.match(cart, /w-full min-h-\[44px\].*choosePaczkomat/s)
})

test("merch secondary dialogs expose 44px close and action targets", () => {
  const geowidget = read("src/components/preact/merch/inpostGeowidget.jsx")
  const product = read("src/components/preact/merch/productCard.jsx")
  assert.match(geowidget, /min-h-\[44px\] min-w-\[44px\]/)
  assert.match(product, /sm:inline-flex min-h-\[44px\]/)
  assert.match(product, /w-full sm:w-auto min-h-\[44px\]/)
  assert.ok((product.match(/min-w-\[44px\]/g) ?? []).length >= 3)
})
