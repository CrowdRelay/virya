import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import TicketInventoryBar from "../tickets/TicketInventoryBar"
import EcosystemControl from "./EcosystemControl"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type Tab = "overview" | "ops" | "ticketing" | "admission" | "mailer" | "system"
type ApiError = Error & { status?: number; payload?: { error?: string } }

type Capabilities = {
  crowdrelayAdmin: boolean
  crowdrelayCommerce: boolean
  crowdrelayWebhook: boolean
  crowdrelayMailer: boolean
  ticketMailer: boolean
  gmail: boolean
  stripe: boolean
}

type EventItem = {
  id: string
  slug: string
  title: string
  venue: string | null
  starts_at: string
  status?: string
  city?: { name?: string } | null
}

type QrCampaign = {
  id: string
  event_slug: string
  event_title: string
  label: string
  valid_from: string
  valid_until: string
  checkin_count: number
  max_checkins: number | null
  active: boolean
}

type Overview = {
  services: { live: string; ready: string }
  operations: { events: EventItem[]; campaigns: QrCampaign[] }
  publicEvents: EventItem[]
  cities: Array<{ slug: string; name: string; fan_count: number }>
  degraded: { active: boolean; unavailableSources: string[] }
  generatedAt: string
}

type TicketType = {
  slug: string
  name: string
  description: string | null
  price_gross_minor: number
  capacity: number | null
  sold: number
  reserved: number
  available: number
  sort_order: number
  active: boolean
}

type TicketSale = {
  event_slug: string
  event_title: string
  event_status: string
  venue: string | null
  starts_at: string
  currency: string
  vat_rate_basis_points: number
  capacity: number
  sold: number
  reserved: number
  available: number
  max_per_order: number
  sales_open_at: string
  sales_close_at: string
  active: boolean
  sales_state: string
  ticket_types: TicketType[]
}

type TicketingOverview = {
  sale: TicketSale
  reserved_orders: number
  checkout_created_orders: number
  reserved_tickets: number
  paid_orders: number
  paid_tickets: number
  gross_sales_minor: number
  refunded_minor: number
  recent_orders: Array<{
    order_id: string
    public_reference: string
    status: string
    buyer_email_masked: string
    amount_gross_minor: number
    amount_refunded_minor: number
    currency: string
    paid_at: string | null
  }>
}

type QueueSummary = {
  pending: number
  processing: number
  delivered_24h: number
  dead: number
  oldest_pending_seconds: number
}

type OpsItem = {
  id: string
  event_type: string
  status: string
  available_at: string
  last_error_kind: string | null
  created_at: string
  dead_at: string | null
  attempts?: number
  attempt_count?: number
  max_attempts: number
  endpoint_name?: string
  endpoint_active?: boolean
  last_response_status?: number | null
}

type OpsOverview = {
  summary: { outbox: QueueSummary; deliveries: QueueSummary }
  deadDeliveries: OpsItem[]
  deadOutbox: OpsItem[]
}

type TicketForm = {
  currency: string
  vatRatePercent: string
  capacity: string
  maxPerOrder: string
  holdSeconds: string
  salesOpenAt: string
  salesCloseAt: string
  active: boolean
  ticketTypes: Array<{
    slug: string
    name: string
    description: string
    priceGross: string
    capacity: string
    active: boolean
  }>
}

const REQUEST_TIMEOUT_MS = 15_000
const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
})
const moneyFormatter = new Map<string, Intl.NumberFormat>()

const formatDate = (value: string | null | undefined) => {
  if (!value || Number.isNaN(Date.parse(value))) return "—"
  return dateFormatter.format(new Date(value))
}

const money = (minor: number, currency = "PLN") => {
  let formatter = moneyFormatter.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency })
    moneyFormatter.set(currency, formatter)
  }
  return formatter.format(minor / 100)
}

const localInput = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const api = async <T,>(
  path: string,
  options: {
    method?: "GET" | "POST"
    body?: unknown
    signal?: AbortSignal
  } = {},
) => {
  const headers = new Headers({ Accept: "application/json" })
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json")
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )
  const forwardAbort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) forwardAbort()
  else options.signal?.addEventListener("abort", forwardAbort, { once: true })
  try {
    const response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    if (!response.ok) {
      const error = new Error(payload.error || "Request failed") as ApiError
      error.status = response.status
      error.payload = payload
      throw error
    }
    return payload as T
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener("abort", forwardAbort)
  }
}

const blankTicketForm = (event?: EventItem): TicketForm => {
  const start = event?.starts_at
    ? new Date(event.starts_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const close = new Date(start.getTime() - 60 * 60 * 1000)
  return {
    currency: "PLN",
    vatRatePercent: "8",
    capacity: "100",
    maxPerOrder: "8",
    holdSeconds: "2100",
    salesOpenAt: localInput(new Date().toISOString()),
    salesCloseAt: localInput(close.toISOString()),
    active: false,
    ticketTypes: [
      {
        slug: "standard",
        name: "Bilet standardowy",
        description: "",
        priceGross: "50.00",
        capacity: "100",
        active: true,
      },
    ],
  }
}

const formFromSale = (sale: TicketSale): TicketForm => ({
  currency: sale.currency,
  vatRatePercent: String(sale.vat_rate_basis_points / 100),
  capacity: String(sale.capacity),
  maxPerOrder: String(sale.max_per_order),
  holdSeconds: "2100",
  salesOpenAt: localInput(sale.sales_open_at),
  salesCloseAt: localInput(sale.sales_close_at),
  active: sale.active,
  ticketTypes: sale.ticket_types.map(type => ({
    slug: type.slug,
    name: type.name,
    description: type.description ?? "",
    priceGross: (type.price_gross_minor / 100).toFixed(2),
    capacity: type.capacity == null ? "" : String(type.capacity),
    active: type.active,
  })),
})

const formFromOverview = (overview: TicketingOverview): TicketForm =>
  formFromSale(overview.sale)

type TicketingSaveReceipt = {
  saved: true
  sale: TicketSale
  refreshPending: true
}

const tabs: Array<{ key: Tab; label: string; hint: string }> = [
  { key: "overview", label: "Stan", hint: "system i koncerty" },
  { key: "ops", label: "Operacje", hint: "kolejki i retry" },
  { key: "ticketing", label: "Bilety", hint: "ceny i pule" },
  { key: "admission", label: "Wejściówki", hint: "wydaj i unieważnij" },
  { key: "mailer", label: "Mailer", hint: "konfiguracja i test" },
  { key: "system", label: "Integracje", hint: "n8n, Meta, Stripe" },
]

export default function AdminConsole() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const events = useMemo(() => {
    const unique = new Map<string, EventItem>()
    for (const event of overview?.publicEvents ?? [])
      unique.set(event.slug, event)
    for (const event of overview?.operations.events ?? [])
      unique.set(event.slug, event)
    return [...unique.values()].sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
    )
  }, [overview])

  useEffect(() => {
    const controller = new AbortController()
    void checkSession(controller.signal)
    return () => controller.abort()
  }, [])

  async function checkSession(signal?: AbortSignal) {
    try {
      const status = await api<{
        authenticated: boolean
        configured: boolean
        capabilities?: Capabilities
      }>("/api/staff/admin/status", { signal })
      if (!status.configured) {
        setState("unconfigured")
        return
      }
      if (!status.authenticated) {
        setState("login")
        queueMicrotask(() => passwordRef.current?.focus())
        return
      }
      setCapabilities(status.capabilities ?? null)
      setState("ready")
      await loadOverview(signal)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setState("error")
    }
  }

  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage("")
    try {
      await api("/api/staff/qr/login", { method: "POST", body: { password } })
      setPassword("")
      await checkSession()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Logowanie nie powiodło się",
      )
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    try {
      await api("/api/staff/qr/logout", { method: "POST", body: {} })
    } finally {
      setOverview(null)
      setCapabilities(null)
      setState("login")
      setBusy(false)
    }
  }

  async function loadOverview(signal?: AbortSignal) {
    setMessage("")
    try {
      setOverview(await api<Overview>("/api/staff/admin/overview", { signal }))
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się pobrać stanu systemu",
      )
    }
  }

  if (state === "checking") return <StatusCard title="Sprawdzam dostęp…" />
  if (state === "unconfigured")
    return (
      <StatusCard
        title="Panel nie jest skonfigurowany"
        body="Ustaw wymagane envy logowania staff oraz serwerowy klucz administratora CrowdRelay w Netlify."
      />
    )
  if (state === "error")
    return (
      <StatusCard
        title="Panel jest chwilowo niedostępny"
        body="Odśwież stronę albo sprawdź logi funkcji Netlify."
      />
    )
  if (state === "login") {
    return (
      <section class="mx-auto max-w-lg rounded-3xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
          Virya control center
        </p>
        <h1 class="mt-3 text-3xl font-black text-white">
          Panel administracyjny
        </h1>
        <p class="mt-3 text-sm leading-6 text-zinc-400">
          To samo bezpieczne logowanie co w QR i księgowości. Sesja wygasa po 12
          godzinach.
        </p>
        <form onSubmit={login} class="mt-6 grid gap-4">
          <label class="text-sm font-semibold text-zinc-200">
            Hasło
            <input
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onInput={event => setPassword(event.currentTarget.value)}
              class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-amber-300"
            />
          </label>
          <button
            disabled={busy || !password}
            class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Loguję…" : "Wejdź do panelu"}
          </button>
        </form>
        {message && (
          <p
            role="alert"
            class="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
          >
            {message}
          </p>
        )}
      </section>
    )
  }

  return (
    <section class="grid gap-5">
      <header class="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
              Virya control center
            </p>
            <h1 class="mt-2 text-3xl font-black text-white sm:text-4xl">
              Cały system w jednym miejscu
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              CrowdRelay, sprzedaż biletów, wejściówki, QR, księgowość i mailer.
              Sekrety nigdy nie trafiają do przeglądarki.
            </p>
          </div>
          <div class="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void loadOverview()}
              class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Odśwież
            </button>
            <button
              disabled={busy}
              onClick={() => void logout()}
              class="rounded-xl border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Sekcje panelu"
        class="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 sm:grid-cols-3 xl:grid-cols-6"
      >
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            class={`rounded-xl px-3 py-3 text-left transition ${tab === item.key ? "bg-amber-300 text-zinc-950" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`}
          >
            <strong class="block text-sm">{item.label}</strong>
            <span
              class={`mt-1 block text-[11px] ${tab === item.key ? "text-zinc-700" : "text-zinc-500"}`}
            >
              {item.hint}
            </span>
          </button>
        ))}
      </nav>

      {message && (
        <div
          role="status"
          class="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
          {message}
        </div>
      )}

      {tab === "overview" && (
        <OverviewTab overview={overview} capabilities={capabilities} />
      )}
      {tab === "ops" && <OpsTab />}
      {tab === "ticketing" && <TicketingTab events={events} />}
      {tab === "admission" && <AdmissionTab events={events} />}
      {tab === "mailer" && <MailerTab capabilities={capabilities} />}
      {tab === "system" && (
        <SystemTab capabilities={capabilities} overview={overview} />
      )}
    </section>
  )
}

function OverviewTab({
  overview,
  capabilities,
}: {
  overview: Overview | null
  capabilities: Capabilities | null
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
    <div class="grid gap-5">
      {overview?.degraded.active && (
        <div
          role="status"
          class="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
        >
          Panel działa w trybie częściowym. Niedostępne źródła: {overview.degraded.unavailableSources.join(", ")}.
          Pozostałe dane są nadal aktualizowane niezależnie.
        </div>
      )}
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

function validateTicketForm(form: TicketForm): string | null {
  const currency = form.currency.trim().toUpperCase()
  const vat = Number(form.vatRatePercent.replace(",", "."))
  const capacity = Number(form.capacity)
  const maxPerOrder = Number(form.maxPerOrder)
  const holdSeconds = Number(form.holdSeconds)
  const salesOpenAt = Date.parse(form.salesOpenAt)
  const salesCloseAt = Date.parse(form.salesCloseAt)

  if (!/^[A-Z]{3}$/.test(currency))
    return "Waluta musi mieć dokładnie 3 litery."
  if (!Number.isFinite(vat) || vat < 0 || vat > 100)
    return "VAT musi być w zakresie 0–100%."
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1_000_000) {
    return "Całkowita pula musi być liczbą od 1 do 1 000 000."
  }
  if (!Number.isInteger(maxPerOrder) || maxPerOrder < 1 || maxPerOrder > 100) {
    return "Limit na zamówienie musi być liczbą od 1 do 100."
  }
  if (
    !Number.isInteger(holdSeconds) ||
    holdSeconds < 2_100 ||
    holdSeconds > 86_400
  ) {
    return "Rezerwacja musi trwać od 2100 do 86400 sekund."
  }
  if (
    !Number.isFinite(salesOpenAt) ||
    !Number.isFinite(salesCloseAt) ||
    salesOpenAt >= salesCloseAt
  ) {
    return "Okno sprzedaży ma nieprawidłowe daty."
  }
  if (form.ticketTypes.length < 1 || form.ticketTypes.length > 24) {
    return "Sprzedaż musi mieć od 1 do 24 typów biletów."
  }

  const slugs = new Set<string>()
  for (const type of form.ticketTypes) {
    const slug = type.slug.trim()
    const priceGross = Number(type.priceGross.replace(",", "."))
    const typeCapacity =
      type.capacity.trim() === "" ? null : Number(type.capacity)
    if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(slug) || slugs.has(slug)) {
      return `Nieprawidłowy albo powtórzony slug biletu: ${slug || "(pusty)"}.`
    }
    slugs.add(slug)
    if (!type.name.trim() || type.name.trim().length > 160) {
      return `Nazwa typu „${slug}” jest pusta albo za długa.`
    }
    if (
      !Number.isFinite(priceGross) ||
      priceGross < 0.01 ||
      priceGross > 10_000_000
    ) {
      return `Cena typu „${slug}” musi mieścić się w zakresie 0,01–10 000 000.`
    }
    if (
      typeCapacity !== null &&
      (!Number.isInteger(typeCapacity) ||
        typeCapacity < 1 ||
        typeCapacity > capacity)
    ) {
      return `Pula typu „${slug}” musi mieścić się w zakresie 1–${capacity}.`
    }
  }

  return null
}

function TicketingTab({ events }: { events: EventItem[] }) {
  const [eventSlug, setEventSlug] = useState("")
  const [overview, setOverview] = useState<TicketingOverview | null>(null)
  const [form, setForm] = useState<TicketForm>(blankTicketForm())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const selectedEvent = events.find(event => event.slug === eventSlug)

  async function load(slug: string) {
    setEventSlug(slug)
    setOverview(null)
    setMessage("")
    if (!slug) return
    setBusy(true)
    try {
      const result = await api<TicketingOverview>(
        `/api/staff/admin/ticketing/${encodeURIComponent(slug)}`,
      )
      setOverview(result)
      setForm(formFromOverview(result))
    } catch (error) {
      const apiError = error as ApiError
      if (apiError.status === 404) {
        setForm(blankTicketForm(events.find(event => event.slug === slug)))
        setMessage(
          "Sprzedaż nie jest jeszcze skonfigurowana. Uzupełnij formularz i zapisz.",
        )
      } else {
        setMessage(
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać sprzedaży",
        )
      }
    } finally {
      setBusy(false)
    }
  }

  async function save(event: SubmitEvent) {
    event.preventDefault()
    if (!eventSlug || busy) return

    const validationError = validateTicketForm(form)
    if (validationError) {
      setMessage(validationError)
      return
    }

    setBusy(true)
    setMessage("")
    try {
      const payload = {
        currency: form.currency.trim().toUpperCase(),
        vat_rate_basis_points: Math.round(
          Number(form.vatRatePercent.replace(",", ".")) * 100,
        ),
        capacity: Number(form.capacity),
        max_per_order: Number(form.maxPerOrder),
        hold_seconds: Number(form.holdSeconds),
        sales_open_at: new Date(form.salesOpenAt).toISOString(),
        sales_close_at: new Date(form.salesCloseAt).toISOString(),
        active: form.active,
        ticket_types: form.ticketTypes.map((type, index) => ({
          slug: type.slug.trim(),
          name: type.name.trim(),
          description: type.description.trim() || null,
          price_gross_minor: Math.round(
            Number(type.priceGross.replace(",", ".")) * 100,
          ),
          capacity: type.capacity.trim() ? Number(type.capacity) : null,
          sort_order: index,
          active: type.active,
        })),
      }
      const result = await api<TicketingOverview | TicketingSaveReceipt>(
        `/api/staff/admin/ticketing/${encodeURIComponent(eventSlug)}`,
        { method: "POST", body: payload },
      )

      if ("recent_orders" in result) {
        setOverview(result)
        setForm(formFromOverview(result))
        setMessage("Konfiguracja sprzedaży zapisana.")
      } else {
        setOverview(current =>
          current ? { ...current, sale: result.sale } : current,
        )
        setForm(formFromSale(result.sale))
        setMessage(
          "Konfiguracja została zapisana. Statystyki nie odświeżyły się od razu — użyj „Odśwież sprzedaż”.",
        )
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać sprzedaży",
      )
    } finally {
      setBusy(false)
    }
  }

  const updateType = (
    index: number,
    patch: Partial<TicketForm["ticketTypes"][number]>,
  ) =>
    setForm(current => ({
      ...current,
      ticketTypes: current.ticketTypes.map((type, typeIndex) =>
        typeIndex === index ? { ...type, ...patch } : type,
      ),
    }))

  return (
    <section class="grid gap-5">
      <div class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-white">
              Sprzedaż biletów per koncert
            </h2>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 text-pretty">
              Ustaw okno sprzedaży, VAT, limit zamówienia, całkowitą pulę oraz
              typy i ceny biletów. Opłacenie następuje w Stripe, a CrowdRelay
              rozdziela sprzedaż od aktywnych rezerwacji.
            </p>
          </div>
          {eventSlug && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void load(eventSlug)}
              class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Odśwież sprzedaż
            </button>
          )}
        </div>
        <label class="mt-5 block text-sm font-semibold text-zinc-200">
          Koncert
          <select
            value={eventSlug}
            onChange={event => void load(event.currentTarget.value)}
            class="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
          >
            <option value="">Wybierz wydarzenie</option>
            {events.map(event => (
              <option key={event.slug} value={event.slug}>
                {event.title} — {formatDate(event.starts_at)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {eventSlug && (
        <form onSubmit={save} class="grid gap-5">
          {overview && <TicketingInventorySummary overview={overview} />}

          <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 class="text-lg font-black text-white">
                  Ustawienia sprzedaży
                </h3>
                <p class="mt-1 text-sm text-zinc-500">{selectedEvent?.title}</p>
              </div>
              <label class="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={event =>
                    setForm({ ...form, active: event.currentTarget.checked })
                  }
                />
                Sprzedaż aktywna
              </label>
            </div>
            <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Waluta"
                value={form.currency}
                onInput={value =>
                  setForm({ ...form, currency: value.toUpperCase() })
                }
                maxLength={3}
              />
              <Field
                label="VAT (%)"
                value={form.vatRatePercent}
                onInput={value => setForm({ ...form, vatRatePercent: value })}
                type="number"
                min="0"
                max="100"
                step="0.01"
              />
              <Field
                label="Całkowita pula"
                value={form.capacity}
                onInput={value => setForm({ ...form, capacity: value })}
                type="number"
                min="1"
                max="1000000"
              />
              <Field
                label="Maks. na zamówienie"
                value={form.maxPerOrder}
                onInput={value => setForm({ ...form, maxPerOrder: value })}
                type="number"
                min="1"
                max="100"
              />
              <Field
                label="Rezerwacja (sekundy)"
                value={form.holdSeconds}
                onInput={value => setForm({ ...form, holdSeconds: value })}
                type="number"
                min="2100"
                max="86400"
              />
              <Field
                label="Start sprzedaży"
                value={form.salesOpenAt}
                onInput={value => setForm({ ...form, salesOpenAt: value })}
                type="datetime-local"
              />
              <Field
                label="Koniec sprzedaży"
                value={form.salesCloseAt}
                onInput={value => setForm({ ...form, salesCloseAt: value })}
                type="datetime-local"
              />
            </div>
          </section>

          <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-black text-white">Typy biletów</h3>
                <p class="mt-1 text-sm text-zinc-500">
                  Cena brutto. Pula typu nie może przekraczać puli wydarzenia.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm(current => ({
                    ...current,
                    ticketTypes: [
                      ...current.ticketTypes,
                      {
                        slug: `ticket-${current.ticketTypes.length + 1}`,
                        name: "Nowy bilet",
                        description: "",
                        priceGross: "50.00",
                        capacity: "",
                        active: true,
                      },
                    ],
                  }))
                }
                class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
              >
                Dodaj typ
              </button>
            </div>

            <div class="mt-5 grid gap-4">
              {form.ticketTypes.map((type, index) => (
                <article
                  key={index}
                  class="grid gap-4 rounded-2xl border border-white/5 bg-black/30 p-4 xl:grid-cols-[1fr_1.2fr_.7fr_.6fr_auto]"
                >
                  <Field
                    label="Slug"
                    value={type.slug}
                    onInput={value =>
                      updateType(index, { slug: value.toLowerCase() })
                    }
                  />
                  <Field
                    label="Nazwa"
                    value={type.name}
                    onInput={value => updateType(index, { name: value })}
                    maxLength={160}
                  />
                  <Field
                    label="Cena brutto"
                    value={type.priceGross}
                    onInput={value => updateType(index, { priceGross: value })}
                    type="number"
                    min="0.01"
                    max="10000000"
                    step="0.01"
                  />
                  <Field
                    label="Pula typu"
                    value={type.capacity}
                    onInput={value => updateType(index, { capacity: value })}
                    type="number"
                    min="1"
                    max={form.capacity || "1000000"}
                    required={false}
                  />
                  <div class="flex flex-wrap items-end gap-2">
                    <label class="flex h-[46px] items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-white">
                      <input
                        type="checkbox"
                        checked={type.active}
                        onChange={event =>
                          updateType(index, {
                            active: event.currentTarget.checked,
                          })
                        }
                      />
                      aktywny
                    </label>
                    <button
                      type="button"
                      disabled={form.ticketTypes.length === 1}
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          ticketTypes: current.ticketTypes.filter(
                            (_, typeIndex) => typeIndex !== index,
                          ),
                        }))
                      }
                      class="h-[46px] rounded-xl border border-rose-400/30 px-3 text-sm font-bold text-rose-200 disabled:opacity-30"
                    >
                      Usuń
                    </button>
                  </div>
                  <label class="grid gap-2 text-sm font-semibold text-zinc-200 xl:col-span-5">
                    Opis
                    <textarea
                      value={type.description}
                      maxLength={1_000}
                      rows={3}
                      onInput={event =>
                        updateType(index, {
                          description: event.currentTarget.value,
                        })
                      }
                      class="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none focus:border-amber-300"
                    />
                  </label>
                </article>
              ))}
            </div>

            <button
              disabled={busy}
              class="mt-5 min-h-12 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50"
            >
              {busy ? "Zapisuję…" : "Zapisz konfigurację sprzedaży"}
            </button>
            {message && (
              <p
                role="status"
                class="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
              >
                {message}
              </p>
            )}
          </section>

          {overview?.recent_orders?.length ? (
            <RecentOrders orders={overview.recent_orders} />
          ) : null}
        </form>
      )}
    </section>
  )
}

function TicketingInventorySummary({
  overview,
}: {
  overview: TicketingOverview
}) {
  return (
    <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)] lg:items-end">
        <div>
          <p class="text-xs font-bold uppercase tracking-[.2em] text-amber-300">
            Stan puli
          </p>
          <p class="mt-2 text-sm leading-6 text-zinc-400">
            Rezerwacje i checkouty blokują miejsca tylko do czasu opłacenia lub
            wygaśnięcia. Nie są liczone jako sprzedaż.
          </p>
        </div>
        <TicketInventoryBar inventory={overview.sale} lang="pl" />
      </div>
      <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <Metric
          label="Sprzedane bilety"
          value={String(overview.paid_tickets)}
        />
        <Metric
          label="Bilety w płatności"
          value={String(overview.reserved_tickets)}
        />
        <Metric
          label="Aktywne rezerwacje"
          value={String(overview.reserved_orders)}
        />
        <Metric
          label="Checkouty Stripe"
          value={String(overview.checkout_created_orders)}
        />
        <Metric
          label="Opłacone zamówienia"
          value={String(overview.paid_orders)}
        />
        <Metric
          label="Przychód brutto"
          value={money(overview.gross_sales_minor, overview.sale.currency)}
        />
        <Metric
          label="Zwroty"
          value={money(overview.refunded_minor, overview.sale.currency)}
          ok={overview.refunded_minor === 0}
        />
      </div>
    </section>
  )
}

type RecentOrder = TicketingOverview["recent_orders"][number]
type OrderTone = "amber" | "emerald" | "sky" | "rose" | "zinc"

const orderStatus = (status: string): { label: string; tone: OrderTone } => {
  switch (status) {
    case "reserved":
      return { label: "Rezerwacja", tone: "amber" }
    case "checkout_created":
      return { label: "W trakcie płatności", tone: "amber" }
    case "paid":
      return { label: "Opłacone", tone: "emerald" }
    case "partially_refunded":
      return { label: "Częściowy zwrot", tone: "sky" }
    case "refunded":
      return { label: "Zwrócone", tone: "sky" }
    case "expired":
      return { label: "Wygasło", tone: "zinc" }
    case "cancelled":
      return { label: "Anulowane", tone: "zinc" }
    case "payment_failed":
      return { label: "Płatność nieudana", tone: "rose" }
    default:
      return { label: status.replaceAll("_", " "), tone: "zinc" }
  }
}

function OrderStatusBadge({ status }: { status: string }) {
  const display = orderStatus(status)
  const tones: Record<OrderTone, string> = {
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    sky: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    zinc: "border-white/10 bg-white/5 text-zinc-300",
  }
  const tone = tones[display.tone]

  return (
    <span
      class={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tone}`}
    >
      {display.label}
    </span>
  )
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  return (
    <section class="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
      <div class="border-b border-white/10 p-5 sm:p-6">
        <h3 class="text-lg font-black text-white">Ostatnie zamówienia</h3>
        <p class="mt-1 text-sm text-zinc-500">
          Checkout w toku jest rezerwacją, nie zakończoną sprzedażą.
        </p>
      </div>

      <div class="grid gap-3 p-4 sm:hidden">
        {orders.map(order => (
          <article
            key={order.order_id}
            class="rounded-2xl border border-white/5 bg-black/25 p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="break-all font-mono text-xs font-bold text-white">
                  {order.public_reference}
                </p>
                <p class="mt-1 text-xs text-zinc-500">
                  {order.buyer_email_masked}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div class="mt-4 flex items-end justify-between gap-3 border-t border-white/5 pt-3">
              <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Kwota
              </span>
              <strong class="text-base text-white">
                {money(order.amount_gross_minor, order.currency)}
              </strong>
            </div>
          </article>
        ))}
      </div>

      <div class="hidden overflow-x-auto sm:block">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-black/30 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th class="px-4 py-3">Numer</th>
              <th class="px-4 py-3">Kupujący</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Kwota</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr
                key={order.order_id}
                class="border-t border-white/5 text-zinc-300"
              >
                <td class="px-4 py-3 font-mono text-xs text-white">
                  {order.public_reference}
                </td>
                <td class="px-4 py-3">{order.buyer_email_masked}</td>
                <td class="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td class="px-4 py-3 text-right font-bold text-white">
                  {money(order.amount_gross_minor, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AdmissionTab({ events }: { events: EventItem[] }) {
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
            onInput={value => setIssue({ ...issue, claimExpiresHours: value })}
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

function MailerTab({ capabilities }: { capabilities: Capabilities | null }) {
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

function OpsTab() {
  const [overview, setOverview] = useState<OpsOverview | null>(null)
  const [busyId, setBusyId] = useState("")
  const [message, setMessage] = useState("")

  async function load(signal?: AbortSignal) {
    setMessage("")
    try {
      setOverview(
        await api<OpsOverview>("/api/staff/admin/ops/summary", { signal }),
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Nie udało się pobrać kolejek",
      )
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [])

  async function retry(target: "outbox" | "delivery", id: string) {
    if (busyId) return
    setBusyId(id)
    setMessage("")
    try {
      await api("/api/staff/admin/ops/retry", {
        method: "POST",
        body: { target, id },
      })
      setMessage("Element wrócił do kolejki. Historia prób została zachowana.")
      await load()
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
      <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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
            disabled={!!busyId}
            onClick={() => void load()}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Odśwież kolejki
          </button>
        </div>
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
        </div>
        {(outbox || deliveries) && (
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
                  <OrderStatusBadge status="payment_failed" />
                  <span class="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    {item.target === "delivery"
                      ? "webhook delivery"
                      : "outbox event"}
                  </span>
                </div>
                <strong class="mt-3 block break-words text-white">
                  {item.event_type}
                </strong>
                <p class="mt-1 break-all font-mono text-[11px] text-zinc-500">
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
                disabled={!!busyId || item.endpoint_active === false}
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

function SystemTab({
  capabilities,
  overview,
}: {
  capabilities: Capabilities | null
  overview: Overview | null
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
  ] as Array<[string, boolean | undefined, string]>
  return (
    <div class="grid gap-5">
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
          Panel zarządza wszystkim, co CrowdRelay wystawia dziś jako bezpieczne
          endpointy admina: ticketingiem, wejściówkami, QR i księgowością. CRUD
          zwykłych kampanii marketingowych, webhooków oraz fanów wymaga osobnych
          endpointów w backendzie Rust — celowo nie obchodzimy tego bezpośrednim
          dostępem do bazy.
        </p>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  onInput,
  type = "text",
  maxLength,
  min,
  max,
  step,
  required = true,
  autocomplete,
}: {
  label: string
  value: string
  onInput: (value: string) => void
  type?: string
  maxLength?: number
  min?: string
  max?: string
  step?: string
  required?: boolean
  autocomplete?: string
}) {
  return (
    <label class="text-sm font-semibold text-zinc-200">
      {label}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        required={required}
        autocomplete={autocomplete}
        onInput={event => onInput(event.currentTarget.value)}
        class="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white outline-none transition-colors focus:border-amber-300"
      />
    </label>
  )
}
function Metric({
  label,
  value,
  ok = true,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <div
      class={`rounded-2xl border p-4 ${ok ? "border-white/10 bg-zinc-900/70" : "border-rose-400/35 bg-rose-400/10"}`}
    >
      <p class="text-xs font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p class="mt-2 text-xl font-black tabular-nums text-white">{value}</p>
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
      class={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${ok ? "bg-emerald-300 text-emerald-950" : "bg-rose-300 text-rose-950"}`}
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
function StatusCard({ title, body }: { title: string; body?: string }) {
  return (
    <section class="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900/80 p-8">
      <h1 class="text-2xl font-black text-white">{title}</h1>
      {body && <p class="mt-3 text-zinc-400">{body}</p>}
    </section>
  )
}
