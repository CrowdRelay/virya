import type { ComponentChildren } from "preact"
import { useEffect, useMemo, useState } from "preact/hooks"
import type {
  AudienceDashboard,
  AudienceFanCard,
  AudienceFanDetail,
  AudienceFilter,
  AudienceSegment,
  CommunicationCampaign,
  SegmentPreview,
} from "../../../types/audience"

type Pane = "fans" | "segments" | "campaigns" | "analytics"
type RequestError = Error & { status?: number }

const REQUEST_TIMEOUT_MS = 12_000

const request = async <T,>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const abort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener("abort", abort, { once: true })
  try {
    const headers = new Headers({ Accept: "application/json" })
    if (options.body !== undefined) headers.set("Content-Type", "application/json")
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
    if (response.status === 204) return undefined as T
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed") as RequestError
      error.status = response.status
      throw error
    }
    return payload
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abort)
  }
}

const money = (minor: number, currency: string) => {
  try {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(minor / 100)
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`
  }
}

const time = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

const localInput = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const split = (value: string) =>
  value
    .split(",")
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50)

export default function AudienceIntelligence() {
  const [pane, setPane] = useState<Pane>("fans")
  const [dashboard, setDashboard] = useState<AudienceDashboard | null>(null)
  const [fans, setFans] = useState<AudienceFanCard[]>([])
  const [selected, setSelected] = useState<AudienceFanDetail | null>(null)
  const [search, setSearch] = useState("")
  const [city, setCity] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const loadDashboard = async (signal?: AbortSignal) => {
    const value = await request<AudienceDashboard>("/api/staff/admin/audience/dashboard", { signal })
    setDashboard(value)
  }

  const loadFans = async (signal?: AbortSignal, nextSearch = search, nextCity = city) => {
    const params = new URLSearchParams({ limit: "60" })
    if (nextSearch.trim()) params.set("search", nextSearch.trim())
    if (nextCity.trim()) params.set("city_slug", nextCity.trim().toLowerCase())
    setFans(await request<AudienceFanCard[]>(`/api/staff/admin/audience/fans?${params}`, { signal }))
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all([loadDashboard(controller.signal), loadFans(controller.signal, "", "")])
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "Audience Intelligence niedostępne")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const refresh = async () => {
    setBusy(true)
    setMessage("")
    try {
      await Promise.all([loadDashboard(), loadFans()])
      if (selected) {
        setSelected(await request<AudienceFanDetail>(`/api/staff/admin/audience/fans/${selected.fan.id}`))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Odświeżenie nie powiodło się")
    } finally {
      setBusy(false)
    }
  }

  const openFan = async (fan: AudienceFanCard) => {
    setBusy(true)
    setMessage("")
    try {
      setSelected(await request<AudienceFanDetail>(`/api/staff/admin/audience/fans/${fan.id}`))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Fan 360 niedostępny")
    } finally {
      setBusy(false)
    }
  }

  const filteredCampaigns = useMemo(
    () => [...(dashboard?.campaigns ?? [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)),
    [dashboard],
  )

  if (loading && !dashboard) {
    return <Panel><p class="text-sm text-zinc-400">Ładuję Audience Intelligence…</p></Panel>
  }

  return (
    <div class="grid gap-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[.28em] text-cyan-300">Audience Intelligence</p>
          <h2 class="mt-1 text-2xl font-black text-white">Relacja z fanem, nie licznik followersów</h2>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Jeden read model łączy pozyskanie, zainteresowanie koncertami, bilety, wejścia, polecenia, nagrody i Synesthesię.
          </p>
        </div>
        <button disabled={busy} onClick={() => void refresh()} class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
          {busy ? "Pracuję…" : "Odśwież"}
        </button>
      </div>

      {dashboard?.degraded.active && (
        <Notice tone="warn">Tryb częściowy: {dashboard.degraded.unavailable.join(", ")}. Pozostałe źródła nadal działają.</Notice>
      )}
      {!dashboard?.features.communication_campaigns_enabled && (
        <Notice tone="safe">
          Campaign delivery jest bezpiecznie wyłączone. Możesz budować segmenty i drafty; wysyłka nie ruszy, dopóki nie włączysz <code>communication_campaigns_enabled</code> po podpięciu adaptera.
        </Notice>
      )}
      {message && <Notice tone="warn">{message}</Notice>}

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Aktywni fani" value={dashboard?.overview?.active_fans ?? 0} />
        <Metric label="Marketing opt-in" value={dashboard?.overview?.marketing_consented_fans ?? 0} />
        <Metric label="Kupili bilet" value={dashboard?.overview?.ticket_buyers ?? 0} />
        <Metric label="Byli na koncercie" value={dashboard?.overview?.attendees ?? 0} />
        <Metric label="Synesthesia" value={dashboard?.overview?.synesthesia_participants ?? 0} />
        <Metric label="Polecenia qualified" value={dashboard?.overview?.qualified_referrals ?? 0} />
        <Metric label="Płatne zamówienia" value={dashboard?.overview?.paid_ticket_orders ?? 0} />
        <Metric label="Segmenty" value={dashboard?.segments.length ?? 0} />
      </div>

      <nav class="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 sm:grid-cols-4">
        {([
          ["fans", "Fani", "Fan 360"],
          ["segments", "Segmenty", "kogo znamy"],
          ["campaigns", "Kampanie", "co wysyłamy"],
          ["analytics", "Analityka", "co działa"],
        ] as const).map(([key, label, hint]) => (
          <button key={key} onClick={() => setPane(key)} class={`rounded-xl px-3 py-3 text-left ${pane === key ? "bg-cyan-300 text-zinc-950" : "text-zinc-300 hover:bg-white/10"}`}>
            <strong class="block text-sm">{label}</strong>
            <span class={`mt-1 block text-[11px] ${pane === key ? "text-zinc-700" : "text-zinc-500"}`}>{hint}</span>
          </button>
        ))}
      </nav>

      {pane === "fans" && (
        <FansPane
          fans={fans}
          selected={selected}
          search={search}
          city={city}
          busy={busy}
          setSearch={setSearch}
          setCity={setCity}
          runSearch={async () => {
            setBusy(true)
            try { await loadFans() } finally { setBusy(false) }
          }}
          openFan={openFan}
          closeFan={() => setSelected(null)}
          reloadFan={async () => {
            if (!selected) return
            setSelected(await request<AudienceFanDetail>(`/api/staff/admin/audience/fans/${selected.fan.id}`))
            await loadFans()
          }}
        />
      )}
      {pane === "segments" && <SegmentsPane dashboard={dashboard} reload={loadDashboard} />}
      {pane === "campaigns" && <CampaignsPane campaigns={filteredCampaigns} dashboard={dashboard} reload={loadDashboard} />}
      {pane === "analytics" && <AnalyticsPane dashboard={dashboard} />}
    </div>
  )
}

function FansPane(props: {
  fans: AudienceFanCard[]
  selected: AudienceFanDetail | null
  search: string
  city: string
  busy: boolean
  setSearch: (value: string) => void
  setCity: (value: string) => void
  runSearch: () => Promise<void>
  openFan: (fan: AudienceFanCard) => Promise<void>
  closeFan: () => void
  reloadFan: () => Promise<void>
}) {
  return (
    <div class="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Panel>
        <form class="grid gap-3 sm:grid-cols-[1fr_.7fr_auto]" onSubmit={event => { event.preventDefault(); void props.runSearch() }}>
          <input value={props.search} onInput={event => props.setSearch(event.currentTarget.value)} placeholder="Szukaj e-mail / nazwa" class={inputClass} />
          <input value={props.city} onInput={event => props.setCity(event.currentTarget.value)} placeholder="miasto, np. wroclaw" class={inputClass} />
          <button disabled={props.busy} class={primaryButton}>Filtruj</button>
        </form>
        <div class="mt-4 divide-y divide-white/5">
          {props.fans.map(fan => (
            <button key={fan.id} onClick={() => void props.openFan(fan)} class="grid w-full grid-cols-[1fr_auto] gap-3 px-2 py-4 text-left hover:bg-white/[.035]">
              <span class="min-w-0">
                <strong class="block truncate text-sm text-white">{fan.display_name || fan.email}</strong>
                <span class="mt-1 block truncate text-xs text-zinc-500">{fan.email}</span>
                <span class="mt-2 block text-[11px] text-zinc-500">
                  eventy {fan.event_interests} · wejścia {fan.attended_events} · bilety {fan.paid_ticket_orders} · ref {fan.qualified_referrals}
                </span>
              </span>
              <span class={`self-start rounded-full px-2 py-1 text-[10px] font-black uppercase ${fan.status === "active" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-zinc-400"}`}>{fan.status}</span>
            </button>
          ))}
          {!props.fans.length && <p class="py-8 text-center text-sm text-zinc-500">Brak fanów dla tego filtra.</p>}
        </div>
      </Panel>
      <FanDetailPane detail={props.selected} close={props.closeFan} reload={props.reloadFan} />
    </div>
  )
}

function FanDetailPane({ detail, close, reload }: { detail: AudienceFanDetail | null; close: () => void; reload: () => Promise<void> }) {
  const [tag, setTag] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  if (!detail) return <Panel><p class="text-sm text-zinc-500">Wybierz fana, żeby otworzyć Fan 360.</p></Panel>
  const mutateTag = async (value: string, remove = false) => {
    if (!value || busy) return
    setBusy(true); setMessage("")
    try {
      const encoded = encodeURIComponent(value)
      await request(
        remove
          ? `/api/staff/admin/audience/fans/${detail.fan.id}/tags/${encoded}/remove`
          : `/api/staff/admin/audience/fans/${detail.fan.id}/tags`,
        { method: "POST", body: remove ? undefined : { tag: value } },
      )
      setTag("")
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tag nie został zapisany")
    } finally { setBusy(false) }
  }
  return (
    <Panel>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Fan 360</p>
          <h3 class="mt-1 truncate text-xl font-black text-white">{detail.fan.display_name || detail.fan.email}</h3>
          <p class="mt-1 truncate text-xs text-zinc-500">{detail.fan.email}</p>
        </div>
        <button onClick={close} class="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300">Zamknij</button>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        {detail.tags.map(value => (
          <button key={value} disabled={busy} onClick={() => void mutateTag(value, true)} title="Usuń tag" class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200">{value} ×</button>
        ))}
      </div>
      <form class="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); void mutateTag(tag.trim().toLowerCase()) }}>
        <input value={tag} onInput={event => setTag(event.currentTarget.value)} placeholder="tag, np. ambassador" class={`${inputClass} min-w-0 flex-1`} />
        <button disabled={busy || !tag.trim()} class={secondaryButton}>Dodaj</button>
      </form>
      {message && <p class="mt-2 text-xs text-rose-300">{message}</p>}
      <Timeline title="Pozyskanie" rows={detail.acquisitions.map(item => ({ title: item.source, meta: item.campaign_name || "bez kampanii", date: item.occurred_at }))} />
      <Timeline title="Koncerty" rows={detail.event_interests.map(item => ({ title: item.event_title, meta: "zainteresowanie", date: item.created_at }))} />
      <Timeline title="Wejścia" rows={detail.attendance.map(item => ({ title: item.event_title, meta: item.status, date: item.redeemed_at }))} />
      <Timeline title="Bilety" rows={detail.ticket_purchases.map(item => ({ title: item.event_title, meta: `${item.status} · ${money(item.amount_gross_minor - item.amount_refunded_minor, item.currency)}`, date: item.paid_at }))} />
      <Timeline title="Synesthesia" rows={detail.synesthesia.map(item => ({ title: item.campaign_slug, meta: item.client_total_elapsed_ms ? `${Math.round(item.client_total_elapsed_ms / 60_000)} min` : "ukończona", date: item.completed_at || item.entered_at }))} />
      <Timeline title="Nagrody" rows={detail.rewards.map(item => ({ title: item.reward_name, meta: `${item.reward_type} · ${item.status}`, date: item.created_at }))} />
    </Panel>
  )
}

function SegmentsPane({ dashboard, reload }: { dashboard: AudienceDashboard | null; reload: () => Promise<void> }) {
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [cities, setCities] = useState("")
  const [tags, setTags] = useState("")
  const [minReferrals, setMinReferrals] = useState("")
  const [synesthesia, setSynesthesia] = useState<"any" | "yes" | "no">("any")
  const [consent, setConsent] = useState<"any" | "yes" | "no">("yes")
  const [preview, setPreview] = useState<SegmentPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const create = async (event: SubmitEvent) => {
    event.preventDefault(); if (busy) return
    const filter: AudienceFilter = { statuses: ["active"] }
    if (cities.trim()) filter.city_slugs = split(cities)
    if (tags.trim()) filter.tags_all = split(tags)
    if (minReferrals.trim()) filter.min_qualified_referrals = Math.max(0, Number(minReferrals) || 0)
    if (synesthesia !== "any") filter.synesthesia_completed = synesthesia === "yes"
    if (consent !== "any") filter.marketing_consent = consent === "yes"
    setBusy(true); setMessage("")
    try {
      await request("/api/staff/admin/audience/segments", { method: "POST", body: { slug: slug.trim().toLowerCase(), name: name.trim(), filter } })
      setSlug(""); setName(""); setCities(""); setTags(""); setMinReferrals("")
      await reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Segment nie powstał") }
    finally { setBusy(false) }
  }
  return (
    <div class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <Panel>
        <h3 class="text-lg font-black text-white">Nowy segment</h3>
        <form onSubmit={create} class="mt-4 grid gap-3">
          <input required value={name} onInput={event => setName(event.currentTarget.value)} placeholder="Nazwa, np. Gorzów — warm audience" class={inputClass} />
          <input required value={slug} onInput={event => setSlug(event.currentTarget.value.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase())} placeholder="slug" class={inputClass} />
          <input value={cities} onInput={event => setCities(event.currentTarget.value)} placeholder="miasta po przecinku" class={inputClass} />
          <input value={tags} onInput={event => setTags(event.currentTarget.value)} placeholder="tagi wymagane po przecinku" class={inputClass} />
          <input value={minReferrals} onInput={event => setMinReferrals(event.currentTarget.value)} inputMode="numeric" placeholder="min. qualified referrals" class={inputClass} />
          <label class={labelClass}>Synesthesia<select value={synesthesia} onChange={event => setSynesthesia(event.currentTarget.value as typeof synesthesia)} class={inputClass}><option value="any">dowolnie</option><option value="yes">ukończona</option><option value="no">nieukończona</option></select></label>
          <label class={labelClass}>Marketing consent<select value={consent} onChange={event => setConsent(event.currentTarget.value as typeof consent)} class={inputClass}><option value="yes">tak</option><option value="any">dowolnie</option><option value="no">nie</option></select></label>
          <button disabled={busy || !slug || !name} class={primaryButton}>{busy ? "Zapisuję…" : "Utwórz segment"}</button>
          {message && <p class="text-xs text-rose-300">{message}</p>}
        </form>
      </Panel>
      <Panel>
        <h3 class="text-lg font-black text-white">Segmenty</h3>
        <div class="mt-3 grid gap-3">
          {(dashboard?.segments ?? []).map(segment => (
            <div key={segment.id} class="rounded-2xl border border-white/8 bg-black/25 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><strong class="text-sm text-white">{segment.name}</strong><p class="mt-1 text-xs text-zinc-500">{segment.slug}</p></div>
                <button onClick={async () => { setBusy(true); try { setPreview(await request<SegmentPreview>(`/api/staff/admin/audience/segments/${encodeURIComponent(segment.slug)}/preview?limit=20`)) } finally { setBusy(false) } }} class={secondaryButton}>Podgląd</button>
              </div>
              <p class="mt-3 break-words text-[11px] leading-5 text-zinc-500">{JSON.stringify(segment.filter)}</p>
            </div>
          ))}
          {!(dashboard?.segments.length) && <p class="text-sm text-zinc-500">Nie ma jeszcze segmentów.</p>}
        </div>
        {preview && (
          <div class="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[.05] p-4">
            <strong class="text-sm text-cyan-100">{preview.segment.name}: {preview.total} fanów</strong>
            <div class="mt-3 grid gap-2">{preview.sample.map(fan => <span key={fan.id} class="truncate text-xs text-zinc-400">{fan.display_name || fan.email}</span>)}</div>
          </div>
        )}
      </Panel>
    </div>
  )
}

function CampaignsPane({ campaigns, dashboard, reload }: { campaigns: CommunicationCampaign[]; dashboard: AudienceDashboard | null; reload: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [segment, setSegment] = useState("")
  const [channel, setChannel] = useState<CommunicationCampaign["channel"]>("email")
  const [template, setTemplate] = useState("crowdrelay-audience-message")
  const [subject, setSubject] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [scheduleTarget, setScheduleTarget] = useState<string | null>(null)
  const [scheduleAt, setScheduleAt] = useState("")
  const create = async (event: SubmitEvent) => {
    event.preventDefault(); setBusy(true); setMessage("")
    try {
      await request("/api/staff/admin/communications/campaigns", { method: "POST", body: { slug: slug.trim().toLowerCase(), name: name.trim(), channel, segment_slug: segment, template_key: template.trim(), subject: subject.trim() || null, content: {} } })
      setName(""); setSlug(""); setSubject("")
      await reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kampania nie powstała") }
    finally { setBusy(false) }
  }
  const beginSchedule = (campaign: CommunicationCampaign) => {
    setScheduleTarget(campaign.id)
    setScheduleAt(localInput(new Date(Date.now() + 10 * 60_000).toISOString()))
    setMessage("")
  }
  const schedule = async (campaign: CommunicationCampaign) => {
    const date = new Date(scheduleAt)
    if (!scheduleAt || Number.isNaN(date.getTime())) { setMessage("Wybierz poprawny termin wysyłki"); return }
    setBusy(true); setMessage("")
    try {
      await request(`/api/staff/admin/communications/campaigns/${campaign.id}/schedule`, { method: "POST", body: { scheduled_at: date.toISOString() } })
      setScheduleTarget(null); setScheduleAt("")
      await reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie udało się zaplanować kampanii") }
    finally { setBusy(false) }
  }
  const cancel = async (campaign: CommunicationCampaign) => {
    setBusy(true); setMessage("")
    try {
      await request(`/api/staff/admin/communications/campaigns/${campaign.id}/cancel`, { method: "POST" })
      if (scheduleTarget === campaign.id) { setScheduleTarget(null); setScheduleAt("") }
      await reload()
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie udało się anulować kampanii") }
    finally { setBusy(false) }
  }
  return (
    <div class="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <Panel>
        <h3 class="text-lg font-black text-white">Nowy draft</h3>
        <form onSubmit={create} class="mt-4 grid gap-3">
          <input required value={name} onInput={event => setName(event.currentTarget.value)} placeholder="Nazwa kampanii" class={inputClass} />
          <input required value={slug} onInput={event => setSlug(event.currentTarget.value.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase())} placeholder="slug" class={inputClass} />
          <select required value={segment} onChange={event => setSegment(event.currentTarget.value)} class={inputClass}><option value="">Wybierz segment</option>{dashboard?.segments.filter(item => item.active).map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select>
          <select value={channel} onChange={event => setChannel(event.currentTarget.value as CommunicationCampaign["channel"])} class={inputClass}><option value="email">email</option><option value="push">push</option><option value="in_app">in-app</option></select>
          <input required value={template} onInput={event => setTemplate(event.currentTarget.value)} placeholder="template key" class={inputClass} />
          <input value={subject} onInput={event => setSubject(event.currentTarget.value)} placeholder="temat (email)" class={inputClass} />
          <button disabled={busy || !name || !slug || !segment || !template} class={primaryButton}>{busy ? "Zapisuję…" : "Utwórz draft"}</button>
          {message && <p class="text-xs text-rose-300">{message}</p>}
        </form>
      </Panel>
      <Panel>
        <h3 class="text-lg font-black text-white">Kampanie</h3>
        <div class="mt-3 grid gap-3">
          {campaigns.map(campaign => (
            <div key={campaign.id} class="rounded-2xl border border-white/8 bg-black/25 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3"><div><strong class="text-sm text-white">{campaign.name}</strong><p class="mt-1 text-xs text-zinc-500">{campaign.channel} · {campaign.segment_slug} · {campaign.status}</p></div><span class="text-[11px] text-zinc-500">{time(campaign.scheduled_at)}</span></div>
              {campaign.status === "completed" && <p class="mt-3 text-xs text-zinc-400">dostarczono {campaign.delivered_count ?? 0}/{campaign.recipient_count ?? 0} · błędy {campaign.failed_count ?? 0}</p>}
              {campaign.status === "draft" && (scheduleTarget === campaign.id ? (
                <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input type="datetime-local" value={scheduleAt} min={localInput(new Date().toISOString())} onInput={event => setScheduleAt(event.currentTarget.value)} class={inputClass} />
                  <button disabled={busy || !scheduleAt} onClick={() => void schedule(campaign)} class={primaryButton}>Potwierdź</button>
                  <button disabled={busy} onClick={() => { setScheduleTarget(null); setScheduleAt("") }} class={secondaryButton}>Wróć</button>
                </div>
              ) : (
                <div class="mt-3 flex gap-2"><button disabled={busy || !dashboard?.features.communication_campaigns_enabled} onClick={() => beginSchedule(campaign)} class={primaryButton}>Zaplanuj</button><button disabled={busy} onClick={() => void cancel(campaign)} class={secondaryButton}>Anuluj</button></div>
              ))}
              {campaign.status === "scheduled" && <div class="mt-3"><button disabled={busy} onClick={() => void cancel(campaign)} class={secondaryButton}>Anuluj przed wysyłką</button></div>}
            </div>
          ))}
          {!campaigns.length && <p class="text-sm text-zinc-500">Brak kampanii.</p>}
        </div>
      </Panel>
    </div>
  )
}

function AnalyticsPane({ dashboard }: { dashboard: AudienceDashboard | null }) {
  return (
    <div class="grid gap-5 xl:grid-cols-2">
      <Panel>
        <h3 class="text-lg font-black text-white">Funnel wg źródła</h3>
        <div class="mt-4 grid gap-3">
          {(dashboard?.funnel ?? []).map(row => (
            <div key={row.source} class="rounded-2xl border border-white/8 bg-black/25 p-4">
              <strong class="text-sm text-white">{row.source}</strong>
              <div class="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]"><Small label="pozyskani" value={row.acquired_fans} /><Small label="aktywni" value={row.active_fans} /><Small label="kupili" value={row.ticket_buyers} /><Small label="przyszli" value={row.attendees} /></div>
            </div>
          ))}
          {!(dashboard?.funnel.length) && <p class="text-sm text-zinc-500">Jeszcze brak danych funnel.</p>}
        </div>
      </Panel>
      <Panel>
        <h3 class="text-lg font-black text-white">Przychód biletowy</h3>
        <p class="mt-1 text-xs text-zinc-500">Waluty są rozdzielone — CrowdRelay nigdy ich nie sumuje bez kursu.</p>
        <div class="mt-4 grid gap-3">
          {(dashboard?.revenue ?? []).map(row => (
            <div key={row.currency} class="rounded-2xl border border-white/8 bg-black/25 p-4"><div class="flex items-end justify-between gap-3"><div><strong class="text-2xl font-black text-white">{money(row.after_refunds_minor, row.currency)}</strong><p class="mt-1 text-xs text-zinc-500">po refundach · {row.paid_orders} zamówień</p></div><span class="text-xs text-zinc-500">refund {money(row.refunded_minor, row.currency)}</span></div></div>
          ))}
          {!(dashboard?.revenue.length) && <p class="text-sm text-zinc-500">Jeszcze brak płatnych zamówień.</p>}
        </div>
      </Panel>
    </div>
  )
}

function Timeline({ title, rows }: { title: string; rows: Array<{ title: string; meta: string; date: string | null }> }) {
  if (!rows.length) return null
  return <section class="mt-5"><h4 class="text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">{title}</h4><div class="mt-2 grid gap-2">{rows.slice(0, 8).map((row, index) => <div key={`${row.title}-${row.date}-${index}`} class="grid grid-cols-[1fr_auto] gap-3 text-xs"><span class="min-w-0"><strong class="block truncate text-zinc-200">{row.title}</strong><span class="block truncate text-zinc-500">{row.meta}</span></span><time class="text-right text-[10px] text-zinc-600">{time(row.date)}</time></div>)}</div></section>
}

function Panel({ children }: { children: ComponentChildren }) {
  return <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">{children}</section>
}
function Metric({ label, value }: { label: string; value: number }) {
  return <div class="rounded-2xl border border-white/10 bg-zinc-900/70 p-4"><span class="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">{label}</span><strong class="mt-2 block text-2xl font-black text-white">{new Intl.NumberFormat("pl-PL").format(value)}</strong></div>
}
function Small({ label, value }: { label: string; value: number }) {
  return <span><strong class="block text-sm text-white">{value}</strong><span class="text-zinc-600">{label}</span></span>
}
function Notice({ children, tone }: { children: ComponentChildren; tone: "warn" | "safe" }) {
  return <div role="status" class={`rounded-2xl border px-4 py-3 text-sm leading-6 ${tone === "warn" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-100"}`}>{children}</div>
}

const inputClass = "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-300/60"
const labelClass = "grid gap-1 text-xs font-bold text-zinc-400"
const primaryButton = "rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-zinc-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
const secondaryButton = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-40"
