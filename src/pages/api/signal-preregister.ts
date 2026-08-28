import type { APIRoute } from "astro"
import { randomUUID } from "node:crypto"
import { readServerEnv } from "../../server/runtimeEnv.ts"
import { BodyTooLargeError, readLimitedText } from "../../server/readLimitedBody"
import { consumePublicFormRateLimit, publicRequestNetwork } from "../../server/publicFormRate"
import { sendMetaEvent } from "../../server/metaCapi"

export const prerender = false

// Email-first Signal pre-registration: captures the email (and fires the Meta
// CAPI Lead beacon) before the fan picks a city or consents. The fan receives
// a session access link via CrowdRelay's fans/access endpoint; if they already
// have a Signal profile, this recovers their session. If they complete the
// enrichment step (city + consent) on the page, the client calls signupFan
// directly. This route exists so a fan who hesitates on city selection is
// still captured for ad optimisation and session recovery.
const MAX_BODY_BYTES = 2 * 1024
const MAX_EMAIL_LENGTH = 254
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CAMPAIGN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/
const LOCALE_PATTERN = /^(pl|en)$/

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

const crowdRelayBaseUrl = () => {
  const configured = readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  )
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : "https://signal-api.virya.music/v1/"
  const url = new URL(value)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.hash = ""
  url.search = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
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

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const locale = typeof body.locale === "string" && LOCALE_PATTERN.test(body.locale) ? body.locale : "pl"
    const campaignId = typeof body.campaign_id === "string" ? body.campaign_id.trim() : ""

    if (
      !email ||
      email.length > MAX_EMAIL_LENGTH ||
      CONTROL_CHAR_PATTERN.test(email) ||
      !EMAIL_PATTERN.test(email)
    ) {
      return json({ error: "Invalid email" }, 400)
    }

    const secret = rateSecret()
    if (!secret) return json({ error: "Signal unavailable" }, 503)
    try {
      const allowed = await consumePublicFormRateLimit(
        "signal-preregister",
        publicRequestNetwork(request),
        secret,
        10,
        60 * 60 * 1_000,
      )
      if (!allowed) return json({ error: "Too many requests" }, 429)
    } catch {
      console.error("[signal-preregister] rate limiter unavailable")
      return json({ error: "Signal unavailable" }, 503)
    }

    // Fire the Meta CAPI Lead beacon so ad platforms can optimise towards
    // real signups, not link clicks. The email is hashed before it leaves
    // the server; the raw address stays inside CrowdRelay.
    await sendMetaEvent({
      eventName: "Lead",
      eventId: `lead-${randomUUID()}`,
      email,
      ...(CAMPAIGN_PATTERN.test(campaignId) && UUID_PATTERN.test(campaignId) ? { campaignId } : {}),
    }).catch(() => undefined)

    // Request a session access link from CrowdRelay. For existing fans this
    // sends a recovery email; for new fans it may create a pending entry.
    // The response is intentionally neutral to prevent account enumeration.
    const accessUrl = new URL("fans/access", crowdRelayBaseUrl())
    try {
      await fetch(accessUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `signal-preregister-${randomUUID()}`,
        },
        body: JSON.stringify({ email, locale }),
        signal: AbortSignal.timeout(5_000),
      })
    } catch (error) {
      // The access request is best-effort: the CAPI beacon already captured
      // the lead. A transient CrowdRelay failure must not block the response.
      console.error("[signal-preregister] access request failed:", error instanceof Error ? error.message : error)
    }

    return json({ accepted: true })
  } catch (err) {
    console.error("[signal-preregister]", err)
    return json({ error: "Server error" }, 500)
  }
}
