import type { Lang } from "../../../i18n/t"
import type { TicketInventoryInput } from "../../../lib/ticketInventory"
import { normalizeTicketInventory } from "../../../lib/ticketInventory"

type Props = {
  inventory: TicketInventoryInput
  lang: Lang
  compact?: boolean
  showLegend?: boolean
  // Sold/reserved counts are staff-facing. Public surfaces keep the
  // proportional bar but list only availability — a "Sold: 0" on a fresh
  // show reads as nobody is coming, which is worse than saying nothing.
  showSales?: boolean
  class?: string
}

const labels = {
  pl: {
    sold: "Sprzedane",
    reserved: "W trakcie płatności",
    available: "Dostępne",
    low: "Ostatnie bilety",
  },
  en: {
    sold: "Sold",
    reserved: "Payment in progress",
    available: "Available",
    low: "Last tickets",
  },
} as const

export default function TicketInventoryBar({
  inventory: rawInventory,
  lang,
  compact = false,
  showLegend = true,
  showSales = false,
  class: className = "",
}: Props) {
  const inventory = normalizeTicketInventory(rawInventory)
  const text = labels[lang]
  const lowStock =
    inventory.available > 0 && inventory.availablePercent <= 20
  const ariaLabel = showSales
    ? `${text.sold}: ${inventory.sold}. ${text.reserved}: ${inventory.reserved}. ${text.available}: ${inventory.available}.`
    : `${text.available}: ${inventory.available}.`

  return (
    <div class={className}>
      <div
        class={`virya-ticket-inventory ${compact ? "virya-ticket-inventory--compact" : ""}`}
        role="img"
        aria-label={ariaLabel}
      >
        {inventory.available > 0 && (
          <span
            class="virya-ticket-inventory__available"
            style={{ width: `${inventory.availablePercent}%` }}
            aria-hidden="true"
          />
        )}
        {inventory.reserved > 0 && (
          <span
            class="virya-ticket-inventory__reserved"
            style={{ width: `${inventory.reservedPercent}%` }}
            aria-hidden="true"
          />
        )}
        {inventory.sold > 0 && (
          <span
            class="virya-ticket-inventory__sold"
            style={{ width: `${inventory.soldPercent}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      {showLegend && (
        <dl
          class={`virya-ticket-inventory__legend ${compact ? "virya-ticket-inventory__legend--compact" : ""}`}
        >
          <div>
            <dt>
              <span class="virya-ticket-inventory__key virya-ticket-inventory__key--available" />
              {text.available}
            </dt>
            <dd>{inventory.available}</dd>
          </div>
          {showSales ? (
            <>
              <div>
                <dt>
                  <span class="virya-ticket-inventory__key virya-ticket-inventory__key--reserved" />
                  {text.reserved}
                </dt>
                <dd>{inventory.reserved}</dd>
              </div>
              <div>
                <dt>
                  <span class="virya-ticket-inventory__key virya-ticket-inventory__key--sold" />
                  {text.sold}
                </dt>
                <dd>{inventory.sold}</dd>
              </div>
            </>
          ) : (
            lowStock && (
              <div>
                <dt>
                  <span class="virya-ticket-inventory__key virya-ticket-inventory__key--urgent" />
                  {text.low}
                </dt>
              </div>
            )
          )}
        </dl>
      )}
    </div>
  )
}
