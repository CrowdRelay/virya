import { createHmac } from "node:crypto"
import { getStore } from "@netlify/blobs"

const STORE_NAME = "virya-public-form-rate"
const MAX_CAS_ATTEMPTS = 6

type RateRecord = {
  version: 1
  attempts: number[]
  updatedAt: string
}

const memoryRates = new Map<string, RateRecord>()
const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

const rateKey = (namespace: string, network: string, secret: string) =>
  `networks/${namespace}/${createHmac("sha256", secret)
    .update(`${namespace}\0${network}`)
    .digest("hex")}`

export const publicRequestNetwork = (request: Request) => {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip")
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]
  const candidate = (netlifyIp || forwarded || "unknown").trim()
  // The raw address exists only as HMAC input and is never persisted/logged.
  return candidate.slice(0, 128)
}

export const consumePublicFormRateLimit = async (
  namespace: string,
  network: string,
  secret: string,
  limit: number,
  windowMs: number,
) => {
  if (!/^[a-z0-9-]{3,64}$/.test(namespace) || secret.length < 32) {
    throw new Error("public_form_rate_limit_unconfigured")
  }
  const key = rateKey(namespace, network, secret)
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
      const attempts = (current?.attempts ?? []).filter(value => value > now - windowMs)
      if (attempts.length >= limit) return false
      memoryRates.set(key, {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      })
      return true
    }
  }
  throw new Error("public_form_rate_limit_busy")
}
