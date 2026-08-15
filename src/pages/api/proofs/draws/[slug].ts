import { readServerEnv } from "../../../../server/runtimeEnv.ts"
import { readLimitedJson } from "../../../../server/readLimitedJson.ts"
import type { APIRoute } from "astro"
import { areaJson } from "../../../../server/areaHttp"
import { resolvePublicDrawProof } from "../../../../data/drawProofs"

export const prerender = false
const MAX_RESPONSE_BYTES = 1024 * 1024
const SLUG = /^[a-z0-9][a-z0-9_-]{0,127}$/
const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug ?? ""
  if (!SLUG.test(slug)) return areaJson({ error: "Invalid draw" }, 400)
  const drawRef = resolvePublicDrawProof(slug)
  const configured = readServerEnv("PUBLIC_CROWDRELAY_API_URL", import.meta.env.PUBLIC_CROWDRELAY_API_URL)?.trim() || DEFAULT_BASE_URL
  const base = configured.endsWith("/") ? configured : `${configured}/`
  try {
    const response = await fetch(`${base}public/proofs/draws/${encodeURIComponent(drawRef.drawSlug)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    let payload: unknown
    try {
      payload = await readLimitedJson<unknown>(response, MAX_RESPONSE_BYTES)
    } catch {
      return areaJson({ error: "Invalid proof response" }, 502)
    }
    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": response.ok
          ? "public, max-age=30, s-maxage=60, stale-while-revalidate=300"
          : "no-store",
      },
    })
  } catch {
    return areaJson({ error: "Proof service unavailable" }, 503)
  }
}
