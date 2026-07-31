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
  const configured = import.meta.env.PUBLIC_CROWDRELAY_API_URL
  const value =
    typeof configured === "string" && configured.trim()
      ? configured.trim()
      : DEFAULT_BASE_URL
  const url = new URL(value)
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Invalid CrowdRelay base URL")
  }
  url.hash = ""
  url.search = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const adminKey = () => {
  const value = import.meta.env.CROWDRELAY_ADMIN_API_KEY
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

const readLimitedJson = async <T>(response: Response): Promise<T> => {
  const declaredLength = Number(response.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_BYTES) {
    throw new StaffQrUpstreamError(502)
  }

  if (!response.body) {
    throw new StaffQrUpstreamError(502)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_UPSTREAM_BYTES) {
        await reader.cancel("CrowdRelay response too large")
        throw new StaffQrUpstreamError(502)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(merged)) as T
  } catch {
    throw new StaffQrUpstreamError(502)
  }
}

export const staffQrRequest = async <T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number; idempotencyKey?: string } = {},
): Promise<T> => {
  const key = adminKey()
  if (!key) throw new StaffQrUpstreamError(503)

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
    if (options.body !== undefined) headers.set("Content-Type", "application/json")
    if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey)

    const response = await fetch(new URL(path.replace(/^\/+/, ""), baseUrl()), {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) {
      let detail: string | null = null
      try {
        const problem = await readLimitedJson<Record<string, unknown>>(response)
        detail = safeProblemDetail(problem.detail) ?? safeProblemDetail(problem.title)
      } catch {
        // Preserve the upstream status even when its error body is absent or malformed.
      }
      throw new StaffQrUpstreamError(response.status, detail)
    }
    if (response.status === 204) return undefined as T

    return await readLimitedJson<T>(response)
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

export const staffApiDownload = async (path: string) => {
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
    const declared = Number(response.headers.get("content-length") ?? "0")
    if (Number.isFinite(declared) && declared > MAX_STAFF_DOWNLOAD_BYTES) {
      throw new StaffQrUpstreamError(502)
    }
    const body = new Uint8Array(await response.arrayBuffer())
    if (body.byteLength > MAX_STAFF_DOWNLOAD_BYTES) {
      throw new StaffQrUpstreamError(502)
    }
    return {
      body,
      contentType: response.headers.get("content-type") ?? "text/csv; charset=utf-8",
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
