import { useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import {
  date,
  humanAction,
  humanContext,
  type AutopilotFeed,
  type AutopilotOpportunity,
} from "./AutopilotHandoffs"

const REQUEST_TIMEOUT_MS = 10_000

type Opportunity = AutopilotOpportunity

// Kolejka "znajdź, potem zrób": agent odkrywa i parkuje, człowiek decyduje.
// „Zrób to” przechodzi przez istniejącą ścieżkę akceptacji CrowdRelay,
// a „zrobione sami” zapisuje, że człowiek załatwił to poza systemem — to
// pełnoprawny wynik, nie odrzucenie.
export default function OpportunityBoard({ feed }: { feed: AutopilotFeed }) {
  const [items, setItems] = useState<Opportunity[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState("")

  const overview = feed.overview
  const queue: Opportunity[] = items ?? (overview === null ? [] : overview.opportunities ?? [])
  const awaiting = queue.filter(item => item.authority === "awaiting_approval").length

  async function decide(item: Opportunity, operation: "do" | "done") {
    const key = `${operation}:${item.decision_id}`
    if (busy !== null) return
    if (confirming !== key) {
      setConfirming(key)
      return
    }
    setConfirming(null)
    setBusy(key)
    setError("")
    try {
      if (operation === "do" && item.action_id) {
        await staffApi("/api/staff/admin/autopilot", {
          method: "POST",
          body: { action_id: item.action_id, operation: "approve" },
          timeoutMs: REQUEST_TIMEOUT_MS,
        })
      } else {
        await staffApi("/api/staff/admin/autopilot", {
          method: "POST",
          body: { decision_id: item.decision_id, operation: "handled_externally" },
          timeoutMs: REQUEST_TIMEOUT_MS,
        })
      }
      setItems(current => (current ?? queue).filter(candidate => candidate.decision_id !== item.decision_id))
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zapisać decyzji")
    } finally {
      setBusy(null)
    }
  }

  const authorityLabel = (item: Opportunity) =>
    item.authority === "awaiting_approval"
      ? "CZEKA NA ZGODĘ"
      : item.authority === "recommended"
        ? "SUGEROWANE"
        : item.authority === "auto_executing"
          ? "WYKONUJE SIĘ"
          : "OBSERWACJA"

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <details class="group">
        <summary class="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 marker:content-none [&::-webkit-details-marker]:hidden">
          <span class="flex items-center gap-3">
            <span class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Kolejka agenta</span>
            <span class="text-sm text-zinc-500">znalezione możliwości — zdecyduj, gdy masz czas</span>
          </span>
          <span class="flex items-center gap-2">
            {queue.length > 0 && (
              <span class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${awaiting > 0 ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>
                {queue.length}{awaiting > 0 ? ` · ${awaiting} czeka` : ""}
              </span>
            )}
            <span aria-hidden="true" class="text-zinc-500 transition group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div class="grid gap-3 border-t border-zinc-800/80 p-5">
          {error && <p role="alert" class="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
          {queue.map(item => (
            <article key={item.decision_id} class="rounded-lg border border-white/10 bg-black/30 p-4">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <strong class="block text-white">#{item.position} {humanAction(item.recommended_action)}</strong>
                  <p class="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">{humanContext(item.context)} · {item.decision_kind.replaceAll("_", " ")}</p>
                  <p class="mt-2 text-sm text-zinc-300">{item.reason}</p>
                  <p class="mt-1 text-xs text-zinc-500">termin: {date(item.due_at)}</p>
                  {item.consequence && (
                    <p class="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-xs text-amber-100">
                      Jeśli zignorujesz: {item.consequence}
                    </p>
                  )}
                  <div class="mt-2 flex flex-wrap gap-2" aria-label={`Fakty o ${humanAction(item.recommended_action)}`}>
                    <span class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.authority === "awaiting_approval" ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : item.authority === "observed" ? "border-white/10 bg-white/5 text-zinc-500" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>
                      {authorityLabel(item)}
                    </span>
                    <span class="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">PEWNOŚĆ {Math.round(item.confidence / 100)}%</span>
                    {item.value_tier && (
                      <span class="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                        WARTOŚĆ {item.value_tier === "downstream" ? "BIZNES" : item.value_tier.toUpperCase()}
                      </span>
                    )}
                    {item.deviation_basis_points !== null && item.deviation_basis_points !== undefined && (
                      <span class="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                        RUCH {(item.deviation_basis_points / 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  {item.action_id && item.authority === "awaiting_approval" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      title={confirming === `do:${item.decision_id}` ? "Kliknij ponownie, aby puścić zaparkowaną akcję" : undefined}
                      onClick={() => void decide(item, "do")}
                      class={confirming === `do:${item.decision_id}`
                        ? "min-h-[44px] rounded-xl border border-amber-300/40 bg-amber-300/20 px-4 py-2 text-xs font-black text-amber-100 disabled:opacity-50"
                        : "min-h-[44px] rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:opacity-50"}
                    >{busy === `do:${item.decision_id}` ? "PUSZCZAM…" : confirming === `do:${item.decision_id}` ? "POTWIERDŹ" : "ZRÓB TO"}</button>
                  ) : (
                    <span class="max-w-[180px] text-right text-xs leading-snug text-zinc-500">{item.authority === "auto_executing" ? "już zatwierdzone — wykonuje się" : "brak kroku do wykonania — załatw po swojemu"}</span>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide(item, "done")}
                    class={confirming === `done:${item.decision_id}`
                      ? "min-h-[44px] rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:opacity-50"
                      : "min-h-[44px] rounded-xl border border-white/15 px-4 py-2 text-xs font-black text-zinc-200 disabled:opacity-50"}
                  >{busy === `done:${item.decision_id}` ? "ZAPISUJĘ…" : confirming === `done:${item.decision_id}` ? "POTWIERDŹ" : "JUŻ ZROBIONE"}</button>
                </div>
              </div>
            </article>
          ))}
          {!feed.loading && !error && queue.length === 0 && (
            <p class="rounded-lg bg-black/20 p-4 text-sm text-zinc-500">Agent niczego teraz nie odkłada — pojawi się tu, gdy tylko jakiś detektor coś znajdzie.</p>
          )}
        </div>
      </details>
    </section>
  )
}
