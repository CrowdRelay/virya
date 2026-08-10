import test from "node:test"
import assert from "node:assert/strict"
import {
  BUNDLES,
  PRODUCTS,
  inventoryAvailability,
  inventoryItemsForCartEntry,
  inventorySku,
} from "../src/data/products.js"

test("every physical merch line has a stable CrowdRelay SKU mapping", () => {
  for (const product of PRODUCTS) {
    if (Array.isArray(product.sizes)) {
      for (const size of product.sizes) {
        assert.match(inventorySku(product, size) ?? "", /^VIRYA-[A-Z0-9-]+$/)
      }
    } else {
      assert.match(inventorySku(product) ?? "", /^VIRYA-[A-Z0-9-]+$/)
    }
  }
})

test("bundle reservations expand into physical stock components", () => {
  const stage = BUNDLES.find(product => product.id === "bundle-stage-pack")
  assert.ok(stage)
  const items = inventoryItemsForCartEntry(stage, "L", 2)
  assert.deepEqual(items, [
    { sku: "VIRYA-CD-ECHOES", quantity: 2 },
    { sku: "VIRYA-TEE-LOGO-L", quantity: 2 },
  ])
})

test("availability fails open to the established static stock when read model is incomplete", () => {
  const shirt = PRODUCTS.find(product => product.id === "virya-logo")
  assert.ok(shirt)
  assert.equal(inventoryAvailability(shirt, "M", {}), null)
  assert.deepEqual(
    inventoryAvailability(shirt, "M", {
      "VIRYA-TEE-LOGO-M": { available: true, availability: "low_stock" },
    }),
    { available: true, lowStock: true },
  )
})

test("mobile bundle catalog is sourced from the same canonical bundle list", async () => {
  const source = await import("node:fs/promises").then(fs =>
    fs.readFile(new URL("../src/pages/api/merch/inventory.ts", import.meta.url), "utf8"),
  )
  assert.match(source, /BUNDLES\.map\(bundle =>/)
  assert.match(source, /discountedPrice\(bundle\)/)
  assert.match(source, /inventoryAvailability\(bundle, size, inventoryBySku\)/)
  assert.match(source, /source=signal-app&product=/)
})

test("adaptive merch pricing is CrowdRelay-authoritative from storefront through Stripe checkout", async () => {
  const fs = await import("node:fs/promises")
  const [inventoryApi, cartContext, productCard, cartDrawer, checkout] = await Promise.all([
    fs.readFile(new URL("../src/pages/api/merch/inventory.ts", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/components/preact/merch/cartContext.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/components/preact/merch/productCard.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/components/preact/merch/cartDrawer.jsx", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/pages/api/checkout.ts", import.meta.url), "utf8"),
  ])

  assert.match(inventoryApi, /prices:\s*priceCatalog\(catalog\)/)
  assert.match(inventoryApi, /product\.price_gross_minor/)
  assert.match(cartContext, /priceOverrides/)
  assert.match(productCard, /inventory\?\.prices\?\.\[product\.id\]/)
  assert.match(cartDrawer, /expectedPriceGrossMinor/)
  assert.match(checkout, /fetchPublicMerchCatalog\(3_000\)/)
  assert.match(checkout, /code:\s*"PRICE_CHANGED"/)
  assert.match(checkout, /unitPrice:\s*authoritativePriceMinor \/ 100/)
})
