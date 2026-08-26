import type { APIRoute } from "astro"
import { readServerEnv } from "../../../server/runtimeEnv.ts"
import { BodyTooLargeError, readLimitedText } from "../../../server/readLimitedBody"
import { consumePublicFormRateLimit, publicRequestNetwork } from "../../../server/publicFormRate"
import { sendMetaEvent } from "../../../server/metaCapi"

export const prerender = false

// First-party Lead beacon: the Signal signup forms fire this after a
// successful fan registration so ad platforms can optimise towards real
// members instead of link clicks. Email is hashed before it ever leaves the
// server; the raw address stays inside CrowdRelay.
const MAX_BODY_BYTES = 2 * 1024
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export const POST: APIRoute = async ({ request }) => {
  const rateSecret = readServerEnv("CONTACT_RATE_SECRET", import.meta.env.CONTACT_RATE_SECRET)
    ?? readServerEnv("AREA_AUTH_SECRET", import.meta.env.AREA_AUTH_SECRET)
  if (typeof rateSecret !== "string" || rateSecret.length < 32) {
    return new Response(null, { status: 204 })
  }
  try {
    const allowed = await consumePublicFormRateLimit(
      "signal-lead-beacon",
      publicRequestNetwork(request),
      rateSecret,
      30,
      60 * 60 * 1_000,
    )
    if (!allowed) return new Response(null, { status: 204 })
  } catch {
    return new Response(null, { status: 204 })
  }

  let rawBody: string
  try {
    rawBody = await readLimitedText(request, MAX_BODY_BYTES)
  } catch (error) {
    if (!(error instanceof BodyTooLargeError)) console.error("[signal-lead] read failed:", error)
    return new Response(null, { status: 204 })
  }

  let email = ""
  let campaignId = ""
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    if (typeof parsed.email === "string") email = parsed.email.trim().toLowerCase()
    if (typeof parsed.campaign_id === "string") campaignId = parsed.campaign_id
  } catch {
    return new Response(null, { status: 204 })
  }

  if (EMAIL_PATTERN.test(email)) {
    await sendMetaEvent({
      eventName: "Lead",
      eventId: `lead-${crypto.randomUUID()}`,
      email,
      ...(UUID_PATTERN.test(campaignId) ? { campaignId } : {}),
    })
  }

  // Always 204: the beacon exists purely for measurement.
  return new Response(null, { status: 204 })
}
