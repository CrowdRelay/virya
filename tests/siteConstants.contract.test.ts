import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  VIRYA_OPERATIONS_EMAIL,
  VIRYA_SITE_ORIGIN,
  siteOriginForRequest,
} from "../src/config.ts"

const sourceFiles = [
  "src/server/siteMailer.ts",
  "src/pages/api/ticket-mail.ts",
  "src/pages/api/crowdrelay-webhook.ts",
  "src/pages/api/checkout.ts",
  "src/pages/api/ticket-checkout.ts",
  "src/pages/api/staff/admin/status.ts",
  "src/pages/api/area/auth/request.ts",
  "src/utils/orderEmail.js",
  "src/utils/inpostShipment.js",
]

test("Virya production constants are canonical and normalized", () => {
  assert.equal(VIRYA_SITE_ORIGIN, "https://virya.music")
  assert.equal(VIRYA_OPERATIONS_EMAIL, "virya.crew@gmail.com")
  const request = new Request("http://localhost:4321/test")
  const resolved = siteOriginForRequest(request)
  assert.ok(resolved === VIRYA_SITE_ORIGIN || resolved === "http://localhost:4321")
  assert.equal(new URL(VIRYA_SITE_ORIGIN).origin, VIRYA_SITE_ORIGIN)
})

test("retired Netlify variables are absent from runtime source", () => {
  const retired = /import\.meta\.env\.(?:PUBLIC_SITE_URL|SITE_URL|INPOST_ENV|GMAIL_USER|ORDER_EMAIL_TO)/
  for (const file of sourceFiles) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    assert.doesNotMatch(source, retired, file)
  }
})
