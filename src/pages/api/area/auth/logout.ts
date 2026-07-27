import type { APIRoute } from "astro"
import { clearAreaSession } from "../../../../server/areaAuth"
import {
  areaJson,
  isSameOriginRequest,
} from "../../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  clearAreaSession(cookies)
  return areaJson({ ok: true })
}

