export type TicketInventoryInput = {
  capacity: number
  available: number
  sold?: number
  reserved?: number
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

/**
 * Normalizes inventory received during staggered CrowdRelay/Virya deployments.
 * New CrowdRelay responses provide all counters and satisfy the invariant
 * sold + reserved + available = capacity. Legacy responses only exposed
 * capacity and available, so the missing committed count is treated as sold.
 */
export const normalizeTicketInventory = (
  input: TicketInventoryInput,
): TicketInventory => {
  const capacity = integerAtLeastZero(input.capacity)
  if (capacity === 0) {
    return {
      capacity: 0,
      sold: 0,
      reserved: 0,
      available: 0,
      soldPercent: 0,
      reservedPercent: 0,
      availablePercent: 0,
    }
  }

  const available = Math.min(capacity, integerAtLeastZero(input.available))
  const reserved = Math.min(
    capacity - available,
    integerAtLeastZero(input.reserved),
  )
  const remaining = capacity - available - reserved
  const sold =
    input.sold === undefined
      ? remaining
      : Math.min(remaining, integerAtLeastZero(input.sold))
  const unaccounted = capacity - available - reserved - sold
  const normalizedAvailable = available + unaccounted

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
