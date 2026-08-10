import { randomUUID } from "node:crypto"
import type { AreaDrop } from "../data/area"
import { readServerEnv } from "./runtimeEnv.ts"

const DEFAULT_API_BASE = "https://signal-api.virya.music/v1/"
const MAX_RESPONSE_BYTES = 256 * 1024
const PUBLIC_REQUEST_TIMEOUT_MS = 2_500
const INTERNAL_REQUEST_TIMEOUT_MS = 7_500
const PUBLIC_CACHE_TTL_MS = 15_000
const PUBLIC_STALE_TTL_MS = 6 * 60 * 60 * 1_000
const PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FAN_TOKEN_PATTERN = /^[0-9a-f]{64}$/i

export type BackendAreaDrop = AreaDrop & {
  active: boolean
  full: boolean
  claimed: boolean
}

export type BackendAreaClaim = {
  dropId: string
  number: string
  city: string
  line: string
  track: string
  edition: string
  riddle: string
  claimedAt: string
  distanceMeters: number
  editionNumber?: number | null
}

export type BackendAreaCommunity = {
  current: number
  total: number
  percent: number
}

export type BackendAreaWallet = {
  authenticated: boolean
  migrationRequired: boolean
  tokenBalance: number
  rewardCredits: number
  reward: { creditsPerCode: number; benefit: string }
  collectionSize: number
  community: BackendAreaCommunity
  claims: BackendAreaClaim[]
  vouchers: unknown[]
  liveDrops: Array<{ id: string }>
  drops: BackendAreaDrop[]
}

export type BackendAreaPublicSnapshot = {
  items: BackendAreaDrop[]
  community: BackendAreaCommunity
}

export type LegacyAreaClaimImport = {
  dropId: string
  claimedAt: string
  editionNumber?: number | null
}

type BackendErrorBody = { error?: unknown; code?: unknown }
type CachedPublicSnapshot = {
  value: BackendAreaPublicSnapshot
  refreshedAt: number
}

let publicSnapshotCache: CachedPublicSnapshot | null = null

export class CrowdRelayAreaError extends Error {
  readonly status: number
  readonly body: BackendErrorBody

  constructor(status: number, body: BackendErrorBody) {
    super(typeof body.error === "string" ? body.error : "AREA backend error")
    this.name = "CrowdRelayAreaError"
    this.status = status
    this.body = body
  }
}

const apiBase = () => {
  const configured =
    readServerEnv(
      "PUBLIC_CROWDRELAY_API_URL",
      import.meta.env.PUBLIC_CROWDRELAY_API_URL,
    ) ?? DEFAULT_API_BASE
  const url = new URL(configured)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay AREA API URL")
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  url.search = ""
  url.hash = ""
  return url
}

const commerceKey = () => {
  const key = readServerEnv(
    "CROWDRELAY_COMMERCE_API_KEY",
    import.meta.env.CROWDRELAY_COMMERCE_API_KEY,
  )
  return typeof key === "string" && key.length >= 24 && key.length <= 512
    ? key
    : null
}

const readBoundedJson = async (response: Response) => {
  const declared = Number(response.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("CrowdRelay AREA response is too large")
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("CrowdRelay AREA response is too large")
  }
  try {
    return text ? (JSON.parse(text) as unknown) : null
  } catch {
    throw new Error("CrowdRelay AREA returned invalid JSON")
  }
}

const call = async (
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: unknown }> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(new URL(path, apiBase()), {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    })
    const body = await readBoundedJson(response)
    if (!response.ok) {
      throw new CrowdRelayAreaError(
        response.status,
        body && typeof body === "object"
          ? (body as BackendErrorBody)
          : { error: "AREA backend error", code: "TEMPORARY" },
      )
    }
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}

const internalHeaders = () => {
  const key = commerceKey()
  if (!key) throw new Error("CrowdRelay commerce key is not configured")
  return { Authorization: `Bearer ${key}` }
}

const internalMutationHeaders = () => ({
  ...internalHeaders(),
  "Idempotency-Key": randomUUID(),
})

const finiteNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback

const publicCommunity = (value: unknown): BackendAreaCommunity => {
  if (!value || typeof value !== "object") {
    return { current: 0, total: 0, percent: 0 }
  }
  const source = value as Record<string, unknown>
  return {
    current: Math.max(0, Math.trunc(finiteNumber(source.current))),
    total: Math.max(0, Math.trunc(finiteNumber(source.total))),
    percent: Math.max(0, Math.min(100, finiteNumber(source.percent))),
  }
}

const isBackendDrop = (value: unknown): value is BackendAreaDrop => {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<BackendAreaDrop>
  return (
    typeof item.id === "string" &&
    /^[a-z]{3}-\d{3}$/.test(item.id) &&
    typeof item.number === "string" &&
    typeof item.city === "string" &&
    typeof item.region === "string" &&
    typeof item.signalCitySlug === "string" &&
    typeof item.mapX === "number" &&
    typeof item.mapY === "number" &&
    typeof item.approximateLat === "number" &&
    typeof item.approximateLng === "number" &&
    Boolean(item.clue) &&
    typeof item.clue?.en === "string" &&
    typeof item.clue?.pl === "string" &&
    typeof item.active === "boolean" &&
    typeof item.full === "boolean" &&
    typeof item.claimed === "boolean"
  )
}

const isBackendClaim = (value: unknown): value is BackendAreaClaim => {
  if (!value || typeof value !== "object") return false
  const claim = value as Partial<BackendAreaClaim>
  return (
    typeof claim.dropId === "string" &&
    /^[a-z]{3}-\d{3}$/.test(claim.dropId) &&
    typeof claim.number === "string" &&
    typeof claim.city === "string" &&
    typeof claim.line === "string" &&
    typeof claim.track === "string" &&
    typeof claim.edition === "string" &&
    typeof claim.riddle === "string" &&
    typeof claim.claimedAt === "string" &&
    Number.isFinite(Date.parse(claim.claimedAt)) &&
    typeof claim.distanceMeters === "number" &&
    Number.isFinite(claim.distanceMeters) &&
    claim.distanceMeters >= 0 &&
    (claim.editionNumber === undefined ||
      claim.editionNumber === null ||
      (Number.isInteger(claim.editionNumber) && claim.editionNumber > 0))
  )
}

const parseBackendWallet = (body: unknown): BackendAreaWallet => {
  if (!body || typeof body !== "object") {
    throw new Error("CrowdRelay returned an invalid AREA wallet")
  }
  const wallet = body as Partial<BackendAreaWallet>
  if (
    typeof wallet.authenticated !== "boolean" ||
    !Array.isArray(wallet.claims) ||
    !wallet.claims.every(isBackendClaim) ||
    !Array.isArray(wallet.drops) ||
    !wallet.drops.every(isBackendDrop) ||
    !Array.isArray(wallet.liveDrops) ||
    !wallet.liveDrops.every(
      drop =>
        Boolean(drop) &&
        typeof drop === "object" &&
        typeof (drop as { id?: unknown }).id === "string",
    ) ||
    !wallet.community ||
    typeof wallet.community !== "object"
  ) {
    throw new Error("CrowdRelay returned a malformed AREA wallet")
  }
  return wallet as BackendAreaWallet
}

const requirePlayerId = (playerId: string) => {
  if (!PLAYER_ID_PATTERN.test(playerId)) throw new Error("Invalid AREA player ID")
  return playerId
}

const parsePublicSnapshot = (body: unknown): BackendAreaPublicSnapshot => {
  if (!body || typeof body !== "object") {
    throw new Error("CrowdRelay returned an invalid AREA catalogue")
  }
  const source = body as { items?: unknown; community?: unknown }
  if (!Array.isArray(source.items)) {
    throw new Error("CrowdRelay returned an invalid AREA catalogue")
  }
  const items = source.items.filter(isBackendDrop)
  if (items.length !== source.items.length) {
    throw new Error("CrowdRelay returned malformed AREA drops")
  }
  return { items, community: publicCommunity(source.community) }
}

export const getPublicAreaSnapshot = async (): Promise<BackendAreaPublicSnapshot> => {
  const now = Date.now()
  if (
    publicSnapshotCache &&
    now - publicSnapshotCache.refreshedAt <= PUBLIC_CACHE_TTL_MS
  ) {
    return publicSnapshotCache.value
  }

  try {
    const { body } = await call(
      "public/area/drops",
      { method: "GET" },
      PUBLIC_REQUEST_TIMEOUT_MS,
    )
    const value = parsePublicSnapshot(body)
    publicSnapshotCache = { value, refreshedAt: now }
    return value
  } catch (error) {
    if (
      publicSnapshotCache &&
      now - publicSnapshotCache.refreshedAt <= PUBLIC_STALE_TTL_MS
    ) {
      return publicSnapshotCache.value
    }
    throw error
  }
}

export const getPublicAreaDrops = async (): Promise<BackendAreaDrop[]> =>
  (await getPublicAreaSnapshot()).items

export const linkAreaPlayer = async (email: string): Promise<string> => {
  const { body } = await call(
    "internal/area/players",
    {
      method: "POST",
      headers: internalMutationHeaders(),
      body: JSON.stringify({ email }),
    },
    INTERNAL_REQUEST_TIMEOUT_MS,
  )
  const playerId =
    body && typeof body === "object"
      ? (body as { playerId?: unknown }).playerId
      : null
  if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
    throw new Error("CrowdRelay returned an invalid AREA player ID")
  }
  return playerId
}

export const getAreaBackendWallet = async (
  playerId: string,
): Promise<BackendAreaWallet> => {
  requirePlayerId(playerId)
  const { body } = await call(
    `internal/area/players/${encodeURIComponent(playerId)}`,
    { method: "GET", headers: internalHeaders() },
    INTERNAL_REQUEST_TIMEOUT_MS,
  )
  return parseBackendWallet(body)
}

export const importLegacyAreaClaims = async (
  playerId: string,
  claims: LegacyAreaClaimImport[],
): Promise<BackendAreaWallet> => {
  requirePlayerId(playerId)
  if (claims.length === 0) return getAreaBackendWallet(playerId)
  const { body } = await call(
    `internal/area/players/${encodeURIComponent(playerId)}/claims/import`,
    {
      method: "POST",
      headers: internalMutationHeaders(),
      body: JSON.stringify({ claims }),
    },
    INTERNAL_REQUEST_TIMEOUT_MS,
  )
  return parseBackendWallet(body)
}

export const issueAreaBackendChallenge = async (
  playerId: string,
  dropId: string,
) => {
  requirePlayerId(playerId)
  return (
    await call(
      `internal/area/players/${encodeURIComponent(playerId)}/challenge`,
      {
        method: "POST",
        headers: internalMutationHeaders(),
        body: JSON.stringify({ dropId }),
      },
      INTERNAL_REQUEST_TIMEOUT_MS,
    )
  ).body
}

export const claimAreaBackendDrop = async (
  playerId: string,
  body: Record<string, unknown>,
) => {
  requirePlayerId(playerId)
  return (
    await call(
      `internal/area/players/${encodeURIComponent(playerId)}/claim`,
      {
        method: "POST",
        headers: internalMutationHeaders(),
        body: JSON.stringify(body),
      },
      INTERNAL_REQUEST_TIMEOUT_MS,
    )
  ).body
}

const fanToken = (request: Request) => {
  const authorization = request.headers.get("authorization")?.trim() ?? ""
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : ""
  return FAN_TOKEN_PATTERN.test(token) ? token.toLowerCase() : null
}

export const proxyMobileArea = async (
  request: Request,
  path: "me/area" | "me/area/challenge" | "me/area/claim",
  method: "GET" | "POST",
  body?: Record<string, unknown>,
) => {
  const token = fanToken(request)
  if (!token) {
    throw new CrowdRelayAreaError(401, {
      code: "AUTH_REQUIRED",
      error: "Unauthorized",
    })
  }
  return (
    await call(
      path,
      {
        method,
        headers: {
          Cookie: `crowdrelay_fan=${token}`,
          ...(method === "POST" ? { "Idempotency-Key": randomUUID() } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      INTERNAL_REQUEST_TIMEOUT_MS,
    )
  ).body
}
