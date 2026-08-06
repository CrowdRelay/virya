import {
  mutateAreaWallet,
  type AreaClaim,
  type AreaWallet,
} from "./areaLedger"
import type { BackendAreaWallet } from "./crowdrelayArea"

const asEditionNumber = (value: number | null | undefined) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined

/** Mirrors canonical backend claims into the transitional Netlify reward ledger.
 *
 * CrowdRelay owns discovery state. The existing wallet remains responsible for
 * voucher spending until reward issuance is migrated, so old deductions and
 * vouchers remain intact while every backend claim is credited exactly once.
 */
export const syncBackendClaimsToLegacyWallet = async (
  walletId: string,
  backendClaims: BackendAreaWallet["claims"],
): Promise<AreaWallet> =>
  mutateAreaWallet(walletId, wallet => {
    const known = new Set(wallet.claims.map(claim => claim.dropId))
    const additions: AreaClaim[] = []
    for (const claim of backendClaims) {
      if (known.has(claim.dropId)) continue
      known.add(claim.dropId)
      additions.push({
        dropId: claim.dropId,
        claimedAt: claim.claimedAt,
        distanceMeters: Math.max(0, Math.round(claim.distanceMeters)),
        editionNumber: asEditionNumber(claim.editionNumber),
      })
    }
    const next: AreaWallet = {
      ...wallet,
      claims: [...wallet.claims, ...additions].sort((left, right) =>
        left.claimedAt.localeCompare(right.claimedAt),
      ),
      tokenBalance: wallet.tokenBalance + additions.length,
    }
    return { wallet: next, result: next }
  })
