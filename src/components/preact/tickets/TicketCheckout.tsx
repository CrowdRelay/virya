import { useEffect, useMemo, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { TicketSaleOffer } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"
import { storeTicketOrder } from "../../../lib/ticketWallet"

interface Props {
  lang: Lang
  slug: string
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; sale: TicketSaleOffer }
  | { kind: "unavailable" }
  | { kind: "error" }

type InvoiceType = "individual" | "company"

type CheckoutResponse = {
  url: string
  orderId: string
  orderReference: string
  checkoutToken: string
  expiresAt: string
}

const copy = {
  pl: {
    eyebrow: "VIRYA // BILETY",
    heading: "Kup bilet bezpośrednio od nas",
    body: "Płatność obsługuje Stripe. Po zakupie dostaniesz mail z biletem i kodem QR, który pokażesz na wejściu.",
    loading: "Sprawdzam dostępność biletów…",
    unavailable: "Sprzedaż naszych biletów nie jest jeszcze uruchomiona dla tego koncertu.",
    scheduled: "Sprzedaż rozpocznie się wkrótce.",
    closed: "Sprzedaż online została zakończona.",
    soldOut: "Ta pula biletów jest wyprzedana.",
    remaining: "Dostępne",
    name: "Imię i nazwisko",
    email: "E-mail do biletu",
    invoice: "Potrzebuję faktury",
    buyerType: "Nabywca",
    person: "Osoba prywatna",
    company: "Firma",
    companyName: "Nazwa firmy",
    taxId: "NIP",
    fullName: "Imię i nazwisko nabywcy",
    address: "Ulica i numer",
    postal: "Kod pocztowy",
    city: "Miasto",
    country: "Kod kraju",
    total: "Razem brutto",
    checkout: "Przejdź do bezpiecznej płatności",
    working: "Rezerwuję miejsca…",
    error: "Nie udało się rozpocząć płatności. Odśwież dostępność i spróbuj ponownie.",
    vat: "w tym VAT",
    reserve: "Miejsca są rezerwowane na czas płatności.",
  },
  en: {
    eyebrow: "VIRYA // TICKETS",
    heading: "Buy directly from Virya",
    body: "Payment is handled by Stripe. After purchase you will receive an e-mail ticket and a QR code for the door.",
    loading: "Checking ticket availability…",
    unavailable: "First-party Virya tickets are not enabled for this show yet.",
    scheduled: "Ticket sales will open soon.",
    closed: "Online ticket sales have closed.",
    soldOut: "This ticket allocation is sold out.",
    remaining: "Available",
    name: "Full name",
    email: "Ticket e-mail",
    invoice: "I need an invoice",
    buyerType: "Buyer",
    person: "Individual",
    company: "Company",
    companyName: "Company name",
    taxId: "Tax ID",
    fullName: "Buyer name",
    address: "Street and number",
    postal: "Postal code",
    city: "City",
    country: "Country code",
    total: "Gross total",
    checkout: "Continue to secure payment",
    working: "Reserving tickets…",
    error: "Payment could not be started. Refresh availability and try again.",
    vat: "including VAT",
    reserve: "Tickets are held while you complete payment.",
  },
} as const

const money = (minor: number, currency: string, lang: Lang) =>
  new Intl.NumberFormat(lang === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100)

const newCheckoutId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, digit =>
    (Number(digit) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(digit) / 4)))).toString(16),
  )
}

export default function TicketCheckout({ lang, slug }: Props) {
  const text = copy[lang]
  const [state, setState] = useState<LoadState>({ kind: "loading" })
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("individual")
  const [invoice, setInvoice] = useState({
    companyName: "",
    taxId: "",
    fullName: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    countryCode: "PL",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSale = () => {
    setState({ kind: "loading" })
    void crowdrelay
      .getTicketSale(slug)
      .then(sale => {
        setState({ kind: "ready", sale })
        setQuantities(current => {
          const next: Record<string, number> = {}
          for (const type of sale.ticket_types) next[type.slug] = current[type.slug] ?? 0
          return next
        })
      })
      .catch(caught => {
        if (caught instanceof CrowdRelayError && caught.status === 404) {
          setState({ kind: "unavailable" })
        } else {
          setState({ kind: "error" })
        }
      })
  }

  useEffect(loadSale, [slug])

  const selection = useMemo(() => {
    if (state.kind !== "ready") return { count: 0, gross: 0, vat: 0 }
    let count = 0
    let gross = 0
    for (const type of state.sale.ticket_types) {
      const quantity = quantities[type.slug] ?? 0
      count += quantity
      gross += quantity * type.price_gross_minor
    }
    const net = Math.round((gross * 10_000) / (10_000 + state.sale.vat_rate_basis_points))
    return { count, gross, vat: gross - net }
  }, [quantities, state])

  const updateQuantity = (ticketSlug: string, value: number) => {
    if (state.kind !== "ready") return
    const type = state.sale.ticket_types.find(item => item.slug === ticketSlug)
    if (!type) return
    const otherCount = Object.entries(quantities).reduce(
      (sum, [key, quantity]) => sum + (key === ticketSlug ? 0 : quantity),
      0,
    )
    const max = Math.max(0, Math.min(type.available, state.sale.max_per_order - otherCount))
    setQuantities(current => ({
      ...current,
      [ticketSlug]: Math.min(max, Math.max(0, Math.trunc(value))),
    }))
  }

  const submit = async (event: Event) => {
    event.preventDefault()
    if (state.kind !== "ready" || state.sale.sales_state !== "open" || selection.count < 1) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/ticket-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: slug,
          buyerEmail,
          buyerName,
          lang,
          checkoutRequestId: newCheckoutId(),
          invoiceRequested,
          invoiceDetails: invoiceRequested
            ? {
                buyerType: invoiceType,
                companyName: invoiceType === "company" ? invoice.companyName : undefined,
                taxId: invoiceType === "company" ? invoice.taxId : undefined,
                fullName: invoiceType === "individual" ? invoice.fullName || buyerName : undefined,
                addressLine1: invoice.addressLine1,
                postalCode: invoice.postalCode,
                city: invoice.city,
                countryCode: invoice.countryCode,
              }
            : undefined,
          items: state.sale.ticket_types
            .map(type => ({ ticketTypeSlug: type.slug, quantity: quantities[type.slug] ?? 0 }))
            .filter(item => item.quantity > 0),
        }),
      })
      const result = (await response.json()) as CheckoutResponse | { error?: string }
      if (!response.ok || !("url" in result)) throw new Error("checkout failed")
      storeTicketOrder({
        orderId: result.orderId,
        orderReference: result.orderReference,
        token: result.checkoutToken,
        eventSlug: slug,
        lang,
        savedAt: Date.now(),
      })
      location.assign(result.url)
    } catch {
      setError(text.error)
      setSubmitting(false)
      loadSale()
    }
  }

  if (state.kind === "loading") {
    return <section class="virya-panel mt-10 p-6" aria-busy="true"><p class="text-xs text-zinc-400">{text.loading}</p></section>
  }
  if (state.kind === "unavailable") return null
  if (state.kind === "error") {
    return <section class="virya-panel mt-10 p-6"><p class="text-xs text-zinc-400">{text.unavailable}</p></section>
  }

  const { sale } = state
  const disabledMessage = sale.sales_state === "upcoming"
    ? text.scheduled
    : sale.sales_state === "sold_out"
      ? text.soldOut
      : sale.sales_state !== "open"
        ? text.closed
        : null

  return (
    <section id="tickets" class="virya-panel mt-10 overflow-hidden border-amber-400/30">
      <div class="border-b border-zinc-800 bg-amber-400/[.035] p-5 sm:p-7">
        <p class="text-[9px] font-black uppercase tracking-[.3em] text-amber-400">{text.eyebrow}</p>
        <h2 class="mt-3 text-2xl font-black uppercase text-white sm:text-3xl">{text.heading}</h2>
        <p class="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">{text.body}</p>
      </div>
      {disabledMessage ? (
        <p class="p-6 text-sm font-semibold text-zinc-300">{disabledMessage}</p>
      ) : (
        <form onSubmit={submit} class="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="space-y-6">
            <div class="grid gap-3">
              {sale.ticket_types.filter(type => type.active).map(type => {
                const max = Math.min(type.available, sale.max_per_order)
                return (
                  <div key={type.id} class="grid gap-4 border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div class="flex flex-wrap items-baseline gap-3">
                        <h3 class="text-sm font-black uppercase text-white">{type.name}</h3>
                        <strong class="text-sm text-amber-400">{money(type.price_gross_minor, sale.currency, lang)}</strong>
                      </div>
                      {type.description && <p class="mt-2 text-xs leading-relaxed text-zinc-400">{type.description}</p>}
                      <p class="mt-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">{text.remaining}: {type.available}</p>
                    </div>
                    <label class="flex items-center gap-3">
                      <span class="sr-only">{type.name}</span>
                      <button type="button" class="virya-button virya-button--ghost h-11 w-11 p-0" onClick={() => updateQuantity(type.slug, (quantities[type.slug] ?? 0) - 1)} aria-label="minus">−</button>
                      <input class="h-11 w-16 border border-zinc-700 bg-zinc-900 text-center font-black text-white" type="number" min="0" max={max} value={quantities[type.slug] ?? 0} onInput={event => updateQuantity(type.slug, Number(event.currentTarget.value))} />
                      <button type="button" class="virya-button virya-button--ghost h-11 w-11 p-0" onClick={() => updateQuantity(type.slug, (quantities[type.slug] ?? 0) + 1)} aria-label="plus">+</button>
                    </label>
                  </div>
                )
              })}
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="grid gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {text.name}
                <input required maxLength={160} autocomplete="name" class="min-h-[48px] border border-zinc-700 bg-zinc-900 px-4 text-sm normal-case tracking-normal text-white" value={buyerName} onInput={event => setBuyerName(event.currentTarget.value)} />
              </label>
              <label class="grid gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                {text.email}
                <input required type="email" maxLength={320} autocomplete="email" class="min-h-[48px] border border-zinc-700 bg-zinc-900 px-4 text-sm normal-case tracking-normal text-white" value={buyerEmail} onInput={event => setBuyerEmail(event.currentTarget.value)} />
              </label>
            </div>

            <label class="flex min-h-[44px] items-center gap-3 text-xs font-bold text-zinc-300">
              <input type="checkbox" checked={invoiceRequested} onChange={event => setInvoiceRequested(event.currentTarget.checked)} class="h-5 w-5 accent-amber-400" />
              {text.invoice}
            </label>

            {invoiceRequested && (
              <fieldset class="grid gap-4 border-l-2 border-amber-400 bg-amber-400/[.025] p-4 sm:grid-cols-2">
                <legend class="px-2 text-[9px] font-black uppercase tracking-widest text-amber-400">{text.buyerType}</legend>
                <label class="flex items-center gap-2 text-xs text-zinc-300"><input type="radio" name="invoice-type" checked={invoiceType === "individual"} onChange={() => setInvoiceType("individual")} /> {text.person}</label>
                <label class="flex items-center gap-2 text-xs text-zinc-300"><input type="radio" name="invoice-type" checked={invoiceType === "company"} onChange={() => setInvoiceType("company")} /> {text.company}</label>
                {invoiceType === "company" ? (
                  <>
                    <Field label={text.companyName} value={invoice.companyName} onInput={value => setInvoice(current => ({ ...current, companyName: value }))} />
                    <Field label={text.taxId} value={invoice.taxId} onInput={value => setInvoice(current => ({ ...current, taxId: value }))} />
                  </>
                ) : (
                  <Field label={text.fullName} value={invoice.fullName} onInput={value => setInvoice(current => ({ ...current, fullName: value }))} placeholder={buyerName} required={false} />
                )}
                <Field label={text.address} value={invoice.addressLine1} onInput={value => setInvoice(current => ({ ...current, addressLine1: value }))} />
                <Field label={text.postal} value={invoice.postalCode} onInput={value => setInvoice(current => ({ ...current, postalCode: value }))} />
                <Field label={text.city} value={invoice.city} onInput={value => setInvoice(current => ({ ...current, city: value }))} />
                <Field label={text.country} value={invoice.countryCode} maxLength={2} onInput={value => setInvoice(current => ({ ...current, countryCode: value.toUpperCase() }))} />
              </fieldset>
            )}
          </div>

          <aside class="h-fit border border-zinc-800 bg-zinc-900/60 p-5 lg:sticky lg:top-28">
            <p class="text-[9px] font-black uppercase tracking-widest text-zinc-500">{text.total}</p>
            <p class="mt-2 text-3xl font-black text-white">{money(selection.gross, sale.currency, lang)}</p>
            <p class="mt-1 text-[10px] text-zinc-500">{text.vat}: {money(selection.vat, sale.currency, lang)} ({sale.vat_rate_basis_points / 100}%)</p>
            <p class="mt-5 text-xs leading-relaxed text-zinc-400">{text.reserve}</p>
            {error && <p class="mt-4 text-xs font-semibold text-red-300" role="alert">{error}</p>}
            <button type="submit" disabled={submitting || selection.count < 1} class="virya-button virya-button--primary mt-5 min-h-[52px] w-full px-5">
              {submitting ? text.working : text.checkout}
            </button>
          </aside>
        </form>
      )}
    </section>
  )
}

function Field({
  label,
  value,
  onInput,
  placeholder,
  maxLength = 240,
  required = true,
}: {
  label: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
}) {
  return (
    <label class="grid gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
      {label}
      <input required={required} maxLength={maxLength} placeholder={placeholder} class="min-h-[46px] border border-zinc-700 bg-zinc-900 px-3 text-sm normal-case tracking-normal text-white" value={value} onInput={event => onInput(event.currentTarget.value)} />
    </label>
  )
}
