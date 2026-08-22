import { randomUUID } from "node:crypto"
import { readLimitedText } from "./readLimitedBody.ts"

export const AREA_WALLET_COOKIE_NAME = "virya-area-wallet"
const YEAR_SECONDS = 60 * 60 * 24 * 365
const MAX_JSON_BYTES = 4096

export type AreaCookieJar = {
  get(name: string): { value: string } | undefined
  set(name: string, value: string, options: Record<string, unknown>): void
  delete?(name: string, options?: Record<string, unknown>): void
}

const validWalletId = (value: string | undefined) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const getAreaWalletId = (cookies: AreaCookieJar) => {
  const current = cookies.get(AREA_WALLET_COOKIE_NAME)?.value
  const id = validWalletId(current) ? current as string : randomUUID()
  cookies.set(AREA_WALLET_COOKIE_NAME, id, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "strict",
    maxAge: YEAR_SECONDS,
  })
  return id
}

export const areaJson = (body: unknown, status = 200, serverTiming?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(serverTiming ? { "Server-Timing": serverTiming } : {}),
    },
  })

/**
 * Split a route's wall time into the part spent waiting on CrowdRelay and the
 * part spent in this function, so "the staff panel is slow" is answerable from
 * DevTools instead of from guesswork. CrowdRelay already reports its own
 * `app;dur=` on every response; this is the hop in front of it.
 */
export const upstreamTiming = (startedAt: number, upstreamMs: number) =>
  `upstream;dur=${Math.round(upstreamMs)}, bff;dur=${Math.round(performance.now() - startedAt - upstreamMs)}`

export const isSameOriginRequest = (request: Request) => {
  const origin = request.headers.get("origin")
  return origin === new URL(request.url).origin
}

export const readSmallJson = async (request: Request) => {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== "application/json") {
    throw new Error("Unsupported content type")
  }

  const rawBody = await readLimitedText(request, MAX_JSON_BYTES)
  if (!rawBody) throw new Error("Empty request body")
  return JSON.parse(rawBody) as unknown
}

export const readSmallJsonObject = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  const value = await readSmallJson(request)
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON object required")
  }
  return value as Record<string, unknown>
}
