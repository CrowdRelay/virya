# Virya website

Astro/Preact website for [virya.music](https://virya.music), including the public band site, Virya Signal, Virya Game, merch and server-rendered Netlify functions.

## Development

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm test` runs TypeScript checks and the source-level Virya Game and Signal audits. Keep those audits green when changing layouts or interaction flows.

Copy `.env.example` to a local environment file and provide only the secrets needed for the feature under test. Variables without the `PUBLIC_` prefix remain server-side.

## Concert QR panel

The staff-only generator lives at `/staff/qr`. It uses a signed HttpOnly session and server-side CrowdRelay proxy, generates dependency-free SVG/PNG QR images, prints an A4 poster and can revoke a campaign immediately.

Configuration and operating instructions: [`docs/STAFF_QR.md`](docs/STAFF_QR.md).

## CrowdRelay integration

The public frontend reads concerts and fan state from CrowdRelay. Bandsintown remains the direct source for the homepage shows section, while CrowdRelay synchronizes provider events asynchronously for Signal, reminders, interests, draws and concert QR check-ins.

See [`docs/VIRYA_SIGNAL_INTEGRATION.md`](docs/VIRYA_SIGNAL_INTEGRATION.md) for the broader integration contract.
