import { createHash, randomUUID } from "node:crypto"
import { getStore } from "@netlify/blobs"
import {
  getAreaRewardRecord,
  transferAreaRewardCodeOwner,
  type AreaRewardRecord,
} from "./areaReward"

export type AreaClaim = {
  dropId: string
  claimedAt: string
  distanceMeters: number
  editionNumber?: number
}

export type AreaVoucher = {
  requestId: string
  code: string
  tokens: number
  benefit: "free-item-and-shipping"
  createdAt: string
  expiresAt: number
  status: "pending" | "issued" | "reserved" | "redeemed" | "failed"
  processingId?: string
  processingExpiresAt?: number
  reservationId?: string
  reservedUntil?: number
  checkoutSessionId?: string
  freeProductId?: string
  freeProductLabel?: string
  redeemedAt?: string
  migrationCompensated?: boolean
}

export type AreaTicketReward = {
  requestId: string
  eventSlug: string
  credits: number
  fanEmail: string
  status: "pending" | "issued" | "failed"
  createdAt: string
  processingId?: string
  processingExpiresAt?: number
  publicReference?: string
  issuedAt?: string
  failureCode?: string
}

type AreaWalletMigrationState = {
  targetWalletId: string
  status: "processing" | "completed"
  leaseId?: string
  leaseExpiresAt?: number
  startedAt: string
  completedAt?: string
}

export type AreaWallet = {
  version: 1
  id: string
  tokenBalance: number
  claims: AreaClaim[]
  vouchers: AreaVoucher[]
  ticketRewards: AreaTicketReward[]
  attempts: number[]
  migrations: string[]
  migration?: AreaWalletMigrationState
  migratedTo?: string
  migratedAt?: string
  updatedAt: string
}

type Mutation<T> = {
  wallet: AreaWallet
  result: T
}

type DropClaimEntry = {
  claimKey: string
  status: "pending" | "committed"
  leaseId?: string
  pendingExpiresAt?: number
  editionNumber: number
  committedAt?: string
}

type DropClaimRecord = {
  version: 2
  nextEditionNumber: number
  claims: DropClaimEntry[]
  updatedAt: string
}

const STORE_NAME = "virya-area"
const MAX_CAS_ATTEMPTS = 8
const CLAIM_LEASE_MS = 2 * 60 * 1000
const MIGRATION_LEASE_MS = 2 * 60 * 1000
const memoryWallets = new Map<string, AreaWallet>()
const memoryDropClaims = new Map<string, DropClaimRecord>()

const isDevelopment = () => Boolean(import.meta.env?.DEV)

const emptyWallet = (id: string): AreaWallet => ({
  version: 1,
  id,
  tokenBalance: 0,
  claims: [],
  vouchers: [],
  ticketRewards: [],
  attempts: [],
  migrations: [],
  updatedAt: new Date().toISOString(),
})

const asInteger = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

const normalizeMigration = (
  input: unknown,
): AreaWalletMigrationState | undefined => {
  if (!input || typeof input !== "object") return undefined
  const value = input as Partial<AreaWalletMigrationState>
  if (
    typeof value.targetWalletId !== "string" ||
    !["processing", "completed"].includes(value.status ?? "") ||
    typeof value.startedAt !== "string"
  ) {
    return undefined
  }
  return {
    targetWalletId: value.targetWalletId,
    status: value.status as AreaWalletMigrationState["status"],
    leaseId: typeof value.leaseId === "string" ? value.leaseId : undefined,
    leaseExpiresAt: Number.isInteger(value.leaseExpiresAt)
      ? Number(value.leaseExpiresAt)
      : undefined,
    startedAt: value.startedAt,
    completedAt:
      typeof value.completedAt === "string" ? value.completedAt : undefined,
  }
}

const normalizeWallet = (input: unknown, id: string): AreaWallet => {
  if (!input || typeof input !== "object") return emptyWallet(id)
  const value = input as Partial<AreaWallet>

  const migratedTo =
    typeof value.migratedTo === "string" ? value.migratedTo : undefined
  const migratedAt =
    typeof value.migratedAt === "string" ? value.migratedAt : undefined
  const migration = normalizeMigration(value.migration)
  const completedMigration =
    Boolean(migratedTo && migratedAt) || migration?.status === "completed"

  const claims = completedMigration
    ? []
    : Array.isArray(value.claims)
      ? value.claims
          .filter(
            (claim): claim is AreaClaim =>
              !!claim &&
              typeof claim.dropId === "string" &&
              typeof claim.claimedAt === "string" &&
              Number.isFinite(Number(claim.distanceMeters)) &&
              (claim.editionNumber === undefined ||
                (Number.isInteger(claim.editionNumber) &&
                  Number(claim.editionNumber) > 0)),
          )
          .slice(0, 100)
      : []

  const vouchers = completedMigration
    ? []
    : Array.isArray(value.vouchers)
      ? value.vouchers
          .filter(
            (voucher): voucher is AreaVoucher =>
              !!voucher &&
              typeof voucher.requestId === "string" &&
              typeof voucher.code === "string" &&
              voucher.benefit === "free-item-and-shipping" &&
              ["pending", "issued", "reserved", "redeemed", "failed"].includes(
                voucher.status,
              ),
          )
          .map(voucher => ({
            ...voucher,
            migrationCompensated: Boolean(voucher.migrationCompensated),
          }))
          .slice(-100)
      : []

  const ticketRewards = completedMigration
    ? []
    : Array.isArray(value.ticketRewards)
      ? value.ticketRewards
          .filter(
            (reward): reward is AreaTicketReward =>
              !!reward &&
              typeof reward.requestId === "string" &&
              /^[0-9a-f-]{36}$/i.test(reward.requestId) &&
              typeof reward.eventSlug === "string" &&
              /^[a-z0-9][a-z0-9_-]{0,127}$/.test(reward.eventSlug) &&
              Number.isInteger(reward.credits) &&
              reward.credits > 0 &&
              reward.credits <= 20 &&
              typeof reward.fanEmail === "string" &&
              reward.fanEmail.length <= 320 &&
              ["pending", "issued", "failed"].includes(reward.status),
          )
          .slice(-50)
      : []

  const attempts = completedMigration
    ? []
    : Array.isArray(value.attempts)
      ? value.attempts.map(Number).filter(Number.isFinite).slice(-20)
      : []
  const migrations = Array.isArray(value.migrations)
    ? value.migrations
        .filter(
          (migrationId): migrationId is string =>
            typeof migrationId === "string" &&
            /^[a-f0-9]{64}$/.test(migrationId),
        )
        .slice(-50)
    : []

  return {
    version: 1,
    id,
    tokenBalance: completedMigration
      ? 0
      : Math.max(0, Math.min(100, asInteger(value.tokenBalance))),
    claims,
    vouchers,
    ticketRewards,
    attempts,
    migrations,
    migration,
    migratedTo,
    migratedAt,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })

const readBlobWallet = async (id: string) => {
  const record = await store().getWithMetadata(`wallets/${id}`, {
    type: "json",
    consistency: "strong",
  })
  return {
    wallet: normalizeWallet(record?.data, id),
    etag: record?.etag,
    exists: !!record,
  }
}

const readWalletRecord = async (id: string) => {
  try {
    return await readBlobWallet(id)
  } catch (error) {
    if (!isDevelopment()) throw error
    return {
      wallet: normalizeWallet(memoryWallets.get(id), id),
      etag: undefined,
      exists: memoryWallets.has(id),
      memory: true as const,
    }
  }
}

export const getAreaWallet = async (id: string) => {
  const record = await readWalletRecord(id)
  return record.wallet
}

export const mutateAreaWallet = async <T>(
  id: string,
  mutate: (wallet: AreaWallet) => Mutation<T>,
): Promise<T> => {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readWalletRecord(id)
    const mutation = mutate(current.wallet)
    const next = normalizeWallet(
      {
        ...mutation.wallet,
        id,
        updatedAt: new Date().toISOString(),
      },
      id,
    )

    if ("memory" in current && current.memory) {
      memoryWallets.set(id, next)
      return mutation.result
    }

    const write = await store().setJSON(
      `wallets/${id}`,
      next,
      current.exists ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
    )

    if (write.modified) return mutation.result
  }

  throw new Error("Area wallet is busy; retry")
}

const walletClaimKey = (walletId: string) =>
  createHash("sha256").update(walletId).digest("hex")

const normalizeDropClaimRecord = (
  input: unknown,
  maxClaims: number,
  now = Date.now(),
): DropClaimRecord => {
  const value =
    input && typeof input === "object"
      ? (input as {
          version?: unknown
          claims?: unknown
          nextEditionNumber?: unknown
          updatedAt?: unknown
        })
      : {}

  const candidates: DropClaimEntry[] = []
  if (Array.isArray(value.claims)) {
    value.claims.forEach((entry, index) => {
      if (typeof entry === "string" && /^[a-f0-9]{64}$/.test(entry)) {
        candidates.push({
          claimKey: entry,
          status: "committed",
          editionNumber: index + 1,
          committedAt: new Date(0).toISOString(),
        })
        return
      }
      if (!entry || typeof entry !== "object") return
      const item = entry as Partial<DropClaimEntry>
      if (
        typeof item.claimKey !== "string" ||
        !/^[a-f0-9]{64}$/.test(item.claimKey) ||
        !["pending", "committed"].includes(item.status ?? "") ||
        !Number.isInteger(item.editionNumber) ||
        Number(item.editionNumber) < 1
      ) {
        return
      }
      if (
        item.status === "pending" &&
        (!item.leaseId ||
          !Number.isInteger(item.pendingExpiresAt) ||
          Number(item.pendingExpiresAt) <= now)
      ) {
        return
      }
      candidates.push({
        claimKey: item.claimKey,
        status: item.status as DropClaimEntry["status"],
        leaseId:
          item.status === "pending" && typeof item.leaseId === "string"
            ? item.leaseId
            : undefined,
        pendingExpiresAt:
          item.status === "pending" && Number.isInteger(item.pendingExpiresAt)
            ? Number(item.pendingExpiresAt)
            : undefined,
        editionNumber: Number(item.editionNumber),
        committedAt:
          item.status === "committed" && typeof item.committedAt === "string"
            ? item.committedAt
            : undefined,
      })
    })
  }

  const byWallet = new Map<string, DropClaimEntry>()
  for (const entry of candidates.sort(
    (a, b) => a.editionNumber - b.editionNumber,
  )) {
    const existing = byWallet.get(entry.claimKey)
    if (
      !existing ||
      (existing.status === "pending" && entry.status === "committed")
    ) {
      byWallet.set(entry.claimKey, entry)
    }
  }
  const claims = [...byWallet.values()]
    .sort((a, b) => a.editionNumber - b.editionNumber)
    .slice(0, Math.max(1, Math.min(500, maxClaims)))
  const highestEdition = claims.reduce(
    (highest, claim) => Math.max(highest, claim.editionNumber),
    0,
  )

  return {
    version: 2,
    nextEditionNumber: Math.max(
      highestEdition + 1,
      asInteger(value.nextEditionNumber, highestEdition + 1),
    ),
    claims,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  }
}

const readDropRecord = async (dropId: string, maxClaims: number) => {
  const blobKey = `drops/${dropId}`
  try {
    const record = await store().getWithMetadata(blobKey, {
      type: "json",
      consistency: "strong",
    })
    return {
      record: normalizeDropClaimRecord(record?.data, maxClaims),
      etag: record?.etag,
      exists: !!record,
      memory: false as const,
      blobKey,
    }
  } catch (error) {
    if (!isDevelopment()) throw error
    return {
      record: normalizeDropClaimRecord(memoryDropClaims.get(dropId), maxClaims),
      etag: undefined,
      exists: memoryDropClaims.has(dropId),
      memory: true as const,
      blobKey,
    }
  }
}

const writeDropRecord = async (
  dropId: string,
  next: DropClaimRecord,
  current: Awaited<ReturnType<typeof readDropRecord>>,
) => {
  if (current.memory) {
    memoryDropClaims.set(dropId, next)
    return true
  }
  const write = await store().setJSON(
    current.blobKey,
    next,
    current.exists ? { onlyIfMatch: current.etag } : { onlyIfNew: true },
  )
  return write.modified
}

export type AreaDropReservation =
  | {
      reserved: true
      alreadyReserved: boolean
      alreadyCommitted: boolean
      remaining: number
      editionNumber: number
      leaseId?: string
    }
  | {
      reserved: false
      alreadyReserved: false
      alreadyCommitted: false
      remaining: 0
    }

export const reserveAreaDropClaim = async (
  dropId: string,
  walletId: string,
  maxClaims: number,
): Promise<AreaDropReservation> => {
  const claimKey = walletClaimKey(walletId)

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readDropRecord(dropId, maxClaims)
    const claims = current.record.claims
    const existing = claims.find(entry => entry.claimKey === claimKey)
    if (existing) {
      return {
        reserved: true,
        alreadyReserved: true,
        alreadyCommitted: existing.status === "committed",
        remaining: Math.max(0, maxClaims - claims.length),
        editionNumber: existing.editionNumber,
        leaseId: existing.status === "pending" ? existing.leaseId : undefined,
      }
    }
    if (claims.length >= maxClaims) {
      return {
        reserved: false,
        alreadyReserved: false,
        alreadyCommitted: false,
        remaining: 0,
      }
    }

    const leaseId = randomUUID()
    const nextEntry: DropClaimEntry = {
      claimKey,
      status: "pending",
      leaseId,
      pendingExpiresAt: Date.now() + CLAIM_LEASE_MS,
      editionNumber: current.record.nextEditionNumber,
    }
    const next: DropClaimRecord = {
      version: 2,
      nextEditionNumber: current.record.nextEditionNumber + 1,
      claims: [...claims, nextEntry],
      updatedAt: new Date().toISOString(),
    }
    if (await writeDropRecord(dropId, next, current)) {
      return {
        reserved: true,
        alreadyReserved: false,
        alreadyCommitted: false,
        remaining: Math.max(0, maxClaims - next.claims.length),
        editionNumber: nextEntry.editionNumber,
        leaseId,
      }
    }
  }

  throw new Error("Area drop is busy; retry")
}

export const commitAreaDropClaim = async (
  dropId: string,
  walletId: string,
  leaseId: string | undefined,
  maxClaims: number,
) => {
  const claimKey = walletClaimKey(walletId)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readDropRecord(dropId, maxClaims)
    const index = current.record.claims.findIndex(
      entry => entry.claimKey === claimKey,
    )
    if (index < 0) return false
    const existing = current.record.claims[index]
    if (existing.status === "committed") return true
    if (!leaseId || existing.leaseId !== leaseId) return false

    const claims = [...current.record.claims]
    claims[index] = {
      claimKey,
      status: "committed",
      editionNumber: existing.editionNumber,
      committedAt: new Date().toISOString(),
    }
    const next = {
      ...current.record,
      claims,
      updatedAt: new Date().toISOString(),
    }
    if (await writeDropRecord(dropId, next, current)) return true
  }
  throw new Error("Area drop commit is busy; retry")
}

export const releaseAreaDropClaim = async (
  dropId: string,
  walletId: string,
  leaseId: string | undefined,
  maxClaims: number,
) => {
  if (!leaseId) return false
  const claimKey = walletClaimKey(walletId)
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readDropRecord(dropId, maxClaims)
    const existing = current.record.claims.find(
      entry => entry.claimKey === claimKey,
    )
    if (!existing || existing.status === "committed") return false
    if (existing.leaseId !== leaseId) return false

    const next = {
      ...current.record,
      claims: current.record.claims.filter(
        entry => entry.claimKey !== claimKey,
      ),
      updatedAt: new Date().toISOString(),
    }
    if (await writeDropRecord(dropId, next, current)) return true
  }
  throw new Error("Area drop release is busy; retry")
}

export const getAreaDropClaimCount = async (dropId: string) => {
  const current = await readDropRecord(dropId, 500)
  return current.record.claims.filter(entry => entry.status === "committed")
    .length
}

export const getAreaCommunityProgress = async (dropIds: string[]) => {
  const counts = await Promise.all(dropIds.map(getAreaDropClaimCount))
  const current = counts.filter(count => count > 0).length
  const total = dropIds.length
  return {
    current,
    total,
    percent: total > 0 ? Math.round((current / total) * 10_000) / 100 : 0,
  }
}

export type AreaWalletMigration = {
  migrated: boolean
  alreadyMigrated: boolean
  transferredClaims: number
  transferredCredits: number
}

export class AreaWalletMigrationConflictError extends Error {
  constructor() {
    super("Area wallet was already linked to another account")
    this.name = "AreaWalletMigrationConflictError"
  }
}

type MigrationLease =
  | { status: "acquired"; leaseId: string; source: AreaWallet }
  | { status: "completed" }
  | { status: "busy" }
  | { status: "conflict" }

const acquireMigrationLease = async (
  sourceWalletId: string,
  targetWalletId: string,
): Promise<MigrationLease> => {
  const leaseId = randomUUID()
  return mutateAreaWallet<MigrationLease>(sourceWalletId, wallet => {
    const boundTarget = wallet.migration?.targetWalletId ?? wallet.migratedTo
    if (boundTarget && boundTarget !== targetWalletId) {
      return { wallet, result: { status: "conflict" } as const }
    }
    if (
      wallet.migration?.status === "completed" ||
      (wallet.migratedTo === targetWalletId && wallet.migratedAt)
    ) {
      return { wallet, result: { status: "completed" } as const }
    }
    if (
      wallet.migration?.status === "processing" &&
      Number(wallet.migration.leaseExpiresAt) > Date.now()
    ) {
      return { wallet, result: { status: "busy" } as const }
    }

    const migration: AreaWalletMigrationState = {
      targetWalletId,
      status: "processing",
      leaseId,
      leaseExpiresAt: Date.now() + MIGRATION_LEASE_MS,
      startedAt: wallet.migration?.startedAt ?? new Date().toISOString(),
    }
    const source = { ...wallet, migration }
    return {
      wallet: source,
      result: { status: "acquired", leaseId, source } as const,
    }
  })
}

const voucherFromRewardRecord = (
  voucher: AreaVoucher,
  record: AreaRewardRecord,
): AreaVoucher => ({
  ...voucher,
  status: record.status,
  reservationId: record.reservationId,
  reservedUntil: record.reservedUntil,
  checkoutSessionId: record.checkoutSessionId,
  freeProductId: record.freeProductId,
  freeProductLabel: record.freeProductLabel,
  redeemedAt: record.redeemedAt,
  processingId: undefined,
  processingExpiresAt: undefined,
})

/**
 * Migrate a legacy browser wallet into one account wallet. The source becomes
 * permanently bound to the first target before any value is copied. Retries
 * for that same target are idempotent; attempts to migrate the source to a
 * different account are rejected even after a crashed lease expires.
 */
export const migrateAreaWallet = async (
  sourceWalletId: string,
  targetWalletId: string,
): Promise<AreaWalletMigration> => {
  if (sourceWalletId === targetWalletId) {
    return {
      migrated: false,
      alreadyMigrated: true,
      transferredClaims: 0,
      transferredCredits: 0,
    }
  }

  const lease = await acquireMigrationLease(sourceWalletId, targetWalletId)
  if (lease.status === "completed") {
    return {
      migrated: false,
      alreadyMigrated: true,
      transferredClaims: 0,
      transferredCredits: 0,
    }
  }
  if (lease.status === "busy") {
    throw new Error("Area wallet migration is already processing")
  }
  if (lease.status === "conflict") {
    throw new AreaWalletMigrationConflictError()
  }

  const migrationId = createHash("sha256")
    .update(`area-wallet-migration\0${sourceWalletId}`)
    .digest("hex")
  const source = lease.source

  const targetResult = await mutateAreaWallet(targetWalletId, target => {
    if (target.migrations.includes(migrationId)) {
      return {
        wallet: target,
        result: {
          migrated: false,
          alreadyMigrated: true,
          transferredClaims: 0,
          transferredCredits: 0,
        },
      }
    }

    const existingDropIds = new Set(target.claims.map(claim => claim.dropId))
    const uniqueClaims = source.claims.filter(
      claim => !existingDropIds.has(claim.dropId),
    )
    const existingVoucherIds = new Set(
      target.vouchers.map(voucher => voucher.requestId),
    )
    const uniqueVouchers = source.vouchers.filter(
      voucher => !existingVoucherIds.has(voucher.requestId),
    )
    const existingTicketRewardIds = new Set(
      target.ticketRewards.map(reward => `${reward.eventSlug}:${reward.requestId}`),
    )
    const uniqueTicketRewards = source.ticketRewards.filter(
      reward => !existingTicketRewardIds.has(`${reward.eventSlug}:${reward.requestId}`),
    )
    const transferableCredits = Math.min(
      source.tokenBalance,
      uniqueClaims.length,
    )

    return {
      wallet: {
        ...target,
        tokenBalance: target.tokenBalance + transferableCredits,
        claims: [...target.claims, ...uniqueClaims],
        vouchers: [...target.vouchers, ...uniqueVouchers],
        ticketRewards: [...target.ticketRewards, ...uniqueTicketRewards],
        migrations: [...target.migrations, migrationId],
      },
      result: {
        migrated: true,
        alreadyMigrated: false,
        transferredClaims: uniqueClaims.length,
        transferredCredits: transferableCredits,
      },
    }
  })

  const rewardStates = new Map<string, AreaRewardRecord | null>()
  for (const voucher of source.vouchers) {
    if (voucher.status === "failed") {
      rewardStates.set(voucher.requestId, null)
      continue
    }
    const transferred = await transferAreaRewardCodeOwner({
      code: voucher.code,
      requestId: voucher.requestId,
      sourceOwnerId: sourceWalletId,
      targetOwnerId: targetWalletId,
    })
    rewardStates.set(
      voucher.requestId,
      transferred ?? (await getAreaRewardRecord(voucher.code)),
    )
  }

  await mutateAreaWallet(targetWalletId, wallet => {
    let compensation = 0
    const vouchers = wallet.vouchers.map(voucher => {
      if (!rewardStates.has(voucher.requestId)) return voucher
      const record = rewardStates.get(voucher.requestId)
      if (record) return voucherFromRewardRecord(voucher, record)
      if (
        voucher.status !== "redeemed" &&
        voucher.status !== "failed" &&
        !voucher.migrationCompensated
      ) {
        compensation += Math.max(0, asInteger(voucher.tokens, 1))
        return {
          ...voucher,
          status: "failed" as const,
          processingId: undefined,
          processingExpiresAt: undefined,
          reservationId: undefined,
          reservedUntil: undefined,
          checkoutSessionId: undefined,
          migrationCompensated: true,
        }
      }
      return voucher
    })
    return {
      wallet: {
        ...wallet,
        tokenBalance: wallet.tokenBalance + compensation,
        vouchers,
      },
      result: null,
    }
  })

  await mutateAreaWallet(sourceWalletId, wallet => {
    if (
      wallet.migration?.targetWalletId !== targetWalletId ||
      wallet.migration.leaseId !== lease.leaseId
    ) {
      throw new Error("Area wallet migration lease was lost")
    }
    const completedAt = new Date().toISOString()
    return {
      wallet: {
        ...wallet,
        tokenBalance: 0,
        claims: [],
        vouchers: [],
        ticketRewards: [],
        attempts: [],
        migratedTo: targetWalletId,
        migratedAt: completedAt,
        migration: {
          targetWalletId,
          status: "completed",
          startedAt: wallet.migration.startedAt,
          completedAt,
        },
      },
      result: null,
    }
  })

  return targetResult
}
