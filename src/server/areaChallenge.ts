import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

export const AREA_CHALLENGE_LIFETIME_MS = 90_000
export const AREA_CHALLENGE_MIN_DURATION_MS = 6_000
export const AREA_CHALLENGE_MIN_SAMPLES = 3
export const AREA_CHALLENGE_MAX_SAMPLES = 8

type AreaChallengePayload = {
  v: 1
  typ: "area-location"
  dropId: string
  actorHash: string
  nonce: string
  iat: number
  exp: number
}

const challengeSecret = () => {
  const dedicated = import.meta.env.AREA_CHALLENGE_SECRET
  if (typeof dedicated === "string" && dedicated.length >= 32) {
    return dedicated
  }
  const auth = import.meta.env.AREA_AUTH_SECRET
  return typeof auth === "string" && auth.length >= 32 ? auth : null
}

const actorHash = (actorId: string) =>
  createHash("sha256").update(`area-challenge\0${actorId}`).digest("hex")

const encode = (payload: AreaChallengePayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")

const sign = (encoded: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`area-location\0${encoded}`)
    .digest("base64url")

const signaturesMatch = (encoded: string, provided: string, secret: string) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(provided)) return false
  const expectedBuffer = Buffer.from(sign(encoded, secret), "base64url")
  const providedBuffer = Buffer.from(provided, "base64url")
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  )
}

export const issueAreaChallenge = (dropId: string, actorId: string) => {
  const secret = challengeSecret()
  if (!secret) return null

  const now = Date.now()
  const payload: AreaChallengePayload = {
    v: 1,
    typ: "area-location",
    dropId,
    actorHash: actorHash(actorId),
    nonce: randomBytes(18).toString("base64url"),
    iat: now,
    exp: now + AREA_CHALLENGE_LIFETIME_MS,
  }
  const encoded = encode(payload)
  return {
    token: `${encoded}.${sign(encoded, secret)}`,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  }
}

export const verifyAreaChallenge = (
  token: string,
  dropId: string,
  actorId: string,
): AreaChallengePayload | null => {
  const secret = challengeSecret()
  if (!secret || token.length < 80 || token.length > 2048) return null

  const parts = token.split(".")
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !signaturesMatch(parts[0], parts[1], secret)
  ) {
    return null
  }

  try {
    const raw = Buffer.from(parts[0], "base64url").toString("utf8")
    if (Buffer.byteLength(raw, "utf8") > 1024) return null
    const payload = JSON.parse(raw) as Partial<AreaChallengePayload>
    const now = Date.now()
    if (
      payload.v !== 1 ||
      payload.typ !== "area-location" ||
      payload.dropId !== dropId ||
      payload.actorHash !== actorHash(actorId) ||
      typeof payload.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{24}$/.test(payload.nonce) ||
      typeof payload.iat !== "number" ||
      !Number.isInteger(payload.iat) ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.iat > now + 2_000 ||
      payload.exp <= now ||
      payload.exp - payload.iat !== AREA_CHALLENGE_LIFETIME_MS
    ) {
      return null
    }
    return payload as AreaChallengePayload
  } catch {
    return null
  }
}
