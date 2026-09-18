import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const layout = read("src/components/Layout.astro")
const middleware = read("src/middleware.ts")
const netlifyHeaders = read("public/_headers")

const METRICOOL_HOST = "https://tracker.metricool.com"
const METRICOOL_HASH = "df939c23f07ed9d3255626c9f9716d5d"

test("metricool tracker loads idly and never on the critical path", () => {
  assert.match(layout, /requestIdleCallback/)
  assert.match(layout, /resources\/be\.js/)
  assert.match(layout, /s\.async = true/)
  // The loader must be scheduled through the idle callback, not parsed inline
  // during initial load or fired synchronously.
  assert.match(layout, /ric\(function\(\) \{[\s\S]*?tracker\.metricool\.com\/resources\/be\.js/)
  // Tracker host must not appear in any <head> resource hint — a preconnect
  // would spend early socket work on a script that loads after load+idle.
  const head = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"))
  assert.doesNotMatch(head, /rel="preconnect"[^>]*metricool/)
})

test("metricool pageview tracking covers ClientRouter navigations without double-counting", () => {
  assert.match(layout, new RegExp(METRICOOL_HASH))
  assert.match(layout, /astro:page-load/)
  // Inline head scripts re-execute on every ClientRouter swap, so the listener
  // and request flag must be window-scoped guards, not per-execution closures.
  assert.match(layout, /__viryaMetricoolInstalled/)
  assert.match(layout, /__viryaMetricoolRequested/)
  assert.match(layout, /__viryaMetricoolLastUrl/)
  assert.match(layout, /location\.href === window\.__viryaMetricoolLastUrl/)
})

test("every CSP grants tracker.metricool.com in script-src and img-src, never connect-src", () => {
  const policies = [
    ...netlifyHeaders.matchAll(/Content-Security-Policy: ([^\n]+)/g),
  ].map(m => m[1])
  policies.push(
    middleware.match(/"(default-src[^"]+)"/)?.[1] ?? "",
  )
  assert.ok(policies.length >= 4, `expected 4+ CSP strings, found ${policies.length}`)
  for (const policy of policies) {
    const scriptSrc = policy.match(/script-src ([^;]+)/)?.[1] ?? ""
    const imgSrc = policy.match(/img-src ([^;]+)/)?.[1] ?? ""
    const connectSrc = policy.match(/connect-src ([^;]+)/)?.[1] ?? ""
    assert.ok(scriptSrc.includes(METRICOOL_HOST), `script-src missing metricool: ${policy}`)
    assert.ok(imgSrc.includes(METRICOOL_HOST), `img-src missing metricool: ${policy}`)
    // be.js beacons via new Image() — connect-src must stay tight.
    assert.ok(!connectSrc.includes(METRICOOL_HOST), `connect-src must not carry metricool: ${policy}`)
  }
})
