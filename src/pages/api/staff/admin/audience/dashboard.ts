import type { APIRoute } from "astro"
import { areaJson } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../server/staffQrApi"
import type {
  AudienceDashboard,
  AudienceOverview,
  AudienceSegment,
  CommunicationCampaign,
  FunnelRow,
  RevenueRow,
} from "../../../../../types/audience"

export const prerender = false

type DashboardSource = "overview" | "segments" | "campaigns" | "funnel" | "revenue" | "flags"

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const results = await Promise.allSettled([
    staffApiRequest<AudienceOverview>("admin/audience/overview", { timeoutMs: 6_000 }),
    staffApiRequest<AudienceSegment[]>("admin/audience/segments", { timeoutMs: 6_000 }),
    staffApiRequest<CommunicationCampaign[]>("admin/communications/campaigns", { timeoutMs: 6_000 }),
    staffApiRequest<FunnelRow[]>("admin/analytics/funnel", { timeoutMs: 8_000 }),
    staffApiRequest<RevenueRow[]>("admin/analytics/revenue", { timeoutMs: 8_000 }),
    staffApiRequest<Array<{ key: string; enabled: boolean }>>("admin/ecosystem/flags", { timeoutMs: 5_000 }),
  ] as const)
  const names: DashboardSource[] = ["overview", "segments", "campaigns", "funnel", "revenue", "flags"]
  const unavailable = results.flatMap((result, index) =>
    result.status === "rejected" ? [names[index]] : [],
  )
  if (unavailable.length === results.length) {
    console.warn("[staff-audience-dashboard] all CrowdRelay sources unavailable")
    return areaJson({ error: "Audience Intelligence temporarily unavailable" }, 502)
  }
  const value = <T>(index: number, fallback: T): T => {
    const result = results[index]
    return result?.status === "fulfilled" ? (result.value as T) : fallback
  }
  const flags = value<Array<{ key: string; enabled: boolean }>>(5, [])
  const enabled = (key: string) => flags.find(flag => flag.key === key)?.enabled === true
  const dashboard: AudienceDashboard = {
    overview: value<AudienceOverview | null>(0, null),
    segments: value<AudienceSegment[]>(1, []),
    campaigns: value<CommunicationCampaign[]>(2, []),
    funnel: value<FunnelRow[]>(3, []),
    revenue: value<RevenueRow[]>(4, []),
    features: {
      communication_campaigns_enabled: enabled("communication_campaigns_enabled"),
      mailer_enabled: enabled("mailer_enabled"),
    },
    degraded: { active: unavailable.length > 0, unavailable },
    generated_at: new Date().toISOString(),
  }
  return areaJson(dashboard)
}
