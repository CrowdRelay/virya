import { useState } from "preact/hooks"
import TicketInventoryBar from "../tickets/TicketInventoryBar"
import BackendLoader from "./BackendLoader"
import { Field, Metric } from "./AdminConsoleUi"
import {
  type ApiError,
  type EventItem,
  type TicketForm,
  type TicketingOverview,
  type TicketingSaveReceipt,
  api,
  blankTicketForm,
  formFromOverview,
  formFromSale,
  formatDate,
  money,
} from "./adminConsoleShared"

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

export function TicketingTab({ events }: { events: EventItem[] }) {
  const [eventSlug, setEventSlug] = useState("")
  const [overview, setOverview] = useState<TicketingOverview | null>(null)
  const [form, setForm] = useState<TicketForm>(blankTicketForm())
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const selectedEvent = events.find(event => event.slug === eventSlug)

  async function load(slug: string) {
    setEventSlug(slug)
    setOverview(null)
    setMessage("")
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
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
      setLoading(false)
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
    <section class="relative grid gap-5" aria-busy={loading}>
      {loading && <BackendLoader overlay label="Pobieram sprzedaż…" />}
      <div class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-black text-white">
              Sprzedaż biletów per koncert
            </h2>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-400 text-pretty">
              Ustaw okno sprzedaży, VAT, limit zamówienia, całkowitą pulę oraz
              typy i ceny biletów. Opłacenie następuje w Stripe, a system
              rozdziela sprzedaż od aktywnych rezerwacji.
            </p>
          </div>
          {eventSlug && (
            <button
              type="button"
              disabled={busy || loading}
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
            disabled={loading || busy}
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

          <section class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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

          <section class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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
                  class="grid gap-4 rounded-lg border border-white/5 bg-black/30 p-4 xl:grid-cols-[1fr_1.2fr_.7fr_.6fr_auto]"
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
    <section class="rounded-xl border border-white/10 bg-zinc-900/70 p-5 sm:p-6">
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
    case "webhook_failed":
      return { label: "Dostawa webhooka nieudana", tone: "rose" }
    case "outbox_failed":
      return { label: "Event outbox zatrzymany", tone: "rose" }
    default:
      return { label: status.replaceAll("_", " "), tone: "zinc" }
  }
}

export function OrderStatusBadge({ status }: { status: string }) {
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
      class={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wider ${tone}`}
    >
      {display.label}
    </span>
  )
}

function RecentOrders({ orders }: { orders: RecentOrder[] }) {
  return (
    <section class="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/70">
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
            class="rounded-lg border border-white/5 bg-black/25 p-4"
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
