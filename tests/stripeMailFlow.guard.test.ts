import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const source = await readFile(
  new URL("../src/pages/api/stripe-webhook.ts", import.meta.url),
  "utf8",
)
const startMarker = '      if (session.metadata?.virya_email_done === "1" && !emailDone) {'
const shipmentMarker = '      if (session.metadata?.virya_shipment_done === "1" && !shipmentDone) {'

test("merch changes do not modify the proven customer email checkpoint", () => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(shipmentMarker, start)
  assert.ok(start >= 0 && end > start)
  const protectedBlock = source.slice(start, end)
  const digest = createHash("sha256").update(protectedBlock).digest("hex")
  assert.equal(
    digest,
    "ff9ea8bd2513b56ea48fbd5bbc7ca39ce2ce8d605012005d2060f0871650939f",
  )
})

test("event pickup may bypass InPost only through the explicit fulfillment branch", () => {
  const start = source.indexOf(shipmentMarker)
  const end = source.indexOf("\n      // Inventory is appended", start)
  assert.ok(start >= 0 && end > start)
  const shippingBlock = source.slice(start, end)
  assert.match(shippingBlock, /fulfillment_mode === "event_pickup"/)
  assert.match(shippingBlock, /if \(eventPickup\) \{[\s\S]*checkpointFulfillmentStep/)
  assert.match(shippingBlock, /else \{[\s\S]*createInpostShipment/)
  assert.match(shippingBlock, /virya_shipment_done/)
})

test("inventory reconciliation is appended after mail and shipping checkpoints", () => {
  const inventory = source.indexOf("// Inventory is appended")
  const mail = source.indexOf(startMarker)
  const processed = source.indexOf("// Mark processed only after")
  assert.ok(mail >= 0 && inventory > mail && processed > inventory)
  assert.match(source, /virya_inventory_done/)
  assert.match(source, /commitMerchInventory/)
})
