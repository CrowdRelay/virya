import { createHash } from "node:crypto"
import { getStore } from "@netlify/blobs"

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
  reservationId?: string
  reservedUntil?: number
  checkoutSessionId?: string
  freeProductId?: string
  freeProductLabel?: string
  redeemedAt?: string
  updatedAt: string
}

type RegisterInput = {
  code: string
  ownerId: string
  requestId: string
  issuedAt: string
  expiresAt: number
}

type ReserveResult =
  | { ok: true; record: AreaRewardRecord; resumed: boolean }
  | {
      ok: false
      reason: "invalid" | "expired" | "redeemed" | "busy" | "mismatch"
    }

const STORE_NAME = "virya-area-rewards"
const MAX_CAS_ATTEMPTS = 6
const memoryRewards = new Map<string, AreaRewardRecord>()

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

export const normalizeAreaRewardCode = (value: unknown) => {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase().replace(/\s+/g, "")
  return /^VIRYA-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){5}$/.test(code)
    ? code
    : null
}

export const areaRewardCodeHash = (code: string) =>
  createHash("sha256")
    .update(`virya-area-reward\0${code}`)
    .digest("hex")

const ownerHash = (ownerId: string) =>
  createHash("sha256").update(`virya-area-owner\0${ownerId}`).digest("hex")

const keyForHash = (hash: string) => `codes/${hash}`

const normalizeRecord = (input: unknown): AreaRewardRecord | null => {
  if (!input || typeof input !== "object") return null
  const value = input as Partial<AreaRewardRecord>
  if (
    value.version !== 1 ||
    typeof value.codeHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.codeHash) ||
    typeof value.codeSuffix !== "string" ||
    typeof value.ownerId !== "string" ||
    value.ownerId.length < 8 ||
    value.ownerId.length > 128 ||
    typeof value.ownerHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.ownerHash) ||
    typeof value.requestId !== "string" ||
    value.benefit !== AREA_REWARD_BENEFIT ||
    !["issued", "reserved", "redeemed"].includes(value.status ?? "") ||
    typeof value.issuedAt !== "string" ||
    !Number.isInteger(value.expiresAt)
  ) {
    return null
  }

  return {
    version: 1,
    codeHash: value.codeHash,
    codeSuffix: value.codeSuffix,
    ownerId: value.ownerId,
    ownerHash: value.ownerHash,
    requestId: value.requestId,
    benefit: AREA_REWARD_BENEFIT,
    status: value.status as AreaRewardStatus,
    issuedAt: value.issuedAt,
    expiresAt: Number(value.expiresAt),
    reservationId:
      typeof value.reservationId === "string" ? value.reservationId : undefined,
    reservedUntil: Number.isInteger(value.reservedUntil)
      ? Number(value.reservedUntil)
      : undefined,
    checkoutSessionId:
      typeof value.checkoutSessionId === "string"
        ? value.checkoutSessionId
        : undefined,
    freeProductId:
      typeof value.freeProductId === "string" ? value.freeProductId : undefined,
    freeProductLabel:
      typeof value.freeProductLabel === "string"
        ? value.freeProductLabel
        : undefined,
    redeemedAt:
      typeof value.redeemedAt === "string" ? value.redeemedAt : undefined,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date(0).toISOString(),
  }
}

const readRecord = async (hash: string) => {
  try {
    const record = await store().getWithMetadata(keyForHash(hash), {
      type: "json",
      consistency: "strong",
    })
    return {
      record: normalizeRecord(record?.data),
      etag: record?.etag,
      exists: !!record,
      memory: false as const,
    }
  } catch (error) {
    if (!import.meta.env.DEV) throw error
    return {
      record: memoryRewards.get(hash) ?? null,
      etag: undefined,
      exists: memoryRewards.has(hash),
      memory: true as const,
    }
  }
}

const writeRecord = async (
  hash: string,
  next: AreaRewardRecord,
  current: Awaited<ReturnType<typeof readRecord>>,
) => {
  if (current.memory) {
    memoryRewards.set(hash, next)
    return true
  }
  const write = await store().setJSON(
    keyForHash(hash),
    next,
    current.exists
      ? { onlyIfMatch: current.etag }
      : { onlyIfNew: true },
  )
  return write.modified
}

export const registerAreaRewardCode = async (input: RegisterInput) => {
  const code = normalizeAreaRewardCode(input.code)
  if (!code) throw new Error("Invalid Area reward code")
  const hash = areaRewardCodeHash(code)
  const expectedOwnerHash = ownerHash(input.ownerId)

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readRecord(hash)
    if (current.record) {
      if (
        current.record.ownerHash !== expectedOwnerHash ||
        current.record.requestId !== input.requestId
      ) {
        throw new Error("Area reward code collision")
      }
      return current.record
    }

    const next: AreaRewardRecord = {
      version: 1,
      codeHash: hash,
      codeSuffix: code.slice(-4),
      ownerId: input.ownerId,
      ownerHash: expectedOwnerHash,
      requestId: input.requestId,
      benefit: AREA_REWARD_BENEFIT,
      status: "issued",
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      updatedAt: new Date().toISOString(),
    }
    if (await writeRecord(hash, next, current)) return next
  }

  throw new Error("Area reward registration is busy; retry")
}

export const previewAreaRewardCode = async (
  rawCode: unknown,
  reservationId?: string,
) => {
  const code = normalizeAreaRewardCode(rawCode)
  if (!code) return { valid: false as const, reason: "invalid" as const }
  const hash = areaRewardCodeHash(code)
  const { record } = await readRecord(hash)
  if (!record) return { valid: false as const, reason: "invalid" as const }
  const now = Math.floor(Date.now() / 1000)
  if (record.expiresAt <= now) {
    return { valid: false as const, reason: "expired" as const }
  }
  if (record.status === "redeemed") {
    return { valid: false as const, reason: "redeemed" as const }
  }
  if (
    record.status === "reserved" &&
    Number(record.reservedUntil) > Date.now()
  ) {
    if (!reservationId || record.reservationId !== reservationId) {
      return { valid: false as const, reason: "busy" as const }
    }
  }
  return {
    valid: true as const,
    code,
    codeHash: hash,
    benefit: record.benefit,
    expiresAt: record.expiresAt,
    resumed:
      record.status === "reserved" && record.reservationId === reservationId,
  }
}

export const reserveAreaRewardCode = async (
  rawCode: unknown,
  reservationId: string,
  reservedUntil: number,
): Promise<ReserveResult> => {
  const code = normalizeAreaRewardCode(rawCode)
  if (!code) return { ok: false, reason: "invalid" }
  const hash = areaRewardCodeHash(code)

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readRecord(hash)
    const record = current.record
    if (!record) return { ok: false, reason: "invalid" }
    if (record.expiresAt <= Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: "expired" }
    }
    if (record.status === "redeemed") {
      return { ok: false, reason: "redeemed" }
    }
    if (
      record.status === "reserved" &&
      record.reservationId !== reservationId &&
      Number(record.reservedUntil) > Date.now()
    ) {
      return { ok: false, reason: "busy" }
    }
    if (
      record.status === "reserved" &&
      record.reservationId === reservationId
    ) {
      return { ok: true, record, resumed: true }
    }

    const next: AreaRewardRecord = {
      ...record,
      status: "reserved",
      reservationId,
      reservedUntil,
      checkoutSessionId: undefined,
      freeProductId: undefined,
      freeProductLabel: undefined,
      updatedAt: new Date().toISOString(),
    }
    if (await writeRecord(hash, next, current)) {
      return { ok: true, record: next, resumed: false }
    }
  }

  throw new Error("Area reward reservation is busy; retry")
}

export const attachAreaRewardCheckout = async ({
  codeHash,
  reservationId,
  checkoutSessionId,
  freeProductId,
  freeProductLabel,
}: {
  codeHash: string
  reservationId: string
  checkoutSessionId: string
  freeProductId: string
  freeProductLabel: string
}) => {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readRecord(codeHash)
    const record = current.record
    if (
      !record ||
      record.status !== "reserved" ||
      record.reservationId !== reservationId
    ) {
      throw new Error("Area reward reservation ownership was lost")
    }
    if (record.checkoutSessionId === checkoutSessionId) return record
    if (
      record.checkoutSessionId &&
      record.checkoutSessionId !== checkoutSessionId
    ) {
      throw new Error("Area reward is already attached to another checkout")
    }

    const next: AreaRewardRecord = {
      ...record,
      checkoutSessionId,
      freeProductId,
      freeProductLabel,
      updatedAt: new Date().toISOString(),
    }
    if (await writeRecord(codeHash, next, current)) return next
  }
  throw new Error("Area reward checkout attachment is busy; retry")
}

export const redeemAreaRewardCode = async ({
  codeHash,
  reservationId,
  checkoutSessionId,
}: {
  codeHash: string
  reservationId: string
  checkoutSessionId: string
}) => {
  if (!/^[a-f0-9]{64}$/.test(codeHash)) return null

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readRecord(codeHash)
    const record = current.record
    if (!record) return null
    if (
      record.status === "redeemed" &&
      record.checkoutSessionId === checkoutSessionId
    ) {
      return record
    }
    if (
      record.status !== "reserved" ||
      record.reservationId !== reservationId ||
      record.checkoutSessionId !== checkoutSessionId
    ) {
      return null
    }

    const next: AreaRewardRecord = {
      ...record,
      status: "redeemed",
      redeemedAt: new Date().toISOString(),
      reservedUntil: undefined,
      updatedAt: new Date().toISOString(),
    }
    if (await writeRecord(codeHash, next, current)) return next
  }
  throw new Error("Area reward redemption is busy; retry")
}

export const releaseAreaRewardCode = async ({
  codeHash,
  reservationId,
  checkoutSessionId,
}: {
  codeHash: string
  reservationId: string
  checkoutSessionId?: string
}) => {
  if (!/^[a-f0-9]{64}$/.test(codeHash)) return null

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readRecord(codeHash)
    const record = current.record
    if (!record || record.status !== "reserved") return null
    if (record.reservationId !== reservationId) return null
    if (
      checkoutSessionId &&
      record.checkoutSessionId &&
      record.checkoutSessionId !== checkoutSessionId
    ) {
      return null
    }

    const next: AreaRewardRecord = {
      ...record,
      status: "issued",
      reservationId: undefined,
      reservedUntil: undefined,
      checkoutSessionId: undefined,
      freeProductId: undefined,
      freeProductLabel: undefined,
      updatedAt: new Date().toISOString(),
    }
    if (await writeRecord(codeHash, next, current)) return next
  }
  throw new Error("Area reward release is busy; retry")
}
