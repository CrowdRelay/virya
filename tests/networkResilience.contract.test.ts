import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('deep AREA rewards hydrate only when visible', () => {
  const source = read('src/components/AreaExperience.astro')
  assert.match(source, /<AreaTicketRewards client:visible lang=\{lang\} \/>/)
  assert.doesNotMatch(source, /<AreaTicketRewards client:load/)
})

test('interactive public request paths are bounded', () => {
  const area = read('src/components/AreaExperience.astro') + read('src/client/areaExperience.ts')
  assert.match(area, /const AREA_REQUEST_TIMEOUT_MS = 10_000/)
  for (const endpoint of [
    '/api/area/wallet',
    '/api/area/auth/verify',
    '/api/area/auth/request',
    '/api/area/auth/logout',
    '/api/area/challenge',
    '/api/area/claim',
    '/api/area/voucher',
  ]) {
    const index = area.indexOf(`fetch("${endpoint}"`)
    assert.notEqual(index, -1, `missing ${endpoint}`)
    const request = area.slice(index, index + 320)
    assert.match(request, /signal: AbortSignal\.timeout\(AREA_REQUEST_TIMEOUT_MS\)/, `${endpoint} is unbounded`)
  }

  const bounded: Array<[string, RegExp]> = [
    ['src/components/preact/Contact.jsx', /AbortSignal\.timeout\(12_000\)/],
    ['src/components/preact/merch/productCard.jsx', /AbortSignal\.timeout\(6_000\)/],
    ['src/components/preact/merch/cartDrawer.jsx', /AbortSignal\.timeout\((?:10|15)_000\)/],
    ['src/components/preact/tickets/TicketCheckout.tsx', /AbortSignal\.timeout\(15_000\)/],
    ['src/components/preact/staff/StaffPairingManager.tsx', /timeoutMs:\s*REQUEST_TIMEOUT_MS/],
  ]
  for (const [path, pattern] of bounded) {
    try {
      assert.match(read(path), pattern, `${path} has no bounded request`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Skip checks for deleted files (e.g., Newsletter.jsx removed in favor of Signal)
        continue
      }
      throw error
    }
  }

  const staffApi = read('src/components/preact/staff/staffApi.ts')
  assert.match(staffApi, /new AbortController\(\)/)
  assert.match(staffApi, /options\.timeoutMs \?\? DEFAULT_TIMEOUT_MS/)
  assert.match(staffApi, /credentials:\s*"same-origin"/)
  assert.match(staffApi, /cache:\s*"no-store"/)
})

test("Bandsintown fallback stays server-only and bounds upstream response bytes", () => {
  const live = read('src/server/liveEvents.ts')
  // The shared bounded-read mechanics are pinned by assetPerformance and
  // upstreamJsonBounds; this gate owns the Bandsintown-specific facts only.
  assert.match(live, /MAX_RESPONSE_BYTES = 512 \* 1024/)
  assert.match(live, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/)
  assert.match(live, /rest\.bandsintown\.com\/artists\/virya\/events/)
})

test("healthy live-event snapshots survive short upstream outages", () => {
  const source = read('src/server/liveEvents.ts')
  assert.match(source, /HEALTHY_STALE_TTL_MS = 10 \* 60 \* 1000/)
  assert.match(source, /!cachedLiveEvents\.result\.degraded/)
  assert.match(source, /result\.degraded && staleHealthy/)
  assert.match(source, /staleHealthy\.staleUntil/)
})

test("an event without a first-party ticket sale is a quiet negative cache result", () => {
  const source = read("src/server/liveEvents.ts")
  assert.match(source, /class UpstreamHttpError extends Error/)
  assert.match(source, /error instanceof UpstreamHttpError && error\.status === 404/)
  assert.match(source, /TICKET_SALE_NEGATIVE_CACHE_TTL_MS/)
})

test("secondary public and staff reads share bounded lifecycle semantics", () => {
  const leaderboard = read("src/components/SynesthesiaLeaderboard.astro")
  assert.match(leaderboard, /AbortSignal\.timeout\(8_000\)/)
  assert.match(leaderboard, /payload\.items\.slice\(0, limit\)/)
  assert.match(leaderboard, /astro:before-preparation/)
  assert.match(leaderboard, /observer\.disconnect\(\)/)
})
