import { useState } from "preact/hooks"
import { staffApi, type StaffApiError } from "./staffApi"

type OperationEvent = {
  occurred_at: string
  source: "audit" | "outbox" | "delivery" | "operator"
  kind: string
  status: string | null
  target_type: string | null
  target_id: string | null
}

type OperationTimeline = {
  request_id: string
  events: OperationEvent[]
}


const OPERATION_SOURCES = new Set<OperationEvent["source"]>(["audit", "outbox", "delivery", "operator"])

const boundedOptionalString = (value: unknown, max: number): string | null | undefined => {
  if (value === null) return null
  if (typeof value !== "string" || value.length > max) return undefined
  return value
}

const parseTimeline = (value: unknown): OperationTimeline | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.request_id !== "string" || !record.request_id || record.request_id.length > 128) return null
  if (!Array.isArray(record.events) || record.events.length > 500) return null
  const events: OperationEvent[] = []
  for (const candidate of record.events) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null
    const item = candidate as Record<string, unknown>
    const occurredAt = typeof item.occurred_at === "string" && item.occurred_at.length <= 64 && !Number.isNaN(Date.parse(item.occurred_at))
      ? item.occurred_at
      : null
    const source = typeof item.source === "string" && OPERATION_SOURCES.has(item.source as OperationEvent["source"])
      ? item.source as OperationEvent["source"]
      : null
    const kind = typeof item.kind === "string" && item.kind.length > 0 && item.kind.length <= 160 ? item.kind : null
    const status = boundedOptionalString(item.status, 96)
    const targetType = boundedOptionalString(item.target_type, 96)
    const targetId = boundedOptionalString(item.target_id, 160)
    if (!occurredAt || !source || !kind || status === undefined || targetType === undefined || targetId === undefined) return null
    events.push({ occurred_at: occurredAt, source, kind, status, target_type: targetType, target_id: targetId })
  }
  return { request_id: record.request_id, events }
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pl-PL")
}

const sourceLabel: Record<OperationEvent["source"], string> = {
  audit: "AUDYT",
  outbox: "OUTBOX",
  delivery: "WEBHOOK",
  operator: "OPERATOR",
}

export default function OpsTimelinePanel() {
  const [requestId, setRequestId] = useState("")
  const [timeline, setTimeline] = useState<OperationTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function inspect(event: SubmitEvent) {
    event.preventDefault()
    const value = requestId.trim()
    if (!value || loading) return
    setLoading(true)
    setMessage("")
    setTimeline(null)
    try {
      const payload = await staffApi<unknown>(
        `/api/staff/admin/ops/operations/${encodeURIComponent(value)}`,
        { timeoutMs: 10_000 },
      )
      const parsed = parseTimeline(payload)
      if (!parsed) throw new Error("Nieprawidłowa odpowiedź osi operacji.")
      setTimeline(parsed)
    } catch (error) {
      const status = (error as StaffApiError | null)?.status
      setMessage(status === 404
        ? "Brak zdarzeń dla tego request ID."
        : error instanceof Error ? error.message : "Nie udało się pobrać osi operacji.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
      <div>
        <h3 class="text-lg font-black text-white">Oś operacji</h3>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
          Wklej <code class="text-zinc-300">x-request-id</code>, aby prześledzić audyt,
          outbox, webhooki i ręczne retry. Backend zwraca wyłącznie metadane — bez
          payloadów, maili, URL-i i sekretów.
        </p>
      </div>
      <form onSubmit={inspect} class="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={requestId}
          onInput={event => setRequestId(event.currentTarget.value)}
          maxLength={128}
          autocomplete="off"
          spellcheck={false}
          placeholder="x-request-id"
          class="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-sm text-white outline-none focus:border-cyan-300/60"
        />
        <button
          type="submit"
          disabled={!requestId.trim() || loading}
          class="min-h-11 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-2 text-sm font-black text-cyan-100 disabled:opacity-40"
        >
          {loading ? "Szukam…" : "Pokaż przebieg"}
        </button>
      </form>
      {message && <p role="status" class="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{message}</p>}
      {timeline && (
        <div class="mt-5 grid gap-2">
          <p class="break-all font-mono text-xs text-zinc-500">{timeline.request_id}</p>
          {timeline.events.map((item, index) => (
            <article key={`${item.source}-${item.target_id ?? index}-${index}`} class="grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <div>
                <span class="text-xs font-black tracking-wider text-cyan-200">{sourceLabel[item.source]}</span>
                <p class="mt-1 text-xs text-zinc-600">{formatTimestamp(item.occurred_at)}</p>
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <strong class="break-words text-sm text-white">{item.kind}</strong>
                  {item.status && <span class="rounded-full border border-white/10 px-2 py-0.5 text-xs font-bold text-zinc-300">{item.status}</span>}
                </div>
                {(item.target_type || item.target_id) && <p class="mt-1 break-all font-mono text-xs text-zinc-600">{[item.target_type, item.target_id].filter(Boolean).join(" · ")}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
