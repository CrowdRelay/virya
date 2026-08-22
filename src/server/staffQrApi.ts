import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"
import { readLimitedBytes } from "./readLimitedBody.ts"
const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const MAX_UPSTREAM_BYTES = 256 * 1024

export type StaffQrEvent = {
  id: string
  slug: string
  title: string
  venue: string | null
  starts_at: string
}

export type StaffQrOverview = {
  events: StaffQrEvent[]
  campaigns: StaffQrCampaign[]
}

export type StaffQrCampaign = {
  id: string
  event_id: string
  event_slug: string
  event_title: string
  venue: string | null
  starts_at: string
  label: string
  valid_from: string
  valid_until: string
  max_checkins: number | null
  checkin_count: number
  active: boolean
  revoked_at: string | null
  created_at: string
  token: string | null
}

const baseUrl = () => {
  const configured = readServerEnv(
    "PUBLIC_CROWDRELAY_API_URL",
    import.meta.env.PUBLIC_CROWDRELAY_API_URL,
  )
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_BASE_URL
  const url = new URL(value)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.hash = ""
  url.search = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const adminKey = () => {
  const value = readServerEnv(
    "CROWDRELAY_ADMIN_API_KEY",
    import.meta.env.CROWDRELAY_ADMIN_API_KEY,
  )
  return typeof value === "string" && value.length >= 24 && value.length <= 512
    ? value
    : null
}

export const isStaffQrApiConfigured = () => adminKey() !== null

export class StaffQrUpstreamError extends Error {
  readonly status: number
  readonly detail: string | null

  constructor(status: number, detail: string | null = null) {
    super(detail ?? `CrowdRelay returned ${status}`)
    this.name = "StaffQrUpstreamError"
    this.status = status
    this.detail = detail
  }
}

const safeProblemDetail = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const detail = value.trim()
  return detail && detail.length <= 300 && !/[\u0000-\u001f\u007f]/.test(detail)
    ? detail
    : null
}

// Public reads that back a staff screen change on the order of minutes and are
// fetched again on every panel load. A warm function container can answer them
// without another CrowdRelay round trip; a cold one pays for it once. Opt-in
// per call site and GET only — admin read models are never served from here.
const MAX_CACHED_READS = 16
const readCache = new Map<string, { expiresAt: number; value: unknown }>()

const cachedRead = <T>(path: string): T | undefined => {
  const entry = readCache.get(path)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    readCache.delete(path)
    return undefined
  }
  return entry.value as T
}

const rememberRead = (path: string, value: unknown, ttlMs: number) => {
  if (readCache.size >= MAX_CACHED_READS) {
    const oldest = readCache.keys().next()
    if (!oldest.done) readCache.delete(oldest.value)
  }
  readCache.set(path, { expiresAt: Date.now() + ttlMs, value })
}

export const staffQrRequest = async <T>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: unknown
    timeoutMs?: number
    idempotencyKey?: string
    correlationId?: string
    /** Serve this GET from the in-process cache for up to this many ms. */
    cacheMs?: number
  } = {},
): Promise<T> => {
  const key = adminKey()
  if (!key) throw new StaffQrUpstreamError(503)
  const cacheable =
    (options.method ?? "GET") === "GET" && options.body === undefined && (options.cacheMs ?? 0) > 0
  if (cacheable) {
    const hit = cachedRead<T>(path)
    if (hit !== undefined) return hit
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 7_000,
  )

  try {
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
    })
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json")
    const method = options.method ?? "GET"
    const idempotencyKey = options.idempotencyKey
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey)
    headers.set(
      "X-CrowdRelay-Correlation-Id",
      options.correlationId ?? crypto.randomUUID(),
    )

    const response = await fetch(new URL(path.replace(/^\/+/, ""), baseUrl()), {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail: string | null = null
      try {
        const problem = await readLimitedJson<Record<string, unknown>>(
          response,
          MAX_UPSTREAM_BYTES,
          () => new StaffQrUpstreamError(response.status),
        )
        detail =
          safeProblemDetail(problem.detail) ?? safeProblemDetail(problem.title)
      } catch {
        // Preserve the upstream status even when its error body is absent or malformed.
      }
      throw new StaffQrUpstreamError(response.status, detail)
    }
    if (response.status === 204) return undefined as T

    const value = await readLimitedJson<T>(
      response,
      MAX_UPSTREAM_BYTES,
      () => new StaffQrUpstreamError(502),
    )
    if (cacheable) rememberRead(path, value, options.cacheMs ?? 0)
    return value
  } catch (error) {
    if (error instanceof StaffQrUpstreamError) throw error
    throw new StaffQrUpstreamError(502)
  } finally {
    clearTimeout(timeout)
  }
}

const MAX_STAFF_DOWNLOAD_BYTES = 5 * 1024 * 1024

/** Generic alias used by the accounting panel; kept alongside the legacy QR name. */
export const staffApiRequest = staffQrRequest
export const isStaffApiConfigured = isStaffQrApiConfigured

export const staffApiDownload = async (
  path: string,
): Promise<{
  body: ArrayBuffer
  contentType: string
  contentDisposition: string
}> => {
  const key = adminKey()
  if (!key) throw new StaffQrUpstreamError(503)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(new URL(path.replace(/^\/+/, ""), baseUrl()), {
      headers: {
        Accept: "text/csv, application/octet-stream;q=0.9",
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) throw new StaffQrUpstreamError(response.status)
    const body = await readLimitedBytes(
      response,
      MAX_STAFF_DOWNLOAD_BYTES,
      () => new StaffQrUpstreamError(502),
    )
    const buffer = body.buffer.slice(
      body.byteOffset,
      body.byteOffset + body.byteLength,
    ) as ArrayBuffer
    return {
      body: buffer,
      contentType:
        response.headers.get("content-type") ?? "text/csv; charset=utf-8",
      contentDisposition:
        response.headers.get("content-disposition") ??
        'attachment; filename="ticket-sales.csv"',
    }
  } catch (error) {
    if (error instanceof StaffQrUpstreamError) throw error
    throw new StaffQrUpstreamError(502)
  } finally {
    clearTimeout(timeout)
  }
}
