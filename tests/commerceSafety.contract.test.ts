import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

const cart = read("src/components/preact/merch/cartDrawer.jsx")
const checkout = read("src/pages/api/checkout.ts")
const successPl = read("src/pages/pl/merch/success.astro")
const successEn = read("src/pages/merch/success.astro")

const staffMutationRoutes = [
  "src/pages/api/staff/commerce/catalog.ts",
  "src/pages/api/staff/commerce/inventory.ts",
  "src/pages/api/staff/commerce/campaigns.ts",
  "src/pages/api/staff/commerce/campaigns/[id]/schedule.ts",
  "src/pages/api/staff/commerce/campaigns/[id]/cancel.ts",
  "src/pages/api/staff/commerce/fulfillments/[winnerId].ts",
]

test("checkout identity changes whenever the full Stripe request changes", () => {
  assert.match(cart, /CHECKOUT_FINGERPRINT_KEY = "virya-checkout-fingerprint"/)
  assert.match(cart, /checkoutFingerprint\(checkoutPayload\)/)
  assert.match(cart, /previousFingerprint === fingerprint && previousRequestId/)
  assert.match(cart, /crypto\.subtle\.digest\("SHA-256", encoded\)/)
  assert.match(cart, /sessionStorage\.setItem\(CHECKOUT_FINGERPRINT_KEY, fingerprint\)/)
})

test("checkout identity is removed after success and invalidated with cart changes", () => {
  assert.match(cart, /sessionStorage\.removeItem\(CHECKOUT_FINGERPRINT_KEY\)/)
  assert.match(successPl, /sessionStorage\.removeItem\("virya-checkout-fingerprint"\)/)
  assert.match(successEn, /sessionStorage\.removeItem\("virya-checkout-fingerprint"\)/)
  assert.match(cart, /previousCartSignature\.current !== cartSignature[\s\S]*clearRewardCheckout\(\)/)
})

test("ambiguous Stripe failures keep stock reserved for an idempotent retry", () => {
  const catchStart = checkout.indexOf("  } catch (err) {")
  assert.notEqual(catchStart, -1)
  const outerCatch = checkout.slice(catchStart)
  assert.match(outerCatch, /inventory-held-for-safe-retry/)
  assert.doesNotMatch(outerCatch, /releaseMerchInventory\(\s*inventoryReservationId,\s*"Stripe checkout creation failed"/)
  assert.match(checkout, /sessionExpired && inventoryReservationId/)
  assert.match(checkout, /Stripe checkout expired after reward attachment failure/)
})

test("all staff commerce mutations reuse staff session and same-origin protection", () => {
  for (const route of staffMutationRoutes) {
    const source = read(route)
    assert.match(source, /isSameOriginRequest\(request\)/, route)
    assert.match(source, /hasStaffQrSession\(cookies\)/, route)
    assert.match(source, /staffApiRequest\(/, route)
    assert.match(source, /method: "POST"/, route)
  }
})

test("staff commerce browser never receives CrowdRelay credentials", () => {
  const manager = read("src/components/preact/staff/StaffCommerceManager.tsx")
  assert.doesNotMatch(manager, /CROWDRELAY_(ADMIN|COMMERCE)_API_KEY/)
  assert.doesNotMatch(manager, /Authorization/)
  assert.match(manager, /credentials: "same-origin"/)
})
