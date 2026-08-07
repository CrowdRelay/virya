# Virya Signal staff pairing

The private page `/staff/pair/` generates the setup QR understood by the current Virya Signal mobile application. It reuses the same password and 12-hour HttpOnly browser session as `/staff/qr/`, `/staff/control/` and `/staff/accounting/`.

## Netlify environment

Set the existing staff-panel variables and add:

```text
STAFF_OPERATOR_KEY=<same staff operator secret configured in CrowdRelay>
```

The key is server-only. Never prefix it with `PUBLIC_` and never render it into Astro HTML. The authenticated API route releases it only inside the mobile setup envelope requested by an operator.

## Mobile contract

Virya Signal currently accepts this URI:

```text
virya-signal://pair?payload=<base64url-json>
```

The decoded JSON is:

```json
{
  "version": 1,
  "apiBaseUrl": "https://signal-api.virya.music/v1/",
  "displayName": "Kuba — bramka",
  "role": "staff",
  "bearerToken": "<STAFF_OPERATOR_KEY>",
  "expiresAt": 1785792000
}
```

The web generator fixes the role to `staff`, allows a validity window of one to ten minutes, limits the payload to the QR encoder's safe profile and removes the QR from the screen when it expires. The app validates the expiry before storing the profile in its local encrypted vault.

## Operator flow

1. Open `/staff/pair/` and sign in with the staff-panel password.
2. Enter a recognizable person/device label.
3. Generate a three-, five- or ten-minute QR.
4. In Virya Signal open the operator area and choose `ZESKANUJ KOD QR`.
5. Scan the code and set a local 4–6 digit PIN.
6. Hide the code immediately after the device confirms pairing.

## Security boundary

This is a compatibility bridge for the current mobile contract. The QR transports the installation-wide staff bearer. The displayed expiry is enforced by the app before import, but the underlying CrowdRelay bearer remains valid until it is rotated. Therefore:

- show the QR only to a trusted person and device;
- never send screenshots or paste the URI into chat;
- use the `staff` key, never the administrator key;
- rotate the CrowdRelay staff operator secret and update `STAFF_OPERATOR_KEY` in Netlify to revoke all paired staff devices.

A future broker-backed pairing flow should replace the static bearer with a one-time exchange that mints a short-lived, revocable per-device session. That requires a matching CrowdRelay and mobile-app contract and is intentionally not faked in the website.
