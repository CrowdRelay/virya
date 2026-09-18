import { useEffect, useMemo, useRef, useState } from "preact/hooks"
import { safeFormatDate } from "../../../lib/safeDateFormat"
import BackendLoader from "./BackendLoader"
import { StaffLoginCard, StaffStatusCard, type NoticeState } from "./AdminConsoleUi"
import { bootstrapStaffPanel, staffApi, type StaffApiError } from "./staffApi"
import {
  staffAccentButton,
  staffEyebrowAccent,
  staffField,
  staffMetricLabel,
  staffMetricTile,
  staffMetricTileError,
  staffMetricValue,
  staffNoticeBase,
  staffNoticeTones,
  staffPanel,
  staffPanelInset,
  staffSecondaryButton,
  staffSubtitle,
  staffTableRow,
  staffTitle,
} from "./staffUi"
import StaffLogoutButton from "./StaffLogoutButton"

type LoadState = "checking" | "login" | "ready" | "unconfigured" | "error"
type ApiError = StaffApiError

type Profile = {
  seller_name: string
  tax_id: string
  regon: string | null
  address_line1: string
  postal_code: string
  city: string
  country_code: string
  document_prefix: string
  updated_at: string
}

type SaleLine = {
  event_id: string
  event_title: string
  event_starts_at: string
  ticket_type_slug: string
  ticket_type_name: string
  quantity: number
  unit_gross_minor: number
  amount_gross_minor: number
  amount_net_minor: number
  amount_vat_minor: number
  vat_rate_basis_points: number
  currency: string
}

type AdjustmentLine = {
  event_id: string
  event_title: string
  event_starts_at: string
  entry_kind: string
  entry_count: number
  amount_gross_minor: number
  amount_net_minor: number
  amount_vat_minor: number
  vat_rate_basis_points: number
  stripe_fee_minor: number
  stripe_net_minor: number
  currency: string
}

type DocumentSummary = {
  id: string
  period_start: string
  period_end: string
  document_number: string
  currency: string
  gross_minor: number
  net_minor: number
  vat_minor: number
  stripe_fee_minor: number
  stripe_net_minor: number
  finalized_at: string
}

type AccountingTotals = {
  gross_minor: number
  net_minor: number
  vat_minor: number
  stripe_fee_minor: number
  stripe_net_minor: number
  sale_entry_count: number
  refund_entry_count: number
  balance_entry_count: number
}

type Preview = {
  period_start: string
  period_end: string
  currency: string
  suggested_document_number: string
  profile: Profile
  sales: SaleLine[]
  adjustments: AdjustmentLine[]
  totals: AccountingTotals
  commerce_totals: AccountingTotals
  invoice_request_count: number
  finalized_document: DocumentSummary | null
}

type InvoiceRequest = {
  order_id: string
  order_reference: string
  paid_at: string
  event_title: string
  buyer_type: string
  company_name: string | null
  tax_id: string | null
  full_name: string | null
  address_line1: string
  postal_code: string
  city: string
  country_code: string
  buyer_email: string
  currency: string
  status: "paid" | "partially_refunded" | "refunded"
  amount_gross_minor: number
  amount_refunded_minor: number
  amount_net_minor: number
  amount_vat_minor: number
  vat_rate_basis_points: number
  refunded_at: string | null
}

const nowMonth = () => new Date().toISOString().slice(0, 7)
const REQUEST_TIMEOUT_MS = 15_000

const api = <T,>(path: string, options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {}) =>
  staffApi<T>(path, { ...options, timeoutMs: REQUEST_TIMEOUT_MS })

const money = (minor: number, currency = "PLN") =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(minor / 100)
const dateFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" })
const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "short",
})
const date = (value: unknown) => safeFormatDate(value, dateFormatter)
const dateTime = (value: unknown) => safeFormatDate(value, dateTimeFormatter)

export default function AccountingManager() {
  const [state, setState] = useState<LoadState>("checking")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [month, setMonth] = useState(nowMonth())
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null)
  const [currency] = useState("PLN")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRequest[]>([])
  const [invoiceListAvailable, setInvoiceListAvailable] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [documentNumber, setDocumentNumber] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)

  const [profileOpen, setProfileOpen] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // One invocation: the month preview carries the session verdict with it.
    // The invoice list follows only once the session is known to be good.
    void bootstrapStaffPanel<Preview>(
      `/api/staff/accounting/preview?month=${encodeURIComponent(month)}&currency=${currency}`,
      { signal: controller.signal },
    ).then(result => {
      if (controller.signal.aborted) return
      if (result.state === "ready" && result.data) {
        setState("ready")
        applyPreview(result.data, month)
        void loadInvoices(month)
        return
      }
      setState(result.state === "ready" ? "error" : result.state)
      if (result.state === "login") {
        queueMicrotask(() => passwordRef.current?.focus())
      }
    })
    return () => { controller.abort(); requestRef.current?.abort() }
  }, [])

  const stripeState = useMemo(() => {
    if (!preview) return { complete: true, reconciles: true }
    const totals = preview.commerce_totals
    const entryCount = totals.sale_entry_count + totals.refund_entry_count
    const complete = totals.balance_entry_count === entryCount
    return {
      complete,
      reconciles: complete && totals.gross_minor - totals.stripe_fee_minor === totals.stripe_net_minor,
    }
  }, [preview])

  function applyPreview(nextPreview: Preview, nextMonth: string) {
    setPreview(nextPreview)
    setLoadedMonth(nextMonth)
    setProfile(nextPreview.profile)
    setDocumentNumber(
      nextPreview.finalized_document?.document_number ?? nextPreview.suggested_document_number,
    )
  }

  async function loadInvoices(nextMonth: string) {
    try {
      const result = await api<{ items: InvoiceRequest[] }>(
        `/api/staff/accounting/invoice-requests?month=${encodeURIComponent(nextMonth)}&currency=${currency}`,
      )
      setInvoices(result.items)
      setInvoiceListAvailable(true)
    } catch {
      setInvoiceListAvailable(false)
    }
  }

  async function loadMonth(nextMonth = month) {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setMessage("")
    try {
      const [previewResult, invoiceResult] = await Promise.allSettled([
        api<Preview>(`/api/staff/accounting/preview?month=${encodeURIComponent(nextMonth)}&currency=${currency}`, { signal: controller.signal }),
        api<{ items: InvoiceRequest[] }>(`/api/staff/accounting/invoice-requests?month=${encodeURIComponent(nextMonth)}&currency=${currency}`, { signal: controller.signal }),
      ])
      if (controller.signal.aborted) return
      if (previewResult.status === "rejected") throw previewResult.reason

      applyPreview(previewResult.value, nextMonth)
      if (invoiceResult.status === "fulfilled") {
        setInvoices(invoiceResult.value.items)
        setInvoiceListAvailable(true)
      } else {
        setInvoices([])
        setInvoiceListAvailable(false)
        setMessage("Zestawienie miesiąca jest gotowe, ale lista żądań faktury jest chwilowo niedostępna.")
      }
    } catch (error) {
      if ((error as ApiError).status === 401) setState("login")
      else setMessage("Nie udało się przygotować zestawienia. Sprawdź połączenie z CrowdRelay i spróbuj ponownie.")
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setLoading(false)
      }
    }
  }

  async function login(event: Event) {
    event.preventDefault()
    setBusy(true); setMessage("")
    try {
      await api("/api/staff/qr/login", { method: "POST", body: { password } })
      setPassword(""); setState("ready"); await loadMonth(month)
    } catch (error) {
      setMessage((error as ApiError).status === 429 ? "Za dużo prób. Spróbuj później." : "Nieprawidłowe hasło.")
    } finally { setBusy(false) }
  }

  async function finalize() {
    if (!preview || preview.finalized_document || busy) return
    if (loadedMonth !== month) {
      return setMessage("Wybrany miesiąc zmienił się. Najpierw kliknij Przelicz, aby potwierdzić dane tego okresu.")
    }
    if (!documentNumber.trim()) return setMessage("Wpisz numer dokumentu WEW.")
    if (!window.confirm(`Zamknąć ${month} jako ${documentNumber.trim()}? Snapshotu nie można później edytować.`)) return
    setBusy(true); setMessage("")
    try {
      await api<DocumentSummary>("/api/staff/accounting/finalize", { method: "POST", body: { month, currency, document_number: documentNumber.trim() } })
      await loadMonth(month)
      setMessage("Dokument został zamknięty. CSV jest gotowy do pobrania.")
    } catch (error) {
      const apiError = error as ApiError
      setMessage(
        apiError.ambiguous
          ? "Nie udało się potwierdzić wyniku zamknięcia. Nie zmieniaj miesiąca ani numeru: odśwież podgląd lub ponów — system zachowa to samo ID operacji."
          : apiError.status === 409
            ? "Ten miesiąc lub numer dokumentu jest już zamknięty."
            : "Nie udało się zamknąć dokumentu.",
      )
    } finally { setBusy(false) }
  }

  async function saveProfile(event: Event) {
    event.preventDefault()
    if (!profile || busy) return
    setBusy(true); setMessage("")
    try {
      const { updated_at: _updatedAt, ...body } = profile
      const saved = await api<Profile>("/api/staff/accounting/profile", { method: "POST", body })
      setProfile(saved); setProfileOpen(false); await loadMonth(month); setMessage("Dane sprzedawcy zapisane.")
    } catch { setMessage("Nie udało się zapisać danych sprzedawcy.") }
    finally { setBusy(false) }
  }

  if (state === "checking") return <StaffStatusCard title="Sprawdzam dostęp…" />
  if (state === "unconfigured") return <StaffStatusCard title="Panel nie jest skonfigurowany" body="Panel nie ma jeszcze włączonego dostępu. Poproś osobę prowadzącą techniczną stronę o jego konfigurację." />
  if (state === "error") return <StaffStatusCard title="Panel chwilowo niedostępny" body="Odśwież stronę za moment." />
  if (state === "login") return (
    <StaffLoginCard
      eyebrow="Virya staff"
      title="Księgowość biletów"
      description="Rozliczenia miesięczne, kontrola Stripe i dokumenty WEW."
      passwordRef={passwordRef}
      password={password}
      onPasswordInput={setPassword}
      busy={busy}
      message={message ? { tone: "error", text: message } : null}
      onSubmit={login}
      submitLabel="Wejdź"
      busyLabel="Loguję…"
    />
  )

  return (
    <section class="relative space-y-6">
      {loading && <BackendLoader overlay label="Pobieram sprzedaż, Stripe i księgowość…" />}
      <header class="grid gap-5 border-b border-virya-edge pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p class={staffEyebrowAccent}>WB Soft · sprzedaż Virya</p><h1 class="mt-2 text-3xl font-black text-virya-text sm:text-4xl">WEW i kontrola Stripe</h1><p class={`mt-3 max-w-2xl ${staffSubtitle}`}>Wybierz miesiąc, sprawdź brutto/netto/VAT, wpisz numer dokumentu i zamknij niezmienny snapshot. Prowizja Stripe jest kosztem, nie pomniejsza przychodu.</p></div>
        <div class="flex flex-wrap gap-2"><input aria-label="Miesiąc" type="month" value={month} onInput={event => setMonth(event.currentTarget.value)} class="input" /><button type="button" disabled={busy || loading} onClick={() => void loadMonth(month)} class={staffSecondaryButton}>{loading ? "Liczenie…" : "Przelicz"}</button><StaffLogoutButton disabled={busy} /></div>
      </header>

      {message && <div role="status" class={`${staffNoticeBase} ${staffNoticeTones.warn}`}>{message}</div>}
      {preview && loadedMonth !== month && (
        <div role="alert" class={`${staffNoticeBase} ${staffNoticeTones.warn}`}>
          Widok pokazuje jeszcze dane za {loadedMonth}. Przelicz {month}, zanim zamkniesz dokument.
        </div>
      )}

      {preview && <>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="WEW brutto" value={money(preview.totals.gross_minor, currency)} />
          <Metric label="WEW netto" value={money(preview.totals.net_minor, currency)} />
          <Metric label="WEW VAT" value={money(preview.totals.vat_minor, currency)} />
          <Metric label="Cały obrót Stripe" value={money(preview.commerce_totals.gross_minor, currency)} />
          <Metric label="Wpływ netto Stripe" value={money(preview.commerce_totals.stripe_net_minor, currency)} ok={stripeState.reconciles} />
        </div>

        {!stripeState.complete && <div role="status" class={`${staffNoticeBase} ${staffNoticeTones.warn}`}>Uzgodnienie ze Stripe jest niepełne: część historycznych zamówień nie ma jeszcze zapisanej prowizji (fee) i kwoty netto. Zestawienie WEW nadal liczy sprzedaż i VAT z ledgeru, ale kontrola wypłat wymaga danych Stripe dla wszystkich wpisów.</div>}
        {stripeState.complete && !stripeState.reconciles && <div role="alert" class={`${staffNoticeBase} ${staffNoticeTones.error}`}>Niezgodność ze Stripe: brutto minus prowizja nie zgadza się z kwotą netto. Nie zamykaj miesiąca bez wyjaśnienia różnicy.</div>}

        <section class={staffPanel}>
          <div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class={staffTitle}>Dokument miesięczny</h2><p class="mt-1 text-sm text-virya-muted">{date(preview.period_start)} – {date(preview.period_end)} · {preview.totals.sale_entry_count} płatności · {preview.totals.refund_entry_count} refundów</p></div><button type="button" onClick={() => setProfileOpen(value => !value)} class="text-sm font-bold text-virya-hot hover:text-virya-text">{profileOpen ? "Ukryj dane firmy" : "Dane firmy"}</button></div>
          {preview.finalized_document ? <div class="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-virya-success/25 bg-virya-success/10 p-4"><div><p class="font-black text-virya-success">Zamknięty: {preview.finalized_document.document_number}</p><p class="mt-1 text-xs text-virya-muted">Snapshot z {dateTime(preview.finalized_document.finalized_at)}</p></div><a class={staffAccentButton} href={`/api/staff/accounting/documents/${preview.finalized_document.id}/csv`}>Pobierz CSV do Saldeo</a></div> : <div class="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"><label class={staffField}>Numer dokumentu<input value={documentNumber} onInput={event => setDocumentNumber(event.currentTarget.value)} maxlength={100} class="input mt-2" /></label><button type="button" disabled={busy || loadedMonth !== month || (preview.sales.length === 0 && preview.adjustments.length === 0)} onClick={() => void finalize()} class={`${staffAccentButton} self-end`}>Zamknij miesiąc</button></div>}
        </section>

        {profileOpen && profile && <ProfileForm profile={profile} setProfile={setProfile} onSubmit={saveProfile} busy={busy} />}

        <section class={`overflow-hidden ${staffPanel} p-0`}><div class="border-b border-virya-edge p-5"><h2 class={staffTitle}>Sprzedaż według wydarzenia i biletu</h2></div><div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead class="bg-virya-bg/40 text-xs uppercase tracking-wider text-virya-muted"><tr><th class="px-4 py-3">Wydarzenie</th><th class="px-4 py-3">Bilet</th><th class="px-4 py-3 text-right">Szt.</th><th class="px-4 py-3 text-right">Cena brutto</th><th class="px-4 py-3 text-right">Netto</th><th class="px-4 py-3 text-right">VAT</th><th class="px-4 py-3 text-right">Brutto</th></tr></thead><tbody>{preview.sales.map(line => <tr key={`${line.event_id}:${line.ticket_type_slug}:${line.unit_gross_minor}`} class={`${staffTableRow} text-virya-text`}><td class="px-4 py-3"><strong class="block text-virya-text">{line.event_title}</strong><span class="text-xs text-virya-muted">{date(line.event_starts_at)}</span></td><td class="px-4 py-3">{line.ticket_type_name}</td><td class="px-4 py-3 text-right tabular-nums">{line.quantity}</td><td class="px-4 py-3 text-right tabular-nums">{money(line.unit_gross_minor, line.currency)}</td><td class="px-4 py-3 text-right tabular-nums">{money(line.amount_net_minor, line.currency)}</td><td class="px-4 py-3 text-right tabular-nums">{money(line.amount_vat_minor, line.currency)} <span class="text-xs text-virya-muted">({line.vat_rate_basis_points / 100}%)</span></td><td class="px-4 py-3 text-right font-bold tabular-nums text-virya-text">{money(line.amount_gross_minor, line.currency)}</td></tr>)}</tbody></table>{preview.sales.length === 0 && <p class="p-6 text-sm text-virya-muted">Brak opłaconych biletów w tym miesiącu.</p>}</div></section>

        {preview.adjustments.length > 0 && <section class={staffPanel}><h2 class={staffTitle}>Zwroty i korekty</h2><div class="mt-4 grid gap-3">{preview.adjustments.map(line => <div key={`${line.event_id}:${line.vat_rate_basis_points}`} class="grid gap-2 rounded-lg bg-virya-bg/60 p-4 sm:grid-cols-[1fr_auto_auto]"><div><strong class="text-virya-text">{line.event_title}</strong><p class="text-xs text-virya-muted">{line.entry_count} zdarzeń · VAT {line.vat_rate_basis_points / 100}%</p></div><span class="font-bold text-rose-200">{money(line.amount_gross_minor, line.currency)}</span><span class="text-virya-muted">Stripe {money(line.stripe_net_minor, line.currency)}</span></div>)}</div></section>}

        <section class={staffPanel}><div class="flex flex-wrap items-end justify-between gap-3"><div><h2 class={staffTitle}>Żądania faktury</h2><p class="mt-1 text-sm text-virya-muted">{preview.invoice_request_count} zamówień wymaga osobnego dokumentu dla kupującego i jest wyłączonych ze zbiorczego WEW.</p></div></div>{invoiceListAvailable === false ? <p class={`mt-4 ${staffNoticeBase} ${staffNoticeTones.warn}`}>Nie potwierdzam pustej listy — lista żądań faktur jest chwilowo niedostępna. Pozostałe wyliczenia miesiąca są nadal ważne.
</p> : invoices.length > 0 ? <div class="mt-4 grid gap-3">{invoices.map(item => <article key={item.order_id} class={staffPanelInset}><div class="flex flex-wrap justify-between gap-3"><div><strong class="text-virya-text">{item.company_name || item.full_name || item.buyer_email}</strong><p class="mt-1 text-xs text-virya-muted">{item.event_title} · {item.order_reference} · {dateTime(item.paid_at)}</p></div><div class="text-right"><strong class="text-virya-hot">{money(item.amount_gross_minor, item.currency)}</strong><p class="mt-1 text-xs text-virya-muted">{item.status === "paid" ? "opłacone" : item.status === "partially_refunded" ? `częściowy zwrot ${money(item.amount_refunded_minor, item.currency)}` : `pełny zwrot ${money(item.amount_refunded_minor, item.currency)}`}</p></div></div><p class="mt-3 text-sm text-virya-text">{item.tax_id ? `NIP ${item.tax_id} · ` : ""}{item.address_line1}, {item.postal_code} {item.city} · {item.buyer_email}</p>{item.status !== "paid" ? <p class="mt-2 text-xs font-bold text-rose-200">Wymaga uwzględnienia zwrotu lub korekty przed wystawieniem dokumentu.</p> : null}</article>)}</div> : <p class="mt-4 text-sm text-virya-muted">Brak żądań faktury w tym miesiącu.</p>}</section>
      </>}
    </section>
  )
}

function Metric({ label, value, ok = true }: { label: string; value: string; ok?: boolean }) { return <div class={ok ? staffMetricTile : staffMetricTileError}><p class={staffMetricLabel}>{label}</p><p class={staffMetricValue}>{value}</p></div> }
function ProfileForm({ profile, setProfile, onSubmit, busy }: { profile: Profile; setProfile: (profile: Profile) => void; onSubmit: (event: Event) => void; busy: boolean }) {
  const field = (key: keyof Profile, label: string) => <label class={staffField}>{label}<input value={String(profile[key] ?? "")} onInput={event => setProfile({ ...profile, [key]: event.currentTarget.value })} class="input mt-2" /></label>
  return <form onSubmit={onSubmit} class={`grid gap-4 ${staffPanel} md:grid-cols-2`}><div class="md:col-span-2"><h2 class={staffTitle}>Dane sprzedawcy</h2><p class="mt-1 text-sm text-virya-muted">Domyślnie WB Soft. Zmiana wpływa tylko na przyszłe snapshoty.</p></div>{field("seller_name", "Nazwa")}{field("tax_id", "NIP")}{field("address_line1", "Adres")}{field("postal_code", "Kod pocztowy")}{field("city", "Miasto")}{field("document_prefix", "Prefiks dokumentu")}<button type="submit" disabled={busy} class={`${staffAccentButton} md:col-span-2`}>Zapisz dane</button></form>
}
