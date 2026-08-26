import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const social = readFileSync(new URL("../src/components/SocialLinks.astro", import.meta.url), "utf8")

test("site social icon links expose 48px touch targets", () => {
  for (const source of [social]) {
    assert.match(source, /\[&_a\]:min-h-12/)
    assert.match(source, /\[&_a\]:min-w-12/)
  }
})
