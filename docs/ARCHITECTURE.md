# Architecture

Virya is a static-first Astro application with narrowly hydrated Preact islands and server-side Netlify routes.

## Trust boundaries

- The browser receives public content, short-lived fan capabilities and masked ticket data only.
- Astro API routes own Stripe secrets, CrowdRelay admin credentials, staff sessions and transactional mail credentials.
- CrowdRelay owns fan consent, referrals, events, ticket inventory, admission state and durable asynchronous delivery.
- n8n consumes signed events after CrowdRelay has committed business state; automation is not part of the transaction boundary.

## Request path

1. Astro renders static public pages or a server route.
2. Preact islands call same-origin `/api/*` routes with bounded timeouts and abort signals.
3. Server routes validate the staff session or public capability before calling CrowdRelay or Stripe.
4. CrowdRelay returns authoritative state and a request correlation identifier.
5. The middleware attaches `X-Request-ID`, security headers and no-store policy to private or failed responses.

## Failure isolation

- Public pages remain renderable when CrowdRelay analytics are unavailable.
- Staff overview uses independent upstream reads and exposes degraded sources instead of collapsing the whole screen.
- Ticket and winner capability pages are never cached by the service worker.
- Runtime failures are captured before Astro navigation starts and can be copied as a bounded, privacy-safe report.
- Uncaught server failures become correlated `application/problem+json` or diagnostic HTML responses without stack leakage.

## Data minimization

The Signal admin view consumes only aggregate counters and a maximum of ten city aggregates. It does not request e-mail addresses, display names, fan IDs or consent history.
