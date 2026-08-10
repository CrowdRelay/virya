import { readServerEnv } from "./runtimeEnv.ts"
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { getStore } from "@netlify/blobs"
import type { AreaCookieJar } from "./areaHttp"

const STORE_NAME = "virya-staff-qr-auth"
const COOKIE_NAME = "virya-staff-qr-session"
const SESSION_SECONDS = 12 * 60 * 60
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT = 8
const MAX_CAS_ATTEMPTS = 5

type SessionPayload = {
  v: 1
  typ: "staff-qr"
  sid: string
  iat: number
  exp: number
}

type RateRecord = {
  version: 1
  attempts: number[]
  updatedAt: string
}

const memoryRates = new Map<string, RateRecord>()
const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

const sessionSecret = () => {
  const value = readServerEnv("STAFF_QR_SESSION_SECRET", import.meta.env.STAFF_QR_SESSION_SECRET)
  return typeof value === "string" && value.length >= 32 ? value : null
}

const passwordDigest = () => {
  const value = readServerEnv("STAFF_QR_PASSWORD_SHA256", import.meta.env.STAFF_QR_PASSWORD_SHA256)
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : null
}

export const isStaffQrConfigured = () =>
  sessionSecret() !== null && passwordDigest() !== null

const sign = (encoded: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`staff-qr-session\0${encoded}`)
    .digest("base64url")

const issueToken = (secret: string) => {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    v: 1,
    typ: "staff-qr",
    sid: randomUUID(),
    iat: now,
    exp: now + SESSION_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  return `${encoded}.${sign(encoded, secret)}`
}

const readToken = (token: string, secret: string): SessionPayload | null => {
  if (token.length < 80 || token.length > 1024) return null
  const parts = token.split(".")
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return null

  const expected = Buffer.from(sign(parts[0], secret), "base64url")
  let supplied: Buffer
  try {
    supplied = Buffer.from(parts[1], "base64url")
  } catch {
    return null
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return null
  }

  try {
    const raw = Buffer.from(parts[0], "base64url").toString("utf8")
    if (Buffer.byteLength(raw, "utf8") > 512) return null
    const payload = JSON.parse(raw) as Partial<SessionPayload>
    const now = Math.floor(Date.now() / 1000)
    return payload.v === 1 &&
      payload.typ === "staff-qr" &&
      typeof payload.sid === "string" &&
      /^[0-9a-f-]{36}$/i.test(payload.sid) &&
      Number.isInteger(payload.iat) &&
      Number.isInteger(payload.exp) &&
      Number(payload.iat) <= now + 60 &&
      Number(payload.exp) > now &&
      Number(payload.exp) - Number(payload.iat) === SESSION_SECONDS
      ? (payload as SessionPayload)
      : null
  } catch {
    return null
  }
}

export const verifyStaffQrPassword = (value: unknown) => {
  const expected = passwordDigest()
  if (!expected || typeof value !== "string" || value.length > 256) return false
  const supplied = createHash("sha256").update(value, "utf8").digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export const setStaffQrSession = (cookies: AreaCookieJar) => {
  const secret = sessionSecret()
  if (!secret) throw new Error("Staff QR authentication is not configured")
  cookies.set(COOKIE_NAME, issueToken(secret), {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "strict",
    maxAge: SESSION_SECONDS,
  })
}

export const clearStaffQrSession = (cookies: AreaCookieJar) => {
  if (cookies.delete) {
    cookies.delete(COOKIE_NAME, { path: "/" })
    return
  }
  cookies.set(COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "strict",
    maxAge: 0,
  })
}

export const hasStaffQrSession = (cookies: AreaCookieJar) => {
  const secret = sessionSecret()
  const token = cookies.get(COOKIE_NAME)?.value
  return !!secret && !!token && readToken(token, secret) !== null
}

export const getStaffClientNetwork = (request: Request) => {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip")
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]
  return (netlifyIp || forwarded || "unknown").trim().slice(0, 128)
}

const rateKey = (identity: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`staff-qr-rate\0${identity}`)
    .digest("hex")

export const consumeStaffQrLoginAttempt = async (identity: string) => {
  const secret = sessionSecret()
  if (!secret) return false
  const key = `rates/${rateKey(identity, secret)}`
  const now = Date.now()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const data = current?.data as Partial<RateRecord> | undefined
      const attempts = Array.isArray(data?.attempts)
        ? data.attempts
            .map(Number)
            .filter(value => Number.isFinite(value) && value > now - RATE_WINDOW_MS)
        : []
      if (attempts.length >= RATE_LIMIT) return false
      const next: RateRecord = {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      }
      const result = await store().setJSON(
        key,
        next,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (result.modified) return true
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const current = memoryRates.get(key)
      const attempts = (current?.attempts ?? []).filter(
        value => value > now - RATE_WINDOW_MS,
      )
      if (attempts.length >= RATE_LIMIT) return false
      memoryRates.set(key, {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date(now).toISOString(),
      })
      return true
    }
  }

  return false
}
