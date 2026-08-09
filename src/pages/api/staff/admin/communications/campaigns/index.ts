import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest, readSmallJson } from "../../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../../server/staffQrAuth"
import { staffApiRequest } from "../../../../../../server/staffQrApi"
import { staffAudienceStatus } from "../../../../../../server/staffAudienceProxy"

export const prerender = false
export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  try { return areaJson(await staffApiRequest("admin/communications/campaigns", { timeoutMs: 6_000 })) }
  catch (error) { return areaJson({ error: "Campaigns unavailable" }, staffAudienceStatus(error)) }
}
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) return areaJson({ error: "Invalid request origin" }, 403)
  if (!hasStaffQrSession(cookies)) return areaJson({ error: "Unauthorized" }, 401)
  let body: unknown
  try { body = await readSmallJson(request) } catch { return areaJson({ error: "Invalid request" }, 400) }
  try { return areaJson(await staffApiRequest("admin/communications/campaigns", { method: "POST", body }), 201) }
  catch (error) { return areaJson({ error: "Could not create campaign" }, staffAudienceStatus(error)) }
}
