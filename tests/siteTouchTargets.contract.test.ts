import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const band = readFileSync(new URL("../src/components/BandTeaser.astro", import.meta.url), "utf8")
const footer = readFileSync(new URL("../src/components/Footer.astro", import.meta.url), "utf8")

test("site social icon links expose 44px touch targets", () => {
  for (const source of [band, footer]) {
    assert.match(source, /\[&_a\]:min-h-\[44px\]/)
    assert.match(source, /\[&_a\]:min-w-\[44px\]/)
  }
})
