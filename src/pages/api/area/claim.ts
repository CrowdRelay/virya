import type { APIRoute } from "astro"
import { getAreaMutationActor } from "../../../server/areaActor"
import {
  claimAreaBackendDrop,
  CrowdRelayAreaError,
  proxyMobileArea,
} from "../../../server/crowdrelayArea"
import { areaJson, readSmallJsonObject } from "../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson(
      { error: "Invalid claim data", code: "INVALID_REQUEST" },
      400,
    )
  }

  try {
    if (request.headers.has("authorization")) {
      return areaJson(
        await proxyMobileArea(request, "me/area/claim", "POST", body),
      )
    }

    const actor = await getAreaMutationActor(request, cookies)
    if (!actor) return areaJson({ error: "Invalid request origin" }, 403)
    if (!actor.authenticated) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }
    if (!actor.backendPlayerId) {
      return areaJson(
        {
          error: "Sign in again to link your AREA profile.",
          code: "AUTH_REQUIRED",
        },
        401,
      )
    }
    return areaJson(await claimAreaBackendDrop(actor.backendPlayerId, body))
  } catch (error) {
    if (error instanceof CrowdRelayAreaError) {
      return areaJson(error.body, error.status)
    }
    console.error("[area-claim]", error)
    return areaJson(
      { error: "Claim temporarily unavailable", code: "TEMPORARY" },
      503,
    )
  }
}
