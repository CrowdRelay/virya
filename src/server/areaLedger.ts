import { getStore } from "@netlify/blobs"

/**
 * Read-only compatibility view of the pre-CrowdRelay AREA wallet.
 *
 * New AREA state is never written here. The only supported use is the
 * one-way migration in areaMigration.ts; after the backend records a migration
 * marker this store is no longer consulted for that player.
 */

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

export type AreaWallet = {
  version: 1
  id: string
  tokenBalance: number
  claims: AreaClaim[]
  vouchers: AreaVoucher[]
  ticketRewards: AreaTicketReward[]
  attempts: number[]
  migrations: string[]
  migratedTo?: string
  migratedAt?: string
  updatedAt: string
}

const STORE_NAME = "virya-area"
const memoryWallets = new Map<string, AreaWallet>()
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
  updatedAt: new Date(0).toISOString(),
})

const finiteInteger = (value: unknown, fallback = 0) => {
  const number = Number(value)
  return Number.isInteger(number) && Number.isFinite(number) ? number : fallback
}

const normalizeWallet = (input: unknown, id: string): AreaWallet => {
  if (!input || typeof input !== "object") return emptyWallet(id)
  const value = input as Partial<AreaWallet>
  const claims = Array.isArray(value.claims)
    ? value.claims
        .filter(
          (claim): claim is AreaClaim =>
            Boolean(claim) &&
            typeof claim.dropId === "string" &&
            typeof claim.claimedAt === "string" &&
            Number.isFinite(Date.parse(claim.claimedAt)) &&
            Number.isFinite(Number(claim.distanceMeters)),
        )
        .slice(0, 100)
    : []
  const vouchers = Array.isArray(value.vouchers)
    ? value.vouchers
        .filter(
          (voucher): voucher is AreaVoucher =>
            Boolean(voucher) &&
            typeof voucher.requestId === "string" &&
            typeof voucher.code === "string" &&
            voucher.benefit === "free-item-and-shipping" &&
            typeof voucher.createdAt === "string" &&
            Number.isInteger(Number(voucher.expiresAt)) &&
            ["pending", "issued", "reserved", "redeemed", "failed"].includes(
              voucher.status,
            ),
        )
        .slice(-100)
    : []
  const ticketRewards = Array.isArray(value.ticketRewards)
    ? value.ticketRewards
        .filter(
          (reward): reward is AreaTicketReward =>
            Boolean(reward) &&
            typeof reward.requestId === "string" &&
            typeof reward.eventSlug === "string" &&
            Number.isInteger(Number(reward.credits)) &&
            Number(reward.credits) > 0 &&
            typeof reward.fanEmail === "string" &&
            ["pending", "issued", "failed"].includes(reward.status),
        )
        .slice(-50)
    : []
  return {
    version: 1,
    id,
    tokenBalance: Math.max(0, finiteInteger(value.tokenBalance)),
    claims,
    vouchers,
    ticketRewards,
    attempts: Array.isArray(value.attempts)
      ? value.attempts.map(Number).filter(Number.isFinite).slice(-20)
      : [],
    migrations: Array.isArray(value.migrations)
      ? value.migrations.filter((item): item is string => typeof item === "string")
      : [],
    migratedTo: typeof value.migratedTo === "string" ? value.migratedTo : undefined,
    migratedAt: typeof value.migratedAt === "string" ? value.migratedAt : undefined,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date(0).toISOString(),
  }
}

export const getAreaWallet = async (id: string): Promise<AreaWallet> => {
  try {
    const value = await getStore({ name: STORE_NAME, consistency: "strong" }).get(
      `wallets/${id}`,
      { type: "json", consistency: "strong" },
    )
    return normalizeWallet(value, id)
  } catch (error) {
    if (!isDevelopment()) throw error
    return memoryWallets.get(id) ?? emptyWallet(id)
  }
}
