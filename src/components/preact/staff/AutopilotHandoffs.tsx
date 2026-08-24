import { useEffect, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import BookingPolicyPanel, { type BookingPolicySummary } from "./BookingPolicyPanel"

const REQUEST_TIMEOUT_MS = 10_000

type PendingAction = {
  id: string
  context: string
  action_kind: string
  subject_kind: string
  created_at: string
  approval_expires_at: string | null
  assignment_due_at?: string | null
  assignee?: {
    member_id: string
    member_key: string
    display_name: string
  } | null
  // False means approving this queues it and nothing happens: no live executor
  // advertises the capability it needs, so CrowdRelay parks it. Presenting such
  // an item as ordinary work promises an outcome the system cannot deliver.
  executor_ready?: boolean
  required_capability?: string | null
}
type TeamAssignee = {
  member_id: string
  member_key: string
  display_name: string
}
type ManualStep = {
  destination: string
  url: string
  what_to_do: string
  why_it_matters: string
}
type RecentAction = {
  id: string
  context: string
  action_kind: string
  status: string
  manual_steps?: ManualStep[]
}
type Overview = {
  runtime_enabled: boolean
  needs_you: PendingAction[]
  available_assignees?: TeamAssignee[]
  recent_actions?: RecentAction[]
  booking_policy?: BookingPolicySummary | null
}

const date = (value: string | null | undefined) => {
  if (!value) return "bez twardego terminu"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(parsed)
}
export { date, humanAction, humanContext }

const ACTION_LABELS: Record<string, string> = {
  "show.growth.request": "Wzmocnij frekwencję / merch",
  "beacon.discovery.request": "Znajdź lokalne Beacony",
  "beacon.outreach.request": "Uruchom lokalny Beacon",
  "booking.outreach.request": "Kontakt bookingowy",
  "opportunity.live.apply": "Wyślij zgłoszenie koncertowe",
  "funding.application.submit": "Wyślij wniosek",
}

const CONTEXT_LABELS: Record<string, string> = {
  show_growth: "Attendance Growth",
  beacon: "Beacons",
  booking_opportunity: "Booking",
  live_opportunity: "Koncerty / festiwale",
}

const TEAM_MEMBER_LABELS: Record<string, string> = {
  "Team Member 1": "Wojtek",
  "Team Member 2": "Lubek",
  "Team Member 3": "Kuba",
  "Team Member 4": "Marcin",
  "Team Member 5": "Marek",
}

const teamMemberLabel = (value: string) => TEAM_MEMBER_LABELS[value] ?? value

const humanAction = (value: string) =>
  ACTION_LABELS[value] ?? value
    .replace(/^apply_/, "zgłoszenie: ")
    .replace(/^request_/, "kontakt: ")
    .replaceAll("_", " ")

const humanContext = (value: string) => CONTEXT_LABELS[value] ?? value.replaceAll("_", " ")

const safeExternalUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

function ReadinessChip({ ok, pending = false, label }: { ok: boolean; pending?: boolean; label: string }) {
  const tone = pending
    ? "border-white/10 bg-white/5 text-zinc-500"
    : ok
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
      : "border-amber-300/25 bg-amber-300/10 text-amber-100"
  return <span class={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone}`}>{pending ? "SPRAWDZAM…" : label}</span>
}

export default function AutopilotHandoffs() {
  const [items, setItems] = useState<PendingAction[]>([])
  const [assignees, setAssignees] = useState<TeamAssignee[]>([])
  const [manualActions, setManualActions] = useState<RecentAction[]>([])
  const [bookingPolicy, setBookingPolicy] = useState<BookingPolicySummary | null>(null)
  const [runtimeEnabled, setRuntimeEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function load(signal?: AbortSignal) {
    setLoading(true)
    try {
      const overview = await staffApi<Overview>("/api/staff/admin/autopilot", {
        signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setItems(overview.needs_you ?? [])
      setAssignees(overview.available_assignees ?? [])
      setManualActions((overview.recent_actions ?? []).filter(action => (action.manual_steps?.length ?? 0) > 0))
      setBookingPolicy(overview.booking_policy ?? null)
      setRuntimeEnabled(Boolean(overview.runtime_enabled))
      setError("")
    } catch (value) {
      if (!(value instanceof DOMException && value.name === "AbortError"))
        setError(value instanceof Error ? value.message : "Autopilot jest chwilowo niedostępny")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  async function assign(item: PendingAction, memberKey: string) {
    if (!memberKey || memberKey === item.assignee?.member_key) return
    setBusy(item.id)
    setError("")
    const person = assignees.find(candidate => candidate.member_key === memberKey)
    if (!person) {
      setBusy(null)
      return
    }
    try {
      await staffApi("/api/staff/admin/autopilot", {
        method: "POST",
        body: { action_id: item.id, operation: "assign", member_key: memberKey },
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setItems(current => current.map(candidate =>
        candidate.id === item.id
          ? {
              ...candidate,
              assignee: {
                member_id: person.member_id,
                member_key: person.member_key,
                display_name: person.display_name,
              },
            }
          : candidate,
      ))
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zmienić ownera")
    } finally {
      setBusy(null)
    }
  }

  async function mutate(item: PendingAction, action: "approve" | "cancel") {
    setBusy(item.id)
    setError("")
    try {
      await staffApi("/api/staff/admin/autopilot", {
        method: "POST",
        body: { action_id: item.id, operation: action },
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setItems(current => current.filter(candidate => candidate.id !== item.id))
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zapisać decyzji")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section class="rounded-xl border border-amber-300/20 bg-zinc-900/70 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Chief of Staff · Needs you</p>
          <h2 class="mt-2 text-xl font-black text-white">Rzeczy wymagające człowieka</h2>
          <p class="mt-1 max-w-3xl text-sm text-zinc-400">
            Jedna kolejka decyzji zespołu. Właściciel jest dobierany według kompetencji i obciążenia; mail pozostaje tylko przypomnieniem, nie drugim task systemem.
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => void load()} class="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 disabled:opacity-50">
          {loading ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
        </button>
      </div>
      {error && <p role="alert" class="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      <div class="mt-4 flex flex-wrap gap-2" aria-label="Stan automatów">
        <ReadinessChip
          ok={runtimeEnabled === true}
          pending={loading && runtimeEnabled === null}
          label={runtimeEnabled === null ? "AUTOMATY · BRAK DANYCH" : runtimeEnabled ? "AUTOMATY ON" : "AUTOMATY OFF"}
        />
      </div>
      <div class="mt-4 grid gap-3">
        {items.map(item => (
          <article key={item.id} class="rounded-lg border border-white/10 bg-black/30 p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <strong class="block text-white">{humanAction(item.action_kind)}</strong>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">{humanContext(item.context)} · {item.subject_kind}</p>
                <p class="mt-2 text-sm text-zinc-300">
                  Owner: <b class="text-amber-200">{item.assignee ? teamMemberLabel(item.assignee.display_name) : "przypisuję…"}</b>
                  {" · "}deadline: {date(item.assignment_due_at ?? item.approval_expires_at)}
                </p>
                {item.executor_ready === false && (
                  <p class="mt-2 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                    Akceptacja nic tu nie uruchomi: żaden executor nie zgłasza
                    zdolności <b>{item.required_capability ?? "wymaganej przez tę akcję"}</b>.
                    Akcja trafi do kolejki i będzie czekać.
                  </p>
                )}
              </div>
              <div class="flex flex-wrap items-center gap-2">
                {assignees.length > 0 && (
                  <label class="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                    PRZYPISZ
                    <select
                      aria-label={`Przypisz ${humanAction(item.action_kind)}`}
                      disabled={busy === item.id}
                      value={item.assignee?.member_key ?? ""}
                      onChange={event => void assign(item, event.currentTarget.value)}
                      class="bg-transparent text-xs font-bold normal-case tracking-normal text-zinc-100 outline-none"
                    >
                      {!item.assignee && <option value="">wybierz…</option>}
                      {assignees.map(person => (
                        <option key={person.member_id} value={person.member_key}>{teamMemberLabel(person.display_name)}</option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void mutate(item, "approve")}
                  title={item.executor_ready === false ? "Zostanie zakolejkowane, ale nikt tego nie wykona" : undefined}
                  class={`rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50 ${item.executor_ready === false ? "border border-amber-300/40 bg-amber-300/20 text-amber-100" : "bg-emerald-300 text-zinc-950"}`}
                >{item.executor_ready === false ? "AKCEPTUJ (BEZ WYKONAWCY)" : "AKCEPTUJ I PUŚĆ DALEJ"}</button>
                <button type="button" disabled={busy === item.id} onClick={() => void mutate(item, "cancel")} class="rounded-xl border border-rose-400/30 px-4 py-2 text-xs font-black text-rose-200 disabled:opacity-50">ODRZUĆ</button>
              </div>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 && <p class="rounded-lg bg-black/20 p-4 text-sm text-zinc-500">Nic nie wymaga teraz ręcznej decyzji.</p>}
      </div>

      <BookingPolicyPanel summary={bookingPolicy} onSaved={() => load()} />

      {manualActions.length > 0 && (
        <div class="mt-6 border-t border-white/10 pt-5">
          <p class="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Autopilot zrobił co mógł · dokończ ręcznie</p>
          <p class="mt-1 text-sm text-zinc-400">Tylko kroki, których nie wolno lub nie da się bezpiecznie zautomatyzować, np. CAPTCHA, logowanie albo link weryfikacyjny.</p>
          <div class="mt-3 grid gap-3">
            {manualActions.flatMap(action => (action.manual_steps ?? []).map((step, index) => {
              const href = safeExternalUrl(step.url)
              return (
                <article key={`${action.id}:${index}`} class="rounded-lg border border-sky-300/15 bg-sky-300/5 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <strong class="text-zinc-100">{step.destination}</strong>
                      <p class="mt-1 text-sm text-zinc-200">{step.what_to_do}</p>
                      <p class="mt-1 text-xs text-zinc-500">{step.why_it_matters}</p>
                    </div>
                    {href && <a href={href} target="_blank" rel="noreferrer" class="rounded-xl border border-sky-300/25 px-3 py-2 text-xs font-black text-sky-200">OTWÓRZ ↗</a>}
                  </div>
                </article>
              )
            }))}
          </div>
        </div>
      )}
    </section>
  )
}
