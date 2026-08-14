import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../../../../../server/mutationSafety"
import { isAudienceTag, isUuid, staffAudienceStatus } from "../../../../../../../../server/staffAudienceProxy"

export const prerender = false
export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id?.trim() ?? ""
  if (!isUuid(id)) return areaJson({ error: "Invalid fan id" }, 400)
  let body: { tag?: unknown }
  try { body = await readSmallJson(request) as { tag?: unknown } } catch { return areaJson({ error: "Invalid request" }, 400) }
  const tag = typeof body.tag === "string" ? body.tag.trim().toLowerCase() : ""
  if (!isAudienceTag(tag)) return areaJson({ error: "Invalid tag" }, 400)
  try {
    return areaJson(await staffApiRequest(`admin/audience/fans/${encodeURIComponent(id)}/tags`, { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body: { tag } }), 201)
  } catch (error) {
    return areaJson({ error: "Could not add tag" }, staffAudienceStatus(error))
  }
}
