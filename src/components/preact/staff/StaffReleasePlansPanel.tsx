import { useEffect, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import { date } from "./AutopilotHandoffs"
import {
  staffAccentButton,
  staffBadge,
  staffBadgeSignal,
  staffBadgeSuccess,
  staffConfirmButton,
  staffEmpty,
  staffEyebrow,
  staffEyebrowAccent,
  staffField,
  staffNoticeBase,
  staffNoticeTones,
  staffPanelInset,
  staffSecondaryButton,
  staffTitle,
} from "./staffUi"

const REQUEST_TIMEOUT_MS = 10_000

type Milestone =
  | "seed_calendar"
  | "editorial_pitch"
  | "announcement"
  | "start_press"
  | "fan_warmup"
  | "countdown"
  | "release_day"
  | "sustain"
  | "wrap"
  | "catalogue_rotation"

type StepState = "done" | "parked" | "due" | "upcoming" | "held" | "disabled" | "blocked"

type TimelineStep = {
  milestone: Milestone
  offset_days: number
  due_at: string
  completed_at: string | null
  state: StepState
}

type ReleasePlan = {
  release_id: string
  title: string
  release_at: string
  active: boolean
  tier: "single" | "track" | "filler"
  assets_ready: boolean
  communication_enabled: boolean
  press_enabled: boolean
  lifecycle: "inactive" | "preparing" | "release_week" | "sustaining" | "complete"
  timeline: TimelineStep[]
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

type ReleaseOutcome = {
  release_id: string
  title: string
  tier: ReleasePlan["tier"]
  release_at: string
  report_kind: "release_r3" | "release_r14"
  generated_at: string
  window_days: number
  verdict: "above_trend" | "within_noise" | "insufficient_evidence"
  payload?: {
    observed?: {
      fans_acquired_via_release_campaign?: number
      release_link_clicks?: number
      release_link_clickers?: number
    }
    inferred?: { window_acquisitions?: number }
    evidence_gaps?: string[]
  }
}

type Payload = {
  plans: ReleasePlan[]
  waves: OutreachWave[]
  outcomes?: ReleaseOutcome[]
  degraded?: boolean
}

const FLAG_LABELS: Array<["assets_ready" | "communication_enabled" | "press_enabled", string]> = [
  ["communication_enabled", "komunikacja"],
  ["press_enabled", "press"],
  ["assets_ready", "assets"],
]

const TIER_LABELS: Record<ReleasePlan["tier"], string> = {
  single: "SINGIEL",
  track: "UTWÓR",
  filler: "WYPEŁNIACZ",
}

const LIFECYCLE_LABELS: Record<ReleasePlan["lifecycle"], string> = {
  inactive: "WYŁĄCZONY",
  preparing: "PRZYGOTOWANIA",
  release_week: "TYDZIEŃ PREMIERY",
  sustaining: "PODTRZYMANIE",
  complete: "ZAKOŃCZONE",
}

const MILESTONE_LABELS: Record<Milestone, string> = {
  seed_calendar: "kalendarz",
  editorial_pitch: "pitch redakcyjny",
  announcement: "zapowiedź",
  start_press: "press",
  fan_warmup: "rozgrzanie fanów",
  countdown: "odliczanie",
  release_day: "dzień premiery",
  sustain: "podtrzymanie",
  wrap: "podsumowanie",
  catalogue_rotation: "rotacja katalogu",
}

const STEP_STATE_LABELS: Record<StepState, string> = {
  done: "GOTOWE",
  parked: "U CZŁOWIEKA",
  due: "TERMIN",
  upcoming: "NADCHODZI",
  held: "WSTRZYMANE",
  disabled: "WYŁĄCZONE",
  blocked: "ZABLOKOWANE",
}

const STEP_TONES: Record<StepState, string> = {
  done: "border-virya-success/30 bg-virya-success/10 text-virya-success",
  parked: "border-virya-warning/30 bg-virya-warning/10 text-yellow-100",
  due: "border-virya-warning/40 bg-virya-warning/15 text-yellow-100",
  upcoming: "border-virya-edge bg-white/5 text-virya-muted",
  held: "border-virya-signal/30 bg-virya-signal/10 text-virya-hot",
  disabled: "border-virya-edge bg-white/5 text-virya-muted",
  blocked: "border-virya-danger/30 bg-virya-danger/10 text-rose-200",
}

const offsetLabel = (offset: number) => `R${offset > 0 ? "+" : ""}${offset}`

const STATE_LABELS: Record<OutreachWave["state"], string> = {
  drafting: "SKŁADA SIĘ",
  sealed: "CZEKA NA ZGODĘ",
  approved: "ZATWIERDZONA",
  expired: "PRZEPADŁA",
}

const VERDICT_LABELS: Record<ReleaseOutcome["verdict"], string> = {
  above_trend: "powyżej trendu",
  within_noise: "w ramach szumu",
  insufficient_evidence: "za mało dowodów",
}

const REPORT_KIND_LABELS: Record<ReleaseOutcome["report_kind"], string> = {
  release_r3: "R+3",
  release_r14: "R+14",
}

export default function StaffReleasePlansPanel() {
  const [plans, setPlans] = useState<ReleasePlan[]>([])
  const [waves, setWaves] = useState<OutreachWave[]>([])
  const [outcomes, setOutcomes] = useState<ReleaseOutcome[]>([])
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
      setOutcomes(payload.outcomes ?? [])
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
          tier: String(data.get("tier") ?? "track"),
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
    <section class="rounded-lg border border-virya-signal/20 bg-virya-surface/80 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class={staffEyebrowAccent}>Wydania · planowanie</p>
          <h2 class={`mt-2 ${staffTitle}`}>Plany wydawnicze i fale kontaktu</h2>
          <p class="mt-1 max-w-3xl text-sm text-virya-muted">
            Plan premiery kotwiczy automat: pitch do kuratorów playlist i mediów wychodzi falą przed datą.
            Fale składają się same — Ty tylko zatwierdzasz gotową paczkę.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          class={staffSecondaryButton}
        >
          {loading ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
        </button>
      </div>
      {error && <p role="alert" class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.error}`}>{error}</p>}
      {message && <p role="status" class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.success}`}>{message}</p>}

      <form
        class={`mt-5 grid gap-3 ${staffPanelInset} sm:grid-cols-2`}
        onSubmit={event => {
          event.preventDefault()
          void submitPlan(event.currentTarget)
        }}
      >
        <label class={`grid gap-1 ${staffField}`}>
          Tytuł wydania
          <input name="title" required maxLength={240} class="input min-h-11" placeholder="Virya — nowy singiel" />
        </label>
        <label class={`grid gap-1 ${staffField}`}>
          Data premiery
          <input name="release_at" type="datetime-local" required class="input min-h-11" />
        </label>
        <label class={`grid gap-1 ${staffField} sm:col-span-2`}>
          Link do odsłuchu (opcjonalnie)
          <input name="listen_url" type="url" class="input min-h-11" placeholder="https://open.spotify.com/…" />
        </label>
        <label class={`grid gap-1 ${staffField} sm:col-span-2`}>
          Rodzaj wydania
          <select name="tier" class="input min-h-11" defaultValue="track">
            <option value="single">Singiel — pełna oś: pitch, odliczanie, pre-save, fale</option>
            <option value="track">Utwór — zapowiedź, katalog, jedna fala, bez wydatków</option>
            <option value="filler">Wypełniacz — publikacja w cichy tydzień, bez osi, bez wydatków</option>
          </select>
        </label>
        {outcomes.length > 0 && (
          <div class="rounded-lg border border-virya-edge bg-virya-bg/40 p-3 sm:col-span-2">
            <p class={staffEyebrow}>
              Wyniki poprzednich wydań — rekord, nie statystyka
            </p>
            <ul class="mt-2 grid gap-1.5">
              {Array.from(
                outcomes.reduce<Map<string, { title: string; tier: ReleasePlan["tier"]; reports: ReleaseOutcome[] }>>(
                  (map, outcome) => {
                    const entry = map.get(outcome.release_id) ?? { title: outcome.title, tier: outcome.tier, reports: [] }
                    entry.reports.push(outcome)
                    return map.set(outcome.release_id, entry)
                  },
                  new Map(),
                ),
              ).map(([releaseId, entry]) => (
                <li key={releaseId} class="flex flex-wrap items-baseline gap-x-2 text-sm text-virya-text">
                  <span class="font-semibold text-virya-text">{entry.title}</span>
                  <span class="text-xs uppercase tracking-wide text-virya-muted">{TIER_LABELS[entry.tier] ?? entry.tier}</span>
                  {entry.reports.map(report => (
                    <span key={report.report_kind} class="text-xs text-virya-muted">
                      {REPORT_KIND_LABELS[report.report_kind] ?? report.report_kind}: {VERDICT_LABELS[report.verdict] ?? report.verdict}
                      {typeof report.payload?.observed?.fans_acquired_via_release_campaign === "number" &&
                        ` · ${report.payload.observed.fans_acquired_via_release_campaign} nowych przez link`}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p class="mt-2 text-xs text-virya-muted">
              Próbka jest za mała, by porównywać rodzaje — to zapis wyników, nie rekomendacja.
            </p>
          </div>
        )}
        <fieldset class="flex flex-wrap items-center gap-4 sm:col-span-2">
          <legend class={staffField}>Przełączniki</legend>
          <label class="flex min-h-11 items-center gap-2 text-sm text-virya-text"><input type="checkbox" name="communication_enabled" checked /> komunikacja do fanów</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-virya-text"><input type="checkbox" name="press_enabled" /> press kit</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-virya-text"><input type="checkbox" name="assets_ready" /> materiały gotowe</label>
        </fieldset>
        <button
          type="submit"
          disabled={busy !== null}
          class={`justify-self-start ${staffAccentButton} sm:col-span-2`}
        >
          {busy === "plan" ? "ZAPISUJĘ…" : "ZAPISZ PLAN"}
        </button>
      </form>

      <div class="mt-6 grid gap-3">
        <h3 class={staffEyebrow}>Plany ({plans.length})</h3>
        {plans.map(plan => (
          <article key={plan.release_id} class={staffPanelInset}>
            <strong class="block text-virya-text">{plan.title}</strong>
            <p class="mt-1 text-xs uppercase tracking-[0.14em] text-virya-muted">premiera: {date(plan.release_at)}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <span class={plan.active ? staffBadgeSuccess : staffBadge}>
                {plan.active ? "AKTYWNY" : "WYŁĄCZONY"}
              </span>
              <span class={staffBadge}>
                {TIER_LABELS[plan.tier] ?? plan.tier}
              </span>
              <span class={staffBadgeSignal}>
                {LIFECYCLE_LABELS[plan.lifecycle] ?? plan.lifecycle}
              </span>
              {FLAG_LABELS.map(([flag, label]) => (
                <span key={flag} class={plan[flag] ? staffBadgeSuccess : staffBadge}>
                  {label}
                </span>
              ))}
            </div>
            {Array.isArray(plan.timeline) && plan.timeline.length > 0 && (
              <details class="mt-3 rounded-lg border border-virya-edge/60 bg-virya-bg/40">
                <summary class="cursor-pointer select-none px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-virya-muted">
                  Oś czasu premiery — {plan.timeline.filter(step => step.state === "done").length}/{plan.timeline.length} gotowe
                </summary>
                <ol class="grid gap-1 px-3 pb-3">
                  {plan.timeline.map(step => (
                    <li key={step.milestone} class="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5">
                      <span class="w-14 text-[10px] font-black uppercase tracking-[0.12em] text-virya-muted">{offsetLabel(step.offset_days)}</span>
                      <span class="min-w-32 flex-1 text-sm text-virya-text">{MILESTONE_LABELS[step.milestone] ?? step.milestone}</span>
                      <span class="text-[10px] uppercase tracking-[0.12em] text-virya-muted">
                        {step.state === "done" && step.completed_at ? `gotowe ${date(step.completed_at)}` : `termin ${date(step.due_at)}`}
                      </span>
                      <span class={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${STEP_TONES[step.state]}`}>
                        {STEP_STATE_LABELS[step.state]}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </article>
        ))}
        {!loading && plans.length === 0 && !error && (
          <p class={staffEmpty}>Brak planów — dodaj pierwszy powyżej.</p>
        )}
      </div>

      <div class="mt-6 grid gap-3">
        <h3 class={staffEyebrow}>Fale ({waves.length})</h3>
        {waves.map(wave => (
          <article key={wave.wave_id} class={staffPanelInset}>
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <strong class="block text-virya-text">{STATE_LABELS[wave.state]} · {wave.target_kind}</strong>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-virya-muted">
                  otwarta {date(wave.opened_at)} · kotwica {date(wave.anchor_at)}
                </p>
                <p class="mt-2 text-sm text-virya-text">{wave.pitches} pitchy gotowe · {wave.eligible_targets} celów kwalifikuje się</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                {wave.state === "sealed" ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void approveWave(wave)}
                    title={confirming === `wave:${wave.wave_id}` ? "Kliknij ponownie, aby wypuścić całą falę" : undefined}
                    class={confirming === `wave:${wave.wave_id}` ? staffConfirmButton : staffAccentButton}
                  >
                    {busy === `wave:${wave.wave_id}` ? "WYPUSZCZAM…" : confirming === `wave:${wave.wave_id}` ? "POTWIERDŹ" : "ZATWIERDŹ FALĘ"}
                  </button>
                ) : (
                  <span class="max-w-[200px] text-right text-xs leading-snug text-virya-muted">
                    {wave.state === "drafting" ? "automat jeszcze składa falę" : "decyzja już zapadła"}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
        {!loading && waves.length === 0 && !error && (
          <p class={staffEmpty}>
            Brak fal. Automat otworzy falę, gdy będą cele danego rodzaju (radio / press / creator / patron) wokół premiery lub koncertu.
          </p>
        )}
      </div>
    </section>
  )
}
