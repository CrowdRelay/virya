import { useState } from "preact/hooks"

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
      const response = await fetch(
        `/api/staff/admin/ops/operations/${encodeURIComponent(value)}`,
        { headers: { accept: "application/json" }, cache: "no-store" },
      )
      const body = (await response.json().catch(() => null)) as
        | OperationTimeline
        | { error?: string }
        | null
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Brak zdarzeń dla tego request ID."
            : body && "error" in body && body.error
              ? body.error
              : "Nie udało się pobrać osi operacji.",
        )
      }
      setTimeline(body as OperationTimeline)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się pobrać osi operacji.")
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
