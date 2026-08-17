import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('Latarnik network BFF matches CrowdRelay invite limits', () => {
  const source = readFileSync(new URL('../src/pages/api/staff/commerce/campaigns.ts', import.meta.url), 'utf8')
  assert.match(source, /ttlDays < 1 \|\| ttlDays > 30/)
  assert.match(source, /radiusKm < 10 \|\| radiusKm > 500/)
  assert.doesNotMatch(source, /ttlDays > 90/)
})
