import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const hub = readFileSync(
  new URL("../src/components/preact/signal/SignalHub.tsx", import.meta.url),
  "utf8",
)
const account = readFileSync(
  new URL("../src/components/preact/signal/MySignal.tsx", import.meta.url),
  "utf8",
)

test("Synesthesia handoff survives transient failures and retries", () => {
  assert.match(
    hub,
    /\[handoffState, setHandoffState\] = useState<HandoffState>/,
  )
  assert.match(hub, /"retry"/)
  assert.match(hub, /setHandoffRetryKey\(value => value \+ 1\)/)
  assert.match(hub, /\[404, 409, 422\]\.includes\(error\.status\)/)
  assert.match(account, /\[404, 409, 422\]\.includes\(error\.status\)/)
  assert.match(account, /Keep transient\/network failures in the fragment/)
})

test("My Signal continuation preserves Synesthesia resume intent and attribution", () => {
  assert.match(
    account,
    /https:\/\/synesthesia\.virya\.music\/\?source=signal-web&resume=1/,
  )
})

test("handoff is removed only after success or a terminal response", () => {
  assert.match(
    hub,
    /linkSynesthesiaCompletion\(code\)\s*\.then\(\(\) => \{[\s\S]*clearSynesthesiaHandoff\(\)/,
  )
  assert.doesNotMatch(
    hub,
    /setHandoffState\("retry"\)[\s\S]{0,100}clearSynesthesiaHandoff/,
  )
})
