import type { APIRoute } from "astro"
import { THOMANN_HOME_URL, thomannAffiliateUrl } from "../../lib/thomann"

export const prerender = false

export const GET: APIRoute = () =>
  new Response(null, {
    status: 302,
    headers: {
      location: thomannAffiliateUrl(THOMANN_HOME_URL, "shop"),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  })
