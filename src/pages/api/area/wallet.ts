import type { APIRoute } from "astro"
import { getAreaReadActor } from "../../../server/areaActor"
import {
  CrowdRelayAreaError,
  getPublicAreaSnapshot,
  proxyMobileArea,
} from "../../../server/crowdrelayArea"
import { ensureLegacyAreaImported } from "../../../server/areaMigration"
import { areaJson } from "../../../server/areaHttp"

export const prerender = false

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

    const backend = await ensureLegacyAreaImported(
      actor.backendPlayerId,
      actor.actorId,
      actor.browserWalletId,
    )
    return areaJson({
      ...backend,
      profile: { emailMasked: actor.emailMasked ?? "" },
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
