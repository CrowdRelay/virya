# BFF reduction guardrail

Virya remains SSR-capable, but `src/pages/api` is capped at the current 80 routes. New browser-safe public reads should prefer CrowdRelay directly. Replace or retire an existing proxy before adding another route. Staff/secret-bearing operations stay server-side. This is a ratchet, not a big-bang static rewrite.

Netlify remains promotion-only: GitHub Actions builds the immutable site/functions artifact and deploys it with `--no-build`; linked Netlify source builds stay disabled.
