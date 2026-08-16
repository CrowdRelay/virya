import { randomUUID } from "node:crypto"
import type { APIRoute } from "astro"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../../../server/areaHttp"
import { hasStaffQrSession } from "../../../../../server/staffQrAuth"
import {
  StaffQrUpstreamError,
  staffApiRequest,
} from "../../../../../server/staffQrApi"

export const prerender = false

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const statusFor = (error: unknown) =>
  error instanceof StaffQrUpstreamError &&
  [400, 401, 404, 409, 429, 503].includes(error.status)
    ? error.status
    : 502

export const POST: APIRoute = async ({ cookies, request }) => {
  if (!hasStaffQrSession(cookies))
    return areaJson({ error: "Unauthorized" }, 401)
  if (!isSameOriginRequest(request))
    return areaJson({ error: "Invalid request origin" }, 403)

  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }

  const operation = body.operation
  const clearDeadDeliveries = operation === "clear_dead_deliveries"
  const target = body.target
  const id = body.id

  if (
    !clearDeadDeliveries &&
    ((target !== "outbox" && target !== "delivery") ||
      typeof id !== "string" ||
      !UUID.test(id))
  ) {
    return areaJson({ error: "Invalid ops mutation" }, 400)
  }

  try {
    const path = clearDeadDeliveries
      ? "admin/ops/deliveries/dead/clear"
      : target === "outbox"
        ? `admin/ops/outbox/${id}/retry`
        : `admin/ops/deliveries/${id}/retry`
    const idempotencyKey = clearDeadDeliveries
      ? `virya-ops-clear-dead-deliveries-${randomUUID()}`
      : `virya-ops-${target}-${id}-${randomUUID()}`
    const result = await staffApiRequest(path, {
      method: "POST",
      timeoutMs: 8_000,
      idempotencyKey,
    })
    return areaJson(result)
  } catch (error) {
    console.error("[staff-admin-ops-mutation]", error)
    return areaJson(
      {
        error:
          error instanceof StaffQrUpstreamError && error.detail
            ? error.detail
            : clearDeadDeliveries
              ? "Clearing dead deliveries failed"
              : "Retry failed",
      },
      statusFor(error),
    )
  }
}
