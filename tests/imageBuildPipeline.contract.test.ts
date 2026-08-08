import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("../scripts/gen-placeholders.mjs", import.meta.url), "utf8")

test("image fingerprints stream source bytes instead of duplicating whole files in memory", () => {
  assert.match(source, /createReadStream\(file\)/)
  assert.doesNotMatch(source, /fingerprint = async file =>[^\n]*readFile\(file\)/)
})

test("responsive image generation avoids nested resize fan-out", () => {
  assert.match(source, /CONCURRENCY = Math\.max\(1, Math\.min\(4,/)
  assert.match(source, /await sharp\(file\)\.resize\(width/)
  assert.doesNotMatch(source, /Promise\.all\(tasks\)/)
})
