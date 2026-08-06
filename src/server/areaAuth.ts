import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto"
import { getStore } from "@netlify/blobs"
import type { AreaCookieJar } from "./areaHttp"
import { readServerEnv } from "./runtimeEnv"

const STORE_NAME = "virya-area-auth"
const SESSION_COOKIE = "virya-area-session"
const MAGIC_LIFETIME_SECONDS = 15 * 60
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60
const MAGIC_LEASE_MS = 2 * 60 * 1000
const MAX_CAS_ATTEMPTS = 6

type AreaLang = "en" | "pl"

type MagicPayload = {
  v: 1
  typ: "area-magic"
  email: string
  accountId: string
  walletId: string
  lang: AreaLang
  nonce: string
  iat: number
  exp: number
}

type SessionPayload = {
  v: 1
  typ: "area-session"
  accountId: string
  sid: string
  iat: number
  exp: number
}

type MagicUseRecord = {
  version: 1
  status: "processing" | "used"
  leaseId: string
  leaseExpiresAt: number
  tokenExpiresAt: number
  updatedAt: string
}

type RateRecord = {
  version: 1
  attempts: number[]
  updatedAt: string
}

type AccountRecord = {
  version: 1
  id: string
  emailMasked: string
  createdAt: string
  lastLoginAt: string
}

const memoryMagicUses = new Map<string, MagicUseRecord>()
const memoryRates = new Map<string, RateRecord>()
const memoryAccounts = new Map<string, AccountRecord>()

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

const authSecret = () => {
  const secret = readServerEnv(
    "AREA_AUTH_SECRET",
    import.meta.env.AREA_AUTH_SECRET,
  )
  return typeof secret === "string" && secret.length >= 32 ? secret : null
}

export const isAreaAuthConfigured = () => authSecret() !== null

const base64UrlJson = (value: object) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url")

const sign = (encoded: string, purpose: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`${purpose}\0${encoded}`)
    .digest("base64url")

const safeSignatureMatch = (
  encoded: string,
  signature: string,
  purpose: string,
  secret: string,
) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false
  const expected = Buffer.from(sign(encoded, purpose, secret), "base64url")
  const provided = Buffer.from(signature, "base64url")
  return (
    expected.length === provided.length &&
    timingSafeEqual(expected, provided)
  )
}

const createSignedToken = (payload: object, purpose: string, secret: string) => {
  const encoded = base64UrlJson(payload)
  return `${encoded}.${sign(encoded, purpose, secret)}`
}

const readSignedToken = <T>(
  token: string,
  purpose: string,
  secret: string,
): T | null => {
  if (token.length < 40 || token.length > 2048) return null
  const pieces = token.split(".")
  if (
    pieces.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(pieces[0]) ||
    !safeSignatureMatch(pieces[0], pieces[1], purpose, secret)
  ) {
    return null
  }

  try {
    const raw = Buffer.from(pieces[0], "base64url").toString("utf8")
    if (Buffer.byteLength(raw, "utf8") > 1024) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export const normalizeAreaEmail = (value: unknown) => {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  if (
    email.length < 3 ||
    email.length > 254 ||
    /[\u0000-\u001f\u007f\s]/.test(email) ||
    !/^[^@]+@[^@]+\.[^@]+$/.test(email)
  ) {
    return null
  }
  const [local, domain] = email.split("@")
  if (!local || local.length > 64 || !domain || domain.length > 253) return null
  return email
}

const accountIdForEmail = (email: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`area-account\0${email}`)
    .digest("hex")

export const areaAccountWalletId = (accountId: string) =>
  `account-${accountId}`

const maskEmail = (email: string) => {
  const separator = email.lastIndexOf("@")
  const local = email.slice(0, separator)
  const domain = email.slice(separator + 1)
  const visible =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`
  return `${visible}@${domain}`
}

export const issueAreaMagicToken = (
  email: string,
  walletId: string,
  lang: AreaLang,
) => {
  const secret = authSecret()
  if (!secret) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: MagicPayload = {
    v: 1,
    typ: "area-magic",
    email,
    accountId: accountIdForEmail(email, secret),
    walletId,
    lang,
    nonce: randomBytes(24).toString("base64url"),
    iat: now,
    exp: now + MAGIC_LIFETIME_SECONDS,
  }
  return {
    token: createSignedToken(payload, "magic", secret),
    expiresAt: payload.exp,
  }
}

export const verifyAreaMagicToken = (token: string): MagicPayload | null => {
  const secret = authSecret()
  if (!secret) return null
  const payload = readSignedToken<Partial<MagicPayload>>(token, "magic", secret)
  const now = Math.floor(Date.now() / 1000)
  if (
    payload?.v !== 1 ||
    payload.typ !== "area-magic" ||
    normalizeAreaEmail(payload.email) !== payload.email ||
    typeof payload.accountId !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.accountId) ||
    payload.accountId !== accountIdForEmail(payload.email, secret) ||
    typeof payload.walletId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(payload.walletId) ||
    (payload.lang !== "en" && payload.lang !== "pl") ||
    typeof payload.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{32}$/.test(payload.nonce) ||
    typeof payload.iat !== "number" ||
    !Number.isInteger(payload.iat) ||
    typeof payload.exp !== "number" ||
    !Number.isInteger(payload.exp) ||
    payload.iat > now + 60 ||
    payload.exp <= now ||
    payload.exp - payload.iat !== MAGIC_LIFETIME_SECONDS
  ) {
    return null
  }
  return payload as MagicPayload
}

export type MagicLease =
  | { status: "acquired"; leaseId: string }
  | { status: "busy" | "used" }

export const acquireAreaMagicUse = async (
  payload: MagicPayload,
): Promise<MagicLease> => {
  const key = `magic/${payload.nonce}`
  const leaseId = randomUUID()

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const record = current?.data as Partial<MagicUseRecord> | undefined
      if (record?.status === "used") return { status: "used" }
      if (
        record?.status === "processing" &&
        Number(record.leaseExpiresAt) > Date.now()
      ) {
        return { status: "busy" }
      }

      const next: MagicUseRecord = {
        version: 1,
        status: "processing",
        leaseId,
        leaseExpiresAt: Date.now() + MAGIC_LEASE_MS,
        tokenExpiresAt: payload.exp,
        updatedAt: new Date().toISOString(),
      }
      const write = await store().setJSON(
        key,
        next,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (write.modified) return { status: "acquired", leaseId }
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const current = memoryMagicUses.get(key)
      if (current?.status === "used") return { status: "used" }
      if (
        current?.status === "processing" &&
        current.leaseExpiresAt > Date.now()
      ) {
        return { status: "busy" }
      }
      memoryMagicUses.set(key, {
        version: 1,
        status: "processing",
        leaseId,
        leaseExpiresAt: Date.now() + MAGIC_LEASE_MS,
        tokenExpiresAt: payload.exp,
        updatedAt: new Date().toISOString(),
      })
      return { status: "acquired", leaseId }
    }
  }
  throw new Error("Magic-link lease is busy")
}

const transitionMagicUse = async (
  nonce: string,
  leaseId: string,
  status: "processing" | "used",
) => {
  const key = `magic/${nonce}`
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const record = current?.data as Partial<MagicUseRecord> | undefined
      if (record?.status === "used" && status === "used") return
      if (!current || record?.leaseId !== leaseId) {
        throw new Error("Magic-link lease ownership was lost")
      }
      const write = await store().setJSON(
        key,
        {
          version: 1,
          status,
          leaseId,
          leaseExpiresAt: status === "used" ? 0 : Date.now() - 1,
          tokenExpiresAt: Number(record.tokenExpiresAt),
          updatedAt: new Date().toISOString(),
        } satisfies MagicUseRecord,
        { onlyIfMatch: current.etag },
      )
      if (write.modified) return
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const record = memoryMagicUses.get(key)
      if (record?.status === "used" && status === "used") return
      if (!record || record.leaseId !== leaseId) throw error
      memoryMagicUses.set(key, {
        ...record,
        status,
        leaseExpiresAt: status === "used" ? 0 : Date.now() - 1,
        updatedAt: new Date().toISOString(),
      })
      return
    }
  }
  throw new Error("Magic-link transition is busy")
}

export const completeAreaMagicUse = (nonce: string, leaseId: string) =>
  transitionMagicUse(nonce, leaseId, "used")

export const releaseAreaMagicUse = (nonce: string, leaseId: string) =>
  transitionMagicUse(nonce, leaseId, "processing")

export const upsertAreaAccount = async (
  accountId: string,
  email: string,
): Promise<AccountRecord> => {
  const key = `accounts/${accountId}`
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const current = await store().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      })
      const previous = current?.data as Partial<AccountRecord> | undefined
      const now = new Date().toISOString()
      const account: AccountRecord = {
        version: 1,
        id: accountId,
        emailMasked: maskEmail(email),
        createdAt:
          typeof previous?.createdAt === "string" ? previous.createdAt : now,
        lastLoginAt: now,
      }
      const write = await store().setJSON(
        key,
        account,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (write.modified) return account
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const previous = memoryAccounts.get(key)
      const now = new Date().toISOString()
      const account: AccountRecord = {
        version: 1,
        id: accountId,
        emailMasked: maskEmail(email),
        createdAt: previous?.createdAt ?? now,
        lastLoginAt: now,
      }
      memoryAccounts.set(key, account)
      return account
    }
  }
  throw new Error("Area account is busy")
}

export const getAreaAccount = async (accountId: string) => {
  const key = `accounts/${accountId}`
  try {
    const value = await store().get(key, {
      type: "json",
      consistency: "strong",
    })
    const account = value as Partial<AccountRecord> | null
    return account?.version === 1 &&
      account.id === accountId &&
      typeof account.emailMasked === "string"
      ? (account as AccountRecord)
      : null
  } catch (error) {
    if (!import.meta.env.DEV) throw error
    return memoryAccounts.get(key) ?? null
  }
}

const validSessionPayload = (
  payload: Partial<SessionPayload> | null,
): payload is SessionPayload => {
  const now = Math.floor(Date.now() / 1000)
  return (
    payload?.v === 1 &&
    payload.typ === "area-session" &&
    typeof payload.accountId === "string" &&
    /^[a-f0-9]{64}$/.test(payload.accountId) &&
    typeof payload.sid === "string" &&
    /^[0-9a-f-]{36}$/i.test(payload.sid) &&
    Number.isInteger(payload.iat) &&
    Number.isInteger(payload.exp) &&
    Number(payload.iat) <= now + 60 &&
    Number(payload.exp) > now &&
    Number(payload.exp) - Number(payload.iat) === SESSION_LIFETIME_SECONDS
  )
}

export const getAreaSession = (
  cookies: AreaCookieJar,
): SessionPayload | null => {
  const secret = authSecret()
  const token = cookies.get(SESSION_COOKIE)?.value
  if (!secret || !token) return null
  const payload = readSignedToken<Partial<SessionPayload>>(
    token,
    "session",
    secret,
  )
  return validSessionPayload(payload) ? payload : null
}

export const setAreaSession = (
  cookies: AreaCookieJar,
  accountId: string,
) => {
  const secret = authSecret()
  if (!secret) throw new Error("Area authentication is not configured")
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    v: 1,
    typ: "area-session",
    accountId,
    sid: randomUUID(),
    iat: now,
    exp: now + SESSION_LIFETIME_SECONDS,
  }
  cookies.set(
    SESSION_COOKIE,
    createSignedToken(payload, "session", secret),
    {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: SESSION_LIFETIME_SECONDS,
    },
  )
}

export const clearAreaSession = (cookies: AreaCookieJar) => {
  if (cookies.delete) {
    cookies.delete(SESSION_COOKIE, { path: "/" })
    return
  }
  cookies.set(SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 0,
  })
}

const rateKey = (scope: string, identity: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`area-rate\0${scope}\0${identity}`)
    .digest("hex")

export const consumeAreaAuthRateLimit = async (
  scope: "email" | "network",
  identity: string,
  limit: number,
  windowMs: number,
) => {
  const secret = authSecret()
  if (!secret) return false
  const key = `rates/${rateKey(scope, identity, secret)}`
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
        updatedAt: new Date().toISOString(),
      }
      const write = await store().setJSON(
        key,
        next,
        current ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
      )
      if (write.modified) return true
    } catch (error) {
      if (!import.meta.env.DEV) throw error
      const data = memoryRates.get(key)
      const attempts = (data?.attempts ?? []).filter(
        value => value > now - windowMs,
      )
      if (attempts.length >= limit) return false
      memoryRates.set(key, {
        version: 1,
        attempts: [...attempts, now],
        updatedAt: new Date().toISOString(),
      })
      return true
    }
  }
  return false
}

export const getAreaClientNetwork = (request: Request) => {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip")
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]
  const candidate = (netlifyIp || forwarded || "unknown").trim()
  // This value is only fed into a keyed HMAC and is never logged or persisted.
  return candidate.slice(0, 128)
}

export const areaAuthFingerprint = (value: string) => {
  const secret = authSecret()
  return secret
    ? createHmac("sha256", secret).update(value).digest("hex")
    : createHash("sha256").update("unconfigured").digest("hex")
}
