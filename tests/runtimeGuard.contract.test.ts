import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const guard = read("public/runtime-guard.js")
const layout = read("src/components/Layout.astro")
const worker = read("public/sw.js")
const middleware = read("src/middleware.ts")

test("runtime guard installs before Astro navigation and keeps reports bounded", () => {
  assert.match(layout, /runtime-guard\.js[\s\S]*<ClientRouter/)
  assert.match(guard, /MAX_REPORTS = 6/)
  assert.match(guard, /unhandledrejection/)
  assert.match(guard, /resource-load-error/)
  assert.match(guard, /unexpected-previous-termination/)
  assert.match(guard, /window\.__VIRYA_REPORT__/)
})

test("runtime diagnostics do not persist capability URLs or form values", () => {
  assert.match(guard, /location\.origin}\$\{location\.pathname/)
  assert.doesNotMatch(guard, /location\.search/)
  assert.doesNotMatch(guard, /location\.hash/)
  assert.doesNotMatch(guard, /\.value\b/)
  assert.doesNotMatch(guard, /FormData/)
  assert.match(guard, /sanitizeDiagnosticText/)
  assert.match(guard, /privacySafeUrl/)
})

test("an abnormal previous foreground session is surfaced visibly", () => {
  const recovery = guard.slice(guard.indexOf("if (previousWasForeground)"))
  assert.match(recovery, /unexpected-previous-termination/)
  assert.doesNotMatch(recovery, /visible:\s*false/)
})

test("service worker always returns a Response during offline fallback", () => {
  assert.match(worker, /offlineHtmlResponse/)
  assert.match(worker, /offlineAssetResponse/)
  assert.match(worker, /X-Virya-Offline/)
  assert.match(worker, /PRIVATE_HTML_PATTERN/)
  assert.match(worker, /VIRYA_OFFLINE_FALLBACK/)
})

test("middleware converts uncaught server failures into correlated no-store responses", () => {
  assert.match(middleware, /try \{[\s\S]*response = await next\(\)[\s\S]*catch/)
  assert.match(middleware, /X-Request-ID/)
  assert.match(middleware, /application\/problem\+json/)
  assert.match(middleware, /private, no-store/)
  assert.match(middleware, /context\.url\.pathname/)
  assert.doesNotMatch(middleware, /context\.url\.href/)
})

test("static service-worker assets are stale-while-revalidate", () => {
  assert.match(worker, /const cached = await cache\.match\(event\.request\)/)
  assert.match(worker, /const revalidate = fetch\(event\.request\)/)
  assert.match(worker, /if \(cached\)[\s\S]*return cached/)
})

test("service-worker caches stay bounded", () => {
  assert.match(worker, /MAX_PAGE_CACHE_ENTRIES = 32/)
  assert.match(worker, /MAX_STATIC_CACHE_ENTRIES = 160/)
  assert.match(worker, /async function trimCache/)
  assert.match(worker, /trimCache\(cache, MAX_STATIC_CACHE_ENTRIES\)/)
  assert.match(worker, /trimCache\(cache, MAX_PAGE_CACHE_ENTRIES\)/)
})
