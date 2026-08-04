const DEFAULT_API_BASE_URL = "https://signal-api.virya.music/v1/"
const MIN_TOKEN_LENGTH = 24
const MAX_TOKEN_LENGTH = 180
const MAX_DISPLAY_NAME_CHARS = 64
const MIN_TTL_MINUTES = 1
const MAX_TTL_MINUTES = 10
const MAX_QR_PAYLOAD_BYTES = 400

export type StaffPairingEnvelope = {
  version: 1
  role: "staff"
  displayName: string
  expiresAt: number
  uri: string
}

type StaffPairingPayload = {
  version: 1
  apiBaseUrl: string
  displayName: string
  role: "staff"
  bearerToken: string
  expiresAt: number
}

type StaffPairingConfig = {
  bearerToken: unknown
  apiBaseUrl: unknown
  allowInsecureHttp?: boolean
}

const cleanBearerToken = (value: unknown) => {
  if (typeof value !== "string") return null
  const token = value.trim()
  return token.length >= MIN_TOKEN_LENGTH &&
    token.length <= MAX_TOKEN_LENGTH &&
    !/[\u0000-\u0020\u007f]/.test(token)
    ? token
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
  bearerToken: import.meta.env.STAFF_OPERATOR_KEY,
  apiBaseUrl: import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  allowInsecureHttp: import.meta.env.DEV,
})

export const isStaffPairingConfigured = () => {
  const config = runtimeConfig()
  return (
    cleanBearerToken(config.bearerToken) !== null &&
    cleanApiBaseUrl(config.apiBaseUrl, config.allowInsecureHttp) !== null
  )
}

export const buildStaffPairingEnvelope = (
  config: StaffPairingConfig,
  displayNameValue: unknown,
  ttlMinutesValue: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): StaffPairingEnvelope => {
  const bearerToken = cleanBearerToken(config.bearerToken)
  const baseUrl = cleanApiBaseUrl(
    config.apiBaseUrl,
    config.allowInsecureHttp,
  )
  const displayName = cleanDisplayName(displayNameValue)
  const ttlMinutes = cleanTtlMinutes(ttlMinutesValue)

  if (!bearerToken || !baseUrl) {
    throw new Error("Staff pairing is not configured")
  }
  if (!displayName || ttlMinutes === null || !Number.isInteger(nowSeconds)) {
    throw new TypeError("Invalid staff pairing input")
  }

  const expiresAt = nowSeconds + ttlMinutes * 60
  const payload: StaffPairingPayload = {
    version: 1,
    apiBaseUrl: baseUrl,
    displayName,
    role: "staff",
    bearerToken,
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
    version: 1,
    role: "staff",
    displayName,
    expiresAt,
    uri,
  }
}

export const createStaffPairingEnvelope = (
  displayNameValue: unknown,
  ttlMinutesValue: unknown,
) =>
  buildStaffPairingEnvelope(
    runtimeConfig(),
    displayNameValue,
    ttlMinutesValue,
  )
