import { useEffect, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"
import AutopilotHandoffs, { useAutopilotFeed } from "./AutopilotHandoffs"
import OpportunityBoard from "./OpportunityBoard"
import { Field, Metric } from "./AdminConsoleUi"
import {
  type EventItem,
  type Overview,
  type SignalOverview,
  api,
  formatDate,
} from "./adminConsoleShared"
import { staffAccentButton, staffSecondaryButton } from "./staffButtons"

export function OverviewTab({
  overview,
  loading,
}: {
  overview: Overview | null
  loading: boolean
}) {
  const feed = useAutopilotFeed()
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
        <div role="status" class="border border-amber-300/25 bg-amber-300/[.06] px-4 py-3 text-sm text-zinc-200">
          Część danych jest chwilowo niedostępna. Możesz nadal korzystać z pozostałych funkcji Staff.
        </div>
      )}

      {next ? (
        <section class="border border-amber-400/25 bg-[radial-gradient(circle_at_90%_0%,rgba(132,180,172,.12),transparent_35%),rgba(16,23,21,.65)] p-5 sm:p-7">
          <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p class="text-[11px] font-black uppercase tracking-[.15em] text-amber-400">Najbliższy koncert</p>
              <h2 class="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">{next.title}</h2>
              <p class="mt-3 text-sm text-zinc-400">{formatDate(next.starts_at)}{next.venue ? ` · ${next.venue}` : ""}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <span class="flex min-h-12 items-center border border-zinc-700 px-4 text-sm font-black text-white">{daysToNext === 0 ? "DZISIAJ" : `${daysToNext} dni`}</span>
              <a href="/staff/qr/" class={staffAccentButton}>Otwórz Live →</a>
            </div>
          </div>
        </section>
      ) : (
        <section class="border border-zinc-800 bg-zinc-900/40 p-5"><strong class="text-white">Brak nadchodzącego koncertu.</strong></section>
      )}

      <dl class="grid gap-px overflow-hidden border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
        <div class="bg-zinc-950 p-5"><dt class="text-[11px] font-bold uppercase tracking-[.12em] text-zinc-500">Koncerty</dt><dd class="mt-2 text-3xl font-black text-white">{upcoming.length}</dd></div>
        <div class="bg-zinc-950 p-5"><dt class="text-[11px] font-bold uppercase tracking-[.12em] text-zinc-500">Aktywne QR</dt><dd class="mt-2 text-3xl font-black text-white">{activeCampaigns.length}</dd></div>
        <div class="bg-zinc-950 p-5"><dt class="text-[11px] font-bold uppercase tracking-[.12em] text-zinc-500">Fani</dt><dd class="mt-2 text-3xl font-black text-white">{totalFans}</dd></div>
      </dl>

      <AutopilotHandoffs feed={feed} />

      <section class="border border-zinc-800 bg-zinc-900/35">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div><h2 class="text-lg font-black text-white">Nadchodzące</h2><p class="mt-1 text-sm text-zinc-500">Najważniejsze rzeczy przed kolejnymi koncertami.</p></div>
          <div class="flex gap-2">
            <a href="/staff/?tab=admission" class="min-h-11 border border-zinc-700 px-4 py-3 text-[11px] font-black uppercase tracking-[.1em] text-zinc-200">Dodaj gościa</a>
            <a href="/staff/?tab=ticketing" class="min-h-11 border border-zinc-700 px-4 py-3 text-[11px] font-black uppercase tracking-[.1em] text-zinc-200">Bilety</a>
          </div>
        </div>
        <div class="divide-y divide-zinc-800/80">
          {upcoming.slice(0, 5).map(event => (
            <article key={event.id} class="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div><strong class="text-white">{event.title}</strong><p class="mt-1 text-sm text-zinc-500">{formatDate(event.starts_at)}{event.venue ? ` · ${event.venue}` : ""}</p></div>
              <a href={`/pl/live/${encodeURIComponent(event.slug)}/`} class="flex min-h-11 items-center text-[11px] font-black uppercase tracking-[.1em] text-amber-400">Strona koncertu →</a>
            </article>
          ))}
        </div>
      </section>

      <OpportunityBoard feed={feed} />
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
  const [message, setMessage] = useState("")
  async function issuePass(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
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
      setMessage(
        `${result.created ? "Wydano" : "Już istniała"} wejściówkę ${result.public_reference}. Mail z linkiem odbioru zostanie wysłany automatycznie.`,
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się wydać wejściówki",
      )
    } finally {
      setBusy(false)
    }
  }
  async function revokePass(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/admin/admission/revoke", {
        method: "POST",
        body: { publicReference: reference },
      })
      setMessage(`Wejściówka ${reference} została unieważniona.`)
      setReference("")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się unieważnić wejściówki",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="grid gap-5">
      <div class="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={issuePass}
          class="rounded-xl border border-white/10 bg-zinc-900/70 p-5"
        >
          <h2 class="text-xl font-black text-white">Wydaj wejściówkę</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Fan musi mieć aktywny, potwierdzony Sygnał. Podaj slug puli skonfigurowanej dla tego koncertu.
          </p>
          <div class="mt-5 grid gap-4">
            <label class="text-sm font-semibold text-zinc-200">
              Koncert
              <select
                value={issue.eventSlug}
                onChange={event =>
                  setIssue({ ...issue, eventSlug: event.currentTarget.value })
                }
                class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
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
              label="Slug puli"
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
            <button
              disabled={busy || !issue.eventSlug || !issue.fanEmail}
              class={staffAccentButton}
            >
              Wydaj wejściówkę
            </button>
          </div>
        </form>
        <form
          onSubmit={revokePass}
          class="rounded-xl border border-white/10 bg-zinc-900/70 p-5"
        >
          <h2 class="text-xl font-black text-white">Unieważnij wejściówkę</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Operacja jest natychmiastowa. Kod QR przestanie działać na bramce.
          </p>
          <div class="mt-5 grid gap-4">
            <Field
              label="Public reference"
              value={reference}
              onInput={setReference}
            />
            <button
              disabled={busy || !reference}
              class="rounded-xl border border-rose-400/40 bg-rose-400/10 px-5 py-3 font-black text-rose-100 disabled:opacity-50"
            >
              Unieważnij
            </button>
          </div>
        </form>
      </div>
      {message && (
        <p
          role="status"
          class="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
          {message}
        </p>
      )}
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
      <section class="border-b border-zinc-800 pb-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              Virya Signal
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">Baza fanów bez PII</h2>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
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
        <div
          role="status"
          class="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
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
        <section class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <h3 class="text-xl font-black text-white">Stan bazy</h3>
          <dl class="mt-5 grid gap-3 sm:grid-cols-2">
            <SignalStat label="Wszyscy" value={summary?.total_fans} />
            <SignalStat label="Oczekujący" value={summary?.pending_fans} />
            <SignalStat label="Wypisani" value={summary?.unsubscribed_fans} />
            <SignalStat label="Wyciszeni" value={summary?.suppressed_fans} />
            <SignalStat label="Nearby aktywne" value={summary?.nearby_enabled} />
            <SignalStat label="Miasta do moderacji" value={activity?.pending_city_requests} />
          </dl>
        </section>

        <section class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <h3 class="text-xl font-black text-white">Aktywność</h3>
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

      <section class="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
        <div class="border-b border-white/10 p-5 sm:p-6">
          <h3 class="text-xl font-black text-white">Najsilniejsze miasta</h3>
          <p class="mt-1 text-sm text-zinc-500">
            Maksymalnie 10 zagregowanych lokalizacji aktywnych fanów.
          </p>
        </div>
        <div class="divide-y divide-white/5">
          {(overview?.top_cities ?? []).map((city, index) => (
            <article key={city.slug} class="flex items-center justify-between gap-4 p-5">
              <div class="min-w-0">
                <span class="text-xs font-black text-zinc-600">#{index + 1}</span>
                <strong class="ml-3 text-white">{city.name}</strong>
                <span class="ml-2 text-xs text-zinc-500">{city.country_code}</span>
              </div>
              <strong class="tabular-nums text-amber-300">{city.active_fans}</strong>
            </article>
          ))}
          {overview && overview.top_cities.length === 0 ? (
            <p class="p-5 text-sm text-zinc-500">Brak danych miejskich w tym snapshotcie.</p>
          ) : null}
          {!overview && !message ? (
            <p class="p-5 text-sm text-zinc-500">Ładuję statystyki Sygnału…</p>
          ) : null}
        </div>
      </section>

      {overview ? (
        <p class="text-xs text-zinc-600">Snapshot: {formatDate(overview.generated_at)} · dane wyłącznie zagregowane</p>
      ) : null}
      {message ? (
        <p
          role="status"
          class="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

function SignalStat({ label, value }: { label: string; value?: number }) {
  return (
    <div class="rounded-lg border border-white/10 bg-black/30 p-4">
      <dt class="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd class="mt-2 text-2xl font-black tabular-nums text-white">{value ?? "…"}</dd>
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
    <div class="rounded-lg border border-white/10 bg-black/30 p-4">
      <dt class="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd class="mt-2 text-xl font-black tabular-nums text-white">
        {recent ?? "…"} / {total ?? "…"}
      </dd>
    </div>
  )
}

export function StatusCard({ title, body, loading = false }: { title: string; body?: string; loading?: boolean }) {
  return (
    <section class="relative mx-auto min-h-40 max-w-xl rounded-xl border border-white/10 bg-zinc-900/80 p-8" aria-busy={loading}>
      {loading && <BackendLoader overlay label={title} />}
      <h1 class="text-2xl font-black text-white">{title}</h1>
      {body && <p class="mt-3 text-zinc-400">{body}</p>}
    </section>
  )
}
