import { randomUUID } from "node:crypto"
import type { APIRoute } from "astro"
import { areaJson, isSameOriginRequest } from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import { StaffQrUpstreamError, staffApiRequest } from "../../../../../server/staffQrApi"

export const prerender = false

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError &&
  [400, 401, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies))
    return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request))
    return areaJson({ error: "Invalid request origin" }, 403)

  try {
    const result = await staffApiRequest("admin/ops/deliveries/dead/clear", {
      method: "POST",
      timeoutMs: 8_000,
      idempotencyKey: `virya-ops-clear-dead-deliveries-${randomUUID()}`,
    })
    return areaJson(result)
  } catch (error) {
    console.error("[staff-admin-ops-clear-dead-deliveries]", error)
    return areaJson(
      {
        error:
          error instanceof StaffQrUpstreamError && error.detail
            ? error.detail
            : "Clearing dead deliveries failed",
      },
      statusFor(error),
    )
  }
}
