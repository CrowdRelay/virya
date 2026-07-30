import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../server/areaHttp"
import { clearStaffQrSession } from "../../../../server/staffQrAuth"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  clearStaffQrSession(cookies)
  return areaJson({ ok: true })
}
