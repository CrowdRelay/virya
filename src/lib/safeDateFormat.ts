const INVALID_DATE_FALLBACK = "—"

/**
 * Converts an untrusted API value into a valid Date without ever throwing.
 * Browser Date parsers return an Invalid Date for values such as null-ish,
 * empty strings and PostgreSQL's textual infinity values; Intl.format then
 * throws a RangeError. Keep that failure contained at the rendering boundary.
 */
export function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }

  if (typeof value !== "string" && typeof value !== "number") return null
  if (typeof value === "number" && !Number.isFinite(value)) return null

  const normalized = typeof value === "string" ? value.trim() : value
  if (normalized === "") return null

  const parsed = new Date(normalized)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export function safeFormatDate(
  value: unknown,
  formatter: Intl.DateTimeFormat,
  fallback = INVALID_DATE_FALLBACK,
): string {
  const parsed = finiteDate(value)
  if (!parsed) return fallback

  try {
    return formatter.format(parsed)
  } catch {
    // Invalid/unsupported values must degrade one cell, never crash the island.
    return fallback
  }
}
