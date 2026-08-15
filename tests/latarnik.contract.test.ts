import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const read = (path: string) => readFileSync(`${root}${path}`, "utf8")
const portal = read("src/components/LatarnikPage.astro")
const pl = read("src/pages/pl/latarnik.astro")
const en = read("src/pages/latarnik.astro")

test("Latarnik stays static-first and direct-to-CrowdRelay", () => {
  assert.match(pl, /LatarnikPage lang="pl"/)
  assert.match(en, /LatarnikPage lang="en"/)
  assert.match(portal, /signal-api\.virya\.music\/v1/)
  assert.match(portal, /beacon\/invitations\/exchange/)
  assert.match(portal, /beacon\/me\/preferences/)
  assert.match(portal, /beacon\/me\/press-requests/)
  assert.match(portal, /beacon\/me\/logout/)
  assert.doesNotMatch(portal, /\/api\/beacon/)
})

test("invite capability is removed from the URL before persisted use", () => {
  assert.match(portal, /url\.searchParams\.delete\("invite"\)/)
  assert.match(portal, /history\.replaceState/)
  assert.match(portal, /localStorage\.setItem\(storageKey/)
  assert.match(portal, /localStorage\.removeItem\(storageKey/)
  assert.doesNotMatch(portal, /console\.log\([^\n]*invite/i)
})

test("press room and local radar remain the product surface", () => {
  for (const marker of ["Press room", "data-events", "data-radius", "press_photo", "clean_version", "accreditation"]) {
    assert.ok(portal.includes(marker), `missing ${marker}`)
  }
})
