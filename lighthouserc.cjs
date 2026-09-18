const { globSync } = require("node:fs")
const { join } = require("node:path")

// Every prerendered route in dist/ is auditable. SSR and auth'd surfaces
// (staff, tickets, /live/[slug]) never land in dist, so this glob IS the
// public audit surface — new pages join the audit automatically.
const ROUTES = globSync("**/index.html", { cwd: join(__dirname, "dist") })
  .map(file => `/${file.slice(0, -"index.html".length)}`)
  .sort()

// Push-gate subset: one representative page per template family, bilingual.
// The full matrix runs nightly via LHCI_FULL=1 (see lighthouse-full.yml).
// No /live/ here — live/[slug] is SSR-only, so there is no live index in dist.
const SUBSET = [
  "/",
  "/pl/",
  "/about/",
  "/pl/about/",
  "/epk/",
  "/news/",
  "/merch/",
  "/gallery/",
  "/videos/",
  "/lyrics/",
  "/signal/",
  "/legal/privacy/",
  "/win/",
]

const FULL = process.env.LHCI_FULL === "1"
const urls = (FULL ? ROUTES : SUBSET.filter(route => ROUTES.includes(route)))
  .map(route => `http://localhost:4173${route}`)

if (urls.length === 0) {
  throw new Error("lighthouserc: no routes resolved — run `npm run build` first")
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node scripts/lhci-server.mjs",
      startServerReadyPattern: "LHCI server ready",
      url: urls,
      // Full sweep runs once per page (~70 routes); the push gate gets the
      // standard 3-run median on the subset.
      numberOfRuns: FULL ? 1 : 3,
      settings: {
        skipAudits: ["is-on-https", "redirects-http", "errors-in-console"],
        // chromeFlags is a STRING (an array is silently ignored — LHCI #190).
        // --no-sandbox is required since the runner's Ubuntu 24.04 AppArmor
        // policy blocks Chrome's userns sandbox; --lang=en-US keeps
        // navigator.language English so the localStorage lang-redirect in
        // Layout never bounces an EN-route audit to /pl/*.
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --disable-gpu --lang=en-US",
      },
    },
    assert: {
      // assertMatrix replaces `assertions` entirely — LHCI refuses to mix them.
      // Entries MERGE for matching URLs (they don't override), so the SEO gate
      // uses a negative lookahead to skip the intentionally-noindexed routes
      // where is-crawlable fails by design.
      //
      // Perf: error floor 0.95 guards regressions; warn at 1.0 keeps sub-100
      // runs visible in the log. A hard perf=1.0 gate would flake on the
      // shared 2-core ARM box — LCP jitter across identical builds is
      // 1.7–2.7s locally, larger under lane contention.
      assertMatrix: [
        {
          matchingUrlPattern: ".*",
          assertions: {
            "categories:performance": ["error", { minScore: 0.95 }],
            "categories:accessibility": ["error", { minScore: 1 }],
            "categories:best-practices": ["error", { minScore: 1 }],
          },
        },
        {
          matchingUrlPattern: ".*",
          assertions: {
            "categories:performance": ["warn", { minScore: 1 }],
          },
        },
        {
          // 14 intentionally-noindexed routes: /win, /latarnik, /my-signal,
          // /merch/{cancel,success}, /signal/{confirm,unsubscribe} (+/pl/*).
          matchingUrlPattern:
            "^(?!.*\\/(win|latarnik|my-signal|merch/cancel|merch/success|signal/confirm|signal/unsubscribe)/?$).*$",
          assertions: {
            "categories:seo": ["error", { minScore: 1 }],
          },
        },
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
