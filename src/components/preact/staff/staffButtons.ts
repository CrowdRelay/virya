// The staff panel grew three different looks for the same two actions.
// global.css already owns the button system, so these are the only classes the
// panel should reach for — one shape, one size, one hover, everywhere.

const BASE = "min-h-[44px] min-w-0 px-4"

export const staffPrimaryButton = `virya-button virya-button--primary ${BASE}`
export const staffSecondaryButton = `virya-button virya-button--secondary ${BASE}`
export const staffGhostButton = `virya-button virya-button--ghost ${BASE}`

/** Sign-out and other exits. Same shape as secondary, warmer edge. */
export const staffLogoutButton = `virya-button virya-button--secondary ${BASE} text-rose-200 hover:text-rose-100`
