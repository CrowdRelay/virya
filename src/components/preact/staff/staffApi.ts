export type StaffApiError = Error & {
  status?: number
  payload?: { error?: string }
}

export type StaffApiOptions = {
  method?: "GET" | "POST"
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

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

  try {
    const headers = new Headers({ Accept: "application/json" })
    if (options.body !== undefined) headers.set("Content-Type", "application/json")
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })

    if (response.status === 204) return undefined as T
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed") as StaffApiError
      error.status = response.status
      error.payload = payload
      throw error
    }
    return payload
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("Request timed out") as StaffApiError
      timeoutError.status = 408
      throw timeoutError
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener("abort", forwardAbort)
  }
}
