import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

const source = await readFile(
  new URL("../src/pages/api/stripe-webhook.ts", import.meta.url),
  "utf8",
)
const startMarker = '      if (session.metadata?.virya_email_done === "1" && !emailDone) {'
const endMarker = "\n      // Inventory is appended"

test("merch inventory integration does not modify the proven mail and shipment block", () => {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start)
  assert.ok(start >= 0 && end > start)
  const protectedBlock = source.slice(start, end)
  const digest = createHash("sha256").update(protectedBlock).digest("hex")
  assert.equal(
    digest,
    "bd3e26e81f6b400d163ca15be113f572929d20af8d212871b4621a574705fb1c",
  )
})

test("inventory reconciliation is appended after mail and shipping checkpoints", () => {
  const inventory = source.indexOf("// Inventory is appended")
  const mail = source.indexOf(startMarker)
  const processed = source.indexOf("// Mark processed only after")
  assert.ok(mail >= 0 && inventory > mail && processed > inventory)
  assert.match(source, /virya_inventory_done/)
  assert.match(source, /commitMerchInventory/)
})
