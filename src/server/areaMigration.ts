import { createHash } from "node:crypto"
import { getAreaWallet, type AreaWallet } from "./areaLedger"
import {
  CrowdRelayAreaError,
  getAreaBackendWallet,
  importLegacyAreaClaims,
  importLegacyAreaWallet,
  type BackendAreaWallet,
} from "./crowdrelayArea"

const migrationId = (walletId: string) =>
  `legacy-v1:${createHash("sha256").update(walletId).digest("hex")}`


const legacyImportsDisabled = (error: unknown) =>
  error instanceof CrowdRelayAreaError &&
  error.status === 410 &&
  error.body.code === "AREA_LEGACY_IMPORTS_DISABLED"

const walletScore = (wallet: AreaWallet) =>
  wallet.tokenBalance +
  wallet.claims.length * 2 +
  wallet.vouchers.filter(voucher =>
    ["issued", "reserved", "redeemed"].includes(voucher.status),
  ).length * 2 +
  wallet.ticketRewards.filter(reward => reward.status === "issued").length * 2

export const chooseLegacyAreaWallet = async (
  accountWalletId: string,
  browserWalletId?: string,
) => {
  const account = await getAreaWallet(accountWalletId)
  if (!browserWalletId || browserWalletId === accountWalletId) {
    return { walletId: accountWalletId, wallet: account }
  }
  const browser = await getAreaWallet(browserWalletId)
  return walletScore(browser) > walletScore(account)
    ? { walletId: browserWalletId, wallet: browser }
    : { walletId: accountWalletId, wallet: account }
}

const visibleLegacyVouchers = (wallet: AreaWallet) =>
  wallet.vouchers
    .filter(voucher =>
      ["issued", "reserved", "redeemed"].includes(voucher.status),
    )
    .map(voucher => ({
      requestId: voucher.requestId,
      code: voucher.code,
      tokens: voucher.tokens,
      benefit: voucher.benefit,
      createdAt: voucher.createdAt,
      expiresAt: voucher.expiresAt,
      status: voucher.status,
      reservationId: voucher.reservationId,
      reservedUntil: voucher.reservedUntil,
      checkoutSessionId: voucher.checkoutSessionId,
      freeProductId: voucher.freeProductId,
      freeProductLabel: voucher.freeProductLabel,
      redeemedAt: voucher.redeemedAt,
    }))

const issuedLegacyTicketRewards = (wallet: AreaWallet) =>
  wallet.ticketRewards
    .filter(
      reward =>
        reward.status === "issued" &&
        typeof reward.publicReference === "string" &&
        typeof reward.issuedAt === "string",
    )
    .map(reward => ({
      requestId: reward.requestId,
      eventSlug: reward.eventSlug,
      credits: reward.credits,
      fanEmail: reward.fanEmail,
      publicReference: reward.publicReference,
      issuedAt: reward.issuedAt,
    }))

export const ensureLegacyAreaImported = async (
  playerId: string,
  accountWalletId: string,
  browserWalletId?: string,
): Promise<BackendAreaWallet> => {
  let backend = await getAreaBackendWallet(playerId)
  if (backend.legacyMigrationApplied) return backend

  const selected = await chooseLegacyAreaWallet(accountWalletId, browserWalletId)
  const known = new Set(backend.claims.map(claim => claim.dropId))
  const missingClaims = selected.wallet.claims
    .filter(claim => !known.has(claim.dropId))
    .map(claim => ({
      dropId: claim.dropId,
      claimedAt: claim.claimedAt,
      editionNumber: claim.editionNumber,
    }))
  if (missingClaims.length > 0) {
    try {
      backend = await importLegacyAreaClaims(playerId, missingClaims)
    } catch (error) {
      if (legacyImportsDisabled(error)) return getAreaBackendWallet(playerId)
      throw error
    }
  }

  try {
    return await importLegacyAreaWallet(playerId, {
      migrationId: migrationId(selected.walletId),
      tokenBalance: selected.wallet.tokenBalance,
      vouchers: visibleLegacyVouchers(selected.wallet),
      ticketRewards: issuedLegacyTicketRewards(selected.wallet),
    })
  } catch (error) {
    if (legacyImportsDisabled(error)) return getAreaBackendWallet(playerId)
    throw error
  }
}
