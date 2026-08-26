import { useEffect, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import { date } from "./AutopilotHandoffs"

const REQUEST_TIMEOUT_MS = 10_000

type ReleasePlan = {
  release_id: string
  title: string
  release_at: string
  active: boolean
  assets_ready: boolean
  communication_enabled: boolean
  press_enabled: boolean
}

type OutreachWave = {
  wave_id: string
  anchor: { kind: "release" | "event"; release_id?: string; event_id?: string }
  target_kind: string
  state: "drafting" | "sealed" | "approved" | "expired"
  opened_at: string
  anchor_at: string
  pitches: number
  eligible_targets: number
}

type Payload = {
  plans: ReleasePlan[]
  waves: OutreachWave[]
  degraded?: boolean
}

const FLAG_LABELS: Array<[keyof ReleasePlan, string]> = [
  ["communication_enabled", "komunikacja"],
  ["press_enabled", "press"],
  ["assets_ready", "assets"],
]

const STATE_LABELS: Record<OutreachWave["state"], string> = {
  drafting: "SKŁADA SIĘ",
  sealed: "CZEKA NA ZGODĘ",
  approved: "ZATWIERDZONA",
  expired: "PRZEPADŁA",
}

export default function StaffReleasePlansPanel() {
  const [plans, setPlans] = useState<ReleasePlan[]>([])
  const [waves, setWaves] = useState<OutreachWave[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  async function load(signal?: AbortSignal) {
    setLoading(true)
    try {
      const payload = await staffApi<Payload>("/api/staff/admin/releases", {
        signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setPlans(payload.plans ?? [])
      setWaves(payload.waves ?? [])
      setError(payload.degraded ? "Część danych chwilowo niedostępna — reszta działa." : "")
    } catch (value) {
      if (!(value instanceof DOMException && value.name === "AbortError"))
        setError(value instanceof Error ? value.message : "Wydania chwilowo niedostępne")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  async function submitPlan(form: HTMLFormElement) {
    const data = new FormData(form)
    setBusy("plan")
    setError("")
    setMessage("")
    try {
      await staffApi("/api/staff/admin/releases", {
        method: "POST",
        body: {
          operation: "upsert_plan",
          title: String(data.get("title") ?? ""),
          release_at: data.get("release_at") || undefined,
          listen_url: String(data.get("listen_url") ?? "").trim() || null,
          active: true,
          assets_ready: data.get("assets_ready") === "on",
          communication_enabled: data.get("communication_enabled") === "on",
          press_enabled: data.get("press_enabled") === "on",
        },
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      form.reset()
      setMessage("Plan zapisany. Automat zaplanuje fale wokół daty premiery.")
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zapisać planu")
    } finally {
      setBusy(null)
    }
  }

  async function approveWave(wave: OutreachWave) {
    const key = `wave:${wave.wave_id}`
    if (busy !== null) return
    if (confirming !== key) {
      setConfirming(key)
      return
    }
    setConfirming(null)
    setBusy(key)
    setError("")
    try {
      await staffApi("/api/staff/admin/releases", {
        method: "POST",
        body: { operation: "approve_wave", wave_id: wave.wave_id },
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setMessage(`Fala wypuszczona (${wave.pitches} pitchy).`)
      await load()
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zatwierdzić fali")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section class="rounded-xl border border-amber-300/20 bg-zinc-900/70 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Wydania · planowanie</p>
          <h2 class="mt-2 text-xl font-black text-white">Plany wydawnicze i fale kontaktu</h2>
          <p class="mt-1 max-w-3xl text-sm text-zinc-400">
            Plan premiery kotwiczy automat: pitch do kuratorów playlist i mediów wychodzi falą przed datą.
            Fale składają się same — Ty tylko zatwierdzasz gotową paczkę.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          class="min-h-[44px] rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 disabled:opacity-50"
        >
          {loading ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
        </button>
      </div>
      {error && <p role="alert" class="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {message && <p role="status" class="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p>}

      <form
        class="mt-5 grid gap-3 rounded-lg border border-white/10 bg-black/30 p-4 sm:grid-cols-2"
        onSubmit={event => {
          event.preventDefault()
          void submitPlan(event.currentTarget)
        }}
      >
        <label class="grid gap-1 text-sm font-semibold text-zinc-200">
          Tytuł wydania
          <input name="title" required maxLength={240} class="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-zinc-100" placeholder="Virya — nowy singiel" />
        </label>
        <label class="grid gap-1 text-sm font-semibold text-zinc-200">
          Data premiery
          <input name="release_at" type="datetime-local" required class="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-zinc-100" />
        </label>
        <label class="grid gap-1 text-sm font-semibold text-zinc-200 sm:col-span-2">
          Link do odsłuchu (opcjonalnie)
          <input name="listen_url" type="url" class="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-zinc-100" placeholder="https://open.spotify.com/…" />
        </label>
        <fieldset class="flex flex-wrap items-center gap-4 sm:col-span-2">
          <legend class="text-sm font-semibold text-zinc-200">Przełączniki</legend>
          <label class="flex min-h-11 items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="communication_enabled" checked /> komunikacja do fanów</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="press_enabled" /> press kit</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="assets_ready" /> materiały gotowe</label>
        </fieldset>
        <button
          type="submit"
          disabled={busy !== null}
          class="min-h-[44px] justify-self-start rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:opacity-50 sm:col-span-2"
        >
          {busy === "plan" ? "ZAPISUJĘ…" : "ZAPISZ PLAN"}
        </button>
      </form>

      <div class="mt-6 grid gap-3">
        <h3 class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Plany ({plans.length})</h3>
        {plans.map(plan => (
          <article key={plan.release_id} class="rounded-lg border border-white/10 bg-black/30 p-4">
            <strong class="block text-white">{plan.title}</strong>
            <p class="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">premiera: {date(plan.release_at)}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <span class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${plan.active ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/5 text-zinc-500"}`}>
                {plan.active ? "AKTYWNY" : "WYŁĄCZONY"}
              </span>
              {FLAG_LABELS.map(([flag, label]) => (
                <span key={flag} class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${plan[flag] ? "border-sky-300/20 bg-sky-300/10 text-sky-200" : "border-white/10 bg-white/5 text-zinc-500"}`}>
                  {label}
                </span>
              ))}
            </div>
          </article>
        ))}
        {!loading && plans.length === 0 && !error && (
          <p class="rounded-lg bg-black/20 p-4 text-sm text-zinc-500">Brak planów — dodaj pierwszy powyżej.</p>
        )}
      </div>

      <div class="mt-6 grid gap-3">
        <h3 class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Fale ({waves.length})</h3>
        {waves.map(wave => (
          <article key={wave.wave_id} class="rounded-lg border border-white/10 bg-black/30 p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <strong class="block text-white">{STATE_LABELS[wave.state]} · {wave.target_kind}</strong>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  otwarta {date(wave.opened_at)} · kotwica {date(wave.anchor_at)}
                </p>
                <p class="mt-2 text-sm text-zinc-300">{wave.pitches} pitchy gotowe · {wave.eligible_targets} celów kwalifikuje się</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                {wave.state === "sealed" ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void approveWave(wave)}
                    title={confirming === `wave:${wave.wave_id}` ? "Kliknij ponownie, aby wypuścić całą falę" : undefined}
                    class={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50 ${confirming === `wave:${wave.wave_id}` ? "border border-amber-300/40 bg-amber-300/20 text-amber-100" : "bg-emerald-300 text-zinc-950"}`}
                  >
                    {busy === `wave:${wave.wave_id}` ? "WYPUSZCZAM…" : confirming === `wave:${wave.wave_id}` ? "POTWIERDŹ" : "ZATWIERDŹ FALĘ"}
                  </button>
                ) : (
                  <span class="max-w-[200px] text-right text-xs leading-snug text-zinc-500">
                    {wave.state === "drafting" ? "automat jeszcze składa falę" : "decyzja już zapadła"}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
        {!loading && waves.length === 0 && !error && (
          <p class="rounded-lg bg-black/20 p-4 text-sm text-zinc-500">
            Brak fal. Automat otworzy falę, gdy będą cele danego rodzaju (radio / press / creator / patron) wokół premiery lub koncertu.
          </p>
        )}
      </div>
    </section>
  )
}
