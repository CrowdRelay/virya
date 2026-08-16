import { useEffect, useState } from "preact/hooks"
import EcosystemControl from "./EcosystemControl"
import BackendLoader from "./BackendLoader"
import OpsTimelinePanel from "./OpsTimelinePanel"
import AutopilotHandoffs from "./AutopilotHandoffs"
import { OrderStatusBadge } from "./AdminTicketingTab"
import { Field, Metric } from "./AdminConsoleUi"
import {
  type Capabilities,
  type EventItem,
  type OpsOverview,
  type Overview,
  type SignalOverview,
  api,
  formatDate,
} from "./adminConsoleShared"

export function OverviewTab({
  overview,
  capabilities,
  loading,
}: {
  overview: Overview | null
  capabilities: Capabilities | null
  loading: boolean
}) {
  const upcoming = (overview?.publicEvents ?? []).filter(
    event => Date.parse(event.starts_at) >= Date.now() - 12 * 60 * 60 * 1000,
  )
  const activeCampaigns = (overview?.operations.campaigns ?? []).filter(
    campaign => campaign.active,
  )
  const totalFans = (overview?.cities ?? []).reduce(
    (sum, city) => sum + Number(city.fan_count || 0),
    0,
  )
  return (
    <div class="relative grid gap-5" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram stan CrowdRelay…" />}
      {overview?.degraded.active && (
        <div
          role="status"
          class="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
          Panel działa w trybie częściowym. Niedostępne źródła: {overview.degraded.unavailableSources.join(", ")}.
          Pozostałe dane są nadal aktualizowane niezależnie.
        </div>
      )}
      <AutopilotHandoffs />
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="CrowdRelay API"
          value={
            overview?.services.ready === "ready"
              ? "READY"
              : overview
                ? "PROBLEM"
                : "…"
          }
          ok={overview?.services.ready === "ready"}
        />
        <Metric label="Nadchodzące koncerty" value={String(upcoming.length)} />
        <Metric
          label="Aktywne kampanie QR"
          value={String(activeCampaigns.length)}
        />
        <Metric label="Potwierdzeni fani / sygnały" value={String(totalFans)} />
      </div>
      <div class="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <section class="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
          <div class="border-b border-white/10 p-5">
            <h2 class="text-xl font-black text-white">Koncerty</h2>
            <p class="mt-1 text-sm text-zinc-400">
              Dane ładowane z CrowdRelay, nie ze statycznego pliku strony.
            </p>
          </div>
          <div class="divide-y divide-white/5">
            {upcoming.map(event => (
              <article
                key={event.id}
                class="flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div>
                  <strong class="text-white">{event.title}</strong>
                  <p class="mt-1 text-sm text-zinc-500">
                    {formatDate(event.starts_at)}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </div>
                <a
                  href={`/pl/live/${encodeURIComponent(event.slug)}/`}
                  class="text-sm font-bold text-amber-300 hover:text-amber-200"
                >
                  Otwórz stronę →
                </a>
              </article>
            ))}
            {upcoming.length === 0 && (
              <p class="p-5 text-sm text-zinc-500">
                Brak nadchodzących koncertów.
              </p>
            )}
          </div>
        </section>
        <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
          <h2 class="text-xl font-black text-white">Gotowość</h2>
          <div class="mt-4 grid gap-3">
            <Capability
              label="CrowdRelay admin"
              ok={!!capabilities?.crowdrelayAdmin}
            />
            <Capability
              label="Commerce / Stripe sync"
              ok={!!capabilities?.crowdrelayCommerce && !!capabilities?.stripe}
            />
            <Capability
              label="Podpisane webhooki"
              ok={!!capabilities?.crowdrelayWebhook}
            />
            <Capability
              label="Mailer CrowdRelay"
              ok={!!capabilities?.crowdrelayMailer && !!capabilities?.gmail}
            />
            <Capability
              label="Mailer biletów"
              ok={!!capabilities?.ticketMailer && !!capabilities?.gmail}
            />
          </div>
        </section>
      </div>
      <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-white">
              Kampanie QR i check-in
            </h2>
            <p class="mt-1 text-sm text-zinc-400">
              Pełne tworzenie, podgląd kodu i unieważnianie zostaje w
              dedykowanym widoku live ops.
            </p>
          </div>
          <a
            href="/staff/qr/"
            class="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950"
          >
            Zarządzaj QR
          </a>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2">
          {(overview?.operations.campaigns ?? []).slice(0, 6).map(campaign => (
            <div key={campaign.id} class="rounded-2xl bg-black/30 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <strong class="text-white">{campaign.event_title}</strong>
                  <p class="mt-1 text-xs text-zinc-500">{campaign.label}</p>
                </div>
                <Badge
                  ok={campaign.active}
                  text={campaign.active ? "aktywna" : "zamknięta"}
                />
              </div>
              <p class="mt-3 text-sm text-zinc-400">
                Check-in:{" "}
                <strong class="text-white">{campaign.checkin_count}</strong>
                {campaign.max_checkins == null
                  ? ""
                  : ` / ${campaign.max_checkins}`}
              </p>
            </div>
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
        `${result.created ? "Wydano" : "Już istniała"} wejściówkę ${result.public_reference}. Mail z linkiem odbioru zostanie wysłany przez CrowdRelay.`,
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
          class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5"
        >
          <h2 class="text-xl font-black text-white">Wydaj wejściówkę</h2>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Fan musi mieć aktywny, potwierdzony Sygnał. Podaj slug puli z
            bootstrapu CrowdRelay.
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
              class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
            >
              Wydaj wejściówkę
            </button>
          </div>
        </form>
        <form
          onSubmit={revokePass}
          class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5"
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

export function MailerTab({ capabilities }: { capabilities: Capabilities | null }) {
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function test(event: SubmitEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/admin/mailer/test", {
        method: "POST",
        body: { to },
      })
      setMessage(`Test wysłany na ${to}.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nie udało się wysłać testu",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div class="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <h2 class="text-xl font-black text-white">Stan mailera</h2>
        <div class="mt-5 grid gap-3">
          <Capability label="Gmail transport" ok={!!capabilities?.gmail} />
          <Capability
            label="CrowdRelay template mailer"
            ok={!!capabilities?.crowdrelayMailer}
          />
          <Capability
            label="Ticket QR mailer"
            ok={!!capabilities?.ticketMailer}
          />
        </div>
        <p class="mt-5 text-sm leading-6 text-zinc-500">
          Zwykłe maile, potwierdzenia Sygnału, wiadomości o koncertach i bilety
          korzystają z jednego transportu Gmail, ale mają oddzielne tokeny
          wejściowe.
        </p>
      </section>
      <form
        onSubmit={test}
        class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5"
      >
        <h2 class="text-xl font-black text-white">Test dostarczenia</h2>
        <p class="mt-2 text-sm leading-6 text-zinc-400">
          Wysyła prosty mail diagnostyczny bez uruchamiania CrowdRelay ani n8n.
        </p>
        <div class="mt-5 grid gap-4">
          <Field
            label="Adres testowy"
            value={to}
            onInput={setTo}
            type="email"
          />
          <button
            disabled={busy || !to || !capabilities?.gmail}
            class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Wysyłam…" : "Wyślij test"}
          </button>
        </div>
        {message && (
          <p
            role="status"
            class="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
          >
            {message}
          </p>
        )}
      </form>
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
      <section class="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              Virya Signal control plane
            </p>
            <h2 class="mt-2 text-2xl font-black text-white">Baza fanów bez PII</h2>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Agregaty z CrowdRelay: potwierdzenia, zgody, polecenia, zainteresowania
              koncertami i najmocniejsze miasta. Panel nie pobiera e-maili ani identyfikatorów fanów.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Odświeżam…" : "Odśwież"}
          </button>
        </div>
      </section>

      {overview?.unavailable_sources.length ? (
        <div
          role="status"
          class="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
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
        <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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

        <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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

      <section class="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
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
    <div class="rounded-2xl border border-white/10 bg-black/30 p-4">
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
    <div class="rounded-2xl border border-white/10 bg-black/30 p-4">
      <dt class="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd class="mt-2 text-xl font-black tabular-nums text-white">
        {recent ?? "…"} / {total ?? "…"}
      </dd>
    </div>
  )
}

export function OpsTab() {
  const [overview, setOverview] = useState<OpsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [clearingDead, setClearingDead] = useState(false)
  const [message, setMessage] = useState("")

  async function load(signal?: AbortSignal, preserveMessage = false) {
    setLoading(true)
    if (!preserveMessage) setMessage("")
    try {
      setOverview(
        await api<OpsOverview>("/api/staff/admin/ops/summary", { signal }),
      )
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage(
          error instanceof Error ? error.message : "Nie udało się pobrać kolejek",
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

  async function clearDeadDeliveries() {
    if (busyId || clearingDead || (overview?.summary.deliveries.dead ?? 0) === 0) return
    const count = overview?.summary.deliveries.dead ?? overview?.deadDeliveries.length ?? 0
    if (!window.confirm(
      `Wyczyścić ${count} martwych dostaw webhooków z aktywnej kolejki?\n\nTylko status dead zostanie oznaczony jako cancelled. Pending, processing i dostarczone wpisy pozostaną bez zmian; historia prób i audyt zostają zachowane.`,
    )) return
    setClearingDead(true)
    setMessage("")
    try {
      const result = await api<{ cleared?: number; replayed?: boolean }>(
        "/api/staff/admin/ops/retry",
        { method: "POST", body: { operation: "clear_dead_deliveries" } },
      )
      const cleared = Math.max(0, Number(result.cleared ?? 0))
      setMessage(
        result.replayed
          ? "Ta operacja czyszczenia została już przyjęta. Odświeżam stan kolejki."
          : `Wyczyszczono ${cleared} martwych dostaw z aktywnej kolejki. Historia i audyt zostały zachowane.`,
      )
      await load(undefined, true)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się wyczyścić martwych dostaw",
      )
    } finally {
      setClearingDead(false)
    }
  }

  async function retry(target: "outbox" | "delivery", id: string) {
    if (busyId || clearingDead) return
    setBusyId(id)
    setMessage("")
    try {
      await api("/api/staff/admin/ops/retry", {
        method: "POST",
        body: { target, id },
      })
      setMessage("Element wrócił do kolejki. Historia prób została zachowana.")
      await load(undefined, true)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się ponowić operacji",
      )
    } finally {
      setBusyId("")
    }
  }

  const outbox = overview?.summary.outbox
  const deliveries = overview?.summary.deliveries
  const push = overview?.summary.push
  const watchdog = overview?.summary.watchdog
  const items = [
    ...(overview?.deadDeliveries ?? []).map(item => ({
      ...item,
      target: "delivery" as const,
    })),
    ...(overview?.deadOutbox ?? []).map(item => ({
      ...item,
      target: "outbox" as const,
    })),
  ].sort(
    (a, b) =>
      Date.parse(b.dead_at ?? b.created_at) -
      Date.parse(a.dead_at ?? a.created_at),
  )

  return (
    <div class="grid gap-5">
      <EcosystemControl />
      <OpsTimelinePanel />
      <section class="relative rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6" aria-busy={loading}>
        {loading && <BackendLoader overlay label="Pobieram kolejki CrowdRelay…" />}
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-white">
              Control plane CrowdRelay
            </h2>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Trwały stan outboxa i dostaw webhooków. Panel pokazuje wyłącznie
              metadane operacyjne — bez payloadów, maili i sekretów.
            </p>
          </div>
          <button
            type="button"
            disabled={!!busyId || clearingDead || loading}
            onClick={() => void load()}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Odśwież kolejki
          </button>
        </div>
        {(overview?.degraded?.length ?? 0) > 0 && (
          <div class="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[.07] p-4" role="status">
            <strong class="text-sm font-black text-amber-100">Częściowa diagnostyka kolejek</strong>
            <p class="mt-1 text-xs leading-5 text-zinc-400">
              Podsumowanie działa, ale nie udało się pobrać: {overview?.degraded?.join(", ")}.
              Retry i licznik kolejki pozostają dostępne; odśwież, aby ponowić diagnostykę.
            </p>
          </div>
        )}
        {(watchdog?.active_alerts ?? 0) > 0 && (
          <div
            class="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[.07] p-4"
            role="status"
          >
            <strong class="text-sm font-black text-amber-100">
              Autopilot pilnuje {watchdog?.active_alerts ?? 0} aktywnych incydentów
            </strong>
            <p class="mt-1 text-xs leading-5 text-zinc-400">
              {watchdog?.critical_alerts
                ? `${watchdog.critical_alerts} krytyczne · `
                : ""}
              Stan jest trwały w CrowdRelay; n8n jest tylko kanałem powiadomienia.
            </p>
          </div>
        )}
        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Outbox pending"
            value={outbox ? String(outbox.pending) : "…"}
            ok={!outbox || outbox.dead === 0}
          />
          <Metric
            label="Outbox dead"
            value={outbox ? String(outbox.dead) : "…"}
            ok={!outbox || outbox.dead === 0}
          />
          <Metric
            label="Dostawy pending"
            value={deliveries ? String(deliveries.pending) : "…"}
            ok={!deliveries || deliveries.dead === 0}
          />
          <Metric
            label="Dostawy dead"
            value={deliveries ? String(deliveries.dead) : "…"}
            ok={!deliveries || deliveries.dead === 0}
          />
          <Metric
            label="Push pending"
            value={push ? String(push.pending) : "…"}
            ok={!push || push.dead === 0}
          />
          <Metric
            label="Push in-flight"
            value={push ? String(push.processing) : "…"}
            ok={!push || push.dead === 0}
          />
          <Metric
            label="Push failed"
            value={push ? String(push.dead) : "…"}
            ok={!push || push.dead === 0}
          />
          <Metric
            label="Push 24 h"
            value={push ? String(push.delivered_24h) : "…"}
            ok={!push || push.dead === 0}
          />
        </div>
        {(deliveries?.dead ?? 0) > 0 && (
          <div class="mt-4 flex flex-col gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/[.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong class="text-sm font-black text-rose-100">
                {deliveries?.dead ?? 0} martwych dostaw webhooków
              </strong>
              <p class="mt-1 text-xs leading-5 text-zinc-400">
                Wyczyść usuwa je wyłącznie z aktywnej kolejki przez stan cancelled.
                Pending, processing i dostarczone wpisy nie są ruszane; historia prób i audyt zostają.
              </p>
            </div>
            <button
              type="button"
              disabled={!!busyId || clearingDead || loading}
              onClick={() => void clearDeadDeliveries()}
              class="min-h-11 shrink-0 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-2 text-sm font-black text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {clearingDead
                ? "Czyszczę…"
                : `Wyczyść dead dostawy (${deliveries?.dead ?? 0})`}
            </button>
          </div>
        )}
        {(outbox || deliveries || push) && (
          <p class="mt-4 text-xs text-zinc-500">
            Najstarszy gotowy element:{" "}
            {Math.max(
              outbox?.oldest_pending_seconds ?? 0,
              deliveries?.oldest_pending_seconds ?? 0,
            )}{" "}
            s · dostarczone w 24 h: {outbox?.delivered_24h ?? 0} eventów /{" "}
            {deliveries?.delivered_24h ?? 0} webhooków
          </p>
        )}
      </section>

      <section class="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
        <div class="border-b border-white/10 p-5 sm:p-6">
          <h3 class="text-lg font-black text-white">Wymaga uwagi</h3>
          <p class="mt-1 text-sm text-zinc-500">
            Retry jest dostępny tylko dla elementów w stanie dead i zapisuje
            audytowalną akcję operatora.
          </p>
        </div>
        <div class="grid gap-3 p-4 sm:p-5">
          {items.map(item => (
            <article
              key={`${item.target}-${item.id}`}
              class="grid gap-4 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge
                    status={item.target === "delivery" ? "webhook_failed" : "outbox_failed"}
                  />
                  <span class="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {item.target === "delivery"
                      ? "webhook delivery"
                      : "outbox event"}
                  </span>
                </div>
                <strong class="mt-3 block break-words text-white">
                  {item.event_type}
                </strong>
                <p class="mt-1 break-all font-mono text-xs text-zinc-500">
                  {item.id}
                </p>
                <p class="mt-2 text-xs text-zinc-400">
                  {item.endpoint_name ? `${item.endpoint_name} · ` : ""}
                  {item.last_error_kind ?? "brak kategorii błędu"} ·{" "}
                  {formatDate(item.dead_at)}
                </p>
              </div>
              <button
                type="button"
                disabled={!!busyId || clearingDead || item.endpoint_active === false}
                onClick={() => void retry(item.target, item.id)}
                class="min-h-11 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyId === item.id
                  ? "Ponawiam…"
                  : item.endpoint_active === false
                    ? "Endpoint wyłączony"
                    : "Ponów bezpiecznie"}
              </button>
            </article>
          ))}
          {overview && items.length === 0 && (
            <div class="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
              <strong class="text-emerald-100">Kolejki są czyste</strong>
              <p class="mt-2 text-sm text-emerald-50/60">
                Brak martwych eventów i dostaw wymagających ręcznej decyzji.
              </p>
            </div>
          )}
          {!overview && !message && (
            <p class="text-sm text-zinc-500">Ładuję stan operacyjny…</p>
          )}
        </div>
      </section>
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

export function SystemTab({
  capabilities,
  overview,
  loading,
}: {
  capabilities: Capabilities | null
  overview: Overview | null
  loading: boolean
}) {
  const cards = [
    [
      "CrowdRelay API",
      overview?.services.ready === "ready",
      "Fan data, wydarzenia, bilety i wejściówki",
    ],
    [
      "CrowdRelay admin key",
      capabilities?.crowdrelayAdmin,
      "Serwerowe operacje panelu",
    ],
    [
      "Commerce key",
      capabilities?.crowdrelayCommerce,
      "Stripe checkout i potwierdzanie płatności",
    ],
    [
      "Webhook HMAC",
      capabilities?.crowdrelayWebhook,
      "Podpisane eventy do n8n",
    ],
    ["Stripe", capabilities?.stripe, "Sprzedaż i refundy"],
    ["Gmail", capabilities?.gmail, "Wysyłka wszystkich wiadomości"],
    [
      "Push runtime",
      overview?.push?.enabled,
      overview?.push
        ? `Android ${overview.push.android_fcm ? "OK" : "OFF"} · Web ${overview.push.web_push ? "OK" : "OFF"}`
        : "Stan providerów push niedostępny",
    ],
  ] as Array<[string, boolean | undefined, string]>
  return (
    <div class="relative grid gap-5" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram stan integracji…" />}
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, ok, description]) => (
          <article
            key={label}
            class={`rounded-2xl border p-5 ${ok ? "border-emerald-400/20 bg-emerald-400/5" : "border-rose-400/25 bg-rose-400/5"}`}
          >
            <div class="flex items-center justify-between gap-3">
              <strong class="text-white">{label}</strong>
              <Badge ok={!!ok} text={ok ? "SET" : "MISSING"} />
            </div>
            <p class="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
          </article>
        ))}
      </section>
      <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5">
        <h2 class="text-xl font-black text-white">Narzędzia operacyjne</h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LinkCard
            href="/staff/qr/"
            title="QR i bramka"
            body="Kampanie check-in i skanowanie"
          />
          <LinkCard
            href="/staff/accounting/"
            title="Księgowość"
            body="WEW, VAT, refundy i CSV"
          />
          <LinkCard
            href="https://n8n.virya.music/"
            title="n8n"
            body="Dispatcher i workflowy"
            external
          />
          <LinkCard
            href="https://app.netlify.com/"
            title="Netlify"
            body="Deploye, funkcje i envy"
            external
          />
        </div>
      </section>
      <section class="rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
        <h2 class="text-lg font-black text-amber-100">Granica obecnego API</h2>
        <p class="mt-2 text-sm leading-6 text-amber-50/70">
          Panel obejmuje dziś ticketing, wejściówki/QR, audience i kampanie komunikacyjne,
          księgowość, Autopilot/booking, proofy, kolejki, push oraz kill-switche ekosystemu.
          Rzeczy bez bezpiecznego endpointu operatora nadal nie są obchodzone bezpośrednim
          dostępem do bazy — najpierw kontrakt Rust, potem kontrolka w tym panelu.
        </p>
      </section>
    </div>
  )
}

function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div class="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/25 px-4 py-3">
      <span class="text-sm text-zinc-300">{label}</span>
      <Badge ok={ok} text={ok ? "gotowe" : "brak"} />
    </div>
  )
}
function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      class={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider ${ok ? "bg-emerald-300 text-emerald-950" : "bg-rose-300 text-rose-950"}`}
    >
      {text}
    </span>
  )
}
function LinkCard({
  href,
  title,
  body,
  external = false,
}: {
  href: string
  title: string
  body: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      class="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:-translate-y-0.5 hover:border-amber-300/40"
    >
      <strong class="text-white">{title}</strong>
      <p class="mt-2 text-sm leading-6 text-zinc-500">{body}</p>
    </a>
  )
}
export function StatusCard({ title, body, loading = false }: { title: string; body?: string; loading?: boolean }) {
  return (
    <section class="relative mx-auto min-h-40 max-w-xl rounded-3xl border border-white/10 bg-zinc-900/80 p-8" aria-busy={loading}>
      {loading && <BackendLoader overlay label={title} />}
      <h1 class="text-2xl font-black text-white">{title}</h1>
      {body && <p class="mt-3 text-zinc-400">{body}</p>}
    </section>
  )
}
