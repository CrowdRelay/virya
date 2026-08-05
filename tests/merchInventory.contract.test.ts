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
