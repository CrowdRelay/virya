# Reliability contract

## Browser

`public/runtime-guard.js` installs before Astro's client router and hydrated islands. It captures uncaught errors, rejected promises, failed resource loads and an unexpected foreground-session termination. Reports are bounded to six entries and store only the origin plus pathname, a sanitized action name, message, stack and user agent. Query strings, URL fragments and form values are excluded.

## Service worker

The service worker does not intercept writes, API calls or cross-origin traffic. Private ticket, winner, merch result and staff pages are network-only and receive a synthetic 503 page when offline. Every fallback returns a real `Response`; an absent cache entry can no longer turn into an undefined `respondWith` result.

## Server

Astro middleware wraps downstream rendering and API execution. Uncaught exceptions are logged with a request ID and converted to no-store responses. The client sees the request ID, never the server stack.

## Operational checks

```sh
npm test
npm run build
npm run budget:build
```

`npm run quality` runs all three gates.

## Known limits

A browser process or device can still be terminated before storage is writable. The guard therefore promises best-effort current-screen diagnostics and deterministic next-load recovery from the last persisted foreground heartbeat, not impossible guarantees against hardware or operating-system failure.
