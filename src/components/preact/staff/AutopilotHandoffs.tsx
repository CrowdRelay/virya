import { useEffect, useState } from "preact/hooks"
import { staffApi } from "./staffApi"
import { Notice } from "./AdminConsoleUi"
import BookingPolicyPanel, { type BookingPolicySummary } from "./BookingPolicyPanel"
import {
  staffAccentButton,
  staffAccentChip,
  staffBadge,
  staffBadgeSuccess,
  staffBadgeWarn,
  staffConfirmButton,
  staffConfirmChip,
  staffEyebrow,
  staffEyebrowAccent,
  staffNoticeBase,
  staffNoticeTones,
  staffPanel,
  staffPanelInset,
  staffRow,
  staffSecondaryButton,
  staffSubtitle,
  staffTitle,
} from "./staffUi"

const REQUEST_TIMEOUT_MS = 10_000

export type PendingAction = {
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
  briefing?: ActionBriefing | null
  // Pola, które można poprawić przy akceptacji — lista przychodzi z
  // CrowdRelay (jedna definicja na frontend i bramkę), nie z tego pliku.
  revisable?: Record<string, string>
}

type BriefingStep = {
  what_to_do: string
  why_it_matters: string
}
type BriefingField = {
  label: string
  value: string
}
type ActionBriefing = {
  summary: string
  why_it_matters: string
  steps: BriefingStep[]
  content: BriefingField[]
  deadline_note: string
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
export type AutopilotOpportunity = {
  position: number
  decision_id: string
  action_id: string | null
  context: string
  decision_kind: string
  subject_kind: string
  authority: "awaiting_approval" | "recommended" | "observed" | "auto_executing"
  confidence: number
  reason: string
  recommended_action: string
  ranked_by: string
  consequence: string
  due_at: string | null
  value_tier: string | null
  deviation_basis_points: number | null
}

export type AutopilotOverview = {
  runtime_enabled: boolean
  needs_you: PendingAction[]
  available_assignees?: TeamAssignee[]
  recent_actions?: RecentAction[]
  opportunities?: AutopilotOpportunity[] | null
  booking_policy?: BookingPolicySummary | null
}

// One fetch feeds both human surfaces on Dzisiaj: the decision queue below and
// the collapsed agent board, so the overview never calls the BFF twice.
export type AutopilotFeed = {
  overview: AutopilotOverview | null
  loading: boolean
  error: string
  reload: () => void
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

// Every action kind the autopilot emits, in the words a band member uses.
//
// Six of the thirty-five were named here; the rest fell through to a fallback
// that replaced underscores — which does nothing to a dotted topic, so
// `show.task.escalate` was printed verbatim as the card title and read aloud by
// screen readers through the aria-labels below.
//
// The label says what the person does, not what the system calls it. The why
// and the when come from the briefing, which the backend already sends.
const ACTION_LABELS: Record<string, string> = {
  // Koncerty i zadania wokół nich
  "show.growth.request": "Wzmocnij frekwencję na koncercie",
  "show.task.complete": "Zamknij zadanie koncertowe",
  "show.task.escalate": "Zadanie koncertowe utknęło — potrzebna decyzja",
  "opportunity.live.apply": "Wyślij zgłoszenie koncertowe",
  "opportunity.terms.accept": "Przyjmij warunki koncertu",
  "opportunity.terms.counter": "Odpowiedz kontrofertą na warunki",
  "booking.outreach.request": "Odezwij się do organizatora",

  // Beacony i sieć lokalna
  "beacon.discovery.request": "Znajdź lokalne Beacony",
  "beacon.outreach.request": "Uruchom lokalny Beacon",

  // Fani i kontakt
  "fan.lifecycle.message.request": "Wyślij wiadomość do fana",
  "audience.campaign.request": "Wyślij kampanię do publiczności",
  "signal.push.request": "Wyślij powiadomienie w aplikacji",
  "referral.code.issue": "Wydaj kod polecający",
  "community.engage.request": "Odezwij się w społeczności",
  "outreach.request": "Wyślij kontakt",
  "outreach.target.request": "Zatwierdź adresata kontaktu",
  "outreach.discovery.request": "Poszukaj nowych adresatów",

  // Treść
  "content.artifact.request": "Przygotuj materiał do publikacji",
  "agent.content.request": "Sprawdź szkic przygotowany przez asystenta",
  "agent.run.request": "Uruchom zadanie asystenta",

  // Wydawnictwa
  "release.milestone.execute": "Wykonaj krok wydawniczy",
  "playlist.placement.verify": "Sprawdź, czy utwór trafił na playlistę",

  // Merch i bilety
  "merch.bundle.request": "Przygotuj zestaw merchu",
  "merch.price.change": "Zmień cenę merchu",
  "merch.reorder.request": "Zamów brakujący merch",
  "ticket.price.change": "Zmień cenę biletu",
  "ticket.capacity.change": "Zmień liczbę biletów",

  // Finansowanie
  "funding.application.submit": "Wyślij wniosek o dofinansowanie",
  "funding.package.prepare": "Przygotuj dokumenty do wniosku",

  // Zespół
  "team.assignment.email": "Powiadom osobę o zadaniu",

  // Sterowanie samym systemem — rzadkie, ale nie mogą wyciekać surowe
  "growth.debt.raise": "Zaległość we wzroście — zobacz, co przestało się dziać",
  "growth.opportunity.raise": "Nowa okazja do wzrostu",
  "experiment.allocation.change": "Zmień podział ruchu w eksperymencie",
  "experiment.complete": "Zamknij eksperyment",
  "play.step.run": "Wykonaj krok zaplanowanego działania",
}

// The area the task belongs to. These were half English in an otherwise Polish
// panel, which reads as a different product mid-sentence.
const CONTEXT_LABELS: Record<string, string> = {
  show_growth: "Frekwencja na koncertach",
  beacon: "Beacony",
  booking_opportunity: "Booking",
  live_opportunity: "Koncerty i festiwale",
  fan_lifecycle: "Kontakt z fanami",
  content: "Treść",
  merch: "Merch",
  ticketing: "Bilety",
  funding: "Dofinansowania",
  outreach: "Kontakt zewnętrzny",
  community: "Społeczności",
  release: "Wydawnictwa",
  team: "Zespół",
  experiment: "Eksperymenty",
}

const TEAM_MEMBER_LABELS: Record<string, string> = {
  "Team Member 1": "Wojtek",
  "Team Member 2": "Lubek",
  "Team Member 3": "Kuba",
  "Team Member 4": "Marcin",
  "Team Member 5": "Marek",
}

const teamMemberLabel = (value: string) => TEAM_MEMBER_LABELS[value] ?? value

// An unnamed action kind must never reach a band member as `show.task.escalate`.
// The old fallback only replaced underscores, so a dotted topic passed through
// untouched. This one keeps the area — the first segment is meaningful even
// when the rest is not — and says plainly that the detail is below, which is
// true: the briefing is rendered whether or not the label is known.
const humanAction = (value: string) => {
  const known = ACTION_LABELS[value]
  if (known) return known
  const area = CONTEXT_LABELS[value.split(".")[0] ?? ""]
  return area ? `Zadanie: ${area.toLowerCase()}` : "Zadanie do wykonania"
}

const humanContext = (value: string) =>
  CONTEXT_LABELS[value] ?? CONTEXT_LABELS[value.split(".")[0] ?? ""] ?? "Inne"

const safeExternalUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

function ReadinessChip({ ok, pending = false, label }: { ok: boolean; pending?: boolean; label: string }) {
  const tone = pending ? staffBadge : ok ? staffBadgeSuccess : staffBadgeWarn
  return <span class={tone}>{pending ? "SPRAWDZAM…" : label}</span>
}

export function useAutopilotFeed(): AutopilotFeed {
  const [overview, setOverview] = useState<AutopilotOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setError("")
    try {
      const nextOverview = await staffApi<AutopilotOverview>("/api/staff/admin/autopilot", {
        signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      setOverview(nextOverview)
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

  return { overview, loading, error, reload: () => void load() }
}

function useQueueMutation(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function send(item: PendingAction, body: Record<string, unknown>, failureMessage: string) {
    setBusy(item.id)
    setError("")
    try {
      await staffApi("/api/staff/admin/autopilot", {
        method: "POST",
        body,
        timeoutMs: REQUEST_TIMEOUT_MS,
      })
      reload()
    } catch (value) {
      setError(value instanceof Error ? value.message : failureMessage)
    } finally {
      setBusy(null)
    }
  }

  return { busy, error, send }
}

const authorityLabel = (item: AutopilotOpportunity) =>
  item.authority === "awaiting_approval"
    ? "CZEKA NA ZGODĘ"
    : item.authority === "recommended"
      ? "SUGEROWANE"
      : item.authority === "auto_executing"
        ? "WYKONUJE SIĘ"
        : "OBSERWACJA"

// Kolejka „znajdź, potem zrób”: agent odkrywa i parkuje, człowiek decyduje.
// Żyje w tym samym komponencie co kolejka decyzji, żeby ta sama rzecz nie była
// zatwierdzalna z dwóch miejsc naraz.
function AgentBoard({ feed }: { feed: AutopilotFeed }) {
  const { overview, loading } = feed
  const [items, setItems] = useState<AutopilotOpportunity[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState("")

  const queue: AutopilotOpportunity[] = items ?? (overview === null ? [] : overview.opportunities ?? [])
  const awaiting = queue.filter(item => item.authority === "awaiting_approval").length

  async function decide(item: AutopilotOpportunity, operation: "do" | "done") {
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
      feed.reload()
    } catch (value) {
      setError(value instanceof Error ? value.message : "Nie udało się zapisać decyzji")
    } finally {
      setBusy(null)
    }
  }

  return (
    <details class="mt-6 border-t border-virya-edge pt-5 group">
      <summary class="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <span class="flex items-center gap-3">
          <span class={staffEyebrowAccent}>Kolejka agenta</span>
          <span class="text-sm text-virya-muted">znalezione możliwości — zdecyduj, gdy masz czas</span>
        </span>
        <span class="flex items-center gap-2">
          {queue.length > 0 && (
            <span class={awaiting > 0 ? staffBadgeWarn : staffBadge}>
              {queue.length}{awaiting > 0 ? ` · ${awaiting} czeka` : ""}
            </span>
          )}
          <span aria-hidden="true" class="text-virya-muted transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div class="mt-4 grid gap-3">
        {error && <Notice tone="error">{error}</Notice>}
        {queue.map(item => (
          <article key={item.decision_id} class={staffRow}>
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <strong class="block text-virya-text">#{item.position} {humanAction(item.recommended_action)}</strong>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-virya-muted">{humanContext(item.context)} · {item.decision_kind.replaceAll("_", " ")}</p>
                <p class="mt-2 text-sm text-virya-text">{item.reason}</p>
                <p class="mt-1 text-xs text-virya-muted">termin: {date(item.due_at)}</p>
                {item.consequence && (
                  <p class={`mt-2 text-xs ${staffNoticeBase} ${staffNoticeTones.warn}`}>
                    Jeśli zignorujesz: {item.consequence}
                  </p>
                )}
                <div class="mt-2 flex flex-wrap gap-2" aria-label={`Fakty o ${humanAction(item.recommended_action)}`}>
                  <span class={item.authority === "awaiting_approval" ? staffBadgeWarn : item.authority === "observed" ? staffBadge : staffBadgeSuccess}>
                    {authorityLabel(item)}
                  </span>
                  <span class={staffBadge}>PEWNOŚĆ {Math.round(item.confidence / 100)}%</span>
                  {item.value_tier && (
                    <span class={staffBadge}>
                      WARTOŚĆ {item.value_tier === "downstream" ? "BIZNES" : item.value_tier.toUpperCase()}
                    </span>
                  )}
                  {item.deviation_basis_points !== null && item.deviation_basis_points !== undefined && (
                    <span class={staffBadge}>
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
                      ? staffConfirmChip
                      : staffAccentChip}
                  >{busy === `do:${item.decision_id}` ? "PUSZCZAM…" : confirming === `do:${item.decision_id}` ? "POTWIERDŹ" : "ZRÓB TO"}</button>
                ) : (
                  <span class="max-w-[180px] text-right text-xs leading-snug text-virya-muted">{item.authority === "auto_executing" ? "już zatwierdzone — wykonuje się" : "brak kroku do wykonania — załatw po swojemu"}</span>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decide(item, "done")}
                  class={confirming === `done:${item.decision_id}`
                    ? staffConfirmButton
                    : staffSecondaryButton}
                >{busy === `done:${item.decision_id}` ? "ZAPISUJĘ…" : confirming === `done:${item.decision_id}` ? "POTWIERDŹ" : "JUŻ ZROBIONE"}</button>
              </div>
            </div>
          </article>
        ))}
        {!loading && !error && queue.length === 0 && (
          <p class="rounded-lg bg-black/20 p-4 text-sm text-virya-muted">Agent niczego teraz nie odkłada — pojawi się tu, gdy tylko jakiś detektor coś znajdzie.</p>
        )}
      </div>
    </details>
  )
}

function ActionDetailModal({
  item,
  assignees,
  busy,
  onAssign,
  onApprove,
  onReject,
  onClose,
}: {
  item: PendingAction
  assignees: TeamAssignee[]
  busy: string | null
  onAssign: (item: PendingAction, memberKey: string) => void
  onApprove: (item: PendingAction, revision?: Record<string, string>) => void
  onReject: (item: PendingAction) => void
  onClose: () => void
}) {
  const briefing = item.briefing
  // Editable draft fields, prefilled with the machine's words. Only fields
  // the operator actually changed go up — an identical value is not a
  // revision and the gate refuses it.
  const revisableEntries = Object.entries(item.revisable ?? {})
  const [edits, setEdits] = useState<Record<string, string>>(() => Object.fromEntries(revisableEntries))
  const changedRevision = Object.fromEntries(
    Object.entries(edits).filter(([field, value]) =>
      value.trim() !== (item.revisable?.[field] ?? "").trim() && value.trim() !== ""),
  )
  const hasEdits = Object.keys(changedRevision).length > 0
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div class="fixed inset-0 z-[10000] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={`Szczegóły: ${humanAction(item.action_kind)}`} onClick={onClose}>
      <div class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-virya-edge bg-virya-bg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class={staffEyebrowAccent}>{humanContext(item.context)} · {item.subject_kind}</p>
            <h3 class={`mt-2 ${staffTitle}`}>{humanAction(item.action_kind)}</h3>
            {briefing && <p class="mt-2 text-lg text-virya-text">{briefing.summary}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Zamknij" class="min-h-[44px] min-w-[44px] rounded-md border border-virya-edge text-virya-muted transition-colors hover:border-zinc-600 hover:text-virya-text">✕</button>
        </div>

        {briefing && (
          <>
            <div class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.warn}`}>
              <p class="text-xs font-black uppercase tracking-[0.14em] text-yellow-100">Dlaczego to ważne</p>
              <p class="mt-1 text-sm">{briefing.why_it_matters}</p>
            </div>

            {briefing.steps.length > 0 && (
              <div class="mt-4">
                <p class={staffEyebrow}>Kroki</p>
                <ol class="mt-2 grid gap-2">
                  {briefing.steps.map((step, i) => (
                    <li key={i} class={`${staffPanelInset} px-3 py-2`}>
                      <p class="text-sm text-virya-text"><b class="text-virya-hot">{i + 1}.</b> {step.what_to_do}</p>
                      <p class="mt-1 text-xs text-virya-muted">{step.why_it_matters}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {briefing.content.length > 0 && (
              <div class="mt-4">
                <p class={staffEyebrow}>Treść</p>
                <dl class="mt-2 grid gap-1">
                  {briefing.content.map((field, i) => (
                    <div key={i} class={`${staffPanelInset} px-3 py-2`}>
                      <dt class={staffEyebrow}>{field.label}</dt>
                      <dd class="mt-1 whitespace-pre-wrap break-words text-sm text-virya-text">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <p class="mt-4 text-sm text-virya-muted">{briefing.deadline_note}</p>
          </>
        )}

        {revisableEntries.length > 0 && (
          <div class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.success}`}>
            <p class="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Popraw przed akceptacją</p>
            <p class="mt-1 text-xs text-virya-muted">
              Możesz poprawić tekst — odbiorca, koszt i adresat zostają jak są. Poprawka liczy się jako nauka stylu.
            </p>
            <div class="mt-3 grid gap-3">
              {revisableEntries.map(([field, original]) => (
                <label key={field} class="grid gap-1">
                  <span class={staffEyebrow}>{field}</span>
                  <textarea
                    rows={Math.min(8, Math.max(2, Math.ceil(original.length / 90)))}
                    disabled={busy === item.id}
                    value={edits[field] ?? original}
                    onInput={event => setEdits(current => ({ ...current, [field]: event.currentTarget.value }))}
                    class="input text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {item.executor_ready === false && (
          <p class={`mt-4 text-xs ${staffNoticeBase} ${staffNoticeTones.warn}`}>
            Akceptacja tylko trafi do kolejki — na razie żaden system nie
            potrafi tej akcji wykonać automatycznie. Ktoś musi ją zrobić ręcznie.
          </p>
        )}

        <div class="mt-5 flex flex-wrap items-center gap-2 border-t border-virya-edge pt-4">
          {assignees.length > 0 && (
            <label class="flex items-center gap-2 rounded-md border border-virya-edge bg-virya-bg/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-virya-muted">
              PRZYPISZ
              <select
                aria-label={`Przypisz ${humanAction(item.action_kind)}`}
                disabled={busy === item.id}
                value={item.assignee?.member_key ?? ""}
                onChange={event => void onAssign(item, event.currentTarget.value)}
                class="bg-transparent text-xs font-bold normal-case tracking-normal text-virya-text outline-none"
              >
                {!item.assignee && (
                  <>
                    <option value="">wybierz…</option>
                    <option value="auto">AUTO (równomiernie, wg umiejętności)</option>
                  </>
                )}
                {assignees.map(person => (
                  <option key={person.member_id} value={person.member_key}>{teamMemberLabel(person.display_name)}</option>
                ))}
              </select>
            </label>
          )}
          {/* While edits are typed, "approve" means "approve my words" — a
              plain approve that silently dropped them would read as a lost
              edit. To approve the machine's draft as written, revert the
              field first. */}
          <button
            type="button"
            disabled={busy === item.id}
            onClick={() => void onApprove(item, hasEdits ? changedRevision : undefined)}
            title={item.executor_ready === false ? "Zostanie zakolejkowane, ale nikt tego nie wykona" : undefined}
            class={item.executor_ready === false ? staffConfirmButton : staffAccentButton}
          >{busy === item.id ? "ZAPISUJĘ…" : item.executor_ready === false ? "AKCEPTUJ (TYLKO KOLEJKA)" : hasEdits ? "AKCEPTUJ POPRAWKĘ I PUŚĆ DALEJ" : "AKCEPTUJ I PUŚĆ DALEJ"}</button>
          <button type="button" disabled={busy === item.id} onClick={() => void onReject(item)} class="virya-button min-h-[44px] min-w-0 border border-virya-danger/30 px-4 text-xs text-rose-200 transition-colors hover:border-virya-danger/50 disabled:opacity-50">ODRZUĆ</button>
        </div>
      </div>
    </div>
  )
}

export default function AutopilotHandoffs({ feed }: { feed: AutopilotFeed }) {
  const { overview, loading, error, reload } = feed
  const { busy, error: mutationError, send } = useQueueMutation(reload)
  const [selected, setSelected] = useState<PendingAction | null>(null)

  if (!overview && !loading && !error) return null

  const items = overview?.needs_you ?? []
  const assignees = overview?.available_assignees ?? []
  const manualActions = (overview?.recent_actions ?? []).filter(action => (action.manual_steps?.length ?? 0) > 0)
  const bookingPolicy = overview?.booking_policy ?? null
  const runtimeEnabled = overview === null ? null : Boolean(overview.runtime_enabled)
  const visibleError = mutationError || error

  async function assign(item: PendingAction, memberKey: string) {
    if (!memberKey || memberKey === item.assignee?.member_key || busy !== null) return
    const person = assignees.find(candidate => candidate.member_key === memberKey)
    if (!person) return
    await send(
      item,
      { action_id: item.id, operation: "assign", member_key: memberKey },
      "Nie udało się zmienić ownera",
    )
  }

  async function mutate(item: PendingAction, action: "approve" | "cancel", revision?: Record<string, string>) {
    const body: Record<string, unknown> = { action_id: item.id, operation: action }
    if (revision && Object.keys(revision).length > 0) body.revision = revision
    await send(item, body, "Nie udało się zapisać decyzji")
    setSelected(null)
  }

  return (
    <section id="needs-you" class={`scroll-mt-24 ${staffPanel}`}>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class={staffEyebrowAccent}>Chief of Staff · Needs you</p>
          <h2 class={`mt-2 ${staffTitle}`}>Rzeczy wymagające człowieka</h2>
          <p class={`mt-1 max-w-3xl ${staffSubtitle}`}>
            Kolejka decyzji zespołu: przypisz ownera, zaakceptuj lub odrzuć.
          </p>
        </div>
        <button type="button" disabled={loading} onClick={reload} class={staffSecondaryButton}>
          {loading ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
        </button>
      </div>
      {visibleError && <p role="alert" class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.error}`}>{visibleError}</p>}
      {!visibleError && (
        <div class="mt-4 flex flex-wrap gap-2" aria-label="Stan automatów">
          <ReadinessChip
            ok={runtimeEnabled === true}
            pending={loading && runtimeEnabled === null}
            label={runtimeEnabled === null ? "AUTOMATY · BRAK DANYCH" : runtimeEnabled ? "AUTOMATY ON" : "AUTOMATY OFF"}
          />
        </div>
      )}
      <div class="mt-4 grid gap-3">
        {items.map(item => (
          <article
            key={item.id}
            class={`cursor-pointer ${staffRow}`}
            onClick={() => setSelected(item)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item) } }}
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <strong class="block text-virya-text">{humanAction(item.action_kind)}</strong>
                <p class="mt-1 text-xs uppercase tracking-[0.14em] text-virya-muted">{humanContext(item.context)} · {item.subject_kind}</p>
                {item.briefing && <p class="mt-2 text-sm text-virya-text">{item.briefing.summary}</p>}
                <p class="mt-2 text-sm text-virya-text">
                  Owner: <b class="text-virya-hot">{item.assignee ? teamMemberLabel(item.assignee.display_name) : "przypisuję…"}</b>
                  {" · "}deadline: {date(item.assignment_due_at ?? item.approval_expires_at)}
                </p>
                {item.executor_ready === false && (
                  <p class={`mt-2 text-xs ${staffNoticeBase} ${staffNoticeTones.warn}`}>
                    Akceptacja tylko trafi do kolejki — na razie żaden system nie
                    potrafi tej akcji wykonać automatycznie. Ktoś musi ją zrobić ręcznie.
                  </p>
                )}
                <p class={`mt-2 ${staffEyebrow}`}>Kliknij po szczegóły →</p>
              </div>
              <div class="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                {assignees.length > 0 && (
                  <label class="flex items-center gap-2 rounded-md border border-virya-edge bg-virya-bg/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-virya-muted">
                    PRZYPISZ
                    <select
                      aria-label={`Przypisz ${humanAction(item.action_kind)}`}
                      disabled={busy === item.id}
                      value={item.assignee?.member_key ?? ""}
                      onChange={event => void assign(item, event.currentTarget.value)}
                      class="bg-transparent text-xs font-bold normal-case tracking-normal text-virya-text outline-none"
                    >
                      {!item.assignee && (
                        <>
                          <option value="">wybierz…</option>
                          <option value="auto">AUTO (równomiernie, wg umiejętności)</option>
                        </>
                      )}
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
                  class={item.executor_ready === false ? staffConfirmButton : staffAccentChip}
                >{item.executor_ready === false ? "AKCEPTUJ (TYLKO KOLEJKA)" : "AKCEPTUJ I PUŚĆ DALEJ"}</button>
                <button type="button" disabled={busy === item.id} onClick={() => void mutate(item, "cancel")} class="virya-button min-h-[44px] min-w-0 border border-virya-danger/30 px-4 text-xs text-rose-200 transition-colors hover:border-virya-danger/50 disabled:opacity-50">ODRZUĆ</button>
              </div>
            </div>
          </article>
        ))}
        {!loading && !error && items.length === 0 && <p class="rounded-lg bg-black/20 p-4 text-sm text-virya-muted">Nic nie wymaga teraz ręcznej decyzji.</p>}
      </div>

      {selected && (
        <ActionDetailModal
          item={selected}
          assignees={assignees}
          busy={busy}
          onAssign={assign}
          onApprove={item => void mutate(item, "approve")}
          onReject={item => void mutate(item, "cancel")}
          onClose={() => setSelected(null)}
        />
      )}

      <AgentBoard feed={feed} />

      <details class="mt-6 border-t border-virya-edge pt-5 group" open={false}>
        <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <span>
            <span class={staffEyebrowAccent}>Guardrails automatów</span>
            <span class="ml-3 text-sm text-virya-muted">Polityka bookingowa · ile gramy i gdzie cisnąć</span>
          </span>
          {bookingPolicy && (
            <span class={staffBadge}>v{bookingPolicy.version} · {bookingPolicy.source}</span>
          )}
        </summary>
        <div class="mt-4">
          <BookingPolicyPanel summary={bookingPolicy} onSaved={reload} />
        </div>
      </details>

      {manualActions.length > 0 && (
        <details class="mt-5 border-t border-virya-edge pt-5" open={manualActions.length <= 3}>
          <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span>
              <span class={staffEyebrowAccent}>Dokończ ręcznie</span>
              <span class="ml-3 text-sm text-virya-muted">{manualActions.length} {manualActions.length === 1 ? "rzecz" : "rzeczy"}, których automat nie zrobi bezpiecznie</span>
            </span>
          </summary>
          <div class="mt-3 grid gap-3">
            {manualActions.flatMap(action => (action.manual_steps ?? []).map((step, index) => {
              const href = safeExternalUrl(step.url)
              return (
                <article key={`${action.id}:${index}`} class={staffRow}>
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <strong class="text-virya-text">{step.destination}</strong>
                      <p class="mt-1 text-sm text-virya-text">{step.what_to_do}</p>
                      <p class="mt-1 text-xs text-virya-muted">{step.why_it_matters}</p>
                    </div>
                    {href && <a href={href} target="_blank" rel="noreferrer" class={`${staffSecondaryButton} min-h-[44px]`}>OTWÓRZ ↗</a>}
                  </div>
                </article>
              )
            }))}
          </div>
        </details>
      )}
    </section>
  )
}
