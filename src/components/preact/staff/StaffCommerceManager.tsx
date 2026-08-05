import type { ComponentChildren } from "preact"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type ApiError = Error & { status?: number }

type Variant = {
  id: string
  sku: string
  label: string
  attributes: Record<string, unknown>
  active: boolean
  low_stock_threshold: number
  sell_without_stock: boolean
  available: boolean
  availability: "in_stock" | "low_stock" | "out_of_stock" | "preorder"
  on_hand?: number
  reserved?: number
  available_quantity?: number
}

type Product = {
  id: string
  slug: string
  name: string
  currency: string
  price_gross_minor: number
  active: boolean
  public: boolean
  variants: Variant[]
}

type Campaign = {
  id: string
  slug: string
  name: string
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled"
  eligibility_kind: "all_active" | "event_interest"
  event_slug?: string | null
  winner_count: number
  selected_winners: number
  prize_sku: string
  prize_name: string
  prize_variant: string
  units_per_winner: number
  reserved_quantity: number
  pending_fulfillments: number
  delivered_fulfillments: number
  opens_at: string
  closes_at: string
  draw_at: string
  completed_at?: string | null
}

type Fulfillment = {
  id: string
  winner_id: string
  draw_id: string
  draw_slug: string
  winner_rank: number
  fan_display_name?: string | null
  fan_email_masked: string
  prize_sku: string
  prize_name: string
  prize_variant: string
  quantity: number
  status: "pending" | "prepared" | "delivered" | "cancelled"
  created_at: string
  updated_at: string
}

type Recommendation = {
  sku: string
  product_name: string
  variant_label: string
  on_hand: number
  reserved: number
  available_quantity: number
  sold_7d: number
  sold_30d: number
  sold_90d: number
  promotional_issued_90d: number
  upcoming_events_60d: number
  history_days: number
  safety_stock: number
  recommended_max_giveaway: number
  recommendation: "hold" | "limited" | "candidate"
  confidence: "low" | "medium" | "high"
  reason: string
}

type Overview = {
  catalog: { generated_at: string | null; products: Product[] }
  campaigns: Campaign[]
  fulfillments: Fulfillment[]
  recommendations: Recommendation[]
  degraded: { active: boolean; unavailable: string[] }
  generatedAt: string
}

type CampaignForm = {
  name: string
  slug: string
  prizeSku: string
  winnerCount: number
  unitsPerWinner: number
  eligibilityKind: "all_active" | "event_interest"
  eventSlug: string
  opensAt: string
  closesAt: string
  drawAt: string
  status: "draft" | "scheduled"
}

const REQUEST_TIMEOUT_MS = 15_000
const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
})

const localDateTime = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

const initialCampaign = (): CampaignForm => {
  const opens = new Date(Date.now() + 60 * 60 * 1000)
  const closes = new Date(opens.getTime() + 7 * 24 * 60 * 60 * 1000)
  const draw = new Date(closes.getTime() + 60 * 60 * 1000)
  return {
    name: "",
    slug: "",
    prizeSku: "",
    winnerCount: 5,
    unitsPerWinner: 1,
    eligibilityKind: "all_active",
    eventSlug: "",
    opensAt: localDateTime(opens),
    closesAt: localDateTime(closes),
    drawAt: localDateTime(draw),
    status: "draft",
  }
}

const api = async <T,>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> => {
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const forwardAbort = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) forwardAbort()
  else options.signal?.addEventListener("abort", forwardAbort, { once: true })
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
    if (!response.ok) {
      const error = new Error("Request failed") as ApiError
      error.status = response.status
      throw error
    }
    return await response.json() as T
  } catch (error) {
    if (timedOut) {
      const timeout = new Error("Request timed out") as ApiError
      timeout.status = 408
      throw timeout
    }
    throw error
  } finally {
    window.clearTimeout(timer)
    options.signal?.removeEventListener("abort", forwardAbort)
  }
}

const slugify = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 128)

const campaignStatus = (status: Campaign["status"]) => ({
  draft: "SZKIC",
  scheduled: "ZAPLANOWANA",
  running: "TRWA LOSOWANIE",
  completed: "ZAKOŃCZONA",
  cancelled: "ANULOWANA",
})[status]

const fulfillmentStatus = (status: Fulfillment["status"]) => ({
  pending: "DO PRZYGOTOWANIA",
  prepared: "PRZYGOTOWANA",
  delivered: "WYDANA",
  cancelled: "ANULOWANA",
})[status]

const displayDate = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : "—"
}

export default function StaffCommerceManager() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [stockSku, setStockSku] = useState("")
  const [stockDelta, setStockDelta] = useState(1)
  const [stockReason, setStockReason] = useState("")
  const [campaign, setCampaign] = useState<CampaignForm>(initialCampaign)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const variants = useMemo(
    () => (overview?.catalog.products ?? []).flatMap(product =>
      product.variants.map(variant => ({ product, variant })),
    ),
    [overview],
  )
  const recommendationBySku = useMemo(
    () => new Map((overview?.recommendations ?? []).map(item => [item.sku, item])),
    [overview],
  )

  useEffect(() => {
    const controller = new AbortController()
    void api<{ authenticated: boolean; configured: boolean }>(
      "/api/staff/qr/status",
      { signal: controller.signal },
    )
      .then(status => {
        if (!status.configured) return setState("unconfigured")
        if (!status.authenticated) {
          setState("login")
          queueMicrotask(() => passwordRef.current?.focus())
          return
        }
        setState("ready")
        void refresh()
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState("error")
        }
      })
    return () => {
      controller.abort()
      requestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!stockSku && variants[0]) setStockSku(variants[0].variant.sku)
    if (!campaign.prizeSku && variants[0]) {
      setCampaign(current => ({ ...current, prizeSku: variants[0].variant.sku }))
    }
  }, [variants, stockSku, campaign.prizeSku])

  async function refresh() {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setMessage("")
    try {
      const next = await api<Overview>("/api/staff/commerce/overview", {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setOverview(next)
    } catch (error) {
      if ((error as ApiError).status === 401) {
        setState("login")
        setOverview(null)
        setMessage("Sesja wygasła. Zaloguj się ponownie.")
      } else if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage("Nie udało się odświeżyć danych commerce.")
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
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
      setState("ready")
      await refresh()
    } catch (error) {
      setMessage(
        (error as ApiError).status === 429
          ? "Za dużo prób. Spróbuj ponownie później."
          : "Nieprawidłowe hasło.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function mutate(path: string, body?: unknown, success = "Zapisano.") {
    if (busy) return false
    setBusy(true)
    setMessage("")
    try {
      await api(path, { method: "POST", body: body ?? {} })
      setMessage(success)
      await refresh()
      return true
    } catch (error) {
      const status = (error as ApiError).status
      if (status === 401) setState("login")
      setMessage(
        status === 409
          ? "Operacja koliduje z aktualnym stanem lub dostępnym magazynem."
          : status === 503
            ? "Funkcja jest wyłączona albo CrowdRelay jest chwilowo niedostępny."
            : "Operacja nie powiodła się.",
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function adjustStock(event: SubmitEvent) {
    event.preventDefault()
    if (!stockSku || !Number.isInteger(stockDelta) || stockDelta === 0) return
    const ok = await mutate(
      "/api/staff/commerce/inventory",
      {
        sku: stockSku,
        delta: stockDelta,
        movement_kind: stockDelta > 0 ? "receipt" : "adjustment",
        actor_id: "virya-staff-web",
        reason: stockReason.trim() || "manual stock correction",
      },
      "Stan magazynowy został zapisany.",
    )
    if (ok) {
      setStockDelta(1)
      setStockReason("")
    }
  }

  async function createCampaign(event: SubmitEvent) {
    event.preventDefault()
    if (!campaign.name.trim() || !campaign.slug || !campaign.prizeSku) return
    const dates = [campaign.opensAt, campaign.closesAt, campaign.drawAt].map(value => new Date(value))
    if (dates.some(value => !Number.isFinite(value.getTime()))) {
      setMessage("Daty kampanii są nieprawidłowe.")
      return
    }
    const ok = await mutate(
      "/api/staff/commerce/campaigns",
      {
        slug: campaign.slug,
        name: campaign.name.trim(),
        prize_sku: campaign.prizeSku,
        winner_count: campaign.winnerCount,
        units_per_winner: campaign.unitsPerWinner,
        eligibility_kind: campaign.eligibilityKind,
        event_slug: campaign.eligibilityKind === "event_interest"
          ? campaign.eventSlug.trim()
          : null,
        base_entries: 1,
        entries_per_referral: 1,
        entries_per_checkin: campaign.eligibilityKind === "event_interest" ? 1 : 0,
        max_entries: 1000,
        claim_expires_hours: 168,
        opens_at: dates[0].toISOString(),
        closes_at: dates[1].toISOString(),
        draw_at: dates[2].toISOString(),
        status: campaign.status,
      },
      "Kampania została utworzona, a nagrody zarezerwowane.",
    )
    if (ok) setCampaign(initialCampaign())
  }

  if (state === "checking") return <StatusCard title="Sprawdzam dostęp…" />
  if (state === "unconfigured") {
    return <StatusCard title="Panel nie jest skonfigurowany" body="Ustaw istniejące zmienne logowania staff i klucz administratora CrowdRelay w Netlify." />
  }
  if (state === "error") {
    return <StatusCard title="Panel jest chwilowo niedostępny" body="Odśwież stronę albo sprawdź logi funkcji Netlify." />
  }
  if (state === "login") {
    return (
      <section class="mx-auto max-w-lg rounded-3xl border border-white/10 bg-zinc-900/80 p-7 shadow-2xl">
        <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Virya / commerce staff</p>
        <h1 class="mt-3 text-3xl font-black text-white">Merch i kampanie</h1>
        <p class="mt-3 text-sm leading-6 text-zinc-400">Zaloguj się tym samym hasłem co do QR i Control Center.</p>
        <form onSubmit={login} class="mt-6 grid gap-4">
          <label class="text-sm font-semibold text-zinc-200">
            Hasło staff
            <input ref={passwordRef} type="password" autoComplete="current-password" value={password}
              onInput={event => setPassword(event.currentTarget.value)}
              class="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-amber-300" />
          </label>
          <button disabled={busy || !password} class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50">
            {busy ? "LOGUJĘ…" : "ZALOGUJ"}
          </button>
        </form>
        {message ? <Message>{message}</Message> : null}
      </section>
    )
  }

  return (
    <div class="grid gap-6">
      <section class="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">CrowdRelay / commerce</p>
            <h1 class="mt-3 text-3xl font-black text-white sm:text-4xl">Merch, magazyn i losowania</h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              Jeden stan magazynowy dla strony, Virya Signal, sprzedaży Stripe i nagród. Operacje są idempotentne, a nowe funkcje mają osobne kill switche.
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => void refresh()}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            {busy ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
          </button>
        </div>
        {overview?.degraded.active ? (
          <p class="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Tryb częściowy: niedostępne sekcje {overview.degraded.unavailable.join(", ")}.
          </p>
        ) : null}
        {message ? <Message>{message}</Message> : null}
      </section>

      <section class="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Magazyn</p>
              <h2 class="mt-2 text-2xl font-black text-white">Dokładny stan wariantów</h2>
            </div>
            <span class="text-xs text-zinc-500">sprzedaż + rezerwacje + kampanie</span>
          </div>
          <div class="mt-5 grid gap-3">
            {variants.length === 0 ? <Empty>Brak katalogu. Najpierw zastosuj seed katalogu.</Empty> : variants.map(({ product, variant }) => {
              const available = variant.available_quantity ?? 0
              const recommendation = recommendationBySku.get(variant.sku)
              const promotable = recommendation?.recommended_max_giveaway ?? 0
              return (
                <article key={variant.id} class="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="font-bold text-white">{product.name} — {variant.label}</p>
                      <code class="mt-1 block text-xs text-zinc-500">{variant.sku}</code>
                    </div>
                    <span class={`rounded-full px-3 py-1 text-xs font-black ${available <= 0 ? "bg-red-400/15 text-red-300" : available <= variant.low_stock_threshold ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-300"}`}>
                      dostępne {available}
                    </span>
                  </div>
                  <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                    <Metric label="Fizycznie" value={variant.on_hand ?? 0} />
                    <Metric label="Rezerwacje" value={variant.reserved ?? 0} />
                    <Metric label="Sprzedaż 30 dni" value={recommendation?.sold_30d ?? 0} />
                    <Metric label="Bezpiecznie rozdać" value={promotable} />
                  </div>
                  {recommendation ? (
                    <p class={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${recommendation.recommendation === "candidate" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-100" : recommendation.recommendation === "limited" ? "border-amber-400/20 bg-amber-400/5 text-amber-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}>
                      <strong>{recommendation.recommendation === "candidate" ? "DOBRY KANDYDAT" : recommendation.recommendation === "limited" ? "TYLKO MAŁA AKCJA" : "NIE ROZDAWAĆ TERAZ"}</strong>
                      <span class="ml-2">{recommendation.reason}</span>
                      <span class="ml-2 text-zinc-500">Pewność: {recommendation.confidence} · historia {recommendation.history_days} dni · koncerty 60 dni: {recommendation.upcoming_events_60d}</span>
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        </div>

        <form onSubmit={adjustStock} class="h-fit rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Ruch magazynowy</p>
          <h2 class="mt-2 text-2xl font-black text-white">Przyjęcie lub korekta</h2>
          <div class="mt-5 grid gap-4">
            <Field label="Wariant">
              <select value={stockSku} onChange={event => setStockSku(event.currentTarget.value)} class="input">
                {variants.map(({ product, variant }) => <option value={variant.sku}>{product.name} — {variant.label}</option>)}
              </select>
            </Field>
            <Field label="Zmiana sztuk (+ / −)">
              <input type="number" step="1" value={stockDelta} onInput={event => setStockDelta(Number(event.currentTarget.value))} class="input" />
            </Field>
            <Field label="Powód">
              <input value={stockReason} onInput={event => setStockReason(event.currentTarget.value)} maxLength={500} placeholder="np. dostawa 50 płyt" class="input" />
            </Field>
            <button disabled={busy || !stockSku || stockDelta === 0} class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50">
              ZAPISZ RUCH
            </button>
          </div>
        </form>
      </section>

      <section class="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <form onSubmit={createCampaign} class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Nowa kampania</p>
          <h2 class="mt-2 text-2xl font-black text-white">Losowanie wielu nagród</h2>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Nazwa" wide>
              <input value={campaign.name} onInput={event => setCampaign(current => ({ ...current, name: event.currentTarget.value, slug: current.slug || slugify(event.currentTarget.value) }))} maxLength={200} class="input" />
            </Field>
            <Field label="Slug" wide>
              <input value={campaign.slug} onInput={event => setCampaign(current => ({ ...current, slug: slugify(event.currentTarget.value) }))} maxLength={128} class="input" />
            </Field>
            <Field label="Nagroda" wide>
              <select value={campaign.prizeSku} onChange={event => setCampaign(current => ({ ...current, prizeSku: event.currentTarget.value }))} class="input">
                {variants.map(({ product, variant }) => <option value={variant.sku}>{product.name} — {variant.label} ({variant.available_quantity ?? 0} dostępnych)</option>)}
              </select>
            </Field>
            <Field label="Zwycięzcy">
              <input type="number" min="1" max="10000" value={campaign.winnerCount} onInput={event => setCampaign(current => ({ ...current, winnerCount: Number(event.currentTarget.value) }))} class="input" />
            </Field>
            <Field label="Sztuk na osobę">
              <input type="number" min="1" max="100" value={campaign.unitsPerWinner} onInput={event => setCampaign(current => ({ ...current, unitsPerWinner: Number(event.currentTarget.value) }))} class="input" />
            </Field>
            <Field label="Kwalifikacja" wide>
              <select value={campaign.eligibilityKind} onChange={event => setCampaign(current => ({ ...current, eligibilityKind: event.currentTarget.value as CampaignForm["eligibilityKind"] }))} class="input">
                <option value="all_active">Wszyscy aktywni Sygnałowcy</option>
                <option value="event_interest">Zainteresowani konkretnym koncertem</option>
              </select>
            </Field>
            {campaign.eligibilityKind === "event_interest" ? (
              <Field label="Slug koncertu" wide>
                <input value={campaign.eventSlug} onInput={event => setCampaign(current => ({ ...current, eventSlug: slugify(event.currentTarget.value) }))} class="input" />
              </Field>
            ) : null}
            <Field label="Start zapisów"><input type="datetime-local" value={campaign.opensAt} onInput={event => setCampaign(current => ({ ...current, opensAt: event.currentTarget.value }))} class="input" /></Field>
            <Field label="Koniec zapisów"><input type="datetime-local" value={campaign.closesAt} onInput={event => setCampaign(current => ({ ...current, closesAt: event.currentTarget.value }))} class="input" /></Field>
            <Field label="Losowanie"><input type="datetime-local" value={campaign.drawAt} onInput={event => setCampaign(current => ({ ...current, drawAt: event.currentTarget.value }))} class="input" /></Field>
            <Field label="Publikacja">
              <select value={campaign.status} onChange={event => setCampaign(current => ({ ...current, status: event.currentTarget.value as CampaignForm["status"] }))} class="input">
                <option value="draft">Szkic — zaplanuję później</option>
                <option value="scheduled">Od razu zaplanowana</option>
              </select>
            </Field>
            <div class="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-zinc-400">
              System natychmiast rezerwuje {Math.max(0, campaign.winnerCount * campaign.unitsPerWinner)} szt. Nagrody nie będą w tym czasie dostępne do sprzedaży.
            </div>
            <button disabled={busy || !campaign.name || !campaign.slug || !campaign.prizeSku} class="sm:col-span-2 rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-50">
              UTWÓRZ I ZAREZERWUJ NAGRODY
            </button>
          </div>
        </form>

        <div class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
          <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Kampanie</p>
          <h2 class="mt-2 text-2xl font-black text-white">Sterowanie losowaniami</h2>
          <div class="mt-5 grid gap-3">
            {(overview?.campaigns ?? []).length === 0 ? <Empty>Brak kampanii wielonagrodowych.</Empty> : overview?.campaigns.map(item => (
              <article key={item.id} class="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="font-black text-white">{item.name}</p>
                    <p class="mt-1 text-xs text-zinc-500">{item.prize_name} / {item.prize_variant} · {item.winner_count} × {item.units_per_winner}</p>
                  </div>
                  <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-zinc-200">{campaignStatus(item.status)}</span>
                </div>
                <div class="mt-3 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2">
                  <span>Zamknięcie: {displayDate(item.closes_at)}</span>
                  <span>Losowanie: {displayDate(item.draw_at)}</span>
                  <span>Zarezerwowano: {item.reserved_quantity} szt.</span>
                  <span>Wydano: {item.delivered_fulfillments}/{item.selected_winners}</span>
                </div>
                {item.status === "draft" ? (
                  <div class="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/campaigns/${item.id}/schedule`, {}, "Kampania została zaplanowana.")} class="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">ZAPLANUJ</button>
                    <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/campaigns/${item.id}/cancel`, {}, "Kampania anulowana, stock zwolniony.")} class="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">ANULUJ</button>
                  </div>
                ) : item.status === "scheduled" ? (
                  <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/campaigns/${item.id}/cancel`, {}, "Kampania anulowana, stock zwolniony.")} class="mt-4 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">ANULUJ I ZWOLNIJ STOCK</button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
        <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Fulfillment</p>
        <h2 class="mt-2 text-2xl font-black text-white">Wydawanie nagród</h2>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          {(overview?.fulfillments ?? []).length === 0 ? <Empty>Po losowaniu pojawią się tutaj zwycięzcy i statusy nagród.</Empty> : overview?.fulfillments.map(item => (
            <article key={item.id} class="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-black text-white">#{item.winner_rank} {item.fan_display_name || item.fan_email_masked}</p>
                  <p class="mt-1 text-xs text-zinc-500">{item.draw_slug} · {item.prize_name} / {item.prize_variant} × {item.quantity}</p>
                </div>
                <span class="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black text-zinc-200">{fulfillmentStatus(item.status)}</span>
              </div>
              {item.status === "pending" ? (
                <div class="mt-4 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/fulfillments/${item.winner_id}`, { status: "prepared", actor_id: "virya-staff-web", note: "prepared in staff panel" }, "Nagroda oznaczona jako przygotowana.")} class="rounded-lg bg-amber-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">PRZYGOTOWANA</button>
                  <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/fulfillments/${item.winner_id}`, { status: "cancelled", actor_id: "virya-staff-web", note: "cancelled in staff panel" }, "Nagroda anulowana i wróciła do dostępnego stocku.")} class="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-50">ANULUJ</button>
                </div>
              ) : item.status === "prepared" ? (
                <button type="button" disabled={busy} onClick={() => void mutate(`/api/staff/commerce/fulfillments/${item.winner_id}`, { status: "delivered", actor_id: "virya-staff-web", note: "delivered in staff panel" }, "Nagroda wydana; zapisano rozchód promocyjny.")} class="mt-4 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950 disabled:opacity-50">OZNACZ JAKO WYDANĄ</button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ComponentChildren }) {
  return <label class={`grid gap-2 text-sm font-semibold text-zinc-200 ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div class="rounded-lg bg-white/[0.04] px-2 py-2"><strong class="block text-base text-white">{value}</strong><span class="text-zinc-500">{label}</span></div>
}

function Message({ children }: { children: ComponentChildren }) {
  return <p class="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100" role="status">{children}</p>
}

function Empty({ children }: { children: ComponentChildren }) {
  return <p class="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">{children}</p>
}

function StatusCard({ title, body }: { title: string; body?: string }) {
  return <section class="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/80 p-7"><h1 class="text-2xl font-black text-white">{title}</h1>{body ? <p class="mt-3 text-sm leading-6 text-zinc-400">{body}</p> : null}</section>
}
