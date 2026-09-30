import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import test from "node:test"
import { CrowdRelayClient } from "../src/lib/crowdrelay-client.ts"
import { createSignalSignupSubmitter, signalSignupInput, signalOfferFromSearch, signalOfferCopy } from "../src/lib/signalSignup.ts"

const result = {
  fan_id: "fan-id",
  status: "pending" as const,
  referral_url: null,
  confirmation_required: true,
  email_kind: "confirmation" as const,
  email_queued: true,
}

test("minimal signup needs explicit consent, not a city or nickname", () => {
  assert.throws(() => signalSignupInput("fan@example.test", "en", false), /consent/)
  assert.throws(() => signalSignupInput("not-an-email", "en", true), /email/)
  const input = signalSignupInput(" fan@example.test ", "pl", true, { city_slug: " ", display_name: " " })
  assert.equal(input.email, "fan@example.test")
  assert.equal("city_slug" in input, false)
  assert.equal("display_name" in input, false)
  assert.deepEqual(input.consent, { marketing: true, policy_version: "virya-signal-v1" })
})

test("source, referral, campaign and an explicit city survive capture", () => {
  const context = {
    city_slug: "wroclaw",
    referral_code: "Ref_123",
    campaign_id: "01990000-0000-7000-8000-000000000001",
    ad_attribution: { utm_source: "instagram", utm_content: "shows" },
  }
  const input = signalSignupInput("fan@example.test", "en", true, context)
  for (const key of Object.keys(context) as (keyof typeof context)[]) {
    assert.deepEqual(input[key], context[key])
  }
})

test("a timed-out signup retries the same durable operation; edited input gets a new key", async () => {
  const calls: string[] = []
  let attempts = 0
  let sequence = 0
  const submit = createSignalSignupSubmitter({
    async signupFan(_input, key) {
      calls.push(key)
      if (++attempts === 1) throw new Error("timeout after commit")
      return result
    },
  }, () => `key-${++sequence}`)
  const input = signalSignupInput("fan@example.test", "en", true)
  await assert.rejects(submit(input), /timeout/)
  assert.deepEqual(await submit(input), result)
  await submit(signalSignupInput("other@example.test", "en", true))
  assert.deepEqual(calls, ["key-1", "key-1", "key-2"])
})

test("real browser client calls durable signup with credentials and no city", async () => {
  const client = new CrowdRelayClient({
    baseUrl: "https://signal-api.virya.music/v1/",
    fetch: async (url, options) => {
      assert.equal(String(url), "https://signal-api.virya.music/v1/fans")
      assert.equal(options?.credentials, "include")
      assert.equal(new Headers(options?.headers).get("Idempotency-Key"), "capture-key")
      const body = JSON.parse(String(options?.body))
      assert.equal("city_slug" in body, false)
      assert.equal(body.referral_code, "Ref_123")
      assert.equal(body.consent.marketing, true)
      return Response.json(result, { status: 202 })
    },
  })
  const submit = createSignalSignupSubmitter(client, () => "capture-key")
  assert.deepEqual(await submit(signalSignupInput("fan@example.test", "en", true, { referral_code: "Ref_123" })), result)
})

test("landing offers are truthful, bilingual and selected only from known values", () => {
  assert.equal(signalOfferFromSearch("?offer=shows"), "shows")
  assert.equal(signalOfferFromSearch("?offer=releases"), "releases")
  assert.equal(signalOfferFromSearch("?offer=<script>"), undefined)
  assert.match(signalOfferCopy("shows", "en"), /nearby show alerts/)
  assert.match(signalOfferCopy("releases", "pl"), /nowej muzyce/)
})

test("all signup surfaces require consent and the pre-consent Meta relay is retired", () => {
  const root = new URL("../", import.meta.url)
  assert.equal(existsSync(new URL("src/pages/api/signal-preregister.ts", root)), false)
  for (const path of [
    "src/components/preact/signal/SignalHub.tsx",
    "src/components/preact/signal/WatchJoin.tsx",
    "src/components/preact/signal/EventDetail.tsx",
    "src/client/areaExperience.ts",
  ]) {
    const source = readFileSync(new URL(path, root), "utf8")
    assert.match(source, /signalSignupInput/)
    assert.match(source, /createSignalSignupSubmitter/)
    assert.doesNotMatch(source, /signal-preregister|sendMetaEvent/)
  }
  for (const path of [
    "src/components/preact/signal/SignalHub.tsx",
    "src/components/preact/signal/WatchJoin.tsx",
    "src/components/preact/signal/EventDetail.tsx",
    "src/components/AreaExperience.astro",
  ]) {
    assert.match(readFileSync(new URL(path, root), "utf8"), /name="consent"/)
  }
})
