import { createHash, randomUUID } from "node:crypto"

const KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/
const PREFIX = /^[a-z0-9][a-z0-9-]{1,47}$/

const canonical = (value: unknown): string => {
  if (value === null) return "null"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("mutation intent must contain finite numbers")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    return `{${entries.join(",")}}`
  }
  throw new TypeError("mutation intent contains unsupported data")
}

/**
 * Stable key for one operator intent. It deliberately excludes timing/request IDs:
 * losing an HTTP response and repeating the same validated intent must replay the
 * same upstream mutation rather than create a second side effect.
 */
export const stableMutationKey = (prefix: string, intent: unknown): string => {
  if (!PREFIX.test(prefix)) throw new TypeError("invalid mutation key prefix")
  const digest = createHash("sha256").update(canonical(intent)).digest("hex")
  return `${prefix}-${digest.slice(0, 48)}`
}

/** Forward a browser-owned operation key, or mint a fresh one for a direct caller. */
export const forwardedMutationKey = (request: Request, prefix: string): string => {
  if (!PREFIX.test(prefix)) throw new TypeError("invalid mutation key prefix")
  const supplied = request.headers.get("idempotency-key")?.trim() ?? ""
  return KEY.test(supplied) ? supplied : `${prefix}-${randomUUID()}`
}

/** Same-origin authenticated callers may preserve their intent key across a retry. */
export const mutationKeyForRequest = (request: Request, prefix: string, intent: unknown): string => {
  const supplied = request.headers.get("idempotency-key")?.trim() ?? ""
  return KEY.test(supplied) ? supplied : stableMutationKey(prefix, intent)
}
