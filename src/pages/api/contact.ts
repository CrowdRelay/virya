import type { APIRoute } from "astro"
import { randomUUID } from "node:crypto"
import {
  acquireCrowdRelayMailLease,
  completeCrowdRelayMailLease,
  markCrowdRelayMailAmbiguous,
} from "../../server/crowdrelayMailLedger"
import { consumePublicFormRateLimit, publicRequestNetwork } from "../../server/publicFormRate"
import { readServerEnv } from "../../server/runtimeEnv"
import { getSiteMailer } from "../../server/siteMailer"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"

const MAX_BODY_BYTES = 32 * 1024
const MAX_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 254
const MAX_MESSAGE_LENGTH = 5000
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const SUBMISSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

const rateSecret = () => {
  const dedicated = readServerEnv("CONTACT_RATE_SECRET", import.meta.env.CONTACT_RATE_SECRET)
  if (typeof dedicated === "string" && dedicated.length >= 32) return dedicated
  const existing = readServerEnv("AREA_AUTH_SECRET", import.meta.env.AREA_AUTH_SECRET)
  return typeof existing === "string" && existing.length >= 32 ? existing : null
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const origin = request.headers.get("origin")?.trim().toLowerCase()
    const ownOrigin = new URL(request.url).origin.toLowerCase()
    if (origin && origin !== ownOrigin) return json({ error: "Forbidden origin" }, 403)

    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      return json({ error: "Unsupported content type" }, 415)
    }

    let rawBody: string
    try {
      rawBody = await readLimitedText(request, MAX_BODY_BYTES)
    } catch (error) {
      if (error instanceof BodyTooLargeError) return json({ error: "Request too large" }, 413)
      throw error
    }

    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(rawBody)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return json({ error: "Invalid request" }, 400)
      }
      body = parsed as Record<string, unknown>
    } catch {
      return json({ error: "Invalid request" }, 400)
    }

    if (typeof body.website === "string" && body.website.trim()) {
      return json({ ok: true })
    }

    const submittedId = typeof body.submission_id === "string" ? body.submission_id.trim() : ""
    const submissionId = submittedId || randomUUID()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (
      !SUBMISSION_ID.test(submissionId) ||
      !name ||
      name.length > MAX_NAME_LENGTH ||
      CONTROL_CHAR_PATTERN.test(name) ||
      !email ||
      email.length > MAX_EMAIL_LENGTH ||
      CONTROL_CHAR_PATTERN.test(email) ||
      !EMAIL_PATTERN.test(email) ||
      !message ||
      message.length > MAX_MESSAGE_LENGTH ||
      message.includes("\u0000")
    ) {
      return json({ error: "Invalid request" }, 400)
    }

    const secret = rateSecret()
    if (!secret) return json({ error: "Contact unavailable" }, 503)
    try {
      const allowed = await consumePublicFormRateLimit(
        "contact",
        publicRequestNetwork(request),
        secret,
        6,
        60 * 60 * 1_000,
      )
      if (!allowed) return json({ error: "Too many requests" }, 429)
    } catch {
      console.error("[contact] rate limiter unavailable")
      return json({ error: "Contact unavailable" }, 503)
    }

    const mailer = getSiteMailer()
    if (!mailer) return json({ error: "Contact unavailable" }, 503)

    const idempotencyKey = `website-contact:${submissionId}`
    const lease = await acquireCrowdRelayMailLease(idempotencyKey, "website_contact", mailer.to)
    if (lease.status === "done") return json({ ok: true, duplicate: true })
    if (lease.status === "busy") return json({ ok: true, accepted: true }, 202)
    if (lease.status === "ambiguous") return json({ error: "Delivery outcome unknown" }, 503)
    if (lease.status !== "acquired") return json({ error: "Contact unavailable" }, 503)

    try {
      const result = await mailer.send({
        fromName: "Virya Website",
        to: mailer.to,
        replyTo: email,
        subject: `✉️ Message from virya.music — ${name}`,
        idempotencyKey,
        text: `From: ${name} <${email}>\n\n${message}`,
      })
      await completeCrowdRelayMailLease(idempotencyKey, lease.leaseId, result.messageId)
      return json({ ok: true })
    } catch (error) {
      await markCrowdRelayMailAmbiguous(idempotencyKey, lease.leaseId).catch(() => undefined)
      console.error("[contact] delivery outcome unknown", error)
      return json({ error: "Contact unavailable" }, 503)
    }
  } catch (err) {
    console.error("[contact]", err)
    return json({ error: "Server error" }, 500)
  }
}
