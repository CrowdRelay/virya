import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { parsePublicDrawProof } from "../src/server/publicDrawProof.ts"
import { readLimitedJson } from "../src/server/readLimitedJson.ts"
import { BodyTooLargeError, readLimitedText } from "../src/server/readLimitedBody.ts"

const hex = "a".repeat(64)
const proof = () => ({
  schema: "crowdrelay/draw-receipt/v1",
  draw_slug: "virya-test-draw",
  draw_name: "Virya test draw",
  run_id: "018f47d2-2f3b-7a1c-8a55-a0b1c2d3e4f5",
  algorithm_version: "weighted-v1",
  seed_hash_sha256: hex,
  revealed_seed_hex: "b".repeat(64),
  eligible_count: 100,
  total_entries: 220,
  requested_winners: 2,
  selected_winners: 2,
  candidate_snapshot_sha256: hex,
  winner_snapshot_sha256: hex,
  receipt_sha256: hex,
  locally_verified: true,
  completed_at: "2026-08-15T10:00:00Z",
  anchor: {
    batch_id: "018f47d2-2f3b-7a1c-8a55-a0b1c2d3e4f6",
    status: "confirmed",
    anchor_kind: "sigstore.rekor.v1",
    anchor_url: "https://rekor.sigstore.dev",
    entry_id: hex,
    sequence: 123,
    integrated_at: "2026-08-15T10:00:02Z",
    signer_fingerprint: hex,
  },
})

test("public draw proof accepts the bounded canonical wire contract", () => {
  const parsed = parsePublicDrawProof(proof())
  assert.ok(parsed)
  assert.equal(parsed.anchor.status, "confirmed")
  assert.equal(parsed.selected_winners, 2)
})

test("public draw proof rejects malformed nested data before Astro rendering", () => {
  const malformed = proof()
  // This shape used to pass the outer `typeof === object` guard and then crash
  // the proof page when nested fields were read/formatted.
  malformed.anchor = [] as never
  assert.equal(parsePublicDrawProof(malformed), null)

  const invalidDate = proof()
  invalidDate.anchor.integrated_at = "not-a-date"
  assert.equal(parsePublicDrawProof(invalidDate), null)

  const impossibleCounts = proof()
  impossibleCounts.selected_winners = 3
  assert.equal(parsePublicDrawProof(impossibleCounts), null)
})

test("upstream JSON byte limit is enforced without Content-Length", async () => {
  const encoder = new TextEncoder()
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"value":"'))
      controller.enqueue(encoder.encode("x".repeat(128)))
      controller.enqueue(encoder.encode('"}'))
      controller.close()
    },
  }), { headers: { "content-type": "application/json" } })

  await assert.rejects(() => readLimitedJson(response, 64), /invalid or too large/i)
})



test("request body byte limit is enforced while streaming", async () => {
  const request = new Request("https://virya.music/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(256) }),
  })
  await assert.rejects(
    () => readLimitedText(request, 64),
    error => error instanceof BodyTooLargeError,
  )
})
test("upstream JSON reader rejects invalid JSON inside the byte budget", async () => {
  const response = new Response("not-json", { headers: { "content-type": "application/json" } })
  await assert.rejects(() => readLimitedJson(response, 64), /invalid or too large/i)
})

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("server-to-server JSON boundaries share the streaming reader", () => {
  for (const path of [
    "src/server/liveEvents.ts",
    "src/server/crowdrelayArea.ts",
    "src/server/crowdrelayCommerce.ts",
    "src/server/crowdrelayTicketing.ts",
    "src/server/staffQrApi.ts",
    "src/server/staffPairing.ts",
  ]) {
    assert.match(source(path), /readLimitedJson/, `${path} bypasses bounded JSON`)
  }
  assert.match(source("src/pages/api/proofs/draws/[slug].ts"), /readLimitedJson/)
  assert.match(source("src/pages/api/proofs/draws/[slug]\/status.ts"), /readLimitedJson/)
})

test("public and staff mutation bodies never buffer unbounded request text", () => {
  const routes = [
    "src/pages/api/signal-feedback.ts",
    "src/pages/api/crowdrelay-mail.ts",
    "src/pages/api/crowdrelay-webhook.ts",
    "src/pages/api/stripe-webhook.ts",
    "src/pages/api/size-demand.ts",
    "src/pages/api/ticket-mail.ts",
    "src/pages/api/contact.ts",
    "src/pages/api/checkout.ts",
    "src/pages/api/ticket-checkout.ts",
    "src/pages/api/staff/admin/ticketing/[slug].ts",
  ]
  for (const path of routes) {
    const body = source(path)
    assert.match(body, /readLimitedText\(request, MAX_BODY_BYTES\)/, `${path} bypasses the streaming request limit`)
    assert.doesNotMatch(body, /request\.(?:text|json|arrayBuffer)\(/, `${path} buffers an unbounded request`)
  }
  const areaHttp = source("src/server/areaHttp.ts")
  assert.match(areaHttp, /readLimitedText\(request, MAX_JSON_BYTES\)/)
  assert.doesNotMatch(areaHttp, /request\.(?:text|json|arrayBuffer)\(/)
})

