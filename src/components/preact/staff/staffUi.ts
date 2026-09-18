// Staff console vocabulary — one chrome for the whole panel, styled after the
// control-plane component language but expressed on virya tokens. Panels reach
// for these names instead of per-file zinc/radius picks; extend here, not
// inline. Buttons stay in staffButtons.ts and are re-exported for one import
// path.

export {
  staffSecondaryButton,
  staffAccentButton,
  staffAccentChip,
  staffLogoutButton,
} from "./staffButtons"

// ── Surfaces ────────────────────────────────────────────────────────────────

/** Primary card chrome — the unit every section/manager renders inside. */
export const staffPanel =
  "rounded-lg border border-virya-edge bg-virya-surface/80 p-5"

/** Panel chrome with no padding — rows inside carry their own. Do NOT try to
 *  get this by appending `p-0` to staffPanel: Tailwind emits p-0 before p-5 in
 *  the stylesheet, so same-specificity cascade always lets p-5 win. */
export const staffPanelFlush =
  "rounded-lg border border-virya-edge bg-virya-surface/80"

/** Nested surface inside a panel (rows, sub-groups, code blocks). */
export const staffPanelInset =
  "rounded-lg border border-virya-edge bg-virya-bg/60 p-4"

// ── Typography ──────────────────────────────────────────────────────────────

/** Section label above a title — replaces the four ad-hoc eyebrow variants. */
export const staffEyebrow =
  "text-[10px] font-black uppercase tracking-[0.16em] text-virya-muted"

export const staffEyebrowAccent =
  "text-[10px] font-black uppercase tracking-[0.16em] text-virya-hot"

export const staffTitle = "text-xl font-black text-virya-text"

export const staffSubtitle = "text-sm leading-6 text-virya-muted"

/** Form label wrapping an input/select. */
export const staffField = "text-sm font-semibold text-virya-text"

// ── Badges / status pills ───────────────────────────────────────────────────

const BADGE =
  "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 " +
  "text-[10px] font-bold uppercase tracking-wider transition-colors"

export const staffBadge = `${BADGE} border-virya-edge text-virya-muted`
export const staffBadgeSignal = `${BADGE} border-virya-signal/40 text-virya-hot`
export const staffBadgeSuccess = `${BADGE} border-virya-success/35 text-virya-success`
export const staffBadgeWarn = `${BADGE} border-virya-warning/35 text-yellow-100`
export const staffBadgeDanger = `${BADGE} border-virya-danger/35 text-rose-200`

// ── Metric tiles ────────────────────────────────────────────────────────────

const METRIC_TILE = "rounded-lg border p-4"

export const staffMetricTile = `${METRIC_TILE} border-virya-edge bg-virya-surface/80`
export const staffMetricTileError = `${METRIC_TILE} border-virya-danger/35 bg-virya-danger/10`
export const staffMetricLabel =
  "text-xs font-bold uppercase tracking-wider text-virya-muted"
export const staffMetricValue = "mt-2 text-xl font-black tabular-nums text-virya-text"
export const staffMetricValueLg = "mt-2 text-3xl font-black tabular-nums text-virya-text"
export const staffMetricHint = "mt-1 text-xs text-virya-muted"

// ── Feedback ────────────────────────────────────────────────────────────────

export const staffNoticeBase =
  "rounded-lg border px-4 py-3 text-sm leading-relaxed"

export const staffNoticeTones = {
  success: "border-virya-success/30 bg-virya-success/10 text-emerald-100",
  error: "border-virya-danger/30 bg-virya-danger/10 text-rose-100",
  warn: "border-virya-warning/30 bg-virya-warning/10 text-yellow-100",
  info: "border-virya-edge bg-white/5 text-zinc-300",
} as const

/** Empty list/table state — dashed, muted, centered. */
export const staffEmpty =
  "rounded-lg border border-dashed border-virya-edge px-5 py-8 text-center text-sm text-virya-muted"

// ── Loading skeletons ───────────────────────────────────────────────────────

export const staffSkeleton = "animate-pulse rounded bg-white/10"
export const staffSkeletonBlock = "animate-pulse rounded-lg bg-white/[0.06]"

// ── Tables & list rows ──────────────────────────────────────────────────────

export const staffTable = "w-full text-sm"
export const staffTableHead =
  "text-left text-[10px] font-black uppercase tracking-[0.14em] text-virya-muted"
export const staffTableRow = "border-t border-virya-edge/60"
export const staffTableCell = "py-3 pr-4 align-top text-virya-text"

/** Row-level surface for dense lists (queue items, fans, orders). */
export const staffRow =
  "rounded-lg border border-virya-edge bg-virya-bg/60 p-4 transition-colors hover:border-virya-signal/40"

/** Armed state of a two-click confirm — warn tone at accent-button geometry.
 *  Composing staffAccentChip + warn overrides would put two bg/text colors in
 *  one class string, and CSS order, not markup order, decides the winner. */
export const staffConfirmChip =
  "virya-button min-h-[44px] min-w-0 px-3 text-[10px] border border-virya-warning/40 bg-virya-warning/20 text-yellow-100"

export const staffConfirmButton =
  "virya-button min-h-[44px] min-w-0 px-4 border border-virya-warning/40 bg-virya-warning/20 text-yellow-100"

// ── Console tab strip ───────────────────────────────────────────────────────

export const staffTabBar =
  "flex gap-1 overflow-x-auto rounded-lg border border-virya-edge bg-virya-bg/70 p-1 " +
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const TAB =
  "min-h-11 shrink-0 rounded-md px-4 py-2 text-left transition-colors"

export const staffTab = `${TAB} text-virya-muted hover:bg-white/[.04] hover:text-virya-text`
export const staffTabActive = `${TAB} bg-virya-high text-virya-text`
export const staffTabLabel = "block text-sm font-bold"
export const staffTabHint = "mt-0.5 block text-[11px] text-virya-muted"
