import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../../server/staffQrApi"
import { forwardedMutationKey } from "../../../../../../../server/mutationSafety"
import { isUuid, staffAudienceStatus } from "../../../../../../../server/staffAudienceProxy"

export const prerender = false
export const POST: APIRoute = async ({ request, cookies, params }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  const id = params.id?.trim() ?? ""
  if (!isUuid(id)) return areaJson({ error: "Invalid campaign id" }, 400)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  try { return areaJson(await staffApiRequest(`admin/communications/campaigns/${encodeURIComponent(id)}/schedule`, { method: "POST", idempotencyKey: forwardedMutationKey(request, "staff-post"), body })) }
  catch (error) { return areaJson({ error: "Could not schedule campaign" }, staffAudienceStatus(error)) }
}
