export type StaffApiError = Error & {
  status?: number
  payload?: { error?: string }
  /** True when transport failed after the mutation may already have reached CrowdRelay. */
  ambiguous?: boolean
}

export type StaffApiOptions = {
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  idempotencyKey?: string
}

const DEFAULT_TIMEOUT_MS = 15_000
const PENDING_MUTATION_TTL_MS = 30 * 60_000
const PENDING_MUTATION_PREFIX = "virya.staff.pending-mutation."
const VALID_IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/

const canonicalMutationBody = (value: unknown): string => {
  if (value === undefined || value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("mutation body must contain finite numbers")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalMutationBody(item)).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .filter(key => record[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalMutationBody(record[key])}`)
      .join(",")}}`
  }
  throw new TypeError("mutation body contains unsupported data")
}

const mutationStorageKey = async (path: string, body: unknown): Promise<string | null> => {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const payload = new TextEncoder().encode(`${path}\n${canonicalMutationBody(body)}`)
    const digest = new Uint8Array(await subtle.digest("SHA-256", payload))
    const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")
    return `${PENDING_MUTATION_PREFIX}${hex}`
  } catch {
    return null
  }
}

type PendingMutation = { key: string; createdAt: number }

const pendingMutationKey = async (path: string, body: unknown): Promise<{ key: string; storageKey: string | null }> => {
  const storageKey = await mutationStorageKey(path, body)
  if (storageKey) {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PendingMutation>
        if (typeof parsed.key === "string"
          && VALID_IDEMPOTENCY_KEY.test(parsed.key)
          && typeof parsed.createdAt === "number"
          && Date.now() - parsed.createdAt <= PENDING_MUTATION_TTL_MS) {
          return { key: parsed.key, storageKey }
        }
        sessionStorage.removeItem(storageKey)
      }
      const key = `staff-op-${crypto.randomUUID()}`
      sessionStorage.setItem(storageKey, JSON.stringify({ key, createdAt: Date.now() } satisfies PendingMutation))
      return { key, storageKey }
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
  }
  return { key: `staff-op-${crypto.randomUUID()}`, storageKey: null }
}

const clearPendingMutation = (storageKey: string | null) => {
  if (!storageKey) return
  try { sessionStorage.removeItem(storageKey) } catch { /* best effort */ }
}

/**
 * Small browser boundary shared by staff tools. Feature modules still own
 * their timeout budgets and response models; this only centralizes transport
 * safety and error semantics.
 */
export const staffApi = async <T,>(
  path: string,
  options: StaffApiOptions = {},
): Promise<T> => {
  const controller = new AbortController()
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  const forwardAbort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) forwardAbort()
  else options.signal?.addEventListener("abort", forwardAbort, { once: true })

  let pendingStorageKey: string | null = null
  let clearPending = false
  try {
    const headers = new Headers({ Accept: "application/json" })
    if (options.body !== undefined) headers.set("Content-Type", "application/json")
    const method = options.method ?? "GET"
    if (method === "POST") {
      const explicit = options.idempotencyKey?.trim() ?? ""
      if (VALID_IDEMPOTENCY_KEY.test(explicit)) {
        headers.set("Idempotency-Key", explicit)
      } else {
        const pending = await pendingMutationKey(path, options.body ?? null)
        headers.set("Idempotency-Key", pending.key)
        pendingStorageKey = pending.storageKey
      }
    }
    const response = await fetch(path, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })

    // A concrete success or client-side rejection closes this operation. Network/5xx,
    // throttling and timeout outcomes remain ambiguous and reuse the same key on retry.
    clearPending = response.ok || (response.status < 500 && ![408, 425, 429].includes(response.status))
    if (response.status === 204) return undefined as T
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed") as StaffApiError
      error.status = response.status
      error.payload = payload
      error.ambiguous = response.status >= 500 || response.status === 408 || response.status === 425
      throw error
    }
    return payload
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("Request timed out") as StaffApiError
      timeoutError.status = 408
      timeoutError.ambiguous = true
      throw timeoutError
    }
    if (error && typeof error === "object" && "status" in error) throw error
    const networkError = new Error("Request outcome is unknown", { cause: error }) as StaffApiError
    networkError.status = 0
    networkError.ambiguous = true
    throw networkError
  } finally {
    if (clearPending) clearPendingMutation(pendingStorageKey)
    window.clearTimeout(timeout)
    options.signal?.removeEventListener("abort", forwardAbort)
  }
}
