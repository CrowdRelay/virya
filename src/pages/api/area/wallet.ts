import type { APIRoute } from "astro"
import { getAreaReadActor } from "../../../server/areaActor"
import {
  CrowdRelayAreaError,
  getAreaBackendWallet,
  getPublicAreaSnapshot,
  importLegacyAreaClaims,
  proxyMobileArea,
} from "../../../server/crowdrelayArea"
import { syncBackendClaimsToLegacyWallet } from "../../../server/areaLegacySync"
import { getAreaWallet } from "../../../server/areaLedger"
import { areaJson } from "../../../server/areaHttp"

export const prerender = false

const serializeVouchers = (wallet: Awaited<ReturnType<typeof getAreaWallet>>) =>
  wallet.vouchers
    .filter(reward => ["issued", "reserved", "redeemed"].includes(reward.status))
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
    )

const anonymousWallet = async (authenticated: boolean, emailMasked = "") => {
  const snapshot = await getPublicAreaSnapshot()
  const liveDrops = snapshot.items
    .filter(drop => drop.active && !drop.full)
    .map(drop => ({ id: drop.id }))
  return {
    authenticated,
    profile: authenticated ? { emailMasked } : null,
    migrationRequired: false,
    backendLinkRequired: authenticated,
    tokenBalance: 0,
    rewardCredits: 0,
    reward: { creditsPerCode: 1, benefit: "free-item-and-shipping" },
    collectionSize: snapshot.items.length,
    community: snapshot.community,
    claims: [],
    vouchers: [],
    liveDrops,
    drops: snapshot.items,
  }
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Compatibility bridge for installed app versions that still call virya.music.
    // Current Virya Signal talks to CrowdRelay directly.
    if (request.headers.has("authorization")) {
      return areaJson(await proxyMobileArea(request, "me/area", "GET"))
    }

    const actor = await getAreaReadActor(request, cookies)
    if (!actor) return areaJson(await anonymousWallet(false))
    if (!actor.authenticated || !actor.backendPlayerId) {
      return areaJson(
        await anonymousWallet(
          actor.authenticated,
          actor.authenticated ? actor.emailMasked ?? "" : "",
        ),
      )
    }

    const legacy = await getAreaWallet(actor.actorId)
    let backend = await getAreaBackendWallet(actor.backendPlayerId)
    const backendDropIds = new Set(backend.claims.map(claim => claim.dropId))
    const missingLegacyClaims = legacy.claims
      .filter(claim => !backendDropIds.has(claim.dropId))
      .map(claim => ({
        dropId: claim.dropId,
        claimedAt: claim.claimedAt,
        editionNumber: claim.editionNumber,
      }))
    if (missingLegacyClaims.length > 0) {
      backend = await importLegacyAreaClaims(
        actor.backendPlayerId,
        missingLegacyClaims,
      )
    }

    const synchronized = await syncBackendClaimsToLegacyWallet(
      actor.actorId,
      backend.claims,
    )
    return areaJson({
      ...backend,
      profile: { emailMasked: actor.emailMasked ?? "" },
      // Reward spending remains in the existing Netlify ledger during migration.
      tokenBalance: synchronized.tokenBalance,
      rewardCredits: synchronized.tokenBalance,
      vouchers: serializeVouchers(synchronized),
    })
  } catch (error) {
    if (error instanceof CrowdRelayAreaError) {
      return areaJson(error.body, error.status)
    }
    console.error("[area-wallet]", error)
    return areaJson(
      { error: "Wallet temporarily unavailable", code: "TEMPORARY" },
      503,
    )
  }
}
