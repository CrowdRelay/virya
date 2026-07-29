# Virya Signal + AREA + CrowdRelay

## Runtime boundaries

- **AREA** remains the source of truth for geolocation challenges, claims, Credits and free-item vouchers.
- **CrowdRelay** is the source of truth for fan consent, city demand, referrals, live-event interest, reminders, admission passes and signed automation events.
- The Virya website is the presentation layer. It never receives privileged CrowdRelay keys.

AREA does not wait for CrowdRelay. After a successful AREA claim the browser stores only the coarse CrowdRelay city slug and reveals a link to Virya Signal. Failure of storage or the CrowdRelay API cannot invalidate a claim, block the wallet or prevent voucher issuance.

## Performance model

- No CrowdRelay code is imported by the global `Layout.astro`.
- Homepage and EPK ecosystem sections are static Astro HTML.
- The main Signal hub uses `client:visible` and hydrates only near the viewport.
- Private profile and token pages hydrate only on their dedicated routes.
- API requests use a bounded 2.5-second timeout.
- View/share telemetry is best-effort and never blocks navigation.
- Public city/event responses are cached in session storage for five minutes.

## Public routes

| Route | Purpose |
| --- | --- |
| `/signal/`, `/pl/signal/` | Signal hub: join, cities and shows |
| `/join`, `/pl/join` | Backward-compatible redirects from CrowdRelay bootstrap |
| `/my-signal/`, `/pl/my-signal/` | Private referral, reward and event state |
| `/signal/confirm`, `/pl/signal/confirm` | Fragment-token confirmation |
| `/signal/unsubscribe`, `/pl/signal/unsubscribe` | Fragment-token unsubscribe |
| `/live/:slug`, `/pl/live/:slug` | CrowdRelay event page |
| `/go/:slug`, `/r/:code` | Branded acquisition/referral redirects to CrowdRelay |

## Netlify configuration

Set the public variable:

```text
PUBLIC_CROWDRELAY_API_URL=https://signal-api.virya.music/v1/
```

This value is intentionally public. Never expose admin, staff, commerce, database, QR or webhook secrets through `PUBLIC_*` variables.

The CSP in `public/_headers` allows only the public Signal API. `public/_redirects` forwards branded acquisition and referral routes to the API so it can establish attribution cookies before redirecting back to Virya.

## CrowdRelay bootstrap alignment

Before promoting every AREA city inside Signal, add these city records to the production CrowdRelay bootstrap if they are not already present:

```json
[
  { "slug": "lodz", "name": "Łódź", "country": "PL", "region": "Łódzkie", "lat": 51.7592, "lng": 19.4560 },
  { "slug": "szczecin", "name": "Szczecin", "country": "PL", "region": "Zachodniopomorskie", "lat": 53.4285, "lng": 14.5528 },
  { "slug": "lublin", "name": "Lublin", "country": "PL", "region": "Lubelskie", "lat": 51.2465, "lng": 22.5684 },
  { "slug": "rzeszow", "name": "Rzeszów", "country": "PL", "region": "Podkarpackie", "lat": 50.0412, "lng": 21.9991 },
  { "slug": "bialystok", "name": "Białystok", "country": "PL", "region": "Podlaskie", "lat": 53.1325, "lng": 23.1688 },
  { "slug": "torun", "name": "Toruń", "country": "PL", "region": "Kujawsko-Pomorskie", "lat": 53.0138, "lng": 18.5984 }
]
```

Until then, AREA remains fully functional. Signal clears a remembered city that the API does not recognize and asks the fan to choose one of the available cities.

## Verification

```bash
npm ci
npm test
npm run build
```

Then deploy a Netlify preview and verify:

1. Existing homepage, EPK, merch and AREA flows still work.
2. `/signal/` loads static content before its Preact island hydrates.
3. Signup returns a pending double-opt-in response.
4. The confirmation fragment disappears from the address bar immediately.
5. `/my-signal/` works after confirmation and fails cleanly without a session.
6. `/live/sanity-check-namyslow-2026/` loads and event interest is idempotent.
7. A successful AREA claim reveals the Signal bridge and preselects the mapped city.
8. Lighthouse is run against production-like Netlify preview pages, not Astro dev mode.
