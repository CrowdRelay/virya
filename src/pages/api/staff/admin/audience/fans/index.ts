import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../../server/staffQrApi"
import { isSlug, staffAudienceStatus } from "../../../../../../server/staffAudienceProxy"
import type { AudienceFanCard } from "../../../../../../types/audience"

export const prerender = false
export const GET: APIRoute = async ({ request, cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const url = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50))
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 160)
  const city = (url.searchParams.get("city_slug") ?? "").trim().toLowerCase()
  if (city && !isSlug(city)) return areaJson({ error: "Invalid city slug" }, 400)
  const query = new URLSearchParams({ limit: String(limit) })
  if (search) query.set("search", search)
  if (city) query.set("city_slug", city)
  try {
    return areaJson(await staffApiRequest<AudienceFanCard[]>(`admin/audience/fans?${query}`, { timeoutMs: 8_000 }))
  } catch (error) {
    if (!(error instanceof StaffQrUpstreamError)) console.error("[staff-audience-fans]", error)
    return areaJson({ error: "Audience fans unavailable" }, staffAudienceStatus(error))
  }
}
