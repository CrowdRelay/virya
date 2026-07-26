# VIRYA Area — pilot operations

VIRYA Area is a location-based loyalty game attached to `virya.music`. A player
tracks a public city signal, finds a physical VIRYA box, opens its QR/NFC link
and explicitly confirms one location reading. A valid claim unlocks one lyric
collectible and awards 1 VIRYA Credit. One Credit can be exchanged for a
single-use 50 PLN Stripe promotion code.

The pilot deliberately keeps rewards off-chain. Credits are free,
non-transferable loyalty benefits with no cash value. This keeps checkout,
fraud limits and privacy controllable while the game loop is validated. An
optional on-chain edition can later represent collectible artwork only; merch
Credits and precise location data should stay off-chain.

## Player flow

1. `/area/` or `/pl/area/` shows six public city signals and their clues.
2. The nearest-city button compares the player's location locally in the
   browser. Nothing is sent during this search.
3. A physical tag opens a URL such as:

   ```text
   https://www.virya.music/pl/area/#claim=wro-001.DROP_SECRET
   ```

   The secret lives in the URL fragment, so it is not sent in the initial HTTP
   request or normal referrer headers. The page reads it and immediately
   removes the fragment from browser history.

4. Only after the player presses the claim button does the browser request a
   fresh position. The API verifies QR secret, activation window, accuracy and
   distance. Raw coordinates are not stored.
5. A successful claim stores only the drop ID, time and rounded verification
   distance in a pseudonymous, HttpOnly browser wallet. It unlocks the private
   line and adds one Credit.
6. The player may exchange 1–5 Credits for a one-time Stripe code. The code
   expires after 12 months and requires an order at least 50 PLN higher than
   its discount. Stripe Checkout accepts promotion codes.

Clearing site data loses access to the pilot wallet. Account recovery should be
added before a full public season.

## Launching a physical drop

Generate a unique secret for every printed tag:

```sh
openssl rand -hex 24
```

Add the drop to the server-only `AREA_LIVE_DROPS_JSON` variable in Netlify. Do
not use a `PUBLIC_` prefix and never commit a real secret or exact coordinates.

```json
{
  "wro-001": {
    "secret": "at-least-24-random-characters",
    "lat": 51.1079,
    "lng": 17.0385,
    "radiusMeters": 100,
    "maxClaims": 25,
    "startsAt": "2026-08-01T10:00:00+02:00",
    "endsAt": "2026-08-03T22:00:00+02:00"
  }
}
```

Supported IDs are defined in `src/data/area.ts`. Exact coordinates and secrets
are parsed only by `src/server/areaCatalog.ts`.

- `radiusMeters`: 25–500 m. Start around 80–120 m outdoors.
- `maxClaims`: 1–500 successful browser wallets. The default is 25.
- `startsAt` / `endsAt`: optional ISO timestamps with an explicit `Z` or
  `±hh:mm` timezone. Outside the window the claim is inactive. A malformed,
  empty or reversed window makes the entire configured drop fail closed.

The global claim cap is written with compare-and-swap storage, independently of
the per-wallet limit. This puts a hard ceiling on nominal campaign exposure:

```text
maximum discount exposure = maxClaims × 50 PLN per drop
```

At the default of 25 claims, one city exposes at most 1,250 PLN and all six pilot
cities at most 7,500 PLN. Every voucher still requires a paid basket at least
50 PLN above the discount.

After setting the environment variable:

1. deploy the site;
2. open the Area map and confirm that the intended city says “live”;
3. scan the production QR on iOS and Android;
4. test once outside the zone and once inside it;
5. generate a 50 PLN test voucher and complete a Stripe test checkout;
6. inspect the Stripe webhook and order notification before going live.

If a QR secret leaks before launch, replace the secret, redeploy and replace the
physical label. Never place a box on private property, near traffic, railways,
rooftops, construction sites or anywhere that encourages unsafe access.

## What is stored

- Netlify Blobs wallet: random wallet ID, claimed drop IDs, claim timestamps,
  rounded distance, balance, claim-attempt timestamps and voucher status.
- Netlify Blobs drop counter: hashes of wallet IDs, used only for the global
  campaign cap.
- Stripe: one single-use coupon and promotion code per Credit exchange.
- Not stored: raw latitude/longitude, route history, background location, QR
  secret in the public page payload, or precise coordinates in social sharing.

The site privacy policy and terms describe this pilot. They should still be
reviewed by Polish counsel before a large paid promotion or any on-chain
release.

## Abuse and failure behaviour

- One wallet can claim a given drop only once.
- Each drop has an atomic global claim cap.
- Claim attempts are limited per wallet in a rolling ten-minute window.
- Position accuracy must be 150 m or better; the accepted distance is the
  configured radius plus at most 50 m of reported accuracy.
- Credit reservation and voucher state transitions use compare-and-swap writes.
- Only one request holds the voucher-processing lease at a time. Stripe coupon
  and promotion creation use deterministic idempotency keys. Recovery also
  retrieves the deterministic coupon and searches the customer-facing code,
  so it remains safe after Stripe's idempotency cache expires.
- Functional responses are `no-store`; the service worker ignores all API and
  claim traffic.
- If Stripe's outcome is uncertain, Credits remain reserved and the browser
  retries the same request ID. This prevents an active Stripe promotion from
  coexisting with a refunded balance. An expired processing lease can be
  resumed safely with the same idempotency keys. A matching code that is
  expired, inactive or already redeemed is never returned as a fresh voucher
  and requires manual review instead of an automatic Credit refund.

Browser geolocation can be spoofed by a determined attacker. The QR secret,
limited activation window, minimum basket and hard `maxClaims` budget make that
risk bounded for the pilot. A public season with materially higher value should
add a recoverable account and verified-email or passkey-based redemption.

## Social rollout

Use one clear campaign tag (`#ViryaArea`) and keep every asset on the same visual
system as the Area cards.

- T−48 h: distorted map crop plus “SIGNAL DETECTED / [CITY REDACTED]”.
- T−24 h: reveal the city and activation window, but not the neighbourhood.
- T−2 h: post one visual clue and a safety reminder.
- T0: “signal live” Story/Reel linking to the Area map with
  `utm_source`, `utm_medium` and `utm_campaign=virya_area`.
- During: reshare finds that show the collectible line but hide the box and
  exact surroundings.
- After: publish claimed count, the unlocked lyric and the next encrypted city.
- Finale: reward a completed collection with access, recognition or a
  non-monetary limited edition; do not increase transferable token value.

The built-in Share button already produces a spoiler-safe caption and tagged
URL. A useful recurring format is: city + unlocked line + challenge to find the
next signal.

## Optional phase two

Only after the pilot proves repeat play and safe operations:

1. add a recoverable VIRYA account and migrate browser wallets;
2. let a player optionally mint the already unlocked artwork;
3. keep the claim proof, precise coordinates and merch balance off-chain;
4. publish mint terms, network fees and transfer rules before enabling it;
5. obtain a dedicated Polish/EU legal review before describing anything as a
   token, NFT or cryptoasset in consumer-facing copy.
