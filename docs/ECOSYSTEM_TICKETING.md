# Virya ticketing ecosystem

Virya is the presentation and trusted Stripe edge of a wider CrowdRelay-backed system.

## One fan-facing journey

- `/live/[slug]` combines event details, ticket inventory, Bandsintown RSVP/follow and Signal interest;
- Stripe Checkout is created server-side from CrowdRelay-authoritative prices and capacity;
- `/tickets/[orderId]` is a private token-bound ticket wallet;
- paid, draw, referral, AREA and guest-list tickets render the same admission credential;
- `/staff/qr` validates the same pass model and writes a durable redemption audit;
- `/staff/accounting` separates monthly WEW sales from individual invoice requests and Stripe reconciliation.

## UI boundaries

The global layout remains static-first. Preact islands are mounted only for checkout, ticket wallet, Signal, AREA and staff tools. Private ticket routes set `no-store`, `noindex` and a restrictive referrer policy. The service worker does not cache token-bearing wallet or winner routes.

## Failure behavior

CrowdRelay is the primary live-event and ticket source. Public event pages retain bounded Bandsintown and curated fallbacks. Ticket checkout fails closed when authoritative pricing or capacity is unavailable. Email delivery is asynchronous and can be retried without issuing a second pass.

## Server-only values

Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CROWDRELAY_COMMERCE_API_KEY`, `CROWDRELAY_ADMIN_API_KEY`, `STAFF_OPERATOR_KEY` or `VIRYA_TICKET_MAILER_API_KEY` through public Astro variables.
