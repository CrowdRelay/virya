# Contributing

Keep public rendering static-first and privileged work server-side. A browser component must not import or reference server credentials.

Before opening a pull request run:

```sh
npm ci
npm test
npm run security:audit
npm run build
```

New failure-prone integrations need a bounded timeout, an abort path, a degraded-state UI and a contract test. Private capability pages must remain `no-store`, absent from search indexing and outside service-worker HTML caching.
