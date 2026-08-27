import type { APIRoute } from "astro"
import { getAreaActor } from "../../../server/areaActor"
import {
  CrowdRelayAreaError,
  createAreaBackendVoucher,
} from "../../../server/crowdrelayArea"
import { ensureLegacyAreaImported } from "../../../server/areaMigration"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../server/areaHttp"

export const prerender = false

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request" }, 400)
  }
  const tokens = Number(body.tokens ?? 1)
  const requestId =
    typeof body.requestId === "string" ? body.requestId.toLowerCase() : ""
  if (tokens !== 1 || !REQUEST_ID_PATTERN.test(requestId)) {
    return areaJson({ error: "Invalid reward request" }, 400)
  }

  try {
    const actor = await getAreaActor(cookies)
    if (!actor.authenticated || !actor.backendPlayerId) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }
    await ensureLegacyAreaImported(
      actor.backendPlayerId,
      actor.actorId,
      actor.browserWalletId,
    )
    const reward = await createAreaBackendVoucher(
      actor.backendPlayerId,
      requestId,
    )
    return areaJson({ ok: true, reward })
  } catch (error) {
    if (error instanceof CrowdRelayAreaError) {
      if (error.status === 409 && error.body.code === "INSUFFICIENT_CREDITS") {
        return areaJson(
          { error: "Not enough VIRYA Credits.", retryWithNewRequest: true },
          409,
        )
      }
      return areaJson(error.body, error.status)
    }
    console.error("[area-reward]", error)
    return areaJson(
      {
        error: "Could not finish the reward code. Retry the same request.",
        code: "VOUCHER_RETRY",
        retryWithNewRequest: false,
      },
      503,
    )
  }
}
