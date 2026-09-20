const { globSync } = require("node:fs")
const { join } = require("node:path")

// Every prerendered route in dist/ is auditable. SSR and auth'd surfaces
// (staff, tickets, /live/[slug]) never land in dist, so this glob IS the
// public audit surface — new pages join the audit automatically.
const ROUTES = globSync("**/index.html", { cwd: join(__dirname, "dist") })
  .map(file => `/${file.slice(0, -"index.html".length)}`)
  .sort()

// Push gate: homepage only, 4×100 hard. Fast on the shared ARM lane —
// the full route sweep runs nightly via LHCI_FULL=1 (lighthouse-full.yml).
const SUBSET = ["/"]

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
      // Push gate: the homepage is held to a hard 4×100 modulo the perf
      // floor. Nightly sweeps every prerendered route. Perf floors are 0.9
      // on both tiers — the shared ARM box jitters identical builds between
      // 0.9 and 1.0, so a tighter floor fails on host noise (the first full
      // sweep red-flagged even /win/ and /signal/confirm/).
      assertMatrix: FULL
        ? [
            {
              matchingUrlPattern: ".*",
              assertions: {
                "categories:performance": ["error", { minScore: 0.9 }],
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
          ]
        : [
            {
              // a11y/bp/seo are deterministic and stay at hard 100. Perf on
              // this lane measures host load more than the page — identical
              // builds score 0.9–1.0 depending on what prod is doing — so the
              // floor is 0.9 (catastrophic regressions only; bundle budgets in
              // npm test are the real size gate) and 1.0 stays as a warn.
              matchingUrlPattern: ".*",
              assertions: {
                "categories:performance": ["error", { minScore: 0.9 }],
                "categories:accessibility": ["error", { minScore: 1 }],
                "categories:best-practices": ["error", { minScore: 1 }],
                "categories:seo": ["error", { minScore: 1 }],
              },
            },
            {
              matchingUrlPattern: ".*",
              assertions: {
                "categories:performance": ["warn", { minScore: 1 }],
              },
            },
          ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
