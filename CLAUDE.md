# Virya — local memory

## Role
Production virya.music website + commerce/tickets/AREA/Signal web/staff surfaces.
Astro static-first + selective Preact.

## Must preserve
- no global hydration without reason
- secrets server-side
- public/static pages resilient to CrowdRelay failure
- bounded API timeouts/fallbacks
- ticket capabilities and staff state never casually cached/exposed
- preserve SEO/a11y/perf budgets

## UI
User likes polished, restrained UI. Prefer geometry/spacing/interaction quality over decoration.
For sticky/fixed nav inspect real header height + stacking context + containing block + scroll state. Prefer one shared offset source.
Test desktop + mobile actual scroll states.

## Gates
`npm test`
`npm run build`
`npm run quality`
