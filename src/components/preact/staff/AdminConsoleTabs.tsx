import { useEffect, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"
import AutopilotHandoffs, { type AutopilotFeed } from "./AutopilotHandoffs"
import { ConfirmButton, Field, Metric, Notice } from "./AdminConsoleUi"
import {
  type EventItem,
  type Overview,
  type SignalOverview,
  api,
  formatDate,
} from "./adminConsoleShared"
import {
  staffAccentButton,
  staffEyebrowAccent,
  staffField,
  staffMetricLabel,
  staffMetricTile,
  staffMetricValue,
  staffMetricValueLg,
  staffNoticeBase,
  staffNoticeTones,
  staffPanel,
  staffPanelFlush,
  staffPanelInset,
  staffSecondaryButton,
  staffSubtitle,
  staffTitle,
} from "./staffUi"

export function OverviewTab({
  overview,
  loading,
  feed,
}: {
  overview: Overview | null
  loading: boolean
  feed: AutopilotFeed
}) {
  const upcoming = (overview?.publicEvents ?? [])
    .filter(event => Date.parse(event.starts_at) >= Date.now() - 12 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  const next = upcoming[0]
  const activeCampaigns = (overview?.operations.campaigns ?? []).filter(campaign => campaign.active)
  const totalFans = (overview?.cities ?? []).reduce((sum, city) => sum + Number(city.fan_count || 0), 0)
  const daysToNext = next
    ? Math.max(0, Math.ceil((Date.parse(next.starts_at) - Date.now()) / 86_400_000))
    : null

  return (
    <div class="relative grid gap-5" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram aktualne dane…" />}
      {overview?.degraded.active && (
        <div role="status" class={`${staffNoticeBase} ${staffNoticeTones.warn}`}>
          Część danych jest chwilowo niedostępna. Możesz nadal korzystać z pozostałych funkcji Staff.
        </div>
      )}

      {next ? (
        <section class="rounded-lg border border-virya-signal/25 bg-virya-surface/70 p-5 sm:p-7">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p class={staffEyebrowAccent}>Najbliższy koncert</p>
              <h2 class="mt-2 text-3xl font-black tracking-tight text-virya-text sm:text-4xl">{next.title}</h2>
              <p class={`mt-3 ${staffSubtitle}`}>{formatDate(next.starts_at)}{next.venue ? ` · ${next.venue}` : ""}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <span class="flex min-h-12 items-center rounded-md border border-virya-edge px-4 text-sm font-black text-virya-text">{daysToNext === 0 ? "DZISIAJ" : `${daysToNext} dni`}</span>
              <a href="/staff/qr/" class={staffAccentButton}>Otwórz Live →</a>
            </div>
          </div>
        </section>
      ) : (
        <section class={staffPanel}><strong class="text-virya-text">Brak nadchodzącego koncertu.</strong></section>
      )}

      <dl class="grid gap-3 sm:grid-cols-3">
        <div class={staffMetricTile}><dt class={staffMetricLabel}>Koncerty</dt><dd class={staffMetricValueLg}>{upcoming.length}</dd></div>
        <div class={staffMetricTile}><dt class={staffMetricLabel}>Aktywne QR</dt><dd class={staffMetricValueLg}>{activeCampaigns.length}</dd></div>
        <div class={staffMetricTile}><dt class={staffMetricLabel}>Fani</dt><dd class={staffMetricValueLg}>{totalFans}</dd></div>
      </dl>

      <AutopilotHandoffs feed={feed} />

      <section class={`${staffPanelFlush}`}>
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-virya-edge px-5 py-4">
          <div><h2 class="text-lg font-black text-virya-text">Nadchodzące</h2><p class="mt-1 text-sm text-virya-muted">Najważniejsze rzeczy przed kolejnymi koncertami.</p></div>
          <div class="flex gap-2">
            <a href="/staff/?tab=admission" class={staffSecondaryButton}>Dodaj gościa</a>
            <a href="/staff/?tab=ticketing" class={staffSecondaryButton}>Bilety</a>
          </div>
        </div>
        <div class="divide-y divide-virya-edge/60">
          {upcoming.slice(0, 5).map(event => (
            <article key={event.id} class="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div><strong class="text-virya-text">{event.title}</strong><p class="mt-1 text-sm text-virya-muted">{formatDate(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p></div>
              <a href={`/pl/live/${encodeURIComponent(event.slug)}/`} class="flex min-h-11 items-center text-[11px] font-black uppercase tracking-[.1em] text-virya-hot">Strona koncertu →</a>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function AdmissionTab({ events }: { events: EventItem[] }) {
  const [issue, setIssue] = useState({
    eventSlug: "",
    poolSlug: "paid-tickets",
    fanEmail: "",
    claimExpiresHours: "72",
  })
  const [reference, setReference] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)
  async function issuePass(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await api<{ public_reference: string; created: boolean }>(
        "/api/staff/admin/admission/issue",
        {
          method: "POST",
          body: {
            ...issue,
            claimExpiresHours: Number(issue.claimExpiresHours),
          },
        },
      )
      setMessage({
        tone: "success",
        text: `${result.created ? "Wydano" : "Już istniała"} wejściówkę ${result.public_reference}. Mail z linkiem odbioru zostanie wysłany automatycznie.`,
      })
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error
          ? error.message
          : "Nie udało się wydać wejściówki",
      })
    } finally {
      setBusy(false)
    }
  }
  async function revokePass() {
    if (!reference) return
    setBusy(true)
    setMessage(null)
    try {
      await api("/api/staff/admin/admission/revoke", {
        method: "POST",
        body: { publicReference: reference },
      })
      setMessage({
        tone: "success",
        text: `Wejściówka ${reference} została unieważniona.`,
      })
      setReference("")
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error
          ? error.message
          : "Nie udało się unieważnić wejściówki",
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="grid gap-5">
      <div class="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={issuePass}
          class={staffPanel}
        >
          <h2 class={staffTitle}>Wydaj wejściówkę</h2>
          <p class={`mt-2 ${staffSubtitle}`}>
            Fan musi mieć aktywny, potwierdzony Sygnał. Wybierz koncert i pulę biletów ustawioną dla tego wydarzenia (zwykle „paid-tickets”).
          </p>
          <div class="mt-5 grid gap-4">
            <label class={staffField}>
              Koncert
              <select
                value={issue.eventSlug}
                onChange={event =>
                  setIssue({ ...issue, eventSlug: event.currentTarget.value })
                }
                class="input mt-2"
              >
                <option value="">Wybierz wydarzenie</option>
                {events.map(event => (
                  <option key={event.slug} value={event.slug}>
                    {event.title} — {formatDate(event.starts_at)}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Pula biletów"
              value={issue.poolSlug}
              onInput={value => setIssue({ ...issue, poolSlug: value })}
            />
            <Field
              label="E-mail fana"
              value={issue.fanEmail}
              onInput={value => setIssue({ ...issue, fanEmail: value })}
              type="email"
            />
            <Field
              label="Ważność linku (godziny)"
              value={issue.claimExpiresHours}
              onInput={value =>
                setIssue({ ...issue, claimExpiresHours: value })
              }
              type="number"
            />
            <button type="submit"
              disabled={busy || !issue.eventSlug || !issue.fanEmail}
              class={staffAccentButton}
            >
              Wydaj wejściówkę
            </button>
          </div>
        </form>
        <div class={staffPanel}>
          <h2 class={staffTitle}>Unieważnij wejściówkę</h2>
          <p class={`mt-2 ${staffSubtitle}`}>
            Operacja jest natychmiastowa — kod QR przestanie działać na bramce. Wpisz kod z rezerwacji fana i potwierdź dwuklikiem.
          </p>
          <div class="mt-5 grid gap-4">
            <Field
              label="Kod wejściówki"
              value={reference}
              onInput={setReference}
            />
            <ConfirmButton
              onConfirm={() => void revokePass()}
              busy={busy}
              busyLabel="UNIEWAŻNIAM…"
              confirmLabel="TAK, UNIEWAŻNIJ"
              disabled={!reference}
            >
              Unieważnij
            </ConfirmButton>
          </div>
        </div>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  )
}

export function SignalTab() {
  const [overview, setOverview] = useState<SignalOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setMessage("")
    try {
      setOverview(
        await api<SignalOverview>("/api/staff/admin/signal/overview", {
          signal,
        }),
      )
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać statystyk Sygnału",
        )
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  const summary = overview?.summary
  const activity = overview?.activity
  const confirmationRate = summary?.total_fans
    ? Math.round((summary.active_fans / summary.total_fans) * 100)
    : 0
  const consentRate = summary?.active_fans
    ? Math.round((summary.marketing_opted_in / summary.active_fans) * 100)
    : 0

  return (
    <div class="relative grid gap-5" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram statystyki Sygnału…" />}
      <section class="border-b border-virya-edge pb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class={staffEyebrowAccent}>
              Virya Signal
            </p>
            <h2 class="mt-2 text-2xl font-black text-virya-text">Baza fanów bez PII</h2>
            <p class={`mt-2 max-w-3xl ${staffSubtitle}`}>
              Zagregowane dane: potwierdzenia, zgody, polecenia, zainteresowania
              koncertami i najmocniejsze miasta. Panel nie pobiera e-maili ani identyfikatorów fanów.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            class={staffSecondaryButton}
          >
            {loading ? "Odświeżam…" : "Odśwież"}
          </button>
        </div>
      </section>

      {overview?.unavailable_sources.length ? (
        <div role="status" class={`${staffNoticeBase} ${staffNoticeTones.warn}`}>
          Snapshot działa częściowo. Niedostępne źródła: {overview.unavailable_sources.join(", ")}.
        </div>
      ) : null}

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Aktywni fani" value={summary ? String(summary.active_fans) : "…"} />
        <Metric label="Potwierdzenie" value={summary ? `${confirmationRate}%` : "…"} />
        <Metric label="Zgoda marketingowa" value={summary ? `${consentRate}%` : "…"} />
        <Metric label="Nowi / 30 dni" value={activity ? String(activity.new_fans_30d) : "…"} />
      </div>

      <div class="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section class={`${staffPanel} sm:p-6`}>
          <h3 class={staffTitle}>Stan bazy</h3>
          <dl class="mt-5 grid gap-3 sm:grid-cols-2">
            <SignalStat label="Wszyscy" value={summary?.total_fans} />
            <SignalStat label="Oczekujący" value={summary?.pending_fans} />
            <SignalStat label="Wypisani" value={summary?.unsubscribed_fans} />
            <SignalStat label="Wyciszeni" value={summary?.suppressed_fans} />
            <SignalStat label="Nearby aktywne" value={summary?.nearby_enabled} />
            <SignalStat label="Miasta do moderacji" value={activity?.pending_city_requests} />
          </dl>
        </section>

        <section class={`${staffPanel} sm:p-6`}>
          <h3 class={staffTitle}>Aktywność</h3>
          <dl class="mt-5 grid gap-3">
            <SignalStat label="Nowi / 7 dni" value={activity?.new_fans_7d} />
            <SignalPair
              label="Polecenia 30 dni / całość"
              recent={activity?.referral_attributions_30d}
              total={activity?.referral_attributions_total}
            />
            <SignalPair
              label="Zainteresowania 30 dni / całość"
              recent={activity?.event_interests_30d}
              total={activity?.event_interests_total}
            />
            <SignalStat label="Nearby wysłane / 30 dni" value={activity?.nearby_notifications_30d} />
          </dl>
        </section>
      </div>

      <section class={`overflow-hidden ${staffPanelFlush}`}>
        <div class="border-b border-virya-edge p-5 sm:p-6">
          <h3 class={staffTitle}>Najsilniejsze miasta</h3>
          <p class="mt-1 text-sm text-virya-muted">
            Maksymalnie 10 zagregowanych lokalizacji aktywnych fanów.
          </p>
        </div>
        <div class="divide-y divide-virya-edge/60">
          {(overview?.top_cities ?? []).map((city, index) => (
            <article key={city.slug} class="flex items-center justify-between gap-4 p-5">
              <div class="min-w-0">
                <span class="text-xs font-black text-virya-muted">#{index + 1}</span>
                <strong class="ml-3 text-virya-text">{city.name}</strong>
                <span class="ml-2 text-xs text-virya-muted">{city.country_code}</span>
              </div>
              <strong class="tabular-nums text-virya-hot">{city.active_fans}</strong>
            </article>
          ))}
          {overview && overview.top_cities.length === 0 ? (
            <p class="p-5 text-sm text-virya-muted">Brak danych miejskich w tym snapshotcie.</p>
          ) : null}
          {!overview && !message ? (
            <p class="p-5 text-sm text-virya-muted">Ładuję statystyki Sygnału…</p>
          ) : null}
        </div>
      </section>

      {overview ? (
        <p class="text-xs text-virya-muted">Snapshot: {formatDate(overview.generated_at)} · dane wyłącznie zagregowane</p>
      ) : null}
      {message ? (
        <p role="status" class={`${staffNoticeBase} ${staffNoticeTones.error}`}>
          {message}
        </p>
      ) : null}
    </div>
  )
}

function SignalStat({ label, value }: { label: string; value?: number }) {
  return (
    <div class={staffPanelInset}>
      <dt class={staffMetricLabel}>{label}</dt>
      <dd class="mt-2 text-2xl font-black tabular-nums text-virya-text">{value ?? "…"}</dd>
    </div>
  )
}

function SignalPair({
  label,
  recent,
  total,
}: {
  label: string
  recent?: number
  total?: number
}) {
  return (
    <div class={staffPanelInset}>
      <dt class={staffMetricLabel}>{label}</dt>
      <dd class={staffMetricValue}>
        {recent ?? "…"} / {total ?? "…"}
      </dd>
    </div>
  )
}
