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
