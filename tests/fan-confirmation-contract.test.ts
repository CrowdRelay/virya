import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("../src/lib/crowdrelay-client.ts", import.meta.url),
  "utf8",
)

const start = source.indexOf("confirmFan(")
const end = source.indexOf("unsubscribeFan(", start)
const block = source.slice(start, end)

test("fan confirmation always sends an idempotency key", () => {
  assert.notEqual(start, -1, "confirmFan method is missing")
  assert.match(block, /idempotencyKey\s*=\s*newIdempotencyKey\(\)/)
  assert.match(block, /body:\s*\{\s*token\s*\},[\s\S]*idempotencyKey,/)
})

const helpers = await readFile(
  new URL("../src/lib/crowdrelay.ts", import.meta.url),
  "utf8",
)

const reader = helpers.slice(
  helpers.indexOf("export function readFragmentToken("),
  helpers.indexOf("const SYNESTHESIA_HANDOFF_PATTERN"),
)

test("a mailed token is accepted in either the fragment or the query", () => {
  assert.notEqual(reader.length, 0, "readFragmentToken is missing")
  // CrowdRelay mails both shapes and mail clients decide which one arrives, so
  // reading only one of them reports a missing token for a valid link.
  assert.match(reader, /window\.location\.hash/)
  assert.match(reader, /window\.location\.search/)
})

test("a consumed token is stripped from the address bar", () => {
  // The token is one-time. Leaving it in the query would keep it in history and
  // hand it to any referrer header the page emits.
  assert.match(reader, /history\.replaceState/)
  assert.match(reader, /search\.delete\("token"\)/)
})
