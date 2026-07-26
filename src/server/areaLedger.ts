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
  valuePln: number
  minimumOrderPln: number
  createdAt: string
  expiresAt: number
  status: "pending" | "issued" | "failed"
  processingId?: string
  processingExpiresAt?: number
  couponId?: string
  promotionCodeId?: string
}

export type AreaWallet = {
  version: 1
  id: string
  tokenBalance: number
  claims: AreaClaim[]
  vouchers: AreaVoucher[]
  attempts: number[]
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
        ["pending", "issued", "failed"].includes(voucher.status)
      ).slice(-100)
    : []

  const attempts = Array.isArray(value.attempts)
    ? value.attempts.map(Number).filter(Number.isFinite).slice(-20)
    : []

  return {
    version: 1,
    id,
    tokenBalance: Math.max(0, Math.min(100, asInteger(value.tokenBalance))),
    claims,
    vouchers,
    attempts,
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

      if (claims.includes(claimKey)) {
        return { reserved: true, alreadyReserved: true, remaining: Math.max(0, maxClaims - claims.length) }
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
        }
      }
    } catch (error) {
      if (!import.meta.env.DEV) throw error

      const claims = memoryDropClaims.get(dropId) ?? []
      if (claims.includes(claimKey)) {
        return { reserved: true, alreadyReserved: true, remaining: Math.max(0, maxClaims - claims.length) }
      }
      if (claims.length >= maxClaims) {
        return { reserved: false, alreadyReserved: false, remaining: 0 }
      }
      memoryDropClaims.set(dropId, [...claims, claimKey])
      return {
        reserved: true,
        alreadyReserved: false,
        remaining: Math.max(0, maxClaims - claims.length - 1),
      }
    }
  }

  throw new Error("Area drop is busy; retry")
}
