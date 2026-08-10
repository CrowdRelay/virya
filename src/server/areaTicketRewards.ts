import { readServerEnv } from "./runtimeEnv.ts"
import { createHash } from "node:crypto"

const EVENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const POOL_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RESPONSE_BYTES = 64 * 1024

export type AreaTicketRewardConfig = {
  eventSlug: string
  poolSlug: string
  credits: number
  title: string
  startsAt?: string
  active: boolean
}

export type IssuedAreaTicket = {
  passId: string
  publicReference: string
  claimToken: string
  claimExpiresAt: string
  created: boolean
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim()
    : null

const parseEntry = (
  eventSlug: string,
  raw: unknown,
): AreaTicketRewardConfig | null => {
  if (!EVENT_SLUG_PATTERN.test(eventSlug) || !raw || typeof raw !== "object") {
    return null
  }
  const value = raw as Record<string, unknown>
  const poolSlug = clean(value.poolSlug, 128) ?? "paid-tickets"
  const title = clean(value.title, 200)
  const credits = Number(value.credits ?? 1)
  const startsAt = clean(value.startsAt, 64) ?? undefined
  if (
    !title ||
    !POOL_SLUG_PATTERN.test(poolSlug) ||
    !Number.isInteger(credits) ||
    credits < 1 ||
    credits > 20 ||
    (startsAt !== undefined && Number.isNaN(Date.parse(startsAt)))
  ) {
    return null
  }
  return {
    eventSlug,
    poolSlug,
    credits,
    title,
    startsAt,
    active: value.active !== false,
  }
}

export const areaTicketRewardConfigs = (): AreaTicketRewardConfig[] => {
  const raw = readServerEnv("AREA_TICKET_REWARDS_JSON", import.meta.env.AREA_TICKET_REWARDS_JSON)
  if (typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    const entries: AreaTicketRewardConfig[] = []
    if (Array.isArray(parsed)) {
      for (const item of parsed.slice(0, 20)) {
        if (!item || typeof item !== "object") continue
        const value = item as Record<string, unknown>
        const eventSlug = clean(value.eventSlug, 128)
        if (!eventSlug) continue
        const entry = parseEntry(eventSlug, value)
        if (entry) entries.push(entry)
      }
    } else if (parsed && typeof parsed === "object") {
      for (const [eventSlug, value] of Object.entries(parsed).slice(0, 20)) {
        const entry = parseEntry(eventSlug, value)
        if (entry) entries.push(entry)
      }
    }
    return entries.filter(entry => entry.active)
  } catch (error) {
    console.error("[area-ticket-config] invalid AREA_TICKET_REWARDS_JSON", error)
    return []
  }
}

export const findAreaTicketReward = (eventSlug: string) =>
  areaTicketRewardConfigs().find(entry => entry.eventSlug === eventSlug) ?? null

const crowdRelayBaseUrl = () => {
  const value = readServerEnv("PUBLIC_CROWDRELAY_API_URL", import.meta.env.PUBLIC_CROWDRELAY_API_URL)?.trim() ||
    "https://signal-api.virya.music/v1/"
  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const readLimitedJson = async (response: Response) => {
  const declared = Number(response.headers.get("content-length") ?? 0)
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new Error("CrowdRelay response too large")
  }
  const text = await response.text()
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
    throw new Error("CrowdRelay response too large")
  }
  return JSON.parse(text) as Record<string, unknown>
}

export class AreaTicketIssueError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`CrowdRelay admission issue returned ${status}`)
    this.name = "AreaTicketIssueError"
    this.status = status
  }
}

export const stableAreaTicketIdempotencyKey = (
  accountId: string,
  eventSlug: string,
) => `area-ticket-${createHash("sha256").update(`${accountId}\0${eventSlug}`).digest("hex")}`

export const issueAreaTicket = async (args: {
  accountId: string
  event: AreaTicketRewardConfig
  email: string
  requestId: string
}): Promise<IssuedAreaTicket> => {
  const adminKey = readServerEnv("CROWDRELAY_ADMIN_API_KEY", import.meta.env.CROWDRELAY_ADMIN_API_KEY)
  if (typeof adminKey !== "string" || adminKey.length < 24) {
    throw new AreaTicketIssueError(503)
  }
  const email = args.email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw new AreaTicketIssueError(422)
  }
  const response = await fetch(new URL("admin/admission/passes", crowdRelayBaseUrl()), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminKey}`,
      "Idempotency-Key": stableAreaTicketIdempotencyKey(
        args.accountId,
        args.event.eventSlug,
      ),
      "X-Request-ID": args.requestId,
    },
    body: JSON.stringify({
      event_slug: args.event.eventSlug,
      pool_slug: args.event.poolSlug,
      fan_email: email,
      claim_expires_hours: 720,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new AreaTicketIssueError(response.status)
  const result = await readLimitedJson(response)
  const passId = clean(result.pass_id, 64)
  const publicReference = clean(result.public_reference, 80)
  const claimToken = clean(result.claim_token, 128)
  const claimExpiresAt = clean(result.claim_expires_at, 64)
  if (
    !passId ||
    !publicReference ||
    !claimToken ||
    !/^[0-9a-f]{64}$/i.test(claimToken) ||
    !claimExpiresAt ||
    Number.isNaN(Date.parse(claimExpiresAt))
  ) {
    throw new AreaTicketIssueError(502)
  }
  return {
    passId,
    publicReference,
    claimToken,
    claimExpiresAt,
    created: result.created === true,
  }
}
