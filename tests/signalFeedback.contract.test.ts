import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const source = await readFile(
  new URL("../src/pages/api/signal-feedback.ts", import.meta.url),
  "utf8",
)

test("anonymous Signal feedback excludes fan and operator identity fields", () => {
  assert.doesNotMatch(source, /body\.(email|name|fan_id|operator_id|session_token)/)
  assert.match(source, /Aplikacja nie dołączyła e-maila, nazwy, tokenu sesji/)
})

test("feedback is bounded, idempotent and delivered through the established site mailer", () => {
  assert.match(source, /MAX_BODY_BYTES = 12 \* 1024/)
  assert.match(source, /MAX_MESSAGE_LENGTH = 2_000/)
  assert.match(source, /signal-feedback:\$\{submissionId\}/)
  assert.match(source, /acquireCrowdRelayMailLease/)
  assert.match(source, /getSiteMailer/)
  assert.match(source, /ALLOWED_ORIGINS/)
  assert.match(source, /UNSAFE_CONTROL_CHARS/)
  assert.match(source, /lease\.status !== "acquired"/)
  assert.match(source, /consumeSignalFeedbackRateLimit/)
  assert.match(source, /signalFeedbackNetwork/)
  assert.match(source, /rate_limited/)
})

test("feedback network abuse protection persists only a keyed fingerprint", async () => {
  const rateSource = await readFile(
    new URL("../src/server/signalFeedbackRate.ts", import.meta.url),
    "utf8",
  )
  assert.match(rateSource, /createHmac\("sha256"/)
  assert.match(rateSource, /SIGNAL_FEEDBACK_RATE_SECRET/)
  assert.match(rateSource, /AREA_AUTH_SECRET/)
  assert.match(rateSource, /never logged or persisted/)
  assert.doesNotMatch(rateSource, /console\.(log|error).*network/)
})
