import type { APIRoute } from "astro"
import type { PublicEvent } from "../../../../lib/crowdrelay-client"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../server/staffQrAuth"
import { publicCrowdRelayRequest } from "../../../../server/staffQrApi"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) => {
  if (!hasStaffQrSession(cookies)) {
    return areaJson({ error: "Unauthorized" }, 401)
  }
  try {
    const result = await publicCrowdRelayRequest<{ events: PublicEvent[] }>(
      "public/events?limit=100",
    )
    return areaJson({ events: result.events })
  } catch (error) {
    console.error("[staff-qr-events]", error)
    return areaJson({ error: "Events temporarily unavailable" }, 502)
  }
}
