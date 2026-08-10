import { readServerEnv } from "./runtimeEnv.ts"
import { createHmac } from "node:crypto"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "virya-signal-feedback-rate"
const MAX_CAS_ATTEMPTS = 6

type RateRecord = {
  version: 1
  attempts: number[]
  updatedAt: string
}

const memoryRates = new Map<string, RateRecord>()
const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

const rateSecret = () => {
  const dedicated = readServerEnv("SIGNAL_FEEDBACK_RATE_SECRET", import.meta.env.SIGNAL_FEEDBACK_RATE_SECRET)
  if (typeof dedicated === "string" && dedicated.length >= 32) return dedicated
  const existing = readServerEnv("AREA_AUTH_SECRET", import.meta.env.AREA_AUTH_SECRET)
  return typeof existing === "string" && existing.length >= 32 ? existing : null
}

const rateKey = (network: string, secret: string) =>
  `networks/${createHmac("sha256", secret)
    .update(`signal-feedback\0${network}`)
    .digest("hex")}`

export const signalFeedbackNetwork = (request: Request) => {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip")
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]
  const candidate = (netlifyIp || forwarded || "unknown").trim()
  // The raw address is used only as HMAC input and is never logged or persisted.
  return candidate.slice(0, 128)
}

export const consumeSignalFeedbackRateLimit = async (
  network: string,
  limit = 8,
  windowMs = 60 * 60 * 1_000,
) => {
  const secret = rateSecret()
  if (!secret) throw new Error("signal_feedback_rate_limit_unconfigured")
  const key = rateKey(network, secret)
  const now = Date.now()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const data = current?.data as Partial<RateRecord> | undefined
      const attempts = Array.isArray(data?.attempts)
        ? data.attempts.map(Number).filter(value => value > now - windowMs)
        : []
      if (attempts.length >= limit) return false
      const next: RateRecord = {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      }
      const write = await store().setJSON(
        key,
        next,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (write.modified) return true
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const current = memoryRates.get(key)
      const attempts = (current?.attempts ?? []).filter(
        value => value > now - windowMs,
      )
      if (attempts.length >= limit) return false
      memoryRates.set(key, {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      })
      return true
    }
  }
  throw new Error("signal_feedback_rate_limit_busy")
}
