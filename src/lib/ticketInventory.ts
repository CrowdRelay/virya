import type { TicketAvailability } from "./crowdrelay-client"

export type TicketInventoryInput = {
  /**
   * The pool's total size. Present only on staff reads — the public sale
   * contract never ships it, so public callers normalize through the
   * `availability` band instead.
   */
  capacity?: number
  available: number
  sold?: number
  reserved?: number
  /** The server-named scarcity band — the public contract's only
   *  proportion. Absent on legacy staff reads, where the counters carry
   *  the proportion themselves. */
  availability?: TicketAvailability
}

export type TicketInventory = {
  capacity: number
  sold: number
  reserved: number
  available: number
  soldPercent: number
  reservedPercent: number
  availablePercent: number
}

const integerAtLeastZero = (value: unknown): number => {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.trunc(number))
}

const percent = (value: number, capacity: number): number =>
  capacity > 0 ? (value / capacity) * 100 : 0

/** The width the public bar draws per band — thin for `low` so the
 *  "last tickets" state still reads, full for `plenty`. The exact
 *  proportion stays server-side; the band IS the information. */
const BAND_PERCENT: Record<TicketAvailability, number> = {
  sold_out: 0,
  low: 20,
  plenty: 100,
}

const empty = (): TicketInventory => ({
  capacity: 0,
  sold: 0,
  reserved: 0,
  available: 0,
  soldPercent: 0,
  reservedPercent: 0,
  availablePercent: 0,
})

/**
 * Normalizes inventory for the bar and its consumers.
 *
 * Two wire shapes feed this:
 * - Staff reads (the admin console's `TicketingOverview.sale`) carry `capacity` plus the
 *   `sold`/`reserved` counters — the proportional segments are real.
 * - Public reads (`TicketSaleOffer`/`TicketSaleSummary`) carry `available`
 *   plus the server-named `availability` band — the operating counts never
 *   leave the venue, so the bar draws the band, not a derived fraction.
 */
export const normalizeTicketInventory = (
  input: TicketInventoryInput,
): TicketInventory => {
  const available = integerAtLeastZero(input.available)

  // Public shape: no capacity — the band is the proportion.
  if (input.capacity === undefined || input.capacity === null) {
    if (available === 0) return empty()
    const band = input.availability ?? "plenty"
    const width = BAND_PERCENT[band]
    return {
      capacity: available,
      sold: 0,
      reserved: 0,
      available,
      soldPercent: 0,
      reservedPercent: 0,
      availablePercent: width,
    }
  }

  const capacity = integerAtLeastZero(input.capacity)
  if (capacity === 0) {
    return empty()
  }

  const boundedAvailable = Math.min(capacity, available)
  const reserved = Math.min(
    capacity - boundedAvailable,
    integerAtLeastZero(input.reserved),
  )
  const remaining = capacity - boundedAvailable - reserved
  const sold =
    input.sold === undefined
      ? remaining
      : Math.min(remaining, integerAtLeastZero(input.sold))
  const unaccounted = capacity - boundedAvailable - reserved - sold
  const normalizedAvailable = boundedAvailable + unaccounted

  return {
    capacity,
    sold,
    reserved,
    available: normalizedAvailable,
    soldPercent: percent(sold, capacity),
    reservedPercent: percent(reserved, capacity),
    availablePercent: percent(normalizedAvailable, capacity),
  }
}
