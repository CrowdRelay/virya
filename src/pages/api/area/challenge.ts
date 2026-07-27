import type { APIRoute } from "astro"
import { getAreaDrop } from "../../../data/area"
import { getAreaActor } from "../../../server/areaActor"
import {
  AREA_CHALLENGE_MAX_SAMPLES,
  AREA_CHALLENGE_MIN_DURATION_MS,
  AREA_CHALLENGE_MIN_SAMPLES,
  issueAreaChallenge,
} from "../../../server/areaChallenge"
import { getCollectible, getLiveDrop } from "../../../server/areaCatalog"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJson,
} from "../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: any
  try {
    body = await readSmallJson(request)
  } catch {
    return areaJson({ error: "Invalid request", code: "INVALID_REQUEST" }, 400)
  }

  const dropId = typeof body?.dropId === "string" ? body.dropId : ""
  if (!getAreaDrop(dropId)) {
    return areaJson({ error: "Invalid drop", code: "INVALID_REQUEST" }, 400)
  }

  try {
    const actor = await getAreaActor(cookies)
    if (!actor.authenticated) {
      return areaJson(
        { error: "Player profile required", code: "AUTH_REQUIRED" },
        401,
      )
    }

    const liveDrop = getLiveDrop(dropId)
    if (!liveDrop || !getCollectible(dropId)) {
      return areaJson(
        { error: "This drop is not live.", code: "DROP_INACTIVE" },
        409,
      )
    }

    const challenge = issueAreaChallenge(dropId, actor.actorId)
    if (!challenge) {
      return areaJson(
        { error: "Area challenge is not configured", code: "TEMPORARY" },
        503,
      )
    }

    return areaJson({
      ok: true,
      challenge: challenge.token,
      issuedAt: challenge.issuedAt,
      expiresAt: challenge.expiresAt,
      minSamples: AREA_CHALLENGE_MIN_SAMPLES,
      maxSamples: AREA_CHALLENGE_MAX_SAMPLES,
      minDurationMs: AREA_CHALLENGE_MIN_DURATION_MS,
    })
  } catch (error) {
    console.error("[area-challenge]", error)
    return areaJson(
      { error: "Challenge temporarily unavailable", code: "TEMPORARY" },
      503,
    )
  }
}
