import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../../server/staffQrApi"
import { isSlug, staffAudienceStatus } from "../../../../../../../server/staffAudienceProxy"

export const prerender = false
export const GET: APIRoute = async ({ request, cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const slug = (params.slug ?? "").trim().toLowerCase()
  if (!isSlug(slug)) return areaJson({ error: "Invalid segment slug" }, 400)
  const requested = Number(new URL(request.url).searchParams.get("limit") ?? 20) || 20
  const limit = Math.min(100, Math.max(1, requested))
  try { return areaJson(await staffApiRequest(`admin/audience/segments/${encodeURIComponent(slug)}/preview?limit=${limit}`, { timeoutMs: 8_000 })) }
  catch (error) { return areaJson({ error: "Segment preview unavailable" }, staffAudienceStatus(error)) }
}
