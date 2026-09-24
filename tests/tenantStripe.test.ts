import assert from "node:assert/strict"
import test from "node:test"
import { resolveCredentialPair } from "../src/server/tenantStripe.ts"
import type { TenantStripeCredentials } from "../src/server/crowdrelayTicketing.ts"

const tenant = (overrides: Partial<TenantStripeCredentials> = {}): TenantStripeCredentials => ({
  ticketing_enabled: true,
  stripe_secret_key: "sk_live_tenant",
  stripe_webhook_secret: "whsec_tenant",
  ...overrides,
})

test("a tenant-stored pair wins over the env pair", () => {
  const resolved = resolveCredentialPair(tenant(), "sk_live_env", "whsec_env")
  assert.equal(resolved.secretKey, "sk_live_tenant")
  assert.equal(resolved.webhookSecret, "whsec_tenant")
  assert.equal(resolved.ticketingEnabled, true)
  assert.equal(resolved.source, "tenant")
})

test("env is the fallback when the tenant store has no rows", () => {
  const resolved = resolveCredentialPair(
    tenant({ stripe_secret_key: null, stripe_webhook_secret: null }),
    "sk_live_env",
    "whsec_env",
  )
  assert.equal(resolved.secretKey, "sk_live_env")
  assert.equal(resolved.webhookSecret, "whsec_env")
  assert.equal(resolved.source, "env")
})

test("the pair resolves all-or-nothing — a half-stored tenant pair never mixes with env", () => {
  // Tenant stored the secret key but not the webhook secret: checkout
  // charges the new account, so verifying its events with the OLD account's
  // env secret would fail every signature — the fan pays, the order never
  // confirms. The missing half stays absent and refuses loudly instead.
  const resolved = resolveCredentialPair(
    tenant({ stripe_webhook_secret: null }),
    "sk_live_env",
    "whsec_env",
  )
  assert.equal(resolved.secretKey, "sk_live_tenant")
  assert.equal(resolved.webhookSecret, null)
  assert.equal(resolved.source, "tenant")
})

test("a tenant webhook secret alone commits the pair too", () => {
  // The mirror image: only the webhook secret stored. The secret key does
  // not fall back to env — checkout refuses rather than charging the old
  // account while the tenant believes the migration happened.
  const resolved = resolveCredentialPair(
    tenant({ stripe_secret_key: null }),
    "sk_live_env",
    "whsec_env",
  )
  assert.equal(resolved.secretKey, null)
  assert.equal(resolved.webhookSecret, "whsec_tenant")
  assert.equal(resolved.source, "tenant")
})

test("an unreachable store resolves to env and reports opt-in unknown", () => {
  const resolved = resolveCredentialPair(null, "sk_live_env", undefined)
  assert.equal(resolved.secretKey, "sk_live_env")
  assert.equal(resolved.webhookSecret, null)
  assert.equal(resolved.ticketingEnabled, null)
  assert.equal(resolved.source, "env")
})

test("nothing configured anywhere resolves to none", () => {
  const resolved = resolveCredentialPair(null, undefined, undefined)
  assert.equal(resolved.secretKey, null)
  assert.equal(resolved.webhookSecret, null)
  assert.equal(resolved.source, "none")
})

test("blank values resolve as absent, not as empty credentials", () => {
  const resolved = resolveCredentialPair(
    tenant({ stripe_secret_key: "   ", stripe_webhook_secret: "" }),
    "  ",
    "",
  )
  assert.equal(resolved.secretKey, null)
  assert.equal(resolved.webhookSecret, null)
  assert.equal(resolved.source, "none")
})

test("the tenant opt-out flag rides through to the caller", () => {
  const resolved = resolveCredentialPair(tenant({ ticketing_enabled: false }), "sk_live_env", "whsec_env")
  assert.equal(resolved.ticketingEnabled, false)
})
