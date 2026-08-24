import { getStore } from "@netlify/blobs"
import type { Traction } from "./traction.ts"

// One snapshot per day, so a paid push (a Bandsintown boost, a release, a
// festival slot) can be judged against where the numbers actually stood when it
// started. Without this the answer to "did it work" is a guess.

const STORE_NAME = "virya-traction-history"
const MAX_DAYS = 400
const COMPARE_DAYS = 7

const METRICS = [
  "trackers",
  "upcomingEvents",
  "signalFans",
  "activeCities",
  "youtubeViews",
  "youtubeSubscribers",
] as const

export type TractionMetric = (typeof METRICS)[number]

export type TractionSnapshot = {
  version: 1
  day: string
} & Record<TractionMetric, number | null>

export type TractionDelta = Partial<Record<TractionMetric, number>>

const store = () => getStore({ name: STORE_NAME, consistency: "strong" })
const dayKey = (day: string) => `days/${day}`
// Warsaw's calendar day, not UTC: the snapshot boundary must match the day the
// operator actually lives in, or a 02:00 boost lands "yesterday".
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date())

const normalize = (value: unknown): TractionSnapshot | null => {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<TractionSnapshot>
  if (record.version !== 1 || typeof record.day !== "string") return null
  const snapshot = { version: 1 as const, day: record.day } as TractionSnapshot
  for (const metric of METRICS) {
    const raw = record[metric]
    snapshot[metric] = typeof raw === "number" && Number.isFinite(raw) ? raw : null
  }
  return snapshot
}

/**
 * Writes at most one snapshot per day and never overwrites one, so the series
 * records where a number stood that morning rather than its latest wobble.
 * Degraded reads are skipped outright — a half-failed collection would enter
 * the history as a fake drop. Never throws; history is not worth a 500.
 */
export const recordSnapshot = async (traction: Traction): Promise<void> => {
  if (traction.degraded) return
  const day = today()
  try {
    const blobs = store()
    if (await blobs.get(dayKey(day), { type: "json" })) return
    const snapshot = { version: 1 as const, day } as TractionSnapshot
    for (const metric of METRICS) {
      const value = traction[metric]
      snapshot[metric] = typeof value === "number" ? value : null
    }
    await blobs.setJSON(dayKey(day), snapshot, { onlyIfNew: true })
  } catch (error) {
    console.warn("[traction-history] snapshot skipped", error)
  }
}

/** Oldest first. Never throws; an unavailable store yields an empty series. */
export const readHistory = async (days = MAX_DAYS): Promise<TractionSnapshot[]> => {
  try {
    const { blobs } = await store().list({ prefix: "days/" })
    const keys = blobs
      .map(blob => blob.key)
      .sort()
      .slice(-Math.max(1, Math.min(days, MAX_DAYS)))
    const snapshots = await Promise.all(
      keys.map(key =>
        store()
          .get(key, { type: "json" })
          .then(normalize)
          .catch(() => null),
      ),
    )
    return snapshots.filter((snapshot): snapshot is TractionSnapshot => snapshot !== null)
  } catch (error) {
    console.warn("[traction-history] history unavailable", error)
    return []
  }
}

/**
 * Change against the snapshot closest to COMPARE_DAYS ago. Only metrics present
 * on both ends appear, so a newly added metric does not read as a huge jump.
 */
export const readDelta = async (
  current: Traction,
): Promise<{ since: string | null; change: TractionDelta }> => {
  const history = await readHistory(COMPARE_DAYS + 1)
  const baseline = history[0]
  if (!baseline || baseline.day === today()) return { since: null, change: {} }

  const change: TractionDelta = {}
  for (const metric of METRICS) {
    const before = baseline[metric]
    const now = current[metric]
    if (typeof before !== "number" || typeof now !== "number") continue
    change[metric] = now - before
  }
  return { since: baseline.day, change }
}
