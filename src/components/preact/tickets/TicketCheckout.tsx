import { useEffect, useMemo, useState } from "preact/hooks"
import type { Lang } from "../../../i18n/t"
import type { TicketSaleOffer } from "../../../lib/crowdrelay-client"
import { CrowdRelayError } from "../../../lib/crowdrelay-client"
import { crowdrelay } from "../../../lib/crowdrelay"
import { storeTicketOrder } from "../../../lib/ticketWallet"
import { normalizeTicketInventory } from "../../../lib/ticketInventory"
import TicketInventoryBar from "./TicketInventoryBar"

interface Props {
  lang: Lang
  slug: string
  initialSale?: TicketSaleOffer | null
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
    body: "Bez pośredników i bez papierologii. Płatność obsługuje Stripe, a po zakupie dostaniesz mail z biletem i kodem QR na wejście.",
    loading: "Sprawdzam aktualną dostępność biletów…",
    unavailable: "Sprzedaż naszych biletów nie jest jeszcze uruchomiona dla tego koncertu.",
    scheduled: "Sprzedaż rozpocznie się wkrótce.",
    closed: "Sprzedaż online została zakończona.",
    soldOut: "Ta pula biletów jest wyprzedana.",
    remaining: "Dostępne",
    reserved: "W trakcie płatności",
    sold: "Sprzedane",
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
    availabilityChanged: "Ktoś właśnie zarezerwował część tej puli. Zaktualizowałem dostępność — wybierz bilety ponownie.",
    vat: "w tym VAT",
    reserve: "Wybrane miejsca są rezerwowane na czas płatności.",
    secure: "Bezpieczna płatność Stripe",
    allocation: "Pula Virya",
    ticketsSelected: "Wybrane bilety",
    decrease: "Zmniejsz liczbę biletów",
    increase: "Zwiększ liczbę biletów",
  },
  en: {
    eyebrow: "VIRYA // TICKETS",
    heading: "Buy directly from Virya",
    body: "No middleman and no paper ticket. Stripe handles payment, then we e-mail your ticket and door QR code.",
    loading: "Checking current ticket availability…",
    unavailable: "First-party Virya tickets are not enabled for this show yet.",
    scheduled: "Ticket sales will open soon.",
    closed: "Online ticket sales have closed.",
    soldOut: "This ticket allocation is sold out.",
    remaining: "Available",
    reserved: "Payment in progress",
    sold: "Sold",
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
    availabilityChanged: "Someone has just reserved part of this allocation. Availability is refreshed — please select your tickets again.",
    vat: "including VAT",
    reserve: "Selected tickets are held while you complete payment.",
    secure: "Secure Stripe payment",
    allocation: "Virya allocation",
    ticketsSelected: "Tickets selected",
    decrease: "Decrease ticket quantity",
    increase: "Increase ticket quantity",
  },
} as const

const moneyFormatters = new Map<string, Intl.NumberFormat>()

const money = (minor: number, currency: string, lang: Lang) => {
  const locale = lang === "pl" ? "pl-PL" : "en-GB"
  const key = `${locale}:${currency}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter.format(minor / 100)
}

const newCheckoutId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, digit =>
    (
      Number(digit) ^
      (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(digit) / 4)))
    ).toString(16),
  )
}

const initialQuantities = (
  sale: TicketSaleOffer | null | undefined,
): Record<string, number> =>
  Object.fromEntries((sale?.ticket_types ?? []).map(type => [type.slug, 0]))

const clampQuantities = (
  sale: TicketSaleOffer,
  current: Record<string, number>,
): Record<string, number> => {
  const next: Record<string, number> = {}
  let remainingOrderCapacity = sale.max_per_order
  for (const type of sale.ticket_types) {
    const requested = current[type.slug] ?? 0
    const quantity = Math.max(
      0,
      Math.min(requested, type.available, remainingOrderCapacity),
    )
    next[type.slug] = quantity
    remainingOrderCapacity -= quantity
  }
  return next
}

class CheckoutStartError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Ticket checkout returned ${status}`)
    this.name = "CheckoutStartError"
    this.status = status
  }
}

export default function TicketCheckout({ lang, slug, initialSale = null }: Props) {
  const text = copy[lang]
  const [state, setState] = useState<LoadState>(
    initialSale ? { kind: "ready", sale: initialSale } : { kind: "loading" },
  )
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    initialQuantities(initialSale),
  )
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

  useEffect(() => {
    let active = true
    if (!initialSale) setState({ kind: "loading" })

    void crowdrelay
      .getTicketSale(slug)
      .then(sale => {
        if (!active) return
        setState({ kind: "ready", sale })
        setQuantities(current => clampQuantities(sale, current))
      })
      .catch(caught => {
        if (!active) return
        if (caught instanceof CrowdRelayError && caught.status === 404) {
          setState({ kind: "unavailable" })
        } else if (!initialSale) {
          setState({ kind: "error" })
        }
      })

    return () => {
      active = false
    }
  }, [slug, initialSale])

  const selection = useMemo(() => {
    if (state.kind !== "ready") return { count: 0, gross: 0, vat: 0 }
    let count = 0
    let gross = 0
    for (const type of state.sale.ticket_types) {
      const quantity = quantities[type.slug] ?? 0
      count += quantity
      gross += quantity * type.price_gross_minor
    }
    const net = Math.round(
      (gross * 10_000) / (10_000 + state.sale.vat_rate_basis_points),
    )
    return { count, gross, vat: gross - net }
  }, [quantities, state])

  const updateQuantity = (ticketSlug: string, value: number) => {
    if (state.kind !== "ready") return
    const type = state.sale.ticket_types.find(item => item.slug === ticketSlug)
    if (!type) return

    setQuantities((current: Record<string, number>) => {
      const otherCount = Object.entries(current).reduce(
        (sum, [key, quantity]) => sum + (key === ticketSlug ? 0 : quantity),
        0,
      )
      const max = Math.max(
        0,
        Math.min(type.available, state.sale.max_per_order - otherCount),
      )
      const finiteValue = Number.isFinite(value) ? value : 0
      return {
        ...current,
        [ticketSlug]: Math.min(max, Math.max(0, Math.trunc(finiteValue))),
      }
    })
  }

  const submit = async (event: Event) => {
    event.preventDefault()
    if (
      submitting ||
      state.kind !== "ready" ||
      state.sale.sales_state !== "open" ||
      selection.count < 1
    ) {
      return
    }
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
                fullName:
                  invoiceType === "individual" ? invoice.fullName || buyerName : undefined,
                addressLine1: invoice.addressLine1,
                postalCode: invoice.postalCode,
                city: invoice.city,
                countryCode: invoice.countryCode,
              }
            : undefined,
          items: state.sale.ticket_types
            .map(type => ({
              ticketTypeSlug: type.slug,
              quantity: quantities[type.slug] ?? 0,
            }))
            .filter(item => item.quantity > 0),
        }),
      })
      const result = (await response.json()) as CheckoutResponse | { error?: string }
      if (!response.ok || !("url" in result)) {
        throw new CheckoutStartError(response.status)
      }
      storeTicketOrder({
        orderId: result.orderId,
        orderReference: result.orderReference,
        token: result.checkoutToken,
        eventSlug: slug,
        lang,
        savedAt: Date.now(),
      })
      location.assign(result.url)
    } catch (caught) {
      setError(
        caught instanceof CheckoutStartError && caught.status === 409
          ? text.availabilityChanged
          : text.error,
      )
      setSubmitting(false)
      try {
        const sale = await crowdrelay.getTicketSale(slug)
        setState({ kind: "ready", sale })
        setQuantities(current => clampQuantities(sale, current))
      } catch {
        // Keep the current offer visible; the explicit error already tells the user what happened.
      }
    }
  }

  if (state.kind === "loading") {
    return (
      <section class="virya-panel mt-10 p-6" aria-busy="true">
        <p class="text-xs text-zinc-400">{text.loading}</p>
      </section>
    )
  }
  if (state.kind === "unavailable") return null
  if (state.kind === "error") {
    return (
      <section class="virya-panel mt-10 p-6">
        <p class="text-xs text-zinc-400">{text.unavailable}</p>
      </section>
    )
  }

  const { sale } = state
  const disabledMessage =
    sale.sales_state === "upcoming"
      ? text.scheduled
      : sale.sales_state === "sold_out"
        ? text.soldOut
        : sale.sales_state !== "open"
          ? text.closed
          : null
  const inventory = normalizeTicketInventory(sale)

  return (
    <section id="tickets" class="virya-ticket-checkout mt-10 scroll-mt-28">
      <div class="virya-ticket-checkout__header">
        <div class="min-w-0">
          <p class="virya-eyebrow">{text.eyebrow}</p>
          <h2 class="mt-3 text-2xl font-black uppercase tracking-tight text-white sm:text-4xl">
            {text.heading}
          </h2>
          <p class="virya-prose mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">{text.body}</p>
        </div>
        <div class="virya-ticket-allocation">
          <span>{text.allocation}</span>
          <strong>{inventory.available}</strong>
          <small>/ {inventory.capacity}</small>
          <TicketInventoryBar inventory={sale} lang={lang} class="mt-4" />
        </div>
      </div>

      {disabledMessage ? (
        <p class="border-x border-b border-zinc-800 bg-zinc-950 p-6 text-sm font-semibold text-zinc-300">
          {disabledMessage}
        </p>
      ) : (
        <form
          onSubmit={submit}
          class="grid gap-7 border-x border-b border-zinc-800 bg-zinc-950/80 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div class="space-y-7">
            <div class="grid gap-3">
              {sale.ticket_types
                .filter(type => type.active)
                .map(type => {
                  const current = quantities[type.slug] ?? 0
                  const otherCount = selection.count - current
                  const max = Math.max(
                    0,
                    Math.min(type.available, sale.max_per_order - otherCount),
                  )
                  const typeSold = Number.isFinite(type.sold) ? type.sold : 0
                  const typeReserved = Number.isFinite(type.reserved)
                    ? type.reserved
                    : 0
                  const typeInventory = normalizeTicketInventory({
                    capacity:
                      type.capacity ??
                      Math.max(0, typeSold + typeReserved + type.available),
                    sold: typeSold,
                    reserved: typeReserved,
                    available: type.available,
                  })

                  return (
                    <div key={type.id} class="virya-ticket-type">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-baseline justify-between gap-3">
                          <h3 class="text-sm font-black uppercase text-white">{type.name}</h3>
                          <strong class="text-lg text-amber-400">
                            {money(type.price_gross_minor, sale.currency, lang)}
                          </strong>
                        </div>
                        {type.description && (
                          <p class="virya-prose mt-2 text-xs leading-relaxed text-zinc-400">
                            {type.description}
                          </p>
                        )}
                        <dl class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          <div class="flex gap-1">
                            <dt>{text.remaining}:</dt>
                            <dd class="text-zinc-300">{typeInventory.available}</dd>
                          </div>
                          {typeInventory.reserved > 0 && (
                            <div class="flex gap-1 text-amber-300/80">
                              <dt>{text.reserved}:</dt>
                              <dd>{typeInventory.reserved}</dd>
                            </div>
                          )}
                          {typeInventory.sold > 0 && (
                            <div class="flex gap-1">
                              <dt>{text.sold}:</dt>
                              <dd>{typeInventory.sold}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      <div class="virya-ticket-stepper" role="group" aria-label={type.name}>
                        <button
                          type="button"
                          class="virya-ticket-stepper__button"
                          onClick={() => updateQuantity(type.slug, current - 1)}
                          disabled={current <= 0}
                          aria-label={`${text.decrease}: ${type.name}`}
                        >
                          −
                        </button>
                        <input
                          class="virya-ticket-stepper__input"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={max}
                          value={current}
                          onInput={event =>
                            updateQuantity(type.slug, Number(event.currentTarget.value))
                          }
                          aria-label={`${type.name}: ${text.ticketsSelected}`}
                        />
                        <button
                          type="button"
                          class="virya-ticket-stepper__button"
                          onClick={() => updateQuantity(type.slug, current + 1)}
                          disabled={current >= max}
                          aria-label={`${text.increase}: ${type.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <Field
                label={text.name}
                value={buyerName}
                onInput={setBuyerName}
                autocomplete="name"
                maxLength={160}
              />
              <Field
                label={text.email}
                value={buyerEmail}
                onInput={setBuyerEmail}
                autocomplete="email"
                type="email"
                maxLength={320}
              />
            </div>

            <label class="flex min-h-11 items-center gap-3 text-xs font-bold text-zinc-300">
              <input
                type="checkbox"
                checked={invoiceRequested}
                onChange={event => setInvoiceRequested(event.currentTarget.checked)}
                class="h-5 w-5 accent-amber-400"
              />
              {text.invoice}
            </label>

            {invoiceRequested && (
              <fieldset class="grid gap-4 border-l-2 border-amber-400 bg-amber-400/[.025] p-4 sm:grid-cols-2">
                <legend class="px-2 text-[9px] font-black uppercase tracking-widest text-amber-400">
                  {text.buyerType}
                </legend>
                <label class="flex min-h-11 items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="invoice-type"
                    checked={invoiceType === "individual"}
                    onChange={() => setInvoiceType("individual")}
                  />
                  {text.person}
                </label>
                <label class="flex min-h-11 items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="radio"
                    name="invoice-type"
                    checked={invoiceType === "company"}
                    onChange={() => setInvoiceType("company")}
                  />
                  {text.company}
                </label>
                {invoiceType === "company" ? (
                  <>
                    <Field
                      label={text.companyName}
                      value={invoice.companyName}
                      onInput={value => setInvoice(current => ({ ...current, companyName: value }))}
                    />
                    <Field
                      label={text.taxId}
                      value={invoice.taxId}
                      onInput={value => setInvoice(current => ({ ...current, taxId: value }))}
                    />
                  </>
                ) : (
                  <Field
                    label={text.fullName}
                    value={invoice.fullName}
                    onInput={value => setInvoice(current => ({ ...current, fullName: value }))}
                    placeholder={buyerName}
                    required={false}
                  />
                )}
                <Field
                  label={text.address}
                  value={invoice.addressLine1}
                  onInput={value => setInvoice(current => ({ ...current, addressLine1: value }))}
                />
                <Field
                  label={text.postal}
                  value={invoice.postalCode}
                  autocomplete="postal-code"
                  onInput={value => setInvoice(current => ({ ...current, postalCode: value }))}
                />
                <Field
                  label={text.city}
                  value={invoice.city}
                  autocomplete="address-level2"
                  onInput={value => setInvoice(current => ({ ...current, city: value }))}
                />
                <Field
                  label={text.country}
                  value={invoice.countryCode}
                  maxLength={2}
                  onInput={value =>
                    setInvoice(current => ({ ...current, countryCode: value.toUpperCase() }))
                  }
                />
              </fieldset>
            )}
          </div>

          <aside class="virya-ticket-summary">
            <div class="flex items-center justify-between gap-4">
              <p class="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                {text.total}
              </p>
              <span class="text-[9px] font-black uppercase tracking-widest text-amber-400">
                {selection.count} {text.ticketsSelected.toLowerCase()}
              </span>
            </div>
            <p class="mt-3 text-4xl font-black tracking-tight text-white">
              {money(selection.gross, sale.currency, lang)}
            </p>
            <p class="mt-1 text-[10px] text-zinc-500">
              {text.vat}: {money(selection.vat, sale.currency, lang)} (
              {sale.vat_rate_basis_points / 100}%)
            </p>
            <div class="mt-6 border-t border-zinc-800 pt-5">
              <p class="text-xs leading-relaxed text-zinc-400">{text.reserve}</p>
              <p class="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                <span class="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                {text.secure}
              </p>
            </div>
            {error && (
              <p class="mt-4 border-l-2 border-red-400 bg-red-400/[.035] p-3 text-xs font-semibold text-red-200" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || selection.count < 1}
              class="virya-button virya-button--primary mt-6 min-h-[52px] w-full px-5"
            >
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
  type = "text",
  autocomplete,
}: {
  label: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: "text" | "email"
  autocomplete?: string
}) {
  return (
    <label class="grid gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
      {label}
      <input
        required={required}
        type={type}
        autocomplete={autocomplete}
        maxLength={maxLength}
        placeholder={placeholder}
        class="virya-input min-h-12 text-sm normal-case tracking-normal"
        value={value}
        onInput={event => onInput(event.currentTarget.value)}
      />
    </label>
  )
}
