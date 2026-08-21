// The staff panel grew three different looks for the same two actions.
// global.css already owns the button system, so these are the only classes the
// panel should reach for — one shape, one size, one hover, everywhere.

const BASE = "min-h-[44px] min-w-0 px-4"

export const staffSecondaryButton = `virya-button virya-button--secondary ${BASE}`

/** Confirming action. Amber is the Staff panel's own accent; the site's mint
 *  primary belongs to the public pages. Geometry is the shared one. */
export const staffAccentButton = `virya-button ${BASE} bg-amber-300 text-zinc-950 hover:bg-amber-200`

/** Row-level accent action. Same look, small enough to sit inside a list row
 *  while still clearing the 44px touch target. */
export const staffAccentChip = `virya-button min-h-[44px] min-w-0 px-3 text-[10px] bg-amber-300 text-zinc-950 hover:bg-amber-200`

/** Sign-out and other exits. Same shape as secondary, warmer edge. */
export const staffLogoutButton = `virya-button virya-button--secondary ${BASE} text-rose-200 hover:text-rose-100`
