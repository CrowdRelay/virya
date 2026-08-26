import crypto from "node:crypto"
import { getStore } from "@netlify/blobs"
import { readServerEnv } from "./runtimeEnv.ts"

// Server-side Meta Conversions API relay. Deliberately no browser pixel:
// the site CSP allows no third-party script hosts, and every event we care
// about (lead, checkout, purchase) already flows through our own functions,
// where the hashed email gives Meta a stronger match key than a cookie.
//
// Secrets live in a Netlify Blobs store ("meta-capi-config") rather than env
// vars: the Meta access token is ~200 chars and the site's combined env vars
// exceed the 4KB Lambda compatibility limit. Blobs have no such cap and are
// read at runtime with a single await. A short env var override
// (META_CAPI_PIXEL_ID) is still honoured for local dev convenience.
const BLOB_STORE = "meta-capi-config"

type CapiConfig = {
  pixelId: string
  accessToken: string
  testEventCode: string
}

let cachedConfig: CapiConfig | null | undefined
let cachedAt = 0
const CACHE_TTL_MS = 60_000

async function loadConfig(): Promise<CapiConfig | null> {
  if (cachedConfig !== undefined && Date.now() - cachedAt < CACHE_TTL_MS) return cachedConfig
  cachedConfig = undefined
  try {
    const store = getStore({ name: BLOB_STORE, consistency: "strong" })
    const [pixelId, accessToken, testEventCode] = await Promise.all([
      store.get("pixel_id"),
      store.get("access_token"),
      store.get("test_event_code"),
    ])
    const str = (v: string | ArrayBuffer | null): string =>
      typeof v === "string" ? v : ""
    const envPixelId = readServerEnv("META_CAPI_PIXEL_ID", import.meta.env.META_CAPI_PIXEL_ID)?.trim()
    cachedConfig = {
      pixelId: (envPixelId || str(pixelId) || "").trim(),
      accessToken: str(accessToken).trim(),
      testEventCode: str(testEventCode).trim(),
    }
    if (!cachedConfig.pixelId || !cachedConfig.accessToken) {
      console.error("[meta-capi] config incomplete: pixelId=", Boolean(cachedConfig.pixelId), "accessToken=", Boolean(cachedConfig.accessToken), "testEventCode=", Boolean(cachedConfig.testEventCode))
      cachedConfig = null
    } else {
      console.log("[meta-capi] config loaded: pixelId=", cachedConfig.pixelId, "testEventCode=", cachedConfig.testEventCode || "(none)")
    }
    cachedAt = Date.now()
  } catch (error) {
    console.error("[meta-capi] config load failed:", error instanceof Error ? error.message : error)
    cachedConfig = null
  }
  return cachedConfig
}

export async function metaCapiEnabled(): Promise<boolean> {
  const config = await loadConfig()
  return config !== null
}

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
  const config = await loadConfig()
  if (!config) return false

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
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(config.pixelId)}/events?access_token=${encodeURIComponent(config.accessToken)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4_000),
      },
    )
    if (!response.ok) {
      const body = await response.text().catch(() => "?")
      console.error("[meta-capi]", input.eventName, "rejected:", response.status, body.slice(0, 200))
      return false
    }
    console.log("[meta-capi]", input.eventName, "sent OK, event_id=", input.eventId)
    return true
  } catch (error) {
    // Measurement must never break checkout or fulfilment.
    console.error("[meta-capi]", input.eventName, "send failed:", error instanceof Error ? error.message : error)
    return false
  }
}
