# Virya staff concert QR panel

The private panel is available at `/staff/qr`. It creates printable QR campaigns through server-side Astro/Netlify routes; the CrowdRelay admin key never reaches browser JavaScript.

## Netlify environment

Set these server-only variables:

```text
CROWDRELAY_ADMIN_API_KEY=<same value as CrowdRelay CROWDRELAY_ADMIN_API_KEY>
STAFF_QR_PASSWORD_SHA256=<lowercase SHA-256 of the staff password>
STAFF_QR_SESSION_SECRET=<independent random secret, at least 32 bytes>
PUBLIC_CROWDRELAY_API_URL=https://signal-api.virya.music/v1/
```

Generate values without writing the plaintext password to shell history:

```sh
read -s QR_PASSWORD; echo
printf %s "$QR_PASSWORD" | shasum -a 256
openssl rand -hex 32
```

Deploy CrowdRelay migration `0010` before deploying this frontend.

## Operator flow

1. Sign in at `/staff/qr`.
2. Select a published concert synchronized into CrowdRelay.
3. Keep the default validity window (one hour before to five hours after the start) unless production requires otherwise.
4. Optionally set a capacity.
5. Create the campaign and test the QR with a separate phone.
6. Download SVG/PNG, print A4 or display full-screen.
7. Revoke the campaign after the show or immediately if the code leaks.

The URL stores the signed token after `#checkin=`, so it is not sent in HTTP requests or referrers. The event page removes it from the address bar immediately. A fan must activate Virya Signal and can confirm only once per concert.

## Reward meaning

A concert check-in records attendance and adds one configurable entry to the single global draw for three physical Virya albums. Guest-list draws remain separate per event. The QR itself does not award an album and is not an admission ticket.

## Operational limitations

A static printed code can be photographed and shared during its active window. Mitigations are a narrow time window, controlled display, optional capacity and immediate revocation. There is deliberately no geolocation requirement because venue GPS is unreliable indoors and would add unnecessary personal-data processing.
