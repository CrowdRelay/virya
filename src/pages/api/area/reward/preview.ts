import type { APIRoute } from "astro"
import {
  AREA_REWARD_BENEFIT,
  previewAreaRewardCode,
} from "../../../../server/areaReward"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }
  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid request", code: "INVALID_REQUEST" }, 400)
  }

  try {
    const checkoutRequestId =
      typeof body.checkoutRequestId === "string" &&
      body.checkoutRequestId.length <= 64
        ? body.checkoutRequestId.toLowerCase()
        : undefined
    const result = await previewAreaRewardCode(
      body.code,
      checkoutRequestId,
    )
    if (!result.valid) {
      const status = result.reason === "busy" ? 409 : 422
      return areaJson(
        {
          error:
            result.reason === "busy"
              ? "This code is attached to another checkout. Try again later."
              : "This VIRYA Area code is invalid, expired or already used.",
          code: `REWARD_${result.reason.toUpperCase()}`,
        },
        status,
      )
    }
    return areaJson({
      ok: true,
      code: result.code,
      benefit: AREA_REWARD_BENEFIT,
      expiresAt: result.expiresAt,
      resumed: result.resumed,
    })
  } catch (error) {
    console.error("[area-reward-preview]", error)
    return areaJson({ error: "Reward validation unavailable" }, 503)
  }
}
