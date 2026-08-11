const LIVE_EVENT_SLUG_ALIASES: Readonly<Record<string, string>> = Object.freeze(
  {
    "gig-108543480": "zakrec-smiglem-2026",
    "gig-108530287": "sanity-check-namyslow-2026",
    "gig-108530289": "sanity-check-gorzow-2026",
    "gig-108530293": "seidr-hradec-kralove-2026",
  },
)

export const canonicalLiveEventSlug = (slug: string): string =>
  LIVE_EVENT_SLUG_ALIASES[slug] ?? slug
