import { readServerEnv } from "./runtimeEnv.ts"

const DEFAULT_API_BASE_URL = "https://signal-api.virya.music/v1/"
const MIN_SECRET_LENGTH = 24
const MAX_SECRET_LENGTH = 512
const MAX_PAIRING_CODE_LENGTH = 128
const MAX_DISPLAY_NAME_CHARS = 64
const MIN_TTL_MINUTES = 1
const MAX_TTL_MINUTES = 10
const MAX_QR_PAYLOAD_BYTES = 400
const BROKER_TIMEOUT_MS = 10_000

export type StaffPairingEnvelope = {
  version: 2
  role: "staff"
  displayName: string
  expiresAt: number
  uri: string
}

type StaffPairingPayload = {
  version: 2
  apiBaseUrl: string
  displayName: string
  role: "staff"
  pairingCode: string
  expiresAt: number
}

export type StaffPairingCode = {
  version: 2
  role: "staff"
  displayName: string
  pairingCode: string
  expiresAt: number
}

type StaffPairingConfig = {
  adminApiKey: unknown
  apiBaseUrl: unknown
  allowInsecureHttp?: boolean
}

const cleanSecret = (value: unknown) => {
  if (typeof value !== "string") return null
  const token = value.trim()
  return token.length >= MIN_SECRET_LENGTH &&
    token.length <= MAX_SECRET_LENGTH &&
    !/[\u0000-\u0020\u007f]/.test(token)
    ? token
    : null
}

const cleanPairingCode = (value: unknown) => {
  if (typeof value !== "string") return null
  const code = value.trim()
  return code.length >= MIN_SECRET_LENGTH &&
    code.length <= MAX_PAIRING_CODE_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(code)
    ? code
    : null
}

const cleanApiBaseUrl = (value: unknown, allowInsecureHttp = false) => {
  const raw =
    typeof value === "string" && value.trim()
      ? value.trim()
      : DEFAULT_API_BASE_URL

  try {
    const url = new URL(raw)
    const protocolAllowed =
      url.protocol === "https:" ||
      (allowInsecureHttp && url.protocol === "http:")
    if (!protocolAllowed || url.username || url.password) return null
    url.hash = ""
    url.search = ""
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
    return url.toString()
  } catch {
    return null
  }
}

const cleanDisplayName = (value: unknown) => {
  if (typeof value !== "string") return null
  const cleaned = value.trim().replace(/\s+/g, " ")
  return cleaned &&
    [...cleaned].length <= MAX_DISPLAY_NAME_CHARS &&
    !/[\u0000-\u001f\u007f]/.test(cleaned)
    ? cleaned
    : null
}

const cleanTtlMinutes = (value: unknown) => {
  const number = Number(value)
  return Number.isInteger(number) &&
    number >= MIN_TTL_MINUTES &&
    number <= MAX_TTL_MINUTES
    ? number
    : null
}

const runtimeConfig = (): StaffPairingConfig => ({
  adminApiKey: readServerEnv(
    "CROWDRELAY_ADMIN_API_KEY",
    import.meta.env.CROWDRELAY_ADMIN_API_KEY,
  ),
  apiBaseUrl: readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  ),
  allowInsecureHttp: import.meta.env.DEV,
})

export const isStaffPairingConfigured = () => {
  const config = runtimeConfig()
  return (
    cleanSecret(config.adminApiKey) !== null &&
    cleanApiBaseUrl(config.apiBaseUrl, config.allowInsecureHttp) !== null
  )
}

export const buildStaffPairingEnvelope = (
  apiBaseUrlValue: unknown,
  brokerValue: StaffPairingCode,
  allowInsecureHttp = false,
): StaffPairingEnvelope => {
  const baseUrl = cleanApiBaseUrl(apiBaseUrlValue, allowInsecureHttp)
  const displayName = cleanDisplayName(brokerValue?.displayName)
  const pairingCode = cleanPairingCode(brokerValue?.pairingCode)
  const expiresAt = Number(brokerValue?.expiresAt)

  if (!baseUrl) throw new Error("Staff pairing is not configured")
  if (
    brokerValue?.version !== 2 ||
    brokerValue?.role !== "staff" ||
    !displayName ||
    !pairingCode ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= 0
  ) {
    throw new TypeError("Invalid staff pairing broker response")
  }

  const payload: StaffPairingPayload = {
    version: 2,
    apiBaseUrl: baseUrl,
    displayName,
    role: "staff",
    pairingCode,
    expiresAt,
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  const uri = `virya-signal://pair?payload=${encoded}`

  if (Buffer.byteLength(uri, "utf8") > MAX_QR_PAYLOAD_BYTES) {
    throw new RangeError("Staff pairing payload is too large for the QR profile")
  }

  return {
    version: 2,
    role: "staff",
    displayName,
    expiresAt,
    uri,
  }
}

export const createStaffPairingEnvelope = async (
  displayNameValue: unknown,
  ttlMinutesValue: unknown,
): Promise<StaffPairingEnvelope> => {
  const config = runtimeConfig()
  const adminApiKey = cleanSecret(config.adminApiKey)
  const apiBaseUrl = cleanApiBaseUrl(config.apiBaseUrl, config.allowInsecureHttp)
  const displayName = cleanDisplayName(displayNameValue)
  const ttlMinutes = cleanTtlMinutes(ttlMinutesValue)

  if (!adminApiKey || !apiBaseUrl) {
    throw new Error("Staff pairing is not configured")
  }
  if (!displayName || ttlMinutes === null) {
    throw new TypeError("Invalid staff pairing input")
  }

  const response = await fetch(new URL("admin/staff/pairing-codes", apiBaseUrl), {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${adminApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName, ttlMinutes }),
  })
  if (!response.ok) {
    throw new Error(`CrowdRelay pairing broker failed (${response.status})`)
  }

  const broker = await response.json() as StaffPairingCode
  return buildStaffPairingEnvelope(apiBaseUrl, broker, config.allowInsecureHttp)
}

export type StaffDeviceSession = {
  id: string
  displayName: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

const cleanSessionId = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())
    ? value.trim()
    : null

const staffAdminRequest = async (path: string, init: RequestInit = {}) => {
  const config = runtimeConfig()
  const adminApiKey = cleanSecret(config.adminApiKey)
  const apiBaseUrl = cleanApiBaseUrl(config.apiBaseUrl, config.allowInsecureHttp)
  if (!adminApiKey || !apiBaseUrl) throw new Error("Staff pairing is not configured")
  return await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${adminApiKey}`,
      ...(init.headers ?? {}),
    },
  })
}

export const listStaffDeviceSessions = async (): Promise<StaffDeviceSession[]> => {
  const response = await staffAdminRequest("admin/staff/sessions")
  if (!response.ok) throw new Error(`CrowdRelay staff sessions failed (${response.status})`)
  const payload = await response.json() as { sessions?: StaffDeviceSession[] }
  if (!Array.isArray(payload.sessions)) throw new TypeError("Invalid staff session response")
  return payload.sessions.slice(0, 100)
}

export const revokeStaffDeviceSession = async (sessionIdValue: unknown): Promise<void> => {
  const sessionId = cleanSessionId(sessionIdValue)
  if (!sessionId) throw new TypeError("Invalid staff session id")
  const response = await staffAdminRequest(
    `admin/staff/sessions/${encodeURIComponent(sessionId)}/revoke`,
    { method: "POST" },
  )
  if (response.status !== 204) {
    throw new Error(`CrowdRelay staff session revoke failed (${response.status})`)
  }
}
