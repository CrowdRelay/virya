import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const en = readFileSync(new URL("../src/pages/gallery.astro", import.meta.url), "utf8")
const pl = readFileSync(new URL("../src/pages/pl/gallery.astro", import.meta.url), "utf8")

test("Polish and English gallery lightboxes share loading UX", () => {
  for (const source of [en, pl]) {
    assert.match(source, /id="modal-spinner"/)
    assert.match(source, /modalSpinner!\.classList\.remove\("hidden"\)/)
    assert.match(source, /modalSpinner!\.classList\.add\("hidden"\)/)
    assert.match(source, /bg-cover bg-center/)
  }
})
