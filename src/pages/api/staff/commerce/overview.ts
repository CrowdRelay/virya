import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { StaffQrUpstreamError, isStaffApiConfigured, staffApiRequest } from "../../../../server/staffQrApi"
import type {
  InventoryActivation,
  InventoryOverview,
  MerchCatalog,
} from "../../../../server/crowdrelayCommerce"

export const prerender = false

type Campaign = Record<string, unknown>
type RewardDraw = Record<string, unknown>
type Fulfillment = Record<string, unknown>
type Recommendation = Record<string, unknown>
type BeaconReleaseOverview = Record<string, unknown>
type BeaconNetworkOverview = Record<string, unknown>

const logFailure = (source: string, error: unknown) => {
  console.warn("[staff-commerce-overview] upstream unavailable", {
    source,
    status: error instanceof StaffQrUpstreamError ? error.status : undefined,
    kind: error instanceof Error ? error.name : typeof error,
  })
}

const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T) =>
  result.status === "fulfilled" ? result.value : fallback

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized", configured: isStaffApiConfigured() }, 401)

  const [catalog, activation, inventory, campaigns, draws, fulfillments, recommendations, beaconReleases, beaconNetwork] =
    await Promise.allSettled([
      staffApiRequest<MerchCatalog>("admin/merch/catalog", { timeoutMs: 8_000 }),
      staffApiRequest<InventoryActivation>("admin/merch/inventory/activation", { timeoutMs: 8_000 }),
      staffApiRequest<InventoryOverview>("admin/merch/inventory/overview", { timeoutMs: 8_000 }),
      staffApiRequest<Campaign[]>("admin/reward-campaigns", { timeoutMs: 8_000 }),
      staffApiRequest<RewardDraw[]>("admin/reward-draws", { timeoutMs: 8_000 }),
      staffApiRequest<Fulfillment[]>("admin/reward-fulfillments", { timeoutMs: 8_000 }),
      staffApiRequest<Recommendation[]>("admin/merch/promotion-recommendations", { timeoutMs: 8_000 }),
      staffApiRequest<BeaconReleaseOverview>("admin/autopilot/beacon-release-campaigns", { timeoutMs: 8_000 }),
      staffApiRequest<BeaconNetworkOverview>("admin/autopilot/beacon-network", { timeoutMs: 8_000 }),
    ] as const)

  const entries = [
    ["catalog", catalog],
    ["activation", activation],
    ["inventory", inventory],
    ["campaigns", campaigns],
    ["draws", draws],
    ["fulfillments", fulfillments],
    ["recommendations", recommendations],
    ["beaconReleases", beaconReleases],
    ["beaconNetwork", beaconNetwork],
  ] as const
  const unavailable = entries.flatMap(([source, result]) => {
    if (result.status === "fulfilled") return []
    logFailure(source, result.reason)
    return [source]
  })

  if (catalog.status === "rejected" && activation.status === "rejected" && inventory.status === "rejected") {
    return areaJson({ error: "Commerce panel temporarily unavailable" }, 503)
  }

  return areaJson({
    catalog: valueOr(catalog, { generated_at: "", products: [] }),
    activation: valueOr(activation, null),
    inventory: valueOr(inventory, { generated_at: "", items: [] }),
    campaigns: valueOr(campaigns, []),
    draws: valueOr(draws, []),
    fulfillments: valueOr(fulfillments, []),
    recommendations: valueOr(recommendations, []),
    beaconReleases: valueOr(beaconReleases, { pool: { activeReleaseLatarnicy: 0, contactableLatarnicy: 0, missingEmail: 0 }, campaigns: [], recipients: [] }),
    beaconNetwork: valueOr(beaconNetwork, { discoveryRuns: [], pendingCandidates: [], approvedCandidates: [], inviteJobs: [] }),
    degraded: { active: unavailable.length > 0, unavailable },
    generatedAt: new Date().toISOString(),
  })
}
