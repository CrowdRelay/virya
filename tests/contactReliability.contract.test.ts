import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const endpoint = read("src/pages/api/contact.ts")
const client = read("src/components/preact/Contact.jsx")
const rate = read("src/server/publicFormRate.ts")

test("public contact fails closed instead of reporting success when mail is unavailable", () => {
  assert.match(endpoint, /if \(!mailer\) return json\(\{ error: "Contact unavailable" \}, 503\)/)
  assert.match(endpoint, /markCrowdRelayMailAmbiguous/)
  assert.doesNotMatch(endpoint, /skipping email/)
})

test("public contact is bounded, rate-limited and network identity is privacy-preserving", () => {
  assert.match(endpoint, /consumePublicFormRateLimit/)
  assert.match(endpoint, /publicRequestNetwork/)
  assert.match(endpoint, /"contact"/)
  assert.match(endpoint, /60 \* 60 \* 1_000/)
  assert.match(rate, /createHmac\("sha256", secret\)/)
  assert.doesNotMatch(rate, /console\.log\([^)]*network/)
})

test("contact remains compatible with a pre-idempotency browser tab", () => {
  assert.match(endpoint, /const submissionId = submittedId \|\| randomUUID\(\)/)
  assert.match(endpoint, /SUBMISSION_ID\.test\(submissionId\)/)
})

test("contact retries preserve one idempotency identity until success", () => {
  assert.match(client, /submissionId \|\| crypto\.randomUUID\(\)/)
  assert.match(client, /submission_id: currentSubmissionId/)
  assert.match(endpoint, /website-contact:\$\{submissionId\}/)
  assert.match(endpoint, /acquireCrowdRelayMailLease/)
  assert.match(endpoint, /idempotencyKey,/)
})
