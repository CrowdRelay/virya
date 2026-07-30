import type { APIRoute } from "astro"
import { getAreaDrop } from "../../../data/area"
import { recordAreaEvent } from "../../../server/areaEvents"
import {
  areaJson,
  isSameOriginRequest,
  readSmallJsonObject,
} from "../../../server/areaHttp"

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOriginRequest(request)) {
    return areaJson({ error: "Invalid request origin" }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await readSmallJsonObject(request)
  } catch {
    return areaJson({ error: "Invalid event" }, 400)
  }

  const event = body.event
  const lang = body.lang === "pl" ? "pl" : body.lang === "en" ? "en" : null
  const path = typeof body.path === "string" ? body.path : ""
  const dropId = typeof body.dropId === "string" ? body.dropId : undefined
  if (
    (event !== "page_view" && event !== "share") ||
    !lang ||
    !["/area/", "/pl/area/", "/area", "/pl/area"].includes(path) ||
    (dropId !== undefined && !getAreaDrop(dropId))
  ) {
    return areaJson({ error: "Invalid event" }, 400)
  }

  try {
    await recordAreaEvent({ event, lang, dropId })
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[area-events]", error)
    // Telemetry is deliberately non-critical to the player flow.
    return new Response(null, { status: 202 })
  }
}
