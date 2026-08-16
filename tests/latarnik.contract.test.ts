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
  assert.match(portal, /beacon\/me\/press-room/)
  assert.match(portal, /beacon\/me\/press-requests/)
  assert.match(portal, /beacon\/me\/events\/.*engagement/)
  assert.match(portal, /beacon\/me\/events\/.*coverage/)
  assert.match(portal, /beacon\/me\/leave/)
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

test("press room, local radar and collaboration loop are the product surface", () => {
  for (const marker of [
    "Press room", "data-events", "data-radius", "data-locale", "data-topic", "press_photo",
    "clean_version", "accreditation", "Mogę pomóc", "Nie tym razem", "Dodaj publikację",
    "data-request-history", "leave-dnc",
  ]) assert.ok(portal.includes(marker), `missing ${marker}`)
  assert.match(portal, /Promise\.allSettled\(\[/)
  assert.match(portal, /requestedEvent \? loadPressRoom\(requestedEvent\.id, requestedEvent\.title\) : loadPressRoom\(\)/)
  assert.match(portal, /initialParams\.get\("event_id"\)/)
  assert.match(portal, /url\.searchParams\.set\("event_id", eventId\)/)
  assert.match(portal, /event_id=/)
  assert.match(portal, /data-press-description/)
  assert.match(portal, /doNotContact/)
})

test("Latarnik client never injects backend content as HTML", () => {
  assert.doesNotMatch(portal, /innerHTML\s*=/)
  assert.match(portal, /textContent\s*=/)
  assert.match(portal, /safePressUrl/)
})
