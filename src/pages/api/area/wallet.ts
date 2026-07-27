import type { APIRoute } from "astro"
import {
  AREA_COLLECTION_SIZE,
  getPublicCollectible,
  getPublicLiveDrops,
} from "../../../server/areaCatalog"
import { getAreaActor } from "../../../server/areaActor"
import { getAreaWallet } from "../../../server/areaLedger"
import { areaJson } from "../../../server/areaHttp"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const actor = await getAreaActor(cookies)
    const wallet = await getAreaWallet(actor.actorId)

    return areaJson({
      authenticated: actor.authenticated,
      tokenBalance: wallet.tokenBalance,
      rewardCredits: wallet.tokenBalance,
      reward: {
        creditsPerCode: 1,
        benefit: "free-item-and-shipping",
      },
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
        .filter((reward) =>
          ["issued", "reserved", "redeemed"].includes(reward.status),
        )
        .map(
          ({
            code,
            tokens,
            benefit,
            createdAt,
            expiresAt,
            status,
            freeProductId,
            freeProductLabel,
            redeemedAt,
          }) => ({
            code,
            tokens,
            benefit,
            createdAt,
            expiresAt,
            status,
            freeProductId,
            freeProductLabel,
            redeemedAt,
          }),
        ),
      liveDrops: getPublicLiveDrops(),
    })
  } catch (error) {
    console.error("[area-wallet]", error)
    return areaJson({ error: "Wallet temporarily unavailable" }, 503)
  }
}
