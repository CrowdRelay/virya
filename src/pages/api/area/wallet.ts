import type { APIRoute } from "astro"
import { AREA_DROPS } from "../../../data/area"
import {
  AREA_COLLECTION_SIZE,
  getPublicCollectible,
  getPublicLiveDrops,
} from "../../../server/areaCatalog"
import { getAreaLiveDropConfigState } from "../../../server/areaLiveDrops"
import { getAreaReadActor } from "../../../server/areaActor"
import {
  getAreaCommunityProgress,
  getAreaWallet,
} from "../../../server/areaLedger"
import { areaJson } from "../../../server/areaHttp"

export const prerender = false

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const actor = await getAreaReadActor(request, cookies)
    if (!actor) return areaJson({ error: "Unauthorized" }, 401)
    const [wallet, community, browserWallet] = await Promise.all([
      getAreaWallet(actor.actorId),
      getAreaCommunityProgress(AREA_DROPS.map(drop => drop.id)),
      actor.authenticated && actor.browserWalletId !== actor.actorId
        ? getAreaWallet(actor.browserWalletId)
        : Promise.resolve(null),
    ])
    const browserWalletTarget =
      browserWallet?.migration?.targetWalletId ?? browserWallet?.migratedTo
    const migrationRequired = Boolean(
      actor.authenticated &&
      browserWallet &&
      !browserWallet.migratedTo &&
      (!browserWalletTarget || browserWalletTarget === actor.actorId) &&
      (browserWallet.tokenBalance > 0 ||
        browserWallet.claims.length > 0 ||
        browserWallet.vouchers.length > 0),
    )

    return areaJson({
      authenticated: actor.authenticated,
      profile: actor.authenticated
        ? { emailMasked: actor.emailMasked ?? "" }
        : null,
      migrationRequired,
      tokenBalance: wallet.tokenBalance,
      rewardCredits: wallet.tokenBalance,
      reward: {
        creditsPerCode: 1,
        benefit: "free-item-and-shipping",
      },
      collectionSize: AREA_COLLECTION_SIZE,
      community,
      claims: wallet.claims
        .map(claim => {
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
        .filter(reward =>
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
      // Public live state intentionally contains IDs only. Exact coordinates,
      // radius and capacity never leave the server.
      liveDrops: getPublicLiveDrops(),
      liveState:
        getAreaLiveDropConfigState() === "ready" ? "ready" : "unavailable",
    })
  } catch (error) {
    console.error("[area-wallet]", error)
    return areaJson({ error: "Wallet temporarily unavailable" }, 503)
  }
}
