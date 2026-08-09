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
  const area = read('src/components/AreaExperience.astro')
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
    ['src/components/preact/Newsletter.jsx', /AbortSignal\.timeout\(10_000\)/],
    ['src/components/preact/Contact.jsx', /AbortSignal\.timeout\(12_000\)/],
    ['src/components/preact/merch/productCard.jsx', /AbortSignal\.timeout\(6_000\)/],
    ['src/components/preact/merch/cartDrawer.jsx', /AbortSignal\.timeout\((?:10|15)_000\)/],
    ['src/components/preact/tickets/TicketCheckout.tsx', /AbortSignal\.timeout\(15_000\)/],
    ['src/components/preact/staff/EcosystemControl.tsx', /AbortSignal\.timeout\(10_000\)/],
    ['src/components/preact/staff/StaffPairingManager.tsx', /AbortSignal\.timeout\(10_000\)/],
  ]
  for (const [path, pattern] of bounded) assert.match(read(path), pattern, `${path} has no bounded request`)
})

test("Bandsintown proxy bounds upstream response bytes", () => {
  const bandsintown = read('src/pages/api/bandsintown.ts')
  assert.match(bandsintown, /MAX_RESPONSE_BYTES = 512 \* 1024/)
  assert.match(bandsintown, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/)
  assert.match(bandsintown, /Buffer\.byteLength\(text, "utf8"\) > MAX_RESPONSE_BYTES/)
  assert.match(bandsintown, /data\.slice\(0, MAX_EVENTS\)/)
})

test("healthy live-event snapshots survive short upstream outages", () => {
  const source = read('src/server/liveEvents.ts')
  assert.match(source, /HEALTHY_STALE_TTL_MS = 10 \* 60 \* 1000/)
  assert.match(source, /!cachedLiveEvents\.result\.degraded/)
  assert.match(source, /result\.degraded && staleHealthy/)
  assert.match(source, /staleHealthy\.staleUntil/)
})
