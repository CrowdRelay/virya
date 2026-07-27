import { createHash } from "node:crypto"
import { getStore } from "@netlify/blobs"

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
}

export type AreaWallet = {
  version: 1
  id: string
  tokenBalance: number
  claims: AreaClaim[]
  vouchers: AreaVoucher[]
  attempts: number[]
  migrations: string[]
  migratedTo?: string
  migratedAt?: string
  updatedAt: string
}

type Mutation<T> = {
  wallet: AreaWallet
  result: T
}

const STORE_NAME = "virya-area"
const MAX_CAS_ATTEMPTS = 6
const memoryWallets = new Map<string, AreaWallet>()
const memoryDropClaims = new Map<string, string[]>()

const emptyWallet = (id: string): AreaWallet => ({
  version: 1,
  id,
  tokenBalance: 0,
  claims: [],
  vouchers: [],
  attempts: [],
  migrations: [],
  updatedAt: new Date().toISOString(),
})

const asInteger = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

const normalizeWallet = (input: unknown, id: string): AreaWallet => {
  if (!input || typeof input !== "object") return emptyWallet(id)
  const value = input as Partial<AreaWallet>

  const claims = Array.isArray(value.claims)
    ? value.claims.filter((claim): claim is AreaClaim =>
        !!claim &&
        typeof claim.dropId === "string" &&
        typeof claim.claimedAt === "string" &&
        Number.isFinite(Number(claim.distanceMeters)) &&
        (claim.editionNumber === undefined ||
          (Number.isInteger(claim.editionNumber) && claim.editionNumber > 0))
      ).slice(0, 100)
    : []

  const vouchers = Array.isArray(value.vouchers)
    ? value.vouchers.filter((voucher): voucher is AreaVoucher =>
        !!voucher &&
        typeof voucher.requestId === "string" &&
        typeof voucher.code === "string" &&
        voucher.benefit === "free-item-and-shipping" &&
        ["pending", "issued", "reserved", "redeemed", "failed"].includes(voucher.status)
      ).slice(-100)
    : []

  const attempts = Array.isArray(value.attempts)
    ? value.attempts.map(Number).filter(Number.isFinite).slice(-20)
    : []
  const migrations = Array.isArray(value.migrations)
    ? value.migrations
        .filter((migration): migration is string =>
          typeof migration === "string" && /^[a-f0-9]{64}$/.test(migration)
        )
        .slice(-50)
    : []

  return {
    version: 1,
    id,
    tokenBalance: Math.max(0, Math.min(100, asInteger(value.tokenBalance))),
    claims,
    vouchers,
    attempts,
    migrations,
    migratedTo:
      typeof value.migratedTo === "string" ? value.migratedTo : undefined,
    migratedAt:
      typeof value.migratedAt === "string" ? value.migratedAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
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
    if (!import.meta.env.DEV) throw error
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
  mutate: (wallet: AreaWallet) => Mutation<T>
): Promise<T> => {
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await readWalletRecord(id)
    const mutation = mutate(current.wallet)
    const next = normalizeWallet({
      ...mutation.wallet,
      id,
      updatedAt: new Date().toISOString(),
    }, id)

    if ("memory" in current && current.memory) {
      memoryWallets.set(id, next)
      return mutation.result
    }

    const write = await store().setJSON(
      `wallets/${id}`,
      next,
      current.exists
        ? { onlyIfMatch: current.etag }
        : { onlyIfNew: true }
    )

    if (write.modified) return mutation.result
  }

  throw new Error("Area wallet is busy; retry")
}

const walletClaimKey = (walletId: string) =>
  createHash("sha256").update(walletId).digest("hex")

export const reserveAreaDropClaim = async (
  dropId: string,
  walletId: string,
  maxClaims: number
) => {
  const claimKey = walletClaimKey(walletId)
  const blobKey = `drops/${dropId}`

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    try {
      const record = await store().getWithMetadata(blobKey, {
        type: "json",
        consistency: "strong",
      })
      const stored = record?.data as { claims?: unknown } | null
      const claims = Array.isArray(stored?.claims)
        ? stored.claims
            .filter((value): value is string => typeof value === "string")
            .slice(0, maxClaims)
        : []

      const existingIndex = claims.indexOf(claimKey)
      if (existingIndex >= 0) {
        return {
          reserved: true,
          alreadyReserved: true,
          remaining: Math.max(0, maxClaims - claims.length),
          editionNumber: existingIndex + 1,
        }
      }
      if (claims.length >= maxClaims) {
        return { reserved: false, alreadyReserved: false, remaining: 0 }
      }

      const write = await store().setJSON(
        blobKey,
        {
          version: 1,
          claims: [...claims, claimKey],
          updatedAt: new Date().toISOString(),
        },
        record
          ? { onlyIfMatch: record.etag }
          : { onlyIfNew: true }
      )

      if (write.modified) {
        return {
          reserved: true,
          alreadyReserved: false,
          remaining: Math.max(0, maxClaims - claims.length - 1),
          editionNumber: claims.length + 1,
        }
      }
    } catch (error) {
      if (!import.meta.env.DEV) throw error

      const claims = memoryDropClaims.get(dropId) ?? []
      const existingIndex = claims.indexOf(claimKey)
      if (existingIndex >= 0) {
        return {
          reserved: true,
          alreadyReserved: true,
          remaining: Math.max(0, maxClaims - claims.length),
          editionNumber: existingIndex + 1,
        }
      }
      if (claims.length >= maxClaims) {
        return { reserved: false, alreadyReserved: false, remaining: 0 }
      }
      memoryDropClaims.set(dropId, [...claims, claimKey])
      return {
        reserved: true,
        alreadyReserved: false,
        remaining: Math.max(0, maxClaims - claims.length - 1),
        editionNumber: claims.length + 1,
      }
    }
  }

  throw new Error("Area drop is busy; retry")
}

export const getAreaDropClaimCount = async (dropId: string) => {
  try {
    const record = await store().get(`drops/${dropId}`, {
      type: "json",
      consistency: "strong",
    })
    const stored = record as { claims?: unknown } | null
    return Array.isArray(stored?.claims)
      ? stored.claims.filter(value => typeof value === "string").length
      : 0
  } catch (error) {
    if (!import.meta.env.DEV) throw error
    return (memoryDropClaims.get(dropId) ?? []).length
  }
}

export type AreaWalletMigration = {
  migrated: boolean
  alreadyMigrated: boolean
  transferredClaims: number
  transferredCredits: number
}

/**
 * Migrate a legacy browser wallet into an account wallet exactly once.
 *
 * The target is updated first and records a deterministic migration ID. If the
 * process is interrupted before the source is marked, a retry cannot credit
 * the target twice. Overlapping claims are merged conservatively and never
 * produce a duplicate Credit.
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

  const migrationId = createHash("sha256")
    .update(`${sourceWalletId}\0${targetWalletId}`)
    .digest("hex")
  const source = await getAreaWallet(sourceWalletId)

  const result = await mutateAreaWallet(targetWalletId, target => {
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
    // A Credit can only originate from a claim. In an overlap conflict we
    // prefer under-crediting for manual review over minting duplicate value.
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

  await mutateAreaWallet(sourceWalletId, wallet => ({
    wallet: {
      ...wallet,
      tokenBalance: 0,
      migratedTo: targetWalletId,
      migratedAt: new Date().toISOString(),
    },
    result: null,
  }))

  return result
}
