import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { hasStaffQrSession, isStaffQrConfigured } from "../../../../server/staffQrAuth"
import { isStaffQrApiConfigured } from "../../../../server/staffQrApi"

export const prerender = false

export const GET: APIRoute = async ({ cookies }) =>
  areaJson({
    authenticated: hasStaffQrSession(cookies),
    configured: isStaffQrConfigured() && isStaffQrApiConfigured(),
  })
