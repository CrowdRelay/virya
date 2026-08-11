# VIRYA Web 1.0.0

VIRYA Web 1.0.0 is the frozen stable release of the public website and staff web surfaces.

## Stability promise

- Public URLs, locale routing and CrowdRelay-facing BFF routes are stable within the 1.x line.
- Breaking route or payload changes require a major version bump or an explicit compatibility adapter.
- Static-first rendering, bounded islands and the existing build/resource budgets are release invariants.
- New business policy belongs in CrowdRelay, not in browser code or Netlify functions.
- New external-provider orchestration belongs in thin adapters; the website remains a presentation/BFF surface.

## Reusable integration boundary

Other artist/team ecosystems should reuse the patterns and contracts, not fork VIRYA-specific content:

- `src/lib/crowdrelay-client.ts` — browser-side CrowdRelay transport boundary;
- `src/server/runtimeEnv.ts` — fail-closed runtime configuration boundary;
- `src/pages/api/staff/**` — thin operator BFF pattern;
- `src/data/viryaIdentity.ts` — example canonical entity/JSON-LD identity module;
- CrowdRelay OpenAPI 1.x remains the authoritative cross-repository service contract.

The website package stays `private: true`: it is a deployable product, not an npm SDK. Reusable service types should be generated from the CrowdRelay OpenAPI contract rather than duplicated here.
