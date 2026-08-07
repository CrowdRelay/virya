# Architecture

`virya.music` is the static-first public/trusted-edge frontend of the VIRYA ecosystem.

## Boundaries

- Astro renders public/static pages; Preact hydrates only interactive surfaces.
- same-origin `/api/*` routes own Stripe, mail and privileged CrowdRelay credentials;
- CrowdRelay owns fan consent, event/ticket/inventory/draw state and durable outbox delivery;
- Virya Signal is a native client of first-party HTTP/deep-link contracts;
- Synesthesia is an independent Godot album experience using additive CrowdRelay run/draw endpoints;
- n8n consumes signed events after business state commits and is never a transaction dependency.

The browser never receives Stripe secrets, staff/admin/service keys or shipping-provider credentials.

## Reliability

Public content fails open around analytics/provider enrichment. Ticket checkout, inventory mutation, staff actions and admission validation fail closed when authoritative state is unavailable. Private/token routes are no-store/noindex. Requests are time-bounded and cancellable; staff dashboards may degrade per source rather than collapse globally.

## Data minimization

Signal/AREA/Synesthesia are separate purpose boundaries. AREA exposes only coarse public city references. Synesthesia draw entry does not grant marketing consent or collect shipping PII. Staff aggregate views avoid fan PII unless the operation explicitly requires it.

## Product links

The public ecosystem rail exposes `virya.music`, Signal/AREA and `synesthesia.virya.music`. Links are navigation boundaries, not shared runtime dependencies, so a failure in one experience cannot take down the others.
