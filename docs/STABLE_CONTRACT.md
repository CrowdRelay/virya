# Stable web contract — 1.x

VIRYA Web is a deployable static-first product. Its stable reusable boundary is deliberately narrow.

1. **Service contract:** CrowdRelay OpenAPI 1.x is authoritative. Do not create a second hand-maintained API schema in this repository.
2. **BFF boundary:** server routes validate/authenticate and proxy; they do not own durable business state.
3. **Identity contract:** canonical artist identity is emitted as JSON-LD on both homepages and mirrored in `/llms.txt` for machine discovery.
4. **Performance contract:** public content is prerendered by default; hydration must be visibility/idle gated unless interaction is immediately required.
5. **Build contract:** GitHub Actions is the production build owner; Netlify must not become a second expensive build pipeline.

Breaking any of these rules requires an explicit architecture decision rather than incidental feature work.
