import type { ComponentChildren } from "preact"
import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import BackendLoader from "./BackendLoader"
import { staffApi, type StaffApiError } from "./staffApi"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type EligibilityKind = "all_active" | "event_interest" | "synesthesia_completion"

const SYNESTHESIA_CAMPAIGN = "virya-synesthesia-album-v1"
type ApiError = StaffApiError

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
  eligibility_kind: EligibilityKind
  eligibility_ref?: string | null
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

type RewardDraw = {
  id: string
  slug: string
  name: string
  prize_kind: "admission_pass" | "physical_item"
  eligibility_kind: EligibilityKind
  eligibility_ref?: string | null
  event_slug?: string | null
  status: "draft" | "scheduled" | "running" | "completed" | "cancelled"
  winner_count: number
  run_count: number
  selected_winners: number
  proof_count: number
  can_delete: boolean
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

type InventoryActivation = {
  status: "preparing" | "ready"
  ready: boolean
  fully_enabled: boolean
  catalog_seed_version: number
  catalog_seeded_at?: string | null
  ready_at?: string | null
  ready_by?: string | null
  version: number
  total_active_variants: number
  counted_active_variants: number
  missing_skus: string[]
  blockers: string[]
  can_mark_ready: boolean
  public_enabled: boolean
  writes_enabled: boolean
  campaigns_enabled: boolean
}

type InventoryItem = {
  product_slug: string
  product_name: string
  variant_id: string
  sku: string
  variant_label: string
  attributes: Record<string, unknown>
  active: boolean
  low_stock_threshold: number
  sell_without_stock: boolean
  counted: boolean
  last_counted_at?: string | null
  on_hand: number
  order_reserved: number
  campaign_reserved: number
  operational_reserved: number
  reserved: number
  available_quantity: number
  sold_total: number
  sold_30d: number
  promotional_issued_total: number
  active_campaigns: number
}

type Overview = {
  catalog: { generated_at: string | null; products: Product[] }
  activation: InventoryActivation | null
  inventory: { generated_at: string | null; items: InventoryItem[] }
  campaigns: Campaign[]
  draws: RewardDraw[]
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
  eligibilityKind: EligibilityKind
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

const api = <T,>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
) => staffApi<T>(path, { ...options, timeoutMs: REQUEST_TIMEOUT_MS })

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

const activationBlocker = (blocker: string) => ({
  catalog_empty: "Katalog nie został założony.",
  uncounted_variants: "Nie wszystkie aktywne warianty mają wpisany dokładny stan.",
  reserved_exceeds_stock: "Aktywne rezerwacje przekraczają policzony stan.",
  feature_flags_inconsistent: "Magazyn jest oznaczony jako gotowy, ale przełączniki nie są spójne.",
})[blocker] ?? blocker

const fulfillmentStatus = (status: Fulfillment["status"]) => ({
  pending: "DO PRZYGOTOWANIA",
  prepared: "PRZYGOTOWANA",
  delivered: "WYDANA",
  cancelled: "ANULOWANA",
})[status]

const displayDate = (value: unknown) => {
  if (typeof value !== "string") return "—"
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : "—"
}

export default function StaffCommerceManager() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [stockSku, setStockSku] = useState("")
  const [stockDelta, setStockDelta] = useState(1)
  const [stockReason, setStockReason] = useState("")
  const [stockCounts, setStockCounts] = useState<Record<string, string>>({})
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
  const inventoryItems = useMemo(
    () => (overview?.inventory.items ?? []).filter(item => item.active),
    [overview],
  )
  const inventoryBySku = useMemo(
    () => new Map((overview?.inventory.items ?? []).map(item => [item.sku, item])),
    [overview],
  )
  const activation = overview?.activation ?? null
  const inventoryReady = Boolean(activation?.ready && activation.fully_enabled)
  const stocktakeComplete = inventoryItems.length > 0 && inventoryItems.every(item => {
    const value = Number(stockCounts[item.sku])
    return stockCounts[item.sku]?.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= 1_000_000
  })

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

  useEffect(() => {
    setStockCounts(current => {
      const next: Record<string, string> = {}
      for (const item of inventoryItems) {
        next[item.sku] = current[item.sku] ?? (item.counted ? String(item.on_hand) : "")
      }
      return next
    })
  }, [inventoryItems])

  async function refresh() {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
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
      if (!controller.signal.aborted) setLoading(false)
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
      const apiError = error as ApiError
      const status = apiError.status
      if (status === 401) setState("login")
      setMessage(
        apiError.ambiguous
          ? "Nie udało się potwierdzić wyniku operacji. Nie zmieniaj danych: odśwież stan albo ponów — retry użyje tego samego ID operacji i nie powinien wykonać jej drugi raz."
          : status === 409
          ? path.includes("/draws/")
            ? "Tego losowania nie można już usunąć: istnieje run, zwycięzca, Proof of Fair albo stan nie pozwala na usunięcie."
            : "Operacja koliduje z aktualnym stanem lub dostępnym magazynem."
          : status === 503
            ? "Funkcja jest wyłączona albo CrowdRelay jest chwilowo niedostępny."
            : "Operacja nie powiodła się.",
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraw(draw: RewardDraw) {
    if (busy || loading || !draw.can_delete) return
    const confirmed = window.confirm(
      `Usunąć błędne losowanie „${draw.name}”?\n\nTa akcja nie usuwa koncertu. Jest dostępna tylko przed pierwszym runem, zwycięzcą i Proof of Fair.`,
    )
    if (!confirmed) return
    await mutate(
      `/api/staff/commerce/draws/${draw.id}/delete`,
      {},
      `Losowanie „${draw.name}” zostało usunięte. Koncert pozostał bez zmian.`,
    )
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

  async function saveExactStock(event: SubmitEvent) {
    event.preventDefault()
    if (!stocktakeComplete || inventoryItems.length === 0) {
      setMessage("Uzupełnij dokładny stan każdego aktywnego wariantu, również zera.")
      return
    }
    await mutate(
      "/api/staff/commerce/stocktake",
      {
        items: inventoryItems.map(item => ({
          sku: item.sku,
          on_hand: Number(stockCounts[item.sku]),
        })),
        actor_id: "virya-staff-web",
        reason: "exact physical stocktake before inventory activation",
      },
      "Dokładny stan wszystkich wariantów został zapisany. Sprawdź podsumowanie i uruchom magazyn przyciskiem READY.",
    )
  }

  async function markInventoryReady() {
    if (!activation?.can_mark_ready || busy) return
    await mutate(
      "/api/staff/commerce/ready",
      { actor_id: "virya-staff-web" },
      "Magazyn jest gotowy. Sprzedaż, rezerwacje i kampanie zostały uruchomione automatycznie.",
    )
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
        eligibility_ref: campaign.eligibilityKind === "synesthesia_completion"
          ? SYNESTHESIA_CAMPAIGN
          : null,
        event_slug: campaign.eligibilityKind === "event_interest"
          ? campaign.eventSlug.trim()
          : null,
        base_entries: 1,
        entries_per_referral: campaign.eligibilityKind === "synesthesia_completion" ? 0 : 1,
        entries_per_checkin: campaign.eligibilityKind === "event_interest" ? 1 : 0,
        max_entries: campaign.eligibilityKind === "synesthesia_completion" ? 1 : 1000,
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
    <div class="relative grid gap-6">
      {loading && <BackendLoader overlay label="Pobieram merch, magazyn i losowania…" />}
      <section class="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-xs font-black uppercase tracking-[0.24em] text-amber-300">CrowdRelay / commerce</p>
            <h1 class="mt-3 text-3xl font-black text-white sm:text-4xl">Merch, magazyn i losowania</h1>
            <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
              Jeden stan magazynowy dla strony, Virya Signal, sprzedaży Stripe i nagród. Operacje są idempotentne, a nowe funkcje mają osobne kill switche.
            </p>
          </div>
          <button type="button" disabled={busy || loading} onClick={() => void refresh()}
            class="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 disabled:opacity-50">
            {loading ? "ODŚWIEŻAM…" : "ODŚWIEŻ"}
          </button>
        </div>
        {overview?.degraded.active ? (
          <p class="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Tryb częściowy: niedostępne sekcje {overview.degraded.unavailable.join(", ")}.
          </p>
        ) : null}
        {message ? <Message>{message}</Message> : null}
      </section>

      {!inventoryReady ? (
        <section class="rounded-3xl border border-amber-300/25 bg-zinc-900/80 p-5 sm:p-7">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Przygotowanie magazynu</p>
              <h2 class="mt-2 text-2xl font-black text-white sm:text-3xl">Policz warianty, zapisz i uruchom</h2>
              <p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                Katalog został założony automatycznie. Wpisz rzeczywisty stan każdego wariantu — także <strong class="text-zinc-200">0</strong>.
                Sam zapis nie uruchamia sprzedaży. Dopiero przycisk READY wykonuje preflight i atomowo włącza publiczny stan, rezerwacje Stripe oraz kampanie.
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
              <strong class="block text-2xl text-white">{activation?.counted_active_variants ?? 0}/{activation?.total_active_variants ?? inventoryItems.length}</strong>
              <span class="text-xs text-zinc-500">wariantów zatwierdzonych</span>
            </div>
          </div>

          {activation?.blockers.length ? (
            <div class="mt-5 grid gap-2">
              {activation.blockers.map(blocker => (
                <p key={blocker} class="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-sm text-amber-100">
                  {activationBlocker(blocker)}
                </p>
              ))}
            </div>
          ) : null}

          <form onSubmit={saveExactStock} class="mt-6">
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inventoryItems.length === 0 ? (
                <Empty>Katalog lub overview magazynu jest chwilowo niedostępny. Migracja 0028 seeduje katalog automatycznie.</Empty>
              ) : inventoryItems.map(item => (
                <label key={item.variant_id} class={`rounded-2xl border p-4 ${item.counted ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-white/10 bg-black/30"}`}>
                  <span class="block text-sm font-black text-white">{item.product_name} — {item.variant_label}</span>
                  <code class="mt-1 block text-[11px] text-zinc-500">{item.sku}</code>
                  <span class="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="1000000"
                      step="1"
                      value={stockCounts[item.sku] ?? ""}
                      onInput={event => setStockCounts(current => ({ ...current, [item.sku]: event.currentTarget.value }))}
                      placeholder="0"
                      class="input w-full"
                    />
                    <span class="shrink-0 text-xs font-bold text-zinc-500">SZT.</span>
                  </span>
                  <span class="mt-2 block text-[11px] text-zinc-500">
                    {item.counted ? `Ostatnio zapisano ${item.on_hand}; rezerwacje ${item.reserved}.` : "Jeszcze niezatwierdzony."}
                  </span>
                </label>
              ))}
            </div>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <button disabled={busy || !stocktakeComplete} class="rounded-xl bg-white px-5 py-3 font-black text-zinc-950 disabled:opacity-40">
                {busy ? "ZAPISUJĘ…" : "ZAPISZ DOKŁADNY STAN"}
              </button>
              <button
                type="button"
                disabled={busy || !activation?.can_mark_ready}
                onClick={() => void markInventoryReady()}
                class="rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 disabled:opacity-40"
              >
                {activation?.ready ? "NAPRAW AKTYWACJĘ" : "MAGAZYN GOTOWY — READY"}
              </button>
            </div>
            <p class="mt-3 text-xs leading-5 text-zinc-500">
              READY jest aktywny dopiero po zapisaniu wszystkich aktywnych SKU i sprawdzeniu, że rezerwacje nie przekraczają stanu. Jeżeli same flagi się rozjadą, ten sam przycisk bezpiecznie je naprawi. Kliknięcie nie zmienia mail-flow ani workflowów n8n.
            </p>
          </form>
        </section>
      ) : (
        <section class="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-5 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Magazyn aktywny</p>
              <p class="mt-1 text-sm text-zinc-300">Publiczny stan, rezerwacje Stripe i kampanie są włączone. Aktywował: {activation?.ready_by ?? "staff"}.</p>
            </div>
            <span class="rounded-full bg-emerald-300 px-4 py-2 text-xs font-black text-zinc-950">READY</span>
          </div>
        </section>
      )}

      {inventoryReady ? (<>
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
            {variants.length === 0 ? <Empty>Katalog jest chwilowo niedostępny.</Empty> : variants.map(({ product, variant }) => {
              const exact = inventoryBySku.get(variant.sku)
              const available = exact?.available_quantity ?? variant.available_quantity ?? 0
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
                  <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-3 xl:grid-cols-6">
                    <Metric label="Fizycznie" value={exact?.on_hand ?? variant.on_hand ?? 0} />
                    <Metric label="Zamówienia" value={exact?.order_reserved ?? 0} />
                    <Metric label="Kampanie" value={exact?.campaign_reserved ?? 0} />
                    <Metric label="Operacyjne" value={exact?.operational_reserved ?? 0} />
                    <Metric label="Sprzedaż 30 dni" value={exact?.sold_30d ?? recommendation?.sold_30d ?? 0} />
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
                {variants.map(({ product, variant }) => <option key={variant.id} value={variant.sku}>{product.name} — {variant.label}</option>)}
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
                {variants.map(({ product, variant }) => <option key={variant.id} value={variant.sku}>{product.name} — {variant.label} ({variant.available_quantity ?? 0} dostępnych)</option>)}
              </select>
            </Field>
            <Field label="Zwycięzcy">
              <input type="number" min="1" max="10000" value={campaign.winnerCount} disabled={campaign.eligibilityKind === "synesthesia_completion"} onInput={event => setCampaign(current => ({ ...current, winnerCount: Number(event.currentTarget.value) }))} class="input disabled:opacity-60" />
            </Field>
            <Field label="Sztuk na osobę">
              <input type="number" min="1" max="100" value={campaign.unitsPerWinner} disabled={campaign.eligibilityKind === "synesthesia_completion"} onInput={event => setCampaign(current => ({ ...current, unitsPerWinner: Number(event.currentTarget.value) }))} class="input disabled:opacity-60" />
            </Field>
            <Field label="Kwalifikacja" wide>
              <select
                value={campaign.eligibilityKind}
                onChange={event => {
                  const eligibilityKind = event.currentTarget.value as CampaignForm["eligibilityKind"]
                  setCampaign(current => eligibilityKind === "synesthesia_completion"
                    ? { ...current, eligibilityKind, winnerCount: 5, unitsPerWinner: 1, eventSlug: "" }
                    : { ...current, eligibilityKind })
                }}
                class="input"
              >
                <option value="all_active">Wszyscy aktywni Sygnałowcy</option>
                <option value="event_interest">Zainteresowani konkretnym koncertem</option>
                <option value="synesthesia_completion">Synesthesia · ukończenie całego albumu</option>
              </select>
            </Field>
            {campaign.eligibilityKind === "event_interest" ? (
              <Field label="Slug koncertu" wide>
                <input value={campaign.eventSlug} onInput={event => setCampaign(current => ({ ...current, eventSlug: slugify(event.currentTarget.value) }))} class="input" />
              </Field>
            ) : null}
            {campaign.eligibilityKind === "synesthesia_completion" ? (
              <div class="sm:col-span-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-3 text-xs leading-5 text-cyan-100/80">
                Synesthesia jest trybem stałym: <strong>5 płyt · 1 ukończenie = 1 los</strong>. Bez bonusu za polecenia i check-in. Kandydaci trafiają do zwykłego CrowdRelay Proof of Fair, a stock jest rezerwowany przed losowaniem.
              </div>
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
                    {item.eligibility_kind === "synesthesia_completion" ? <p class="mt-1 text-xs font-semibold text-cyan-200/80">Synesthesia · 1 ukończenie = 1 los</p> : null}
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
        <p class="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Losowania / administracja</p>
        <h2 class="mt-2 text-2xl font-black text-white">Wszystkie weighted draws</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Tu są także losowania wejściówek, które nie mają merchowego stocku. Błędny draw możesz usunąć tylko zanim powstanie pierwszy run, zwycięzca albo Proof of Fair. Koncert nie jest usuwany.
        </p>
        <div class="mt-5 grid gap-3">
          {(overview?.draws ?? []).length === 0 ? <Empty>Brak skonfigurowanych losowań.</Empty> : overview?.draws.map(draw => (
            <article key={draw.id} class="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="font-black text-white">{draw.name}</p>
                  <p class="mt-1 font-mono text-[11px] text-zinc-500">{draw.slug}</p>
                  <p class="mt-2 text-xs text-zinc-400">
                    {draw.prize_kind === "admission_pass" ? "Wejściówki" : "Nagroda fizyczna"}
                    {draw.eligibility_kind === "synesthesia_completion"
                      ? " · Synesthesia"
                      : draw.event_slug ? ` · ${draw.event_slug}` : " · pula globalna"}
                    {` · ${draw.winner_count} zwycięzców`}
                  </p>
                </div>
                <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-zinc-200">{campaignStatus(draw.status)}</span>
              </div>
              <div class="mt-3 grid gap-1 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
                <span>Losowanie: {displayDate(draw.draw_at)}</span>
                <span>Runy: {draw.run_count}</span>
                <span>Zwycięzcy: {draw.selected_winners}</span>
                <span>Proofy: {draw.proof_count}</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <a
                  href={`/pl/dowody/losowania/${encodeURIComponent(draw.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg border border-cyan-300/30 bg-cyan-300/[.04] px-3 py-2 text-xs font-black text-cyan-200 hover:bg-cyan-300/10"
                >
                  IDŹ DO LOSOWANIA ↗
                </a>
                {draw.can_delete && (
                  <button
                    type="button"
                    disabled={busy || loading}
                    onClick={() => void deleteDraw(draw)}
                    class="rounded-lg border border-red-400/35 bg-red-400/[.04] px-3 py-2 text-xs font-black text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                  >
                    USUŃ BŁĘDNE LOSOWANIE
                  </button>
                )}
              </div>
              {!draw.can_delete && (
                <p class="mt-3 text-xs font-semibold text-zinc-500">
                  {draw.run_count > 0 || draw.selected_winners > 0 || draw.proof_count > 0
                    ? "Zablokowane: istnieje już trwała historia losowania / Proof of Fair."
                    : "Zablokowane w aktualnym stanie losowania."}
                </p>
              )}
            </article>
          ))}
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
      </>) : null}
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
