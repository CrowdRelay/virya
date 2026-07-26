import type { APIRoute } from "astro"
import { AREA_COLLECTION_SIZE, getPublicCollectible, getPublicLiveDrops } from "../../../server/areaCatalog"
import { getAreaWallet } from "../../../server/areaLedger"
import { areaJson, getAreaWalletId } from "../../../server/areaHttp"
import { AREA_TOKEN_VALUE_PLN } from "../../../data/area"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const walletId = getAreaWalletId(cookies)
    const wallet = await getAreaWallet(walletId)

    return areaJson({
      tokenBalance: wallet.tokenBalance,
      tokenValuePln: AREA_TOKEN_VALUE_PLN,
      collectionSize: AREA_COLLECTION_SIZE,
      claims: wallet.claims
        .map((claim) => {
          const collectible = getPublicCollectible(claim.dropId)
          return collectible
            ? {
                ...collectible,
                claimedAt: claim.claimedAt,
                editionNumber: claim.editionNumber,
              }
            : null
        })
        .filter(Boolean),
      vouchers: wallet.vouchers
        .filter((voucher) => voucher.status === "issued")
        .map(({ code, tokens, valuePln, minimumOrderPln, createdAt, expiresAt }) => ({
          code,
          tokens,
          valuePln,
          minimumOrderPln,
          createdAt,
          expiresAt,
        })),
      liveDrops: getPublicLiveDrops(),
    })
  } catch (error) {
    console.error("[area-wallet]", error)
    return areaJson({ error: "Wallet temporarily unavailable" }, 503)
  }
}
