import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../../../../server/staffQrApi"
import { isAudienceTag, isUuid, staffAudienceStatus } from "../../../../../../../../../server/staffAudienceProxy"

export const prerender = false
export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id?.trim() ?? ""
  const tag = (params.tag ?? "").trim().toLowerCase()
  if (!isUuid(id) || !isAudienceTag(tag)) return areaJson({ error: "Invalid tag request" }, 400)
  try {
    await staffApiRequest(`admin/audience/fans/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}/remove`, { method: "POST" })
    return new Response(null, { status: 204 })
  } catch (error) {
    return areaJson({ error: "Could not remove tag" }, staffAudienceStatus(error))
  }
}
