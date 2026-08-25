import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

const en = read("src/pages/gallery.astro")
const pl = read("src/pages/pl/gallery.astro")
const shared = read("src/components/GalleryGrid.astro")

// Both locales render one shared gallery component; the lightbox loading UX
// lives there exactly once instead of being copy-pasted per locale (which had
// already drifted: PL grew alt_pl support the EN page never picked up).
test("both gallery locales render the shared grid + lightbox component", () => {
  for (const [name, source] of [["en", en], ["pl", pl]] as const) {
    assert.match(source, /<GalleryGrid lang=\{lang\}/, `${name} must render GalleryGrid`)
    assert.doesNotMatch(source, /modal-spinner|photo-btn/, `${name} must not keep a private lightbox copy`)
  }
})

test("shared lightbox keeps its loading and navigation behavior", () => {
  for (const pattern of [
    /id="modal-spinner"/,
    /modalSpinner!\.classList\.remove\("hidden"\)/,
    /modalSpinner!\.classList\.add\("hidden"\)/,
    /createDialogFocus/,
    /ArrowLeft/,
    /touchstart/,
  ]) {
    assert.match(shared, pattern)
  }
})
