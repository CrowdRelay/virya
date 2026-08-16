import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { forwardedMutationKey, stableMutationKey } from "../src/server/mutationSafety.ts"
import { staffApi } from "../src/components/preact/staff/staffApi.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const source = async (relative: string) => readFile(path.join(root, relative), "utf8")

test("stable mutation keys survive response-loss retries but distinguish intents", () => {
  const a = stableMutationKey("test-intent", { action: "approve", id: "a", version: 3 })
  const reordered = stableMutationKey("test-intent", { version: 3, id: "a", action: "approve" })
  const changed = stableMutationKey("test-intent", { action: "approve", id: "a", version: 4 })
  assert.equal(a, reordered)
  assert.notEqual(a, changed)
  assert.match(a, /^test-intent-[0-9a-f]{48}$/)
})
test("server transport forwards an operation key without inventing eternal content dedupe", async () => {
  const helper = await source("src/server/staffQrApi.ts")
  assert.match(helper, /const idempotencyKey = options\.idempotencyKey/)
  assert.match(helper, /headers\.set\("Idempotency-Key", idempotencyKey\)/)
  assert.doesNotMatch(helper, /stableMutationKey/)

  const supplied = "staff-op-01234567-89ab-4cde-8fab-0123456789ab"
  const preserved = forwardedMutationKey(new Request("https://virya.music", { headers: { "Idempotency-Key": supplied } }), "staff-post")
  assert.equal(preserved, supplied)
  const fresh = forwardedMutationKey(new Request("https://virya.music"), "staff-post")
  assert.match(fresh, /^staff-post-[0-9a-f-]{36}$/)
  assert.notEqual(fresh, supplied)
})

test("browser retries reuse one pending operation key but a completed later action gets a fresh key", async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = (globalThis as unknown as { window?: unknown }).window
  const originalStorage = (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
  const seenKeys: string[] = []
  let call = 0
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout, clearTimeout } })
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage })
  globalThis.fetch = async (_input, init) => {
    seenKeys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "")
    call += 1
    const status = call === 1 ? 503 : 200
    return new Response(JSON.stringify(status === 200 ? { ok: true } : { error: "ambiguous" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  try {
    const options = { method: "POST" as const, body: { sku: "tee-l", delta: 5 } }
    await assert.rejects(
      staffApi("/api/staff/commerce/inventory", options),
      (error: unknown) => Boolean((error as { ambiguous?: boolean }).ambiguous),
    )
    await staffApi("/api/staff/commerce/inventory", options)
    await staffApi("/api/staff/commerce/inventory", options)
    assert.match(seenKeys[0], /^staff-op-[0-9a-f-]{36}$/)
    assert.equal(seenKeys[1], seenKeys[0], "ambiguous retry must preserve operation identity")
    assert.notEqual(seenKeys[2], seenKeys[1], "a later completed operation must be independently executable")
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow })
    if (originalStorage === undefined) delete (globalThis as unknown as { sessionStorage?: unknown }).sessionStorage
    else Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: originalStorage })
  }
})

test("high-risk operator mutations no longer mint a random replay key", async () => {
  const critical = [
    "src/pages/api/staff/admin/autopilot.ts",
    "src/pages/api/staff/admin/admission/issue.ts",
    "src/pages/api/staff/admin/admission/revoke.ts",
    "src/pages/api/staff/admin/ticketing/[slug].ts",
    "src/pages/api/staff/commerce/inventory.ts",
    "src/pages/api/staff/commerce/stocktake.ts",
    "src/pages/api/staff/accounting/finalize.ts",
    "src/pages/api/staff/admin/ecosystem/checklists/[slug]/[item].ts",
    "src/pages/api/staff/admin/ecosystem/flags/[key].ts",
  ]
  for (const relative of critical) {
    const text = await source(relative)
    assert.doesNotMatch(text, /idempotencyKey:\s*(?:crypto\.)?randomUUID\(/, relative)
    assert.match(text, /staffApiRequest\(/, relative)
  }
})

test("deliberately repeatable operator commands keep explicit fresh attempts", async () => {
  const retry = await source("src/pages/api/staff/admin/ops/retry.ts")
  const clearDead = await source("src/pages/api/staff/admin/ops/clear-dead-deliveries.ts")
  const audit = await source("src/pages/api/staff/admin/ecosystem/proofs/audit.ts")
  const reconcile = await source("src/pages/api/staff/admin/ecosystem/reconcile.ts")
  const emitDue = await source("src/pages/api/staff/admin/ecosystem/emit-due.ts")
  assert.match(retry, /randomUUID\(/)
  assert.match(clearDead, /randomUUID\(/)
  assert.match(clearDead, /admin\/ops\/deliveries\/dead\/clear/)
  assert.match(audit, /randomUUID\(/)
  assert.match(reconcile, /randomUUID\(/)
  assert.match(emitDue, /idempotencyKey: `checklist-due-\$\{crypto\.randomUUID\(\)\}`/)
})
test("every cookie-authenticated staff POST is same-origin guarded", async () => {
  const { readdir } = await import("node:fs/promises")
  const walk = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(entries.map(async entry => {
      const full = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(full) : [full]
    }))
    return nested.flat()
  }
  const apiRoot = path.join(root, "src/pages/api/staff")
  for (const file of (await walk(apiRoot)).filter(value => value.endsWith(".ts"))) {
    const text = await readFile(file, "utf8")
    if (!text.includes("export const POST") || !text.includes("hasStaffQrSession")) continue
    assert.match(text, /isSameOriginRequest/, path.relative(root, file))
    if (text.includes("staffApiRequest(") && text.includes('method: "POST"')) {
      assert.match(text, /idempotencyKey/, `${path.relative(root, file)} must forward an operation id`)
    }
  }
})
