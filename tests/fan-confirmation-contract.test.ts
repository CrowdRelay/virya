import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const clientSource = await readFile(
  new URL("../src/lib/crowdrelay-client.ts", import.meta.url),
  "utf8",
)
const flowSource = await readFile(
  new URL(
    "../src/components/preact/signal/SignalTokenAction.tsx",
    import.meta.url,
  ),
  "utf8",
)
const continuitySource = await readFile(
  new URL("../src/lib/crowdrelay.ts", import.meta.url),
  "utf8",
)

const start = clientSource.indexOf("confirmFan(")
const end = clientSource.indexOf("unsubscribeFan(", start)
const block = clientSource.slice(start, end)

test("fan confirmation always sends an idempotency key", () => {
  assert.notEqual(start, -1, "confirmFan method is missing")
  assert.match(block, /idempotencyKey\s*=\s*newIdempotencyKey\(\)/)
  assert.match(block, /body:\s*\{\s*token\s*\},[\s\S]*idempotencyKey,/)
})

test("confirmation continues a pending Synesthesia handoff safely", () => {
  assert.match(flowSource, /synesthesiaHandoffFromLocation\(\)/)
  assert.match(flowSource, /linkSynesthesiaCompletion\(handoff\)/)
  assert.match(flowSource, /\[404, 409, 422\]\.includes\(error\.status\)/)
  assert.match(flowSource, /clearSynesthesiaHandoff\(\)/)
})

test("fragment capabilities are consumed independently", () => {
  assert.match(continuitySource, /removeFragmentParam\("token"\)/)
  assert.match(continuitySource, /removeFragmentParam\("checkin"\)/)
  assert.match(continuitySource, /removeFragmentParam\("handoff"\)/)
  assert.doesNotMatch(
    continuitySource,
    /readFragmentToken\(\)[\s\S]{0,300}location\.pathname\}\$\{location\.search\}`/,
  )
})
