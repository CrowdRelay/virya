import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../", import.meta.url)
const read = (path: string) => readFile(new URL(path, root), "utf8")
const mailer = await read("src/server/siteMailer.ts")
const endpoint = await read("src/pages/api/crowdrelay-mail.ts")
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
