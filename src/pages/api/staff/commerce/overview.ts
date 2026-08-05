import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
} from "../../../../server/staffQrApi"
import type { MerchCatalog } from "../../../../server/crowdrelayCommerce"

export const prerender = false

type Campaign = Record<string, unknown>
type Fulfillment = Record<string, unknown>
type Recommendation = Record<string, unknown>

const logFailure = (source: string, error: unknown) => {
  console.warn("[staff-commerce-overview] upstream unavailable", {
    source,
    status: error instanceof StaffQrUpstreamError ? error.status : undefined,
    kind: error instanceof Error ? error.name : typeof error,
  })
}

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)

  const requests = await Promise.allSettled([
    staffApiRequest<MerchCatalog>("admin/merch/catalog", { timeoutMs: 8_000 }),
    staffApiRequest<Campaign[]>("admin/reward-campaigns", { timeoutMs: 8_000 }),
    staffApiRequest<Fulfillment[]>("admin/reward-fulfillments", { timeoutMs: 8_000 }),
    staffApiRequest<Recommendation[]>("admin/merch/promotion-recommendations", { timeoutMs: 8_000 }),
  ] as const)
  const sources = ["catalog", "campaigns", "fulfillments", "recommendations"] as const
  const unavailable = requests.flatMap((result, index) => {
    if (result.status === "fulfilled") return []
    logFailure(sources[index] ?? "unknown", result.reason)
    return [sources[index]]
  })

  if (unavailable.length === sources.length) {
    return areaJson({ error: "Commerce panel temporarily unavailable" }, 503)
  }

  return areaJson({
    catalog: requests[0].status === "fulfilled" ? requests[0].value : { generated_at: null, products: [] },
    campaigns: requests[1].status === "fulfilled" ? requests[1].value : [],
    fulfillments: requests[2].status === "fulfilled" ? requests[2].value : [],
    recommendations: requests[3].status === "fulfilled" ? requests[3].value : [],
    degraded: { active: unavailable.length > 0, unavailable },
    generatedAt: new Date().toISOString(),
  })
}
