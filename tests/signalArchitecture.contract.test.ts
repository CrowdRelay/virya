import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"

const root = new URL("../", import.meta.url)

test("Signal remains the single fan signup path instead of a dead newsletter-to-email shim", () => {
  assert.equal(existsSync(new URL("src/components/preact/Newsletter.jsx", root)), false)
  assert.equal(existsSync(new URL("src/pages/api/subscribe.ts", root)), false)
})
