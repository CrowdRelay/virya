import type { APIRoute } from "astro"
import {
  acquireCrowdRelayMailLease,
  completeCrowdRelayMailLease,
  markCrowdRelayMailAmbiguous,
} from "../../server/crowdrelayMailLedger"
import { getSiteMailer } from "../../server/siteMailer"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"
import {
  consumeSignalFeedbackRateLimit,
  signalFeedbackNetwork,
} from "../../server/signalFeedbackRate"

const MAX_BODY_BYTES = 12 * 1024
const MIN_MESSAGE_LENGTH = 8
const MAX_MESSAGE_LENGTH = 2_000
const ALLOWED_ORIGINS = new Set(["https://virya.music", "https://www.virya.music"])
const UNSAFE_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const SUBMISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CATEGORIES = new Map([
  ["idea", "Pomysł"],
  ["bug", "Błąd"],
  ["concert", "Koncerty i bilety"],
  ["merch", "Merch"],
  ["other", "Inne"],
])

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  })

const boundedText = (value: unknown, max: number) => {
  if (typeof value !== "string") return ""
  const text = value.replace(/\r\n?/g, "\n").trim()
  if (!text || text.length > max || UNSAFE_CONTROL_CHARS.test(text)) return ""
  return text
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin")?.trim().toLowerCase()
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "forbidden_origin" }, 403)
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== "application/json") {
    return json({ error: "unsupported_content_type" }, 415)
  }

  let rawBody: string
  try {
    rawBody = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json({ error: "request_too_large" }, 413)
    throw error
  }

  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(rawBody)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_request" }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: "invalid_request" }, 400)
  }

  // Bot trap. A real app client never fills this field.
  if (boundedText(body.website, 200)) return json({ ok: true })

  const submissionId = boundedText(body.submission_id, 64)
  const category = boundedText(body.category, 32).toLowerCase()
  const message = boundedText(body.message, MAX_MESSAGE_LENGTH)
  const categoryLabel = CATEGORIES.get(category)
  if (
    !SUBMISSION_ID.test(submissionId) ||
    !categoryLabel ||
    message.length < MIN_MESSAGE_LENGTH
  ) {
    return json({ error: "invalid_request" }, 400)
  }

  try {
    const allowed = await consumeSignalFeedbackRateLimit(
      signalFeedbackNetwork(request),
    )
    if (!allowed) return json({ error: "rate_limited" }, 429)
  } catch {
    // Never log the network value or request body.
    console.error("[signal-feedback] rate limiter unavailable")
    return json({ error: "feedback_unavailable" }, 503)
  }

  const mailer = getSiteMailer()
  if (!mailer) return json({ error: "feedback_unavailable" }, 503)

  const idempotencyKey = `signal-feedback:${submissionId}`
  let lease
  try {
    lease = await acquireCrowdRelayMailLease(
      idempotencyKey,
      "signal_feedback",
      mailer.to,
    )
  } catch (error) {
    console.error("[signal-feedback] lease failed", error)
    return json({ error: "feedback_unavailable" }, 503)
  }
  if (lease.status === "done") return json({ ok: true, duplicate: true })
  if (lease.status === "ambiguous") return json({ error: "feedback_delivery_unknown" }, 503)
  if (lease.status === "busy") return json({ ok: true, accepted: true }, 202)
  if (lease.status !== "acquired") return json({ error: "feedback_unavailable" }, 503)

  try {
    const result = await mailer.send({
      fromName: "Virya Signal Feedback",
      to: mailer.to,
      subject: `Anonimowy feedback z Virya Signal — ${categoryLabel}`,
      idempotencyKey,
      text: [
        "Anonimowy feedback z aplikacji Virya Signal",
        `Kategoria: ${categoryLabel}`,
        "",
        message,
        "",
        "Aplikacja nie dołączyła e-maila, nazwy, tokenu sesji ani identyfikatora fana/operatora.",
      ].join("\n"),
    })
    await completeCrowdRelayMailLease(idempotencyKey, lease.leaseId, result.messageId)
    return json({ ok: true })
  } catch (error) {
    await markCrowdRelayMailAmbiguous(idempotencyKey, lease.leaseId).catch(() => undefined)
    console.error("[signal-feedback] delivery outcome unknown", error)
    return json({ error: "feedback_unavailable" }, 503)
  }
}
