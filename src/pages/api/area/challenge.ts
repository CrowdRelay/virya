import type { APIRoute } from "astro"
import { getAreaMutationActor } from "../../../server/areaActor"
import {
  CrowdRelayAreaError,
  issueAreaBackendChallenge,
  proxyMobileArea,
} from "../../../server/crowdrelayArea"
import { areaJson, readSmallJsonObject } from "../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request", code: "INVALID_REQUEST" }, 400)
  }

  try {
    if (request.headers.has("authorization")) {
      return areaJson(
        await proxyMobileArea(request, "me/area/challenge", "POST", body),
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
    const dropId = typeof body.dropId === "string" ? body.dropId : ""
    return areaJson(await issueAreaBackendChallenge(actor.backendPlayerId, dropId))
  } catch (error) {
    if (error instanceof CrowdRelayAreaError) {
      return areaJson(error.body, error.status)
    }
    console.error("[area-challenge]", error)
    return areaJson(
      { error: "Challenge temporarily unavailable", code: "TEMPORARY" },
      503,
    )
  }
}
