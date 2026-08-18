import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const feed = read("src/pages/news/feed.json.ts")
const assetlinks = read("src/pages/.well-known/assetlinks.json.ts")
const portal = read("src/components/LatarnikPage.astro")
const campaigns = read("src/pages/api/staff/commerce/campaigns.ts")
const env = read(".env.example")

test("public news has a bounded machine-readable feed for native Briefing", () => {
  assert.match(feed, /MAX_ITEMS = 20/)
  assert.match(feed, /newsPosts\.slice\(0, MAX_ITEMS\)/)
  assert.match(feed, /summary: post\.excerpt/)
  assert.match(feed, /https:\/\/virya\.music/)
})

test("Android association fails closed until the Play signing fingerprint is configured", () => {
  assert.match(assetlinks, /music\.virya\.signal/)
  assert.match(assetlinks, /VIRYA_SIGNAL_ANDROID_APP_LINK_SHA256/)
  assert.match(assetlinks, /sha256_cert_fingerprints/)
  assert.match(assetlinks, /sha256CertFingerprints\.length === 0/)
  assert.match(assetlinks, /status: 503/)
  assert.match(assetlinks, /android_app_links_not_configured/)
  assert.match(assetlinks, /X-Virya-App-Links/)
  assert.match(env, /VIRYA_SIGNAL_ANDROID_APP_LINK_SHA256=/)
  assert.doesNotMatch(assetlinks, /[0-9A-F]{2}(?::[0-9A-F]{2}){31}/)
})

test("web invite exchange explicitly attributes itself as web", () => {
  assert.match(portal, /inviteToken: invite, clientKind: "web"/)
  assert.doesNotMatch(portal, /every active Beacons|każd[ya] Latarnik dostaje/i)
})

test("staff BFF supports no-mint preview and response-only single invite", () => {
  assert.match(campaigns, /action === "single_invite"/)
  assert.match(campaigns, /admin\/autopilot\/beacons\/\$\{beaconId\}\/signal-invites/)
  assert.match(campaigns, /Do not\n        \/\/ forward the standalone raw inviteToken/)
  assert.match(campaigns, /return areaJson\(\{ displayName, inviteUrl, expiresAt \}, 201\)/)
  assert.match(campaigns, /action === "preview_invites" \|\| action === "queue_invites"/)
  assert.match(campaigns, /action === "queue_invites" \? \{ idempotencyKey \} : \{\}/)
})
