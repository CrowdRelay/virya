# Virya ticket checkout backend

This stage adds the trusted server-side half of first-party ticket sales. The visual ticket selector and enriched gig page are intentionally handled in the next frontend stage.

## Routes and modules

- `POST /api/ticket-checkout` validates the browser request, reserves inventory in CrowdRelay and creates Stripe Checkout.
- `src/server/crowdrelayTicketing.ts` is the bounded server-only CrowdRelay client.
- `src/server/ticketStripeWebhook.ts` recognizes ticket Checkout and refund events.
- The existing `/api/stripe-webhook` verifies Stripe's signature before ticket reconciliation and keeps ticket orders out of the merch/InPost fulfillment path.

## Required environment

```dotenv
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
Production site origin is fixed in `src/config.ts` as `https://virya.music`.
PUBLIC_CROWDRELAY_API_URL=https://signal-api.virya.music/v1/
CROWDRELAY_COMMERCE_API_KEY=...
```

`CROWDRELAY_COMMERCE_API_KEY` must be the same plaintext secret configured in CrowdRelay. It is server-only and must never use the `PUBLIC_` prefix.

## Browser contract

The future ticket widget sends:

```json
{
  "eventSlug": "gig-example",
  "buyerEmail": "fan@example.com",
  "buyerName": "Jan Kowalski",
  "invoiceRequested": false,
  "checkoutRequestId": "67c7cdf2-ef0e-4fd1-b565-949992d84b97",
  "lang": "pl",
  "items": [
    { "ticketTypeSlug": "normalny", "quantity": 2 }
  ]
}
```

`checkoutRequestId` must be a UUID v4 generated once per logical checkout attempt and reused only when retrying that same attempt. The browser never sends a price. The response contains the Stripe URL, order ID, order reference, private checkout token and expiry. The next frontend stage stores the private token in session storage for the success/status view; it must not be placed in query parameters or analytics events.

## Failure behavior

- A failed CrowdRelay reservation does not call Stripe.
- An ambiguous Stripe creation failure is safe to retry with the same checkout request because both CrowdRelay and Stripe use stable idempotency keys.
- If Stripe succeeds but the binding fails, the server attempts to expire the Session before releasing capacity.
- Stripe webhook failures return HTTP 500 so Stripe retries until CrowdRelay commits the transition.
- Ticket Checkout events return before the legacy merch workflow and cannot create an InPost shipment.
