import { readServerEnv } from "./runtimeEnv.ts"
import { readLimitedJson } from "./readLimitedJson.ts"

// The attestation card is a shared-link read, same admission as the band
// listing: the token in the URL is the whole credential. Everything the page
// renders — the figures, the methods, the four verification flags — arrives
// already computed; the parser's only job is to refuse a shape it does not
// recognise rather than render a number it cannot stand behind.

const DEFAULT_BASE_URL = "https://signal-api.virya.music/v1/"
const ATTESTATION_RESPONSE_BYTES = 96 * 1024
const FETCH_TIMEOUT_MS = 2500

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DIGEST = /^[0-9a-f]{64}$/
const METRICS = new Set([
  "reachable_fans",
  "active_fans",
  "tickets_sold",
  "observed_attendance",
  "repeat_attenders",
  "connected_followers",
])

export type AttestationScope =
  | { kind: "everywhere" }
  | { kind: "city"; value: string }
  | { kind: "event"; value: string }

export type AttestedFigure = {
  metric: string
  scope: AttestationScope
  /** The reader-facing number as the issuer wrote it — "1,247" or
   *  "fewer than 10". The typed `value` is derived from it when it parses. */
  reads_as: string
  value: { kind: "exact"; value: number } | { kind: "fewer_than"; value: number } | null
  /** The metric's own account of how the number was produced. */
  method: string
  window_days: number
  observed_at: string
}

export type VerifiedAttestation = {
  act_name: string
  figures: AttestedFigure[]
  issued_at: string
  valid_until: string
  digest: string
  unedited: boolean
  issued_by_us: boolean
  current: boolean
  revoked: boolean
}

const unixToIso = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return new Date(value * 1000).toISOString()
}

export type AttestationState =
  | { kind: "ready"; card: VerifiedAttestation }
  | { kind: "not_found" }
  | { kind: "unavailable" }

function attestationApiBase(): URL {
  const configured =
    readServerEnv(
      "PUBLIC_CROWDRELAY_API_URL",
      import.meta.env.PUBLIC_CROWDRELAY_API_URL,
    )?.trim() || DEFAULT_BASE_URL
  const url = new URL(configured)
  const localHttp = import.meta.env.DEV && url.protocol === "http:"
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid CrowdRelay attestation API URL")
  }
  url.search = ""
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  return url
}

const boundedString = (value: unknown, max: number) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null

function parseScope(value: unknown): AttestationScope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const scope = value as Record<string, unknown>
  if (scope.kind === "everywhere") return { kind: "everywhere" }
  if (scope.kind === "city" || scope.kind === "event") {
    const name = boundedString(scope.value, 160)
    return name === null ? null : { kind: scope.kind, value: name }
  }
  return null
}

/** The wire value is the rendered sentence ("1,247", "fewer than 10"); the
 *  typed form is derived so the card can localize "fewer than". A shape that
 *  does not parse still renders — the sentence stands on its own. */
function deriveValue(
  readsAs: string,
): AttestedFigure["value"] {
  const fewer = /^fewer than (\d+)$/.exec(readsAs)
  if (fewer) return { kind: "fewer_than", value: Number(fewer[1]) }
  const digits = readsAs.replace(/,/g, "")
  if (/^\d+$/.test(digits)) {
    const n = Number(digits)
    if (Number.isSafeInteger(n) && n <= 9e15) return { kind: "exact", value: n }
  }
  return null
}

export function parseVerifiedAttestation(
  value: unknown,
): VerifiedAttestation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const actName = boundedString(raw.act, 160)
  const issuedAt = unixToIso(raw.issued_at)
  const validUntil = unixToIso(raw.valid_until)
  const digest = boundedString(raw.digest, 64)
  if (!actName || !issuedAt || !validUntil || !digest || !DIGEST.test(digest)) {
    return null
  }
  // A figure that does not parse is dropped, not fatal — one malformed row
  // must not take a document the reader can otherwise verify down with it.
  const figures: AttestedFigure[] = []
  if (Array.isArray(raw.figures)) {
    for (const item of raw.figures.slice(0, 40)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue
      const f = item as Record<string, unknown>
      const metric = boundedString(f.metric, 40)
      const scope = parseScope(f.scope)
      const readsAs = boundedString(f.reads_as, 60)
      const method = boundedString(f.method, 600) ?? ""
      const observedAt = unixToIso(f.observed_at)
      const windowDays = f.window_days
      if (
        !metric ||
        !METRICS.has(metric) ||
        !scope ||
        !readsAs ||
        observedAt === null ||
        typeof windowDays !== "number" ||
        !Number.isSafeInteger(windowDays) ||
        windowDays < 0
      ) {
        continue
      }
      figures.push({
        metric,
        scope,
        reads_as: readsAs,
        value: deriveValue(readsAs),
        method,
        window_days: windowDays,
        observed_at: observedAt,
      })
    }
  }
  const verification =
    raw.verification &&
    typeof raw.verification === "object" &&
    !Array.isArray(raw.verification)
      ? (raw.verification as Record<string, unknown>)
      : null
  if (!verification) return null
  const flag = (key: string) => verification[key] === true
  return {
    act_name: actName,
    figures,
    issued_at: issuedAt,
    valid_until: validUntil,
    digest,
    unedited: flag("unedited"),
    issued_by_us: flag("issued_by_us"),
    current: flag("current"),
    revoked: flag("revoked"),
  }
}

/**
 * Reads the attestation a share token names. A wrong, rotated or revoked-then-
 * deleted token is the same 404 upstream and the same `not_found` here —
 * a reader must not be able to tell "never existed" from "un-sent". A revoked
 * document still resolves, because upstream answers it with `revoked: true`
 * rather than silence.
 */
export async function readAttestation(
  token: string,
): Promise<AttestationState> {
  if (!UUID.test(token)) return { kind: "not_found" }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const url = new URL(
      `public/attestations/${token}`,
      attestationApiBase(),
    )
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
    if (response.status === 404) return { kind: "not_found" }
    if (!response.ok) return { kind: "unavailable" }
    const body = await readLimitedJson(response, ATTESTATION_RESPONSE_BYTES)
    const card = parseVerifiedAttestation(body)
    return card ? { kind: "ready", card } : { kind: "unavailable" }
  } catch {
    return { kind: "unavailable" }
  } finally {
    clearTimeout(timer)
  }
}
