import { randomUUID } from "node:crypto"

export const AREA_WALLET_COOKIE_NAME = "virya-area-wallet"
const YEAR_SECONDS = 60 * 60 * 24 * 365
const MAX_JSON_BYTES = 4096
const encoder = new TextEncoder()

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

export const areaJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })

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

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new Error("Request too large")
  }

  const raw = await request.text()
  if (encoder.encode(raw).byteLength > MAX_JSON_BYTES) {
    throw new Error("Request too large")
  }

  return JSON.parse(raw) as unknown
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
