import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("checkout switches inventory writes from authoritative backend READY state", async () => {
  const checkout = await source("src/pages/api/checkout.ts")
  const commerce = await source("src/server/crowdrelayCommerce.ts")
  assert.match(checkout, /await merchInventoryWritesReady\(\)/)
  assert.match(commerce, /internal\/merch\/inventory\/activation/)
  assert.doesNotMatch(commerce, /CROWDRELAY_MERCH_INVENTORY_WRITES_ENABLED/)
})

test("staff onboarding requires exact counts and delegates activation to CrowdRelay", async () => {
  const panel = await source("src/components/preact/staff/StaffCommerceManager.tsx")
  const stocktake = await source("src/pages/api/staff/commerce/stocktake.ts")
  const ready = await source("src/pages/api/staff/commerce/ready.ts")
  assert.match(panel, /również zera/)
  assert.match(panel, /MAGAZYN GOTOWY — READY/)
  assert.match(panel, /NAPRAW AKTYWACJĘ/)
  assert.match(stocktake, /admin\/merch\/inventory\/stocktakes/)
  assert.match(ready, /admin\/merch\/inventory\/ready/)
})

test("proof UI uses Rekor coordinates and contains no Base Sepolia contract", async () => {
  const publicProof = await source("src/pages/pl/dowody/losowania/[slug].astro")
  const staffProof = await source("src/components/preact/staff/EcosystemControl.tsx")
  for (const value of [publicProof, staffProof]) {
    assert.match(value, /sigstore\.rekor\.v1|Sigstore Rekor/)
    assert.doesNotMatch(value, /basescan|Base Sepolia|transaction_hash|chain_id/)
  }
})


test("public Namysłów proof resolves the friendly URL to the scheduled CrowdRelay draw", async () => {
  const publicProof = await source("src/pages/pl/dowody/losowania/[slug].astro")
  const proxy = await source("src/pages/api/proofs/draws/[slug].ts")
  const refs = await source("src/data/drawProofs.ts")
  assert.match(refs, /namyslow-guest-list-2026/)
  assert.match(refs, /2026-09-01T20:05:00\+02:00/)
  assert.match(publicProof, /resolvePublicDrawProof/)
  assert.match(proxy, /resolvePublicDrawProof/)
  assert.match(publicProof, /Dowód pojawi się po losowaniu/)
  assert.match(publicProof, /Działający Sigstore Rekor może w tym czasie normalnie kotwiczyć inne proofy/)
  assert.doesNotMatch(publicProof, /warstwa proofów nie była jeszcze aktywna/)
})
