// Where a Signal signup came from, as the landing URL said.
//
// CrowdRelay's weekly join ask posts a link to the band's Facebook and
// Instagram pages ending in `?utm_source=facebook&utm_medium=join_ask&
// utm_campaign=join_ask_w39`, and the signup API accepts those fields under
// `ad_attribution`. The site never sent them: on 2026-09-26 all 14 attribution
// rows had every UTM field empty, so whether the join ask converts a single
// follower was unmeasurable.
//
// Only the first-party campaign tags are carried. Ad-platform click IDs
// (fbclid, gclid) and the `_fbp` cookie are deliberately left out: the signup
// consents to hearing from the band, not to ad-platform matching.

export interface SignupAttribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  event_source_url?: string
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const

const STORAGE_KEY = "virya-signup-attribution"
const MAX_FIELD = 200

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, MAX_FIELD) : undefined
}

/** The campaign tags in one query string, or `undefined` when it has none. */
export function attributionFromSearch(
  search: string,
  pageUrl?: string,
): SignupAttribution | undefined {
  const params = new URLSearchParams(search)
  const found: SignupAttribution = {}
  for (const key of UTM_KEYS) {
    const value = clean(params.get(key))
    if (value) found[key] = value
  }
  if (Object.keys(found).length === 0) return undefined
  // The page without its query: the tags are already carried field by field,
  // and a query string can hold things the signup should not repeat.
  const page = clean(pageUrl ?? null)
  if (page) found.event_source_url = page
  return found
}

/**
 * Remembers the landing attribution for this browser session. The first
 * tagged landing wins: a visitor who arrives from the join ask and then
 * clicks around the site still signs up as a join-ask arrival.
 */
export function rememberLandingAttribution(): void {
  if (typeof window === "undefined") return
  const found = attributionFromSearch(
    window.location.search,
    `${window.location.origin}${window.location.pathname}`,
  )
  if (!found) return
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found))
  } catch {
    // Storage blocked: the submit still reads the current URL.
  }
}

/** The attribution a signup submitted now should carry, if any. */
export function signupAttribution(): SignupAttribution | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as SignupAttribution
      if (parsed && typeof parsed === "object") return parsed
    }
  } catch {
    // Fall through to the current URL.
  }
  return attributionFromSearch(
    window.location.search,
    `${window.location.origin}${window.location.pathname}`,
  )
}
