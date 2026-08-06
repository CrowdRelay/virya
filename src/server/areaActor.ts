import { createHash } from "node:crypto"
import {
  areaAccountWalletId,
  getAreaAccount,
  getAreaSession,
} from "./areaAuth"
import {
  getAreaWalletId,
  isSameOriginRequest,
  type AreaCookieJar,
} from "./areaHttp"

export type AreaActor =
  | {
      authenticated: true
      actorId: string
      accountId: string
      emailMasked?: string
      browserWalletId: string
    }
  | {
      authenticated: false
      actorId: string
      browserWalletId: string
    }

const MOBILE_WALLET_HEADER = "x-virya-area-wallet"
const MOBILE_SESSION_TTL_MS = 60_000
const MOBILE_SESSION_CACHE_LIMIT = 128
const MAX_AUTH_RESPONSE_BYTES = 64 * 1024

type MobileSessionCacheEntry = {
  referralCode: string
  expiresAt: number
}

const mobileSessionCache = new Map<string, MobileSessionCacheEntry>()

const validWalletId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const fanApiBase = () => {
  const configured =
    import.meta.env.PUBLIC_CROWDRELAY_API_URL?.trim() ||
    "https://signal-api.virya.music/v1/"
  const parsed = new URL(configured)
  if (parsed.protocol !== "https:") {
    throw new Error("CrowdRelay fan API must use HTTPS")
  }
  parsed.pathname = `${parsed.pathname.replace(/\/*$/, "")}/`
  parsed.search = ""
  parsed.hash = ""
  return parsed
}

const pruneMobileSessionCache = () => {
  const now = Date.now()
  for (const [key, value] of mobileSessionCache) {
    if (value.expiresAt <= now) mobileSessionCache.delete(key)
  }
  while (mobileSessionCache.size > MOBILE_SESSION_CACHE_LIMIT) {
    const oldest = mobileSessionCache.keys().next().value
    if (typeof oldest !== "string") break
    mobileSessionCache.delete(oldest)
  }
}

const readReferralCode = async (token: string) => {
  const cacheKey = createHash("sha256").update(token).digest("hex")
  const cached = mobileSessionCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.referralCode

  const endpoint = new URL("me/referral", fanApiBase())
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `crowdrelay_fan=${token}`,
      },
      redirect: "manual",
      signal: controller.signal,
    })
    if (response.status !== 200) return null
    const declared = Number(response.headers.get("content-length") ?? "0")
    if (Number.isFinite(declared) && declared > MAX_AUTH_RESPONSE_BYTES) return null
    const body = await response.text()
    if (Buffer.byteLength(body, "utf8") > MAX_AUTH_RESPONSE_BYTES) return null
    const parsed = JSON.parse(body) as { referral_code?: unknown }
    const referralCode =
      typeof parsed.referral_code === "string" ? parsed.referral_code.trim() : ""
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(referralCode)) return null
    pruneMobileSessionCache()
    mobileSessionCache.set(cacheKey, {
      referralCode,
      expiresAt: Date.now() + MOBILE_SESSION_TTL_MS,
    })
    return referralCode
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

const getMobileAreaActor = async (request: Request): Promise<AreaActor | null> => {
  const authorization = request.headers.get("authorization")?.trim() ?? ""
  const walletId = request.headers.get(MOBILE_WALLET_HEADER)?.trim() ?? ""
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : ""
  if (
    !validWalletId(walletId) ||
    token.length < 24 ||
    token.length > 2048 ||
    !/^[A-Za-z0-9._~-]+$/.test(token)
  ) {
    return null
  }

  const referralCode = await readReferralCode(token)
  if (!referralCode) return null
  const accountId = createHash("sha256")
    .update(`signal-area-account\0${referralCode}`)
    .digest("hex")
  return {
    authenticated: true,
    actorId: areaAccountWalletId(accountId),
    accountId,
    browserWalletId: walletId,
  }
}

export const getAreaActor = async (
  cookies: AreaCookieJar,
): Promise<AreaActor> => {
  const browserWalletId = getAreaWalletId(cookies)
  const session = getAreaSession(cookies)
  if (!session) {
    return {
      authenticated: false,
      actorId: browserWalletId,
      browserWalletId,
    }
  }

  const account = await getAreaAccount(session.accountId)
  if (!account) {
    return {
      authenticated: false,
      actorId: browserWalletId,
      browserWalletId,
    }
  }

  return {
    authenticated: true,
    actorId: areaAccountWalletId(session.accountId),
    accountId: session.accountId,
    emailMasked: account.emailMasked,
    browserWalletId,
  }
}

/** Safe GETs accept either the browser AREA session or an authenticated
 * Virya Signal fan session. The raw fan token is only used for one bounded
 * validation request and is never written to storage or logs. */
export const getAreaReadActor = async (
  request: Request,
  cookies: AreaCookieJar,
): Promise<AreaActor | null> => {
  if (request.headers.has("authorization")) {
    return getMobileAreaActor(request)
  }
  return getAreaActor(cookies)
}

/** Mutations remain same-origin for the website. Native Virya Signal requests
 * must present a valid CrowdRelay fan session plus their Stronghold wallet ID. */
export const getAreaMutationActor = async (
  request: Request,
  cookies: AreaCookieJar,
): Promise<AreaActor | null> => {
  if (isSameOriginRequest(request)) return getAreaActor(cookies)
  return getMobileAreaActor(request)
}
