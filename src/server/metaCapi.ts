import crypto from "node:crypto"
import { readServerEnv } from "./runtimeEnv.ts"

// Server-side Meta Conversions API relay. Deliberately no browser pixel:
// the site CSP allows no third-party script hosts, and every event we care
// about (lead, checkout, purchase) already flows through our own functions,
// where the hashed email gives Meta a stronger match key than a cookie.
//
// Activation is purely environmental: with META_CAPI_PIXEL_ID and
// META_CAPI_ACCESS_TOKEN unset every call is a cheap no-op, so shipping the
// hooks is safe before the Meta side exists. Set META_CAPI_TEST_EVENT_CODE
// while validating against Events Manager test events.
const PIXEL_ID = readServerEnv("META_CAPI_PIXEL_ID", import.meta.env.META_CAPI_PIXEL_ID)?.trim()
const ACCESS_TOKEN = readServerEnv("META_CAPI_ACCESS_TOKEN", import.meta.env.META_CAPI_ACCESS_TOKEN)?.trim()
const TEST_EVENT_CODE = readServerEnv("META_CAPI_TEST_EVENT_CODE", import.meta.env.META_CAPI_TEST_EVENT_CODE)?.trim()

export const metaCapiEnabled = (): boolean => Boolean(PIXEL_ID && ACCESS_TOKEN)

const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex")

export type MetaEventInput = {
  eventName: "Lead" | "InitiateCheckout" | "Purchase"
  eventId: string
  email?: string | null
  valueMajor?: number | null
  currency?: string | null
  sourceUrl?: string | null
  campaignId?: string | null
}

export async function sendMetaEvent(input: MetaEventInput): Promise<boolean> {
  if (!metaCapiEnabled() || !PIXEL_ID || !ACCESS_TOKEN) return false

  const user_data: Record<string, unknown> = {}
  if (input.email) user_data.em = [sha256(input.email)]

  const custom_data: Record<string, unknown> = {}
  if (typeof input.valueMajor === "number" && Number.isFinite(input.valueMajor)) {
    custom_data.value = Math.round(input.valueMajor * 100) / 100
  }
  if (input.currency) custom_data.currency = input.currency.toUpperCase()
  if (input.campaignId) custom_data.campaign_id = input.campaignId

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "server",
        user_data,
        custom_data,
        ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
      },
    ],
    ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {}),
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(PIXEL_ID)}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4_000),
      },
    )
    if (!response.ok) {
      console.error("[meta-capi]", input.eventName, "rejected:", response.status)
      return false
    }
    return true
  } catch (error) {
    // Measurement must never break checkout or fulfilment.
    console.error("[meta-capi]", input.eventName, "send failed:", error instanceof Error ? error.message : error)
    return false
  }
}
