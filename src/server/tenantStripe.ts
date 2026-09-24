import { readServerEnv } from "./runtimeEnv.ts"
import {
  fetchTenantStripeCredentials,
  type TenantStripeCredentials,
} from "./crowdrelayTicketing.ts"

// The tenant's Stripe credentials live in CrowdRelay's workspace secret store
// — set through the control plane, never readable back. This module resolves
// the pair this deployment should run against: the tenant-stored value wins,
// the env vars are the fallback that keeps pre-store deploys working.
//
// Answers are cached briefly so a webhook burst or a checkout retry does not
// turn into a CrowdRelay call per request, and a stale answer is served a
// little longer rather than dropping to env mid-incident — env may belong to
// a different Stripe account once the tenant has set its own.

const CREDENTIALS_TTL_MS = 60_000
const STALE_TTL_MS = 15 * 60_000

let cache: { value: TenantStripeCredentials; fetchedAt: number } | null = null
let inflight: Promise<TenantStripeCredentials | null> | null = null

const tenantCredentials = async (): Promise<TenantStripeCredentials | null> => {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CREDENTIALS_TTL_MS) return cache.value
  inflight ??= fetchTenantStripeCredentials()
    .then(value => {
      cache = { value, fetchedAt: Date.now() }
      return value
    })
    .catch(() => {
      // CrowdRelay down: serve the last good answer through the stale window,
      // then report "unknown" so callers fall back to the env pair.
      if (cache && now - cache.fetchedAt < STALE_TTL_MS) return cache.value
      return null
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export type ResolvedStripeCredentials = {
  secretKey: string | null
  webhookSecret: string | null
  /** The tenant's own ticket opt-in; `null` when CrowdRelay could not say. */
  ticketingEnabled: boolean | null
  /** Where the answer came from — logged, never returned to fans. */
  source: "tenant" | "env" | "none"
}

// The merge decision, pure so it is testable without the transport. The
// pair resolves all-or-nothing per source: the moment the tenant stores
// either field, BOTH fields come from the tenant — a per-field fallback
// would pair a new-account secret key with the old account's webhook
// secret, so checkout charges the new account while every signed event
// fails verification and the fan's paid order never confirms. The missing
// half stays null and its capability refuses loudly (webhook 500s on the
// first event) instead of silently mixing accounts. Old-account retries
// during a migration are covered by the webhook handler's explicit
// env-secret second verifier, not by this resolution.
export const resolveCredentialPair = (
  tenant: TenantStripeCredentials | null,
  envSecret: string | undefined,
  envWebhook: string | undefined,
): ResolvedStripeCredentials => {
  const tenantSecret = tenant?.stripe_secret_key?.trim() || null
  const tenantWebhook = tenant?.stripe_webhook_secret?.trim() || null
  const hasTenantField = tenantSecret !== null || tenantWebhook !== null
  const secretKey = hasTenantField ? tenantSecret : envSecret?.trim() || null
  const webhookSecret = hasTenantField ? tenantWebhook : envWebhook?.trim() || null
  return {
    secretKey,
    webhookSecret,
    ticketingEnabled: tenant?.ticketing_enabled ?? null,
    source: hasTenantField ? "tenant" : secretKey ? "env" : "none",
  }
}

export const resolveStripeCredentials = async (): Promise<ResolvedStripeCredentials> =>
  resolveCredentialPair(
    await tenantCredentials(),
    readServerEnv("STRIPE_SECRET_KEY", import.meta.env.STRIPE_SECRET_KEY),
    readServerEnv("STRIPE_WEBHOOK_SECRET", import.meta.env.STRIPE_WEBHOOK_SECRET),
  )
