# VIRYA Area — GPS hunt and free-merch reward

VIRYA Area is a location-based loyalty game built into `virya.music`. A player
follows a clue, reaches an active city zone, signs in and explicitly starts a
short GPS verification. A valid claim unlocks one lyric collectible and awards
1 VIRYA Credit.

One Credit can be converted into a single-use internal winning code. In one
merch order that code makes the highest-priced single available item in the
cart free and removes the InPost delivery charge. Additional items remain
payable. No Stripe coupon is created. The current pilot uses account-bound GPS
verification; see **Anti-cheat boundary** below before attaching higher-value
or scarce physical rewards.

Credits and codes stay off-chain. They have no cash value, cannot be withdrawn
and are not cryptocurrency or an investment. Optional on-chain minting may
later represent collectible artwork only.

## Player flow

1. `/area/` or `/pl/area/` shows public city signals and clues.
2. The nearest-city button compares the player's location locally in the
   browser. Nothing is sent during this search.
3. The player selects a live city, reaches the place suggested by the clue and
   signs in through the magic-link profile.
4. Pressing **Lock signal** calls `POST /api/area/challenge`. The server returns
   a signed, actor-bound challenge valid for 90 seconds.
5. The browser gathers at least three fresh high-accuracy readings over at
   least six seconds and submits them to `POST /api/area/claim`.
6. The server verifies challenge signature, player, activation window, sample
   freshness, accuracy and distance. Raw samples are discarded.
7. A successful claim stores the drop ID, time, edition number and rounded
   verification distance, then adds 1 Credit.
8. The player exchanges exactly 1 Credit for a one-time code such as
   `VIRYA-AB12-CD34-EF56-7890-ABCD-EF12`.
9. In the merch cart the player enters the code. Checkout validates the cart
   server-side, sets one item to zero and sets InPost delivery to zero.
10. Stripe Checkout may have a total of zero. The signed webhook marks the code
    redeemed and performs normal email and shipment fulfilment.

## Environment

Required server-side variables:

```dotenv
AREA_AUTH_SECRET=<at least 32 random bytes>
AREA_CHALLENGE_SECRET=<at least 32 random bytes; optional but recommended>
AREA_LIVE_DROPS_JSON={...}
```

Generate secrets with:

```sh
openssl rand -hex 32
```

Example live zone (use the real point only in the server environment):

```json
{
  "wro-001": {
    "lat": 50.000001,
    "lng": 19.000001,
    "radiusMeters": 80,
    "maxClaims": 25,
    "startsAt": "2026-08-01T10:00:00+02:00",
    "endsAt": "2026-08-03T22:00:00+02:00"
  }
}
```

Supported IDs are defined in `src/data/area.ts`. Exact coordinates are loaded
by `src/server/areaLiveDrops.ts`, validated by `src/server/areaCatalog.ts` and
must never be copied into `src/data/area.ts` or a `PUBLIC_` environment value.

- `radiusMeters`: 25–500 m. Start around 50–100 m outdoors and test the actual
  site on several phones.
- `maxClaims`: 1–500 successful player profiles. Default: 25.
- `startsAt` / `endsAt`: optional ISO timestamps with explicit `Z` or
  `±hh:mm`. Invalid windows fail closed.

## GPS verification

The server accepts 3–8 samples. The default frontend aims for four readings
over at least six seconds.

A sample must have reported accuracy no worse than 60 m. Its accepted distance
is:

```text
configured radius + min(reported accuracy × 0.35, 15 m)
```

At least three accurate readings must be inside the allowed distance and the
median reading must also pass. Challenge tokens are HMAC-signed, bound to the
logged-in actor and drop, and expire after 90 seconds.

Raw coordinates and samples are not retained. The wallet stores only a rounded
verification distance. Failed claims never return the measured distance, so the
endpoint cannot be used as a distance oracle to triangulate the hidden point.

### Anti-cheat boundary

Browser geolocation can still be spoofed by a determined attacker. Signed
accounts, short challenges, rolling attempt limits, hidden coordinates and a
hard `maxClaims` cap reduce the exposure, but web GPS alone is not cryptographic
proof of physical presence.

For higher-value drops, combine this flow with a physical second factor at the
location, preferably a pool of individually numbered one-time QR/scratch codes.
A single permanent QR can be photographed and shared, so it should not be the
only proof for a scarce reward.

## Consistency and migration

- Drop capacity uses CAS with short `pending` leases and a final `committed`
  state. An expired pending reservation is removed automatically.
- Wallet writes are idempotent per player and drop. A retry reconciles the
  edition number without awarding a second Credit.
- A legacy browser wallet is permanently bound to the first account that
  migrates it. The same browser may still sign into another account, but the
  already-bound wallet is not copied again.
- Reward-code ownership is transferred together with a legacy migration so
  checkout and Stripe webhook updates reach the account wallet.
- If a legacy voucher has no matching global reward record, it is marked failed
  and its spent Credit is compensated once.

## Validation commands

Run before deployment:

```sh
npm ci
npm test
npm run build
```

`npm test` runs TypeScript validation and `scripts/audit-area.mjs`. The audit
guards against reintroducing exact zone geometry into the client, restoring the
removed `/api/area/profile` call, leaking distance in `OUTSIDE_ZONE`, or making
public city reference coordinates too precise. GitHub Actions runs these checks
before the production build.

## Reward and checkout semantics

- 1 successful drop = 1 Credit.
- 1 Credit = 1 single-use winning code.
- The code expires after 12 months.
- The highest-priced single unit in the submitted cart is free. If quantity is
  greater than one, only one unit is free.
- InPost Paczkomat delivery is free in the same order.
- Other items remain payable.
- Normal Stripe promotion-code entry is disabled for a reward checkout.
- The code is reserved for a checkout request for about 31 minutes.
- Repeating the same request ID resumes the same open Stripe Checkout session.
- `checkout.session.expired` and `checkout.session.async_payment_failed`
  release the reservation.
- `checkout.session.completed` and
  `checkout.session.async_payment_succeeded` redeem the code after verifying
  `paid` or `no_payment_required`.

Configure the Stripe webhook for all four event types above. A completely free
order still reaches `checkout.session.completed` with
`payment_status=no_payment_required`.

## Storage

Netlify Blobs stores:

- account and session records for the Area magic-link profile;
- account wallet: claims, Credit balance, attempts and issued-code history;
- per-drop hashed actor claim list for atomic capacity and edition numbers;
- reward-code record: hash, owner, status, expiry, checkout reservation and
  redeemed product.

Stripe stores order metadata and line items. The raw winning code, GPS samples,
route history and exact claimed coordinates are not written to Stripe.

## Failure and concurrency behaviour

- A profile can claim a given drop only once.
- `reserveAreaDropClaim` is idempotent for the same drop/profile pair and
  returns a stable edition number.
- Wallet and drop-cap writes use compare-and-swap storage.
- Reward issuance uses a persistent request ID and processing lease.
- Reward checkout uses a persistent request ID, code reservation and Stripe
  idempotency key.
- Webhook fulfilment uses a lease/checkpoint ledger, so Stripe retries do not
  resend email or recreate shipments.
- If checkout creation returns an uncertain error, the client retries with the
  same request ID instead of minting another reservation.

## Launch checklist

1. Set strong `AREA_AUTH_SECRET` and `AREA_CHALLENGE_SECRET` values.
2. Add one test live zone with a small radius and low `maxClaims`.
3. Deploy and verify that only the intended city is marked live.
4. Test login and signal lock on iOS Safari and Android Chrome.
5. Test outside-zone, low-accuracy, expired-challenge and repeated-claim paths.
6. Create a winning code and test carts containing one item, multiple items and
   quantity greater than one.
7. Complete a fully free order and a partially paid order in Stripe test mode.
8. Verify reward release on session expiry and async payment failure.
9. Verify order email, VAT metadata and InPost shipment creation.
10. Review the privacy policy and terms with Polish counsel before a large
    public promotion.

## Social rollout

- T−48 h: distorted map crop and `SIGNAL DETECTED / [CITY REDACTED]`.
- T−24 h: reveal city and activation window, not the exact neighbourhood.
- T−2 h: publish a visual clue and safety reminder.
- T0: Story/Reel linking to Area with campaign UTM parameters.
- During: reshare finds that show the unlocked line but hide the exact place.
- After: publish the verified count and next encrypted city.

The built-in share action includes the city and unlocked lyric but no exact
coordinates.
