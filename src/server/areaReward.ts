import { createHash } from "node:crypto"
import { callAreaInternal } from "./crowdrelayArea"

export const AREA_REWARD_BENEFIT = "free-item-and-shipping" as const
export const AREA_REWARD_LIFETIME_SECONDS = 60 * 60 * 24 * 365
// Stripe requires expires_at to be at least 30 minutes after session creation.
// Keep one minute of headroom for validation and network latency.
export const AREA_REWARD_CHECKOUT_SECONDS = 31 * 60

export type AreaRewardStatus = "issued" | "reserved" | "redeemed"

export type AreaRewardRecord = {
  version: 1
  codeHash: string
  codeSuffix: string
  ownerId: string
  ownerHash: string
  requestId: string
  benefit: typeof AREA_REWARD_BENEFIT
  status: AreaRewardStatus
  issuedAt: string
  expiresAt: number
  reservationId?: string | null
  reservedUntil?: number | null
  checkoutSessionId?: string | null
  freeProductId?: string | null
  freeProductLabel?: string | null
  redeemedAt?: string | null
  updatedAt: string
}

type ReserveResult =
  | { ok: true; record: AreaRewardRecord; resumed: boolean }
  | {
      ok: false
      reason: "invalid" | "expired" | "redeemed" | "busy" | "mismatch"
    }

export const normalizeAreaRewardCode = (value: unknown) => {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase().replace(/\s+/g, "")
  return /^VIRYA-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/.test(code) ? code : null
}

export const areaRewardCodeHash = (code: string) =>
  createHash("sha256").update(`virya-area-reward\0${code}`).digest("hex")

const isRecord = (value: unknown): value is AreaRewardRecord => {
  if (!value || typeof value !== "object") return false
  const record = value as Partial<AreaRewardRecord>
  return (
    record.version === 1 &&
    typeof record.codeHash === "string" &&
    /^[a-f0-9]{64}$/.test(record.codeHash) &&
    typeof record.codeSuffix === "string" &&
    typeof record.ownerId === "string" &&
    typeof record.ownerHash === "string" &&
    typeof record.requestId === "string" &&
    record.benefit === AREA_REWARD_BENEFIT &&
    ["issued", "reserved", "redeemed"].includes(record.status ?? "") &&
    typeof record.issuedAt === "string" &&
    Number.isInteger(record.expiresAt) &&
    typeof record.updatedAt === "string"
  )
}

export const previewAreaRewardCode = async (
  rawCode: unknown,
  reservationId?: string,
) => {
  const code = normalizeAreaRewardCode(rawCode)
  if (!code) return { valid: false as const, reason: "invalid" as const }
  const body = await callAreaInternal("internal/area/rewards/preview", {
    body: { code, reservationId },
  })
  if (!body || typeof body !== "object") {
    throw new Error("CrowdRelay returned an invalid reward preview")
  }
  const preview = body as Record<string, unknown>
  if (preview.valid !== true) {
    const reason = ["invalid", "expired", "redeemed", "busy"].includes(
      String(preview.reason),
    )
      ? (preview.reason as "invalid" | "expired" | "redeemed" | "busy")
      : "invalid"
    return { valid: false as const, reason }
  }
  if (
    typeof preview.code !== "string" ||
    typeof preview.codeHash !== "string" ||
    preview.benefit !== AREA_REWARD_BENEFIT ||
    !Number.isInteger(preview.expiresAt)
  ) {
    throw new Error("CrowdRelay returned a malformed reward preview")
  }
  return {
    valid: true as const,
    code: preview.code,
    codeHash: preview.codeHash,
    benefit: AREA_REWARD_BENEFIT,
    expiresAt: Number(preview.expiresAt),
    resumed: preview.resumed === true,
  }
}

export const reserveAreaRewardCode = async (
  rawCode: unknown,
  reservationId: string,
  reservedUntil: number,
): Promise<ReserveResult> => {
  const code = normalizeAreaRewardCode(rawCode)
  if (!code) return { ok: false, reason: "invalid" }
  const body = await callAreaInternal("internal/area/rewards/reserve", {
    body: { code, reservationId, reservedUntil },
  })
  if (!body || typeof body !== "object") {
    throw new Error("CrowdRelay returned an invalid reward reservation")
  }
  const result = body as {
    ok?: unknown
    reason?: unknown
    record?: unknown
    resumed?: unknown
  }
  if (result.ok !== true) {
    const reason = ["invalid", "expired", "redeemed", "busy", "mismatch"].includes(
      String(result.reason),
    )
      ? (result.reason as ReserveResult extends { ok: false; reason: infer R }
          ? R
          : never)
      : "invalid"
    return { ok: false, reason }
  }
  if (!isRecord(result.record)) {
    throw new Error("CrowdRelay returned a malformed reward reservation")
  }
  return { ok: true, record: result.record, resumed: result.resumed === true }
}

export const attachAreaRewardCheckout = async (input: {
  codeHash: string
  reservationId: string
  checkoutSessionId: string
  freeProductId: string
  freeProductLabel: string
}) => {
  const body = await callAreaInternal("internal/area/rewards/attach", {
    body: input,
  })
  if (!isRecord(body)) throw new Error("Invalid reward checkout attachment")
  return body
}

export const redeemAreaRewardCode = async (input: {
  codeHash: string
  reservationId: string
  checkoutSessionId: string
}) => {
  const body = await callAreaInternal("internal/area/rewards/redeem", {
    body: input,
  })
  if (body === null) return null
  if (!isRecord(body)) throw new Error("Invalid reward redemption")
  return body
}

export const releaseAreaRewardCode = async (input: {
  codeHash: string
  reservationId: string
  checkoutSessionId?: string
}) => {
  const body = await callAreaInternal("internal/area/rewards/release", {
    body: input,
  })
  if (body === null) return null
  if (!isRecord(body)) throw new Error("Invalid reward release")
  return body
}
