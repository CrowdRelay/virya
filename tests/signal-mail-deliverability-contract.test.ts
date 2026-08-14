import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)
const read = (path: string) => readFile(new URL(path, root), "utf8")
const mailer = await read("src/server/siteMailer.ts")
const endpoint = await read("src/pages/api/crowdrelay-mail.ts")

const ledger = await read("src/server/crowdrelayMailLedger.ts")
const signalHub = await read("src/components/preact/signal/SignalHub.tsx")
const signalClient = await read("src/lib/crowdrelay-client.ts")
const signalCopy = await read("src/data/signalCopy.ts")
const migratedEndpoints = await Promise.all([
  "src/pages/api/contact.ts",
  "src/pages/api/crowdrelay-webhook.ts",
  "src/pages/api/size-demand.ts",
  "src/pages/api/staff/admin/mailer/test.ts",
  "src/pages/api/subscribe.ts",
  "src/pages/api/ticket-mail.ts",
  "src/pages/api/crowdrelay-mail.ts",
].map(read))

test("transactional mail supports an authenticated domain provider and Gmail fallback", () => {
  assert.match(mailer, /RESEND_API_KEY/)
  assert.match(mailer, /SIGNAL_MAIL_FROM/)
  assert.match(mailer, /Idempotency-Key/)
  assert.match(mailer, /content_id/)
  assert.match(mailer, /content_type/)
  assert.match(mailer, /envelope:\s*\{\s*from:\s*user,\s*to:\s*recipient\s*\}/)
})

test("all site mail endpoints use the provider-neutral sender contract", () => {
  for (const source of migratedEndpoints) {
    assert.match(source, /mailer\.send\s*\(/)
    assert.doesNotMatch(source, /mailer\.transporter|mailer\.user|\{\s*transporter\s*,/)
  }
  assert.doesNotMatch(mailer, /ReturnType<typeof nodemailer\.createTransport>/)
  assert.match(mailer, /cachedGmailSender/)
})

test("ticket delivery preserves QR attachments for Resend and Gmail", async () => {
  const tickets = await read("src/pages/api/ticket-mail.ts")
  assert.match(tickets, /attachments,/)
  assert.match(tickets, /idempotencyKey:\s*`ticket\/\$\{payload\.eventId\}`/)
  assert.match(mailer, /Buffer\.from\(attachment\.content\)\.toString\("base64"\)/)
  assert.match(mailer, /cid:\s*attachment\.cid/)
})

test("confirmation copy is transactional rather than promotional", () => {
  assert.match(endpoint, /Potwierdź adres e-mail/)
  assert.match(endpoint, /Jeśli to nie Ty, zignoruj wiadomość/)
  assert.doesNotMatch(endpoint, /Jedno kliknięcie aktywuje prywatną przestrzeń fana/)
})
test("CrowdRelay mail time budgets fit the durable webhook retry window", () => {
  assert.match(mailer, /AbortSignal\.timeout\(35_000\)/)
  assert.match(mailer, /connectionTimeout:\s*8_000/)
  assert.match(mailer, /socketTimeout:\s*25_000/)
  assert.match(ledger, /LEASE_MS\s*=\s*75\s*\*\s*1_000/)
})

test("session recovery receives dedicated transactional copy", () => {
  assert.match(endpoint, /variables\.purpose\s*===\s*"session_recovery"/)
  assert.match(endpoint, /Odzyskaj dostęp — Virya Signal/)
  assert.match(endpoint, /Otwórz mój Sygnał/)
})

test("Signal signup reports queued, cooldown and unknown delivery states honestly", () => {
  assert.match(signalClient, /email_queued\?: boolean/)
  assert.match(signalClient, /retry_after_seconds\?: number \| null/)
  assert.match(signalHub, /result\.email_queued === true/)
  assert.match(signalHub, /result\.email_queued === false/)
  assert.match(signalHub, /copy\.form\.cooldownBody\(minutes\)/)
  assert.match(signalHub, /copy\.form\.acceptedBody/)
  assert.match(signalCopy, /Nowa wiadomość nie została wysłana/)
  assert.doesNotMatch(signalHub, /setSubmitMessage\([^)]*Mail wysłany/)
})


test("confirmation mail embeds a CID QR attachment for the mobile flow", () => {
  assert.match(endpoint, /qrGifBuffer\(qrPayload\)/)
  assert.match(endpoint, /cid:\s*"virya-signal-confirmation-qr"/)
  assert.match(endpoint, /src="cid:virya-signal-confirmation-qr"/)
  assert.match(endpoint, /attachments:\s*rendered\.attachments/)
})


test("CrowdRelay mail bridge treats unknown provider outcomes as terminal instead of retryable", () => {
  assert.match(ledger, /status:\s*"processing"\s*\|\s*"done"\s*\|\s*"ambiguous"/)
  assert.match(ledger, /markCrowdRelayMailAmbiguous/)
  assert.match(endpoint, /delivery_outcome_unknown/)
  assert.match(endpoint, /markCrowdRelayMailAmbiguous/)
  assert.match(endpoint, /provider_reference:\s*result\.messageId/)
  assert.doesNotMatch(endpoint, /releaseCrowdRelayMailLease/)
})
