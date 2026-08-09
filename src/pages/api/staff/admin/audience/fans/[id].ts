import type { APIRoute } from "astro"
import { areaJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../server/staffQrApi"
import { isUuid, staffAudienceStatus } from "../../../../../../server/staffAudienceProxy"
import type { AudienceFanDetail } from "../../../../../../types/audience"

export const prerender = false
export const GET: APIRoute = async ({ cookies, params }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id?.trim() ?? ""
  if (!isUuid(id)) return areaJson({ error: "Invalid fan id" }, 400)
  try {
    return areaJson(await staffApiRequest<AudienceFanDetail>(`admin/audience/fans/${encodeURIComponent(id)}`, { timeoutMs: 8_000 }))
  } catch (error) {
    return areaJson({ error: "Fan 360 unavailable" }, staffAudienceStatus(error))
  }
}
